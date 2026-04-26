import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FiscalReceipt, FiscalReceiptStatus } from './entities/fiscal-receipt.entity';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { EventBusService } from '../platform/events/event-bus.service';

@Injectable()
export class FiscalService {
  private readonly logger = new Logger(FiscalService.name);
  private readonly issuerMatricule: string;
  private readonly ttnEnabled: boolean;
  private readonly ttnEndpoint: string;
  private readonly ttnApiKey: string;
  private readonly TAX_RATE = 19;

  // Sequence used to build human-readable fiscal numbers (the real one will use a DB
  // sequence or external provider; this is good enough for first deploy).
  private sequenceCache: number | null = null;

  constructor(
    @InjectRepository(FiscalReceipt) private readonly recRepo: Repository<FiscalReceipt>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly eventBus: EventBusService,
    private readonly config: ConfigService,
  ) {
    this.issuerMatricule = this.config.get<string>('fiscal.issuerMatricule', '0000000A/A/M/000');
    this.ttnEnabled = this.config.get<boolean>('fiscal.ttnEnabled', false);
    this.ttnEndpoint = this.config.get<string>('fiscal.ttnEndpoint', '');
    this.ttnApiKey = this.config.get<string>('fiscal.ttnApiKey', '');
  }

  // Generate a fiscal receipt for one order. Idempotent: if a receipt already
  // exists for this order, returns the existing one instead of creating a duplicate.
  async generate(orderId: number): Promise<FiscalReceipt> {
    const existing = await this.recRepo.findOne({ where: { order_id: orderId } });
    if (existing) return existing;

    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('order not found');
    const user = order.user_id ? await this.userRepo.findOne({ where: { id: order.user_id } }) : null;

    const totalIncl = Number((order as any).total_amount || 0);
    const totalExcl = Math.round(totalIncl / (1 + this.TAX_RATE / 100) * 1000) / 1000;
    const totalTax = Math.round((totalIncl - totalExcl) * 1000) / 1000;

    if (this.sequenceCache == null) {
      const cnt = await this.recRepo.count();
      this.sequenceCache = cnt + 1;
    } else {
      this.sequenceCache++;
    }
    const fiscalNumber = `FAC-${new Date().getFullYear()}-${String(this.sequenceCache).padStart(7, '0')}`;

    const r = this.recRepo.create({
      fiscal_number: fiscalNumber,
      order_id: orderId,
      order_reference: (order as any).reference || `ORD-${orderId}`,
      fiscal_date: new Date(),
      issuer_matricule: this.issuerMatricule,
      customer_matricule: null,
      customer_name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : 'Client',
      total_excl_tax: totalExcl,
      total_tax: totalTax,
      total_incl_tax: totalIncl,
      status: FiscalReceiptStatus.PENDING,
      submission_payload: this.buildPayload(order, fiscalNumber, totalIncl, totalExcl, totalTax),
    });
    const saved = await this.recRepo.save(r);
    this.eventBus.publish('fiscal.receipt_created', { receiptId: saved.id, orderId, total: totalIncl }, {
      aggregateId: `fiscal:${saved.id}`,
    }).catch(() => {});

    // If TTN is configured, submit immediately. Otherwise stays PENDING for batch later.
    if (this.ttnEnabled) this.submitToTTN(saved.id).catch((e) => this.logger.warn(e?.message));
    return saved;
  }

  private buildPayload(order: any, fiscalNumber: string, totalIncl: number, totalExcl: number, tax: number) {
    return {
      fiscalNumber,
      orderReference: order.reference,
      issuedAt: new Date().toISOString(),
      issuer: { matricule: this.issuerMatricule, country: 'TN' },
      currency: 'TND',
      totals: { excl: totalExcl, tax, incl: totalIncl, vatRate: this.TAX_RATE },
    };
  }

  // Best-effort submission. The real TTN integration uses signed XML over a B2B
  // gateway; here we either POST to a dev mock endpoint or stamp locally if disabled.
  async submitToTTN(receiptId: number): Promise<FiscalReceipt> {
    const r = await this.recRepo.findOne({ where: { id: receiptId } });
    if (!r) throw new NotFoundException();
    if (r.status === FiscalReceiptStatus.STAMPED) return r;

    if (!this.ttnEnabled || !this.ttnEndpoint) {
      // Local stamping mode — useful in dev / before fiscal integration is live.
      r.status = FiscalReceiptStatus.STAMPED;
      r.ttn_stamp = `LOCAL-${Date.now().toString(36).toUpperCase()}`;
      r.ttn_reference = `DEV-${r.fiscal_number}`;
      await this.recRepo.save(r);
      this.eventBus.publish('fiscal.stamped', { receiptId: r.id, stamp: r.ttn_stamp, mode: 'local' }, {
        aggregateId: `fiscal:${r.id}`,
      }).catch(() => {});
      return r;
    }

    r.status = FiscalReceiptStatus.SUBMITTED;
    await this.recRepo.save(r);
    try {
      const res = await fetch(this.ttnEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.ttnApiKey}` },
        body: JSON.stringify(r.submission_payload),
        signal: AbortSignal.timeout(15_000),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `TTN HTTP ${res.status}`);
      r.status = FiscalReceiptStatus.STAMPED;
      r.ttn_stamp = data?.stamp || data?.fiscal_id;
      r.ttn_reference = data?.reference || null;
      await this.recRepo.save(r);
      this.eventBus.publish('fiscal.stamped', { receiptId: r.id, stamp: r.ttn_stamp, mode: 'ttn' }, {
        aggregateId: `fiscal:${r.id}`,
      }).catch(() => {});
    } catch (err: any) {
      r.status = FiscalReceiptStatus.REJECTED;
      r.last_error = (err?.message || 'unknown').slice(0, 500);
      await this.recRepo.save(r);
    }
    return r;
  }

  async retryPending(limit = 50) {
    const pending = await this.recRepo.find({ where: [{ status: FiscalReceiptStatus.PENDING }, { status: FiscalReceiptStatus.REJECTED }], take: limit });
    let ok = 0, fail = 0;
    for (const r of pending) {
      const updated = await this.submitToTTN(r.id);
      if (updated.status === FiscalReceiptStatus.STAMPED) ok++;
      else fail++;
    }
    return { processed: pending.length, stamped: ok, failed: fail };
  }

  async listReceipts(opts: { status?: string; limit?: number } = {}) {
    const qb = this.recRepo.createQueryBuilder('r').orderBy('r.created_at', 'DESC').take(Math.min(500, opts.limit || 100));
    if (opts.status) qb.andWhere('r.status = :s', { s: opts.status.toUpperCase() });
    return qb.getMany();
  }

  async stats() {
    const [total, stamped, pending, rejected] = await Promise.all([
      this.recRepo.count(),
      this.recRepo.count({ where: { status: FiscalReceiptStatus.STAMPED } }),
      this.recRepo.count({ where: { status: FiscalReceiptStatus.PENDING } }),
      this.recRepo.count({ where: { status: FiscalReceiptStatus.REJECTED } }),
    ]);
    return { total, stamped, pending, rejected, ttnEnabled: this.ttnEnabled };
  }

  // Monthly VAT report — what the accountant needs for the "déclaration mensuelle TVA".
  async vatReport(year: number, month: number) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const rows = await this.recRepo
      .createQueryBuilder('r')
      .where('r.fiscal_date >= :s AND r.fiscal_date < :e', { s: start, e: end })
      .andWhere('r.status = :st', { st: FiscalReceiptStatus.STAMPED })
      .select('SUM(r.total_excl_tax)', 'baseTax')
      .addSelect('SUM(r.total_tax)', 'totalTax')
      .addSelect('SUM(r.total_incl_tax)', 'totalIncl')
      .addSelect('COUNT(1)', 'cnt')
      .getRawOne();
    return {
      period: `${year}-${String(month).padStart(2, '0')}`,
      receiptCount: Number(rows?.cnt || 0),
      baseTax: Number(rows?.baseTax || 0),
      vatCollected: Number(rows?.totalTax || 0),
      grossInclTax: Number(rows?.totalIncl || 0),
      vatRate: this.TAX_RATE,
    };
  }
}
