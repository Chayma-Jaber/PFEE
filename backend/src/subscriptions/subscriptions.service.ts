import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';

import { Subscription, SubscriptionStatus } from './entities/subscription.entity';
import { SubscriptionCycle } from './entities/subscription-cycle.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { SmsService } from '../sms/sms.service';
import { EmailService } from '../email/email.service';
import { EventBusService } from '../platform/events/event-bus.service';

const ALLOWED_FREQUENCIES = [7, 14, 30, 60, 90];
const MAX_DUNNING_ATTEMPTS = 3;

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
    @InjectRepository(SubscriptionCycle) private readonly cycleRepo: Repository<SubscriptionCycle>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly sms: SmsService,
    private readonly email: EmailService,
    private readonly eventBus: EventBusService,
  ) {}

  // ═══ Customer-facing ══════════════════════════════════════════════════

  async listForUser(userId: number) {
    return this.subRepo.find({ where: { user_id: userId }, order: { created_at: 'DESC' } });
  }

  async create(userId: number, data: {
    productId: number;
    quantity?: number;
    frequencyDays: number;
    shippingAddressId?: number;
    paymentMethodId?: number;
  }) {
    if (!ALLOWED_FREQUENCIES.includes(data.frequencyDays)) {
      throw new BadRequestException(`frequencyDays must be one of ${ALLOWED_FREQUENCIES.join(',')}`);
    }
    const product = await this.productRepo.findOne({ where: { id: data.productId } });
    if (!product) throw new NotFoundException('Product not found');

    const now = new Date();
    const next = new Date(now.getTime() + data.frequencyDays * 86400000);

    const sub = this.subRepo.create({
      user_id: userId,
      product_id: data.productId,
      quantity: Math.max(1, Number(data.quantity || 1)),
      frequency_days: data.frequencyDays,
      discount_pct: 10,
      status: SubscriptionStatus.ACTIVE,
      next_charge_at: next,
      shipping_address_id: data.shippingAddressId ?? null,
      payment_method_id: data.paymentMethodId ?? null,
      total_cycles: 0,
      failed_attempts: 0,
    });
    const saved = await this.subRepo.save(sub);
    this.eventBus.publish('subscription.created', { subscriptionId: saved.id, userId, productId: data.productId }, {
      aggregateId: `subscription:${saved.id}`, actorId: userId,
    }).catch(() => {});
    return saved;
  }

  async pause(userId: number, id: number, untilISO?: string) {
    const s = await this.ownedOrThrow(userId, id);
    s.status = SubscriptionStatus.PAUSED;
    s.pause_until = untilISO ? new Date(untilISO) : null;
    await this.subRepo.save(s);
    this.eventBus.publish('subscription.paused', { subscriptionId: s.id, userId, until: s.pause_until }, {
      aggregateId: `subscription:${s.id}`, actorId: userId,
    }).catch(() => {});
    return s;
  }

  async resume(userId: number, id: number) {
    const s = await this.ownedOrThrow(userId, id);
    s.status = SubscriptionStatus.ACTIVE;
    s.pause_until = null;
    // If next_charge_at was in the past, push to today + frequency.
    if (s.next_charge_at.getTime() < Date.now()) {
      s.next_charge_at = new Date(Date.now() + s.frequency_days * 86400000);
    }
    await this.subRepo.save(s);
    this.eventBus.publish('subscription.resumed', { subscriptionId: s.id, userId }, {
      aggregateId: `subscription:${s.id}`, actorId: userId,
    }).catch(() => {});
    return s;
  }

  async cancel(userId: number, id: number, reason?: string) {
    const s = await this.ownedOrThrow(userId, id);
    s.status = SubscriptionStatus.CANCELLED;
    s.cancelled_at = new Date();
    s.cancel_reason = (reason || '').slice(0, 400) || 'Customer cancelled';
    await this.subRepo.save(s);
    this.eventBus.publish('subscription.cancelled', { subscriptionId: s.id, userId, reason }, {
      aggregateId: `subscription:${s.id}`, actorId: userId,
    }).catch(() => {});
    return s;
  }

  async skipNext(userId: number, id: number) {
    const s = await this.ownedOrThrow(userId, id);
    s.next_charge_at = new Date(s.next_charge_at.getTime() + s.frequency_days * 86400000);
    await this.subRepo.save(s);
    // Record a SKIPPED cycle for the log
    await this.cycleRepo.save(this.cycleRepo.create({
      subscription_id: s.id,
      cycle_number: s.total_cycles + 1,
      order_id: null,
      status: 'SKIPPED',
      amount: 0,
      scheduled_for: s.next_charge_at,
    }));
    return s;
  }

  private async ownedOrThrow(userId: number, id: number) {
    const s = await this.subRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException();
    if (s.user_id !== userId) throw new ForbiddenException();
    return s;
  }

  // ═══ Cron: process due subscriptions ═══════════════════════════════════

  async processDue(limit = 100) {
    const now = new Date();
    const due = await this.subRepo.find({
      where: { status: SubscriptionStatus.ACTIVE, next_charge_at: LessThanOrEqual(now) },
      take: limit,
    });

    let processed = 0, failed = 0;
    for (const s of due) {
      try {
        // Check pause_until boundary
        if (s.pause_until && s.pause_until.getTime() > Date.now()) continue;

        const product = await this.productRepo.findOne({ where: { id: s.product_id } });
        if (!product) { await this.markFailed(s, 'product_missing'); failed++; continue; }
        const user = await this.userRepo.findOne({ where: { id: s.user_id } });
        if (!user) { await this.markFailed(s, 'user_missing'); failed++; continue; }

        // Create a lightweight recurring order. We don't run the full legacy /api/placeOrder
        // here — instead we create an Order row directly with the subscription reference.
        const unit = Number((product as any).currentPrice || 0);
        const disc = (unit * s.discount_pct) / 100;
        const subtotal = Math.max(0, unit - disc) * s.quantity;

        const orderEntity = this.orderRepo.create({
          user_id: s.user_id,
          reference: `SUB-${s.id}-${s.total_cycles + 1}-${Date.now().toString().slice(-6)}`,
          status: OrderStatus.CONFIRMED,
          payment_status: 'PENDING',
          subtotal,
          discount_amount: disc * s.quantity,
          shipping_amount: 0,
          total_amount: subtotal,
          notes: `Subscription #${s.id} cycle ${s.total_cycles + 1}`,
        } as any) as unknown as Order;
        const savedOrder = await this.orderRepo.save(orderEntity) as Order;

        const cycle = this.cycleRepo.create({
          subscription_id: s.id,
          cycle_number: s.total_cycles + 1,
          order_id: savedOrder.id,
          status: 'SUCCESS',
          amount: subtotal,
          scheduled_for: s.next_charge_at,
          attempted_at: new Date(),
        });
        await this.cycleRepo.save(cycle);

        s.total_cycles += 1;
        s.failed_attempts = 0;
        s.last_error = null;
        s.next_charge_at = new Date(Date.now() + s.frequency_days * 86400000);
        await this.subRepo.save(s);

        // Notify
        if (user.phone) {
          this.sms.sendOrderConfirmation(user.phone, savedOrder.reference, user.id).catch(() => {});
        }
        if (user.email) {
          this.email.sendOrderConfirmation({
            id: savedOrder.id, orderNumber: savedOrder.reference, customerEmail: user.email,
            customerName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
            totalAmount: subtotal, items: [{ name: product.title, quantity: s.quantity, price: unit }],
          } as any).catch(() => {});
        }

        this.eventBus.publish('subscription.charged', {
          subscriptionId: s.id, orderId: savedOrder.id, amount: subtotal, cycle: s.total_cycles,
        }, { aggregateId: `subscription:${s.id}`, actorId: s.user_id }).catch(() => {});

        processed++;
      } catch (err: any) {
        await this.markFailed(s, err?.message || 'unknown');
        failed++;
      }
    }

    return { processed, failed, considered: due.length };
  }

  private async markFailed(s: Subscription, reason: string) {
    s.failed_attempts += 1;
    s.last_error = reason.slice(0, 400);
    // Move the due time forward by 1 day so we retry tomorrow
    s.next_charge_at = new Date(Date.now() + 86400000);
    if (s.failed_attempts >= MAX_DUNNING_ATTEMPTS) {
      s.status = SubscriptionStatus.PAST_DUE;
    }
    await this.subRepo.save(s);
    await this.cycleRepo.save(this.cycleRepo.create({
      subscription_id: s.id,
      cycle_number: s.total_cycles + 1,
      order_id: null,
      status: 'FAILED',
      amount: 0,
      error_message: reason.slice(0, 400),
      scheduled_for: s.next_charge_at,
      attempted_at: new Date(),
    }));
    this.eventBus.publish('subscription.payment_failed', {
      subscriptionId: s.id, attempt: s.failed_attempts, reason,
    }, { aggregateId: `subscription:${s.id}`, actorId: s.user_id }).catch(() => {});
  }

  // ═══ Admin ═════════════════════════════════════════════════════════════

  adminList(status?: string, limit = 100) {
    const qb = this.subRepo.createQueryBuilder('s').orderBy('s.created_at', 'DESC').take(Math.min(500, limit));
    if (status) qb.andWhere('s.status = :st', { st: status.toUpperCase() });
    return qb.getMany();
  }

  async stats() {
    const [total, active, paused, cancelled, pastDue] = await Promise.all([
      this.subRepo.count(),
      this.subRepo.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      this.subRepo.count({ where: { status: SubscriptionStatus.PAUSED } }),
      this.subRepo.count({ where: { status: SubscriptionStatus.CANCELLED } }),
      this.subRepo.count({ where: { status: SubscriptionStatus.PAST_DUE } }),
    ]);
    const mrr = await this.subRepo
      .createQueryBuilder('s')
      .leftJoin(Product, 'p', 'p.id = s.product_id')
      .select('SUM(p.current_price * s.quantity * (1 - s.discount_pct / 100.0) * (30.0 / s.frequency_days))', 'mrr')
      .where('s.status = :st', { st: SubscriptionStatus.ACTIVE })
      .getRawOne();
    return { total, active, paused, cancelled, pastDue, estimatedMRR: Math.round(Number(mrr?.mrr || 0)) };
  }
}
