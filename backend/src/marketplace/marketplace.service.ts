import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';

import { Seller, SellerStatus } from './entities/seller.entity';
import { SellerPayout } from './entities/seller-payout.entity';
import { Order } from '../orders/entities/order.entity';
import { EventBusService } from '../platform/events/event-bus.service';

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    @InjectRepository(Seller) private readonly sellerRepo: Repository<Seller>,
    @InjectRepository(SellerPayout) private readonly payoutRepo: Repository<SellerPayout>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    private readonly eventBus: EventBusService,
  ) {}

  // ═══ Seller onboarding (self-service) ═════════════════════════════════

  async apply(userId: number, data: {
    businessName: string; contactEmail: string; contactPhone?: string;
    legalName?: string; vatNumber?: string; description?: string; logoUrl?: string;
    payoutIban?: string; payoutBankName?: string; slug?: string;
  }) {
    if (!data.businessName || !data.contactEmail) throw new BadRequestException('business name + contact email requis');
    const existing = await this.sellerRepo.findOne({ where: { owner_user_id: userId } });
    if (existing) throw new BadRequestException('Vous avez déjà un profil vendeur');

    const slug = (data.slug || data.businessName)
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

    const seller = this.sellerRepo.create({
      owner_user_id: userId,
      slug: await this.uniqueSlug(slug || `seller-${userId}`),
      business_name: data.businessName,
      legal_name: data.legalName || null,
      vat_number: data.vatNumber || null,
      description: data.description || null,
      logo_url: data.logoUrl || null,
      contact_email: data.contactEmail,
      contact_phone: data.contactPhone || null,
      commission_pct: 15,
      payout_iban: data.payoutIban || null,
      payout_bank_name: data.payoutBankName || null,
      status: SellerStatus.PENDING,
    });
    const saved = await this.sellerRepo.save(seller);
    this.eventBus.publish('seller.applied', { sellerId: saved.id, userId }, {
      aggregateId: `seller:${saved.id}`, actorId: userId,
    }).catch(() => {});
    return saved;
  }

  private async uniqueSlug(base: string): Promise<string> {
    let s = base, n = 1;
    while (await this.sellerRepo.findOne({ where: { slug: s } })) {
      n++;
      s = `${base}-${n}`;
      if (n > 50) break;
    }
    return s;
  }

  async getMine(userId: number) {
    return this.sellerRepo.findOne({ where: { owner_user_id: userId } });
  }

  async updateMine(userId: number, patch: Partial<Seller>) {
    const s = await this.sellerRepo.findOne({ where: { owner_user_id: userId } });
    if (!s) throw new NotFoundException();
    // Sellers can't change protected fields
    delete (patch as any).status;
    delete (patch as any).commission_pct;
    delete (patch as any).approved_by;
    Object.assign(s, patch);
    return this.sellerRepo.save(s);
  }

  // ═══ Admin moderation ═════════════════════════════════════════════════

  adminList(status?: string) {
    const qb = this.sellerRepo.createQueryBuilder('s').orderBy('s.created_at', 'DESC');
    if (status) qb.andWhere('s.status = :st', { st: status.toUpperCase() });
    return qb.getMany();
  }

  async approve(sellerId: number, adminId: number, commissionPct?: number) {
    const s = await this.sellerRepo.findOne({ where: { id: sellerId } });
    if (!s) throw new NotFoundException();
    s.status = SellerStatus.APPROVED;
    s.approved_at = new Date();
    s.approved_by = adminId;
    if (commissionPct != null) s.commission_pct = Number(commissionPct);
    await this.sellerRepo.save(s);
    this.eventBus.publish('seller.approved', { sellerId, adminId }, { aggregateId: `seller:${sellerId}`, actorId: adminId }).catch(() => {});
    return s;
  }

  async reject(sellerId: number, adminId: number, reason: string) {
    const s = await this.sellerRepo.findOne({ where: { id: sellerId } });
    if (!s) throw new NotFoundException();
    s.status = SellerStatus.REJECTED;
    s.rejection_reason = reason.slice(0, 500);
    s.approved_by = adminId;
    await this.sellerRepo.save(s);
    return s;
  }

  async suspend(sellerId: number, adminId: number, reason: string) {
    const s = await this.sellerRepo.findOne({ where: { id: sellerId } });
    if (!s) throw new NotFoundException();
    s.status = SellerStatus.SUSPENDED;
    s.rejection_reason = reason.slice(0, 500);
    s.approved_by = adminId;
    await this.sellerRepo.save(s);
    this.eventBus.publish('seller.suspended', { sellerId, reason }, { aggregateId: `seller:${sellerId}`, actorId: adminId }).catch(() => {});
    return s;
  }

  // ═══ Payouts ═══════════════════════════════════════════════════════════

  // Compute a payout for one seller covering [start, end). Uses orders' items linked via
  // `seller_id` on the product (wired below in marketplace controller). For now we use a
  // simplified calc over all orders whose notes carry a "seller:<id>" tag.
  async computePayout(sellerId: number, start: Date, end: Date) {
    const seller = await this.sellerRepo.findOne({ where: { id: sellerId } });
    if (!seller) throw new NotFoundException();

    // Orders between the two dates
    const orders = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.created_at >= :s AND o.created_at < :e', { s: start, e: end })
      .andWhere("o.status IN ('CONFIRMED','DELIVERED','COMPLETED')")
      .andWhere('o.notes LIKE :tag', { tag: `%[seller:${sellerId}]%` })
      .getMany();

    const gross = orders.reduce((sum, o) => sum + Number((o as any).total_amount || 0), 0);
    const commission = Math.round(gross * Number(seller.commission_pct) / 100 * 1000) / 1000;
    const refunds = 0;
    const net = Math.max(0, gross - commission - refunds);

    const payout = this.payoutRepo.create({
      seller_id: sellerId,
      period_start: start,
      period_end: end,
      gross_sales: gross,
      commission_amount: commission,
      refund_amount: refunds,
      net_payout: net,
      order_count: orders.length,
      status: 'PENDING',
    });
    const saved = await this.payoutRepo.save(payout);
    this.eventBus.publish('payout.created', { payoutId: saved.id, sellerId, amount: net }, {
      aggregateId: `payout:${saved.id}`,
    }).catch(() => {});
    return saved;
  }

  async markPaid(payoutId: number, reference: string) {
    const p = await this.payoutRepo.findOne({ where: { id: payoutId } });
    if (!p) throw new NotFoundException();
    if (p.status === 'PAID') return p;
    p.status = 'PAID';
    p.paid_at = new Date();
    p.payment_reference = reference?.slice(0, 100) || null;
    await this.payoutRepo.save(p);
    this.eventBus.publish('payout.paid', { payoutId, sellerId: p.seller_id, amount: Number(p.net_payout) }, {
      aggregateId: `payout:${payoutId}`,
    }).catch(() => {});
    return p;
  }

  listPayoutsForSeller(sellerId: number) {
    return this.payoutRepo.find({ where: { seller_id: sellerId }, order: { period_end: 'DESC' } });
  }

  listAllPayouts(status?: string) {
    const qb = this.payoutRepo.createQueryBuilder('p').orderBy('p.created_at', 'DESC');
    if (status) qb.andWhere('p.status = :s', { s: status.toUpperCase() });
    return qb.getMany();
  }

  // ═══ Stats for admin dashboard ═════════════════════════════════════════

  async stats() {
    const [total, approved, pending, suspended, pendingPayouts] = await Promise.all([
      this.sellerRepo.count(),
      this.sellerRepo.count({ where: { status: SellerStatus.APPROVED } }),
      this.sellerRepo.count({ where: { status: SellerStatus.PENDING } }),
      this.sellerRepo.count({ where: { status: SellerStatus.SUSPENDED } }),
      this.payoutRepo.count({ where: { status: 'PENDING' } }),
    ]);
    return { total, approved, pending, suspended, pendingPayouts };
  }
}
