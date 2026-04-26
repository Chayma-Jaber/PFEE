import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductDrop, DropStatus } from './entities/product-drop.entity';
import { PreorderReservation, ReservationStatus } from './entities/preorder-reservation.entity';
import { Product } from '../products/entities/product.entity';
import { EventBusService } from '../platform/events/event-bus.service';

@Injectable()
export class PreorderService {
  private readonly logger = new Logger(PreorderService.name);

  constructor(
    @InjectRepository(ProductDrop) private readonly dropRepo: Repository<ProductDrop>,
    @InjectRepository(PreorderReservation) private readonly resRepo: Repository<PreorderReservation>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    private readonly eventBus: EventBusService,
  ) {}

  // ═══ Admin — drop CRUD ════════════════════════════════════════════════

  listDrops(active = true) {
    const qb = this.dropRepo.createQueryBuilder('d').orderBy('d.preorder_start', 'DESC');
    if (active) qb.andWhere("d.status IN ('SCHEDULED','PREORDER_OPEN','WAITLIST','LIVE')");
    return qb.getMany();
  }

  async createDrop(data: {
    productId: number; capacity: number; depositPct?: number;
    preorderStart: string; preorderEnd: string; expectedShipDate?: string;
    headline?: string; allowWaitlist?: boolean;
  }) {
    const product = await this.productRepo.findOne({ where: { id: data.productId } });
    if (!product) throw new NotFoundException('Product not found');
    const d = this.dropRepo.create({
      product_id: data.productId,
      headline: data.headline || null,
      capacity: Math.max(1, Number(data.capacity)),
      reserved_count: 0,
      deposit_pct: Math.max(0, Math.min(100, Number(data.depositPct ?? 20))),
      preorder_start: new Date(data.preorderStart),
      preorder_end: new Date(data.preorderEnd),
      expected_ship_date: data.expectedShipDate ? new Date(data.expectedShipDate) : null,
      status: new Date(data.preorderStart) <= new Date() ? DropStatus.PREORDER_OPEN : DropStatus.SCHEDULED,
      allow_waitlist: data.allowWaitlist !== false,
    });
    return this.dropRepo.save(d);
  }

  async updateDrop(id: number, patch: Partial<ProductDrop>) {
    const d = await this.dropRepo.findOne({ where: { id } });
    if (!d) throw new NotFoundException();
    Object.assign(d, patch);
    return this.dropRepo.save(d);
  }

  async closeDrop(id: number) {
    const d = await this.dropRepo.findOne({ where: { id } });
    if (!d) throw new NotFoundException();
    d.status = DropStatus.CLOSED;
    return this.dropRepo.save(d);
  }

  async goLive(id: number) {
    const d = await this.dropRepo.findOne({ where: { id } });
    if (!d) throw new NotFoundException();
    d.status = DropStatus.LIVE;
    await this.dropRepo.save(d);
    // Notify all deposited reservations (event — lifecycle marketing handler picks it up)
    const deposited = await this.resRepo.find({ where: { drop_id: id, status: ReservationStatus.DEPOSITED } });
    for (const r of deposited) {
      this.eventBus.publish('preorder.ready', { dropId: id, reservationId: r.id, userId: r.user_id }, {
        aggregateId: `preorder:${r.id}`, actorId: r.user_id,
      }).catch(() => {});
    }
    return d;
  }

  // ═══ Customer-facing ══════════════════════════════════════════════════

  async activeDropForProduct(productId: number) {
    return this.dropRepo.findOne({
      where: [
        { product_id: productId, status: DropStatus.PREORDER_OPEN },
        { product_id: productId, status: DropStatus.WAITLIST },
        { product_id: productId, status: DropStatus.LIVE },
      ],
      order: { preorder_start: 'DESC' },
    });
  }

  async reserve(userId: number, dropId: number, quantity = 1) {
    const d = await this.dropRepo.findOne({ where: { id: dropId } });
    if (!d) throw new NotFoundException();
    const now = new Date();
    if (d.preorder_start > now) throw new BadRequestException('Préouverture non encore ouverte');
    if (d.preorder_end < now) throw new BadRequestException('Période de précommande terminée');
    if (d.status === DropStatus.CLOSED) throw new BadRequestException('Drop clôturé');

    // Already reserved?
    const existing = await this.resRepo.findOne({ where: { drop_id: dropId, user_id: userId } });
    if (existing) return existing;

    const qty = Math.max(1, Number(quantity));
    const wouldExceed = d.reserved_count + qty > d.capacity;
    const goingWaitlist = wouldExceed && d.allow_waitlist;

    const product = await this.productRepo.findOne({ where: { id: d.product_id } });
    const unit = Number((product as any)?.currentPrice || 0);
    const deposit = Math.round(unit * qty * d.deposit_pct / 100 * 1000) / 1000;
    const balance = Math.round((unit * qty - deposit) * 1000) / 1000;

    let position: number | null = null;
    if (goingWaitlist) {
      const waiting = await this.resRepo.count({ where: { drop_id: dropId, status: ReservationStatus.WAITLIST } });
      position = waiting + 1;
    } else if (wouldExceed) {
      throw new BadRequestException('Capacité atteinte');
    }

    const r = this.resRepo.create({
      drop_id: dropId,
      user_id: userId,
      quantity: qty,
      deposit_amount: deposit,
      balance_amount: balance,
      status: goingWaitlist ? ReservationStatus.WAITLIST : ReservationStatus.PENDING,
      waitlist_position: position,
    });
    const saved = await this.resRepo.save(r);

    if (!goingWaitlist) {
      d.reserved_count += qty;
      if (d.reserved_count >= d.capacity) d.status = DropStatus.SOLD_OUT;
      await this.dropRepo.save(d);
    } else if (d.status === DropStatus.PREORDER_OPEN) {
      d.status = DropStatus.WAITLIST;
      await this.dropRepo.save(d);
    }

    this.eventBus.publish('preorder.reserved', { dropId, reservationId: saved.id, userId, status: saved.status }, {
      aggregateId: `preorder:${saved.id}`, actorId: userId,
    }).catch(() => {});

    return saved;
  }

  // Mark a reservation's deposit as captured. In a real checkout this is called from the
  // payment webhook; here exposed to admin for manual recording.
  async confirmDeposit(reservationId: number) {
    const r = await this.resRepo.findOne({ where: { id: reservationId } });
    if (!r) throw new NotFoundException();
    if (r.status !== ReservationStatus.PENDING && r.status !== ReservationStatus.WAITLIST) return r;
    r.status = ReservationStatus.DEPOSITED;
    r.deposit_paid_at = new Date();
    r.waitlist_position = null;
    await this.resRepo.save(r);
    this.eventBus.publish('preorder.deposit_captured', { reservationId, userId: r.user_id }, {
      aggregateId: `preorder:${reservationId}`, actorId: r.user_id,
    }).catch(() => {});
    return r;
  }

  async cancelReservation(userId: number, reservationId: number) {
    const r = await this.resRepo.findOne({ where: { id: reservationId } });
    if (!r) throw new NotFoundException();
    if (r.user_id !== userId) throw new BadRequestException();
    const wasWaitlist = r.status === ReservationStatus.WAITLIST;
    r.status = ReservationStatus.CANCELLED;
    await this.resRepo.save(r);
    const d = await this.dropRepo.findOne({ where: { id: r.drop_id } });
    if (d && !wasWaitlist) {
      d.reserved_count = Math.max(0, d.reserved_count - r.quantity);
      if (d.status === DropStatus.SOLD_OUT) d.status = DropStatus.PREORDER_OPEN;
      await this.dropRepo.save(d);
    }
    return r;
  }

  listMine(userId: number) {
    return this.resRepo.find({ where: { user_id: userId }, order: { created_at: 'DESC' } });
  }

  async stats() {
    const [drops, active, reservations, waitlisted] = await Promise.all([
      this.dropRepo.count(),
      this.dropRepo.count({ where: { status: DropStatus.PREORDER_OPEN } }),
      this.resRepo.count(),
      this.resRepo.count({ where: { status: ReservationStatus.WAITLIST } }),
    ]);
    return { drops, active, reservations, waitlisted };
  }
}
