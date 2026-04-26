import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';

import { FraudSignal, FraudStatus } from './entities/fraud-signal.entity';
import { DeviceFingerprint } from './entities/device-fingerprint.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { EventBusService } from '../platform/events/event-bus.service';

export interface ScoreInput {
  orderId: number;
  userId: number | null;
  totalAmount: number;
  fingerprint?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  country?: string | null;
  shippingCity?: string | null;
}

export interface ScoreResult {
  score: number;
  status: FraudStatus;
  rulesTriggered: string[];
  details: Record<string, any>;
}

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  // Thresholds — tunable. Keep here so rules engine is explicit.
  private readonly REVIEW_THRESHOLD = 45;
  private readonly HOLD_THRESHOLD = 70;

  // Per-user order velocity window (hours)
  private readonly VELOCITY_WINDOW_HOURS = 1;
  private readonly VELOCITY_WINDOW_MAX_ORDERS = 4;

  constructor(
    @InjectRepository(FraudSignal) private readonly signalRepo: Repository<FraudSignal>,
    @InjectRepository(DeviceFingerprint) private readonly fpRepo: Repository<DeviceFingerprint>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly eventBus: EventBusService,
  ) {}

  // Capture or update a device fingerprint.
  async recordFingerprint(input: {
    fingerprint: string; userId?: number | null; ip?: string | null;
    userAgent?: string | null; timezone?: string | null; screenResolution?: string | null;
  }): Promise<DeviceFingerprint> {
    let fp = await this.fpRepo.findOne({ where: { fingerprint_hash: input.fingerprint } });
    if (!fp) {
      fp = this.fpRepo.create({
        fingerprint_hash: input.fingerprint,
        user_id: input.userId ?? null,
        ip_address: input.ip || null,
        user_agent: input.userAgent || null,
        timezone: input.timezone || null,
        screen_resolution: input.screenResolution || null,
        session_count: 1,
      });
    } else {
      fp.session_count = (fp.session_count || 0) + 1;
      if (input.userId && !fp.user_id) fp.user_id = input.userId;
      if (input.ip) fp.ip_address = input.ip;
    }
    return this.fpRepo.save(fp);
  }

  // Core scoring. Runs a battery of rules and returns a score 0..100.
  async scoreOrder(input: ScoreInput): Promise<ScoreResult> {
    const rulesTriggered: string[] = [];
    const details: Record<string, any> = {};
    let score = 0;

    // Rule 1 — Velocity: too many orders in 1h for this user
    if (input.userId) {
      const since = new Date(Date.now() - this.VELOCITY_WINDOW_HOURS * 3600 * 1000);
      const recent = await this.orderRepo.count({
        where: { user_id: input.userId, created_at: MoreThan(since) },
      });
      details.recentOrders1h = recent;
      if (recent >= this.VELOCITY_WINDOW_MAX_ORDERS) {
        rulesTriggered.push(`VELOCITY_${recent}_IN_${this.VELOCITY_WINDOW_HOURS}H`);
        score += 25;
      }
    }

    // Rule 2 — High-value new account (first order > 500 TND)
    if (input.userId) {
      const user = await this.userRepo.findOne({ where: { id: input.userId } });
      if (user) {
        const ageDays = (Date.now() - new Date(user.created_at).getTime()) / 86400000;
        const prev = await this.orderRepo.count({ where: { user_id: input.userId } });
        details.accountAgeDays = Math.round(ageDays);
        details.previousOrders = Math.max(0, prev - 1); // exclude current
        if (prev <= 1 && input.totalAmount > 500 && ageDays < 1) {
          rulesTriggered.push('HIGH_VALUE_BRAND_NEW_ACCOUNT');
          score += 30;
        } else if (prev <= 1 && input.totalAmount > 300 && ageDays < 7) {
          rulesTriggered.push('HIGH_VALUE_YOUNG_ACCOUNT');
          score += 15;
        }
      }
    } else if (input.totalAmount > 300) {
      rulesTriggered.push('HIGH_VALUE_GUEST');
      score += 20;
    }

    // Rule 3 — Device sharing: fingerprint associated with ≥3 distinct users
    if (input.fingerprint) {
      const fp = await this.fpRepo.findOne({ where: { fingerprint_hash: input.fingerprint } });
      if (fp) {
        const distinctUsers = await this.fpRepo
          .createQueryBuilder('f')
          .select('COUNT(DISTINCT f.user_id)', 'c')
          .where('f.fingerprint_hash = :h', { h: input.fingerprint })
          .andWhere('f.user_id IS NOT NULL')
          .getRawOne();
        const cnt = Number(distinctUsers?.c || 0);
        details.fingerprintDistinctUsers = cnt;
        if (cnt >= 3) {
          rulesTriggered.push(`DEVICE_SHARED_${cnt}_USERS`);
          score += 20;
        }
      }
    }

    // Rule 4 — History: user has had a rejected order before
    if (input.userId) {
      const rejections = await this.signalRepo.count({
        where: { user_id: input.userId, status: FraudStatus.REJECTED },
      });
      details.pastRejections = rejections;
      if (rejections > 0) {
        rulesTriggered.push(`PAST_REJECTIONS_${rejections}`);
        score += Math.min(40, rejections * 20);
      }
    }

    // Rule 5 — Missing phone on high-value order
    if (input.userId) {
      const user = await this.userRepo.findOne({ where: { id: input.userId } });
      if (user && !user.phone && input.totalAmount > 300) {
        rulesTriggered.push('NO_PHONE_HIGH_VALUE');
        score += 10;
      }
    }

    // Rule 6 — Country / city implausible
    if (input.country && input.country.toUpperCase() !== 'TN' && input.country.toUpperCase() !== 'TUNISIA') {
      details.country = input.country;
      rulesTriggered.push(`FOREIGN_COUNTRY_${input.country.toUpperCase()}`);
      score += 15;
    }

    score = Math.min(100, Math.max(0, score));

    let status: FraudStatus = FraudStatus.CLEAR;
    if (score >= this.HOLD_THRESHOLD) status = FraudStatus.HELD;
    else if (score >= this.REVIEW_THRESHOLD) status = FraudStatus.REVIEW;

    return { score, status, rulesTriggered, details };
  }

  // Persist a signal, optionally hold the order.
  async record(orderId: number, input: ScoreInput): Promise<{ signal: FraudSignal; held: boolean }> {
    const result = await this.scoreOrder({ ...input, orderId });
    const signal = await this.signalRepo.save(this.signalRepo.create({
      order_id: orderId,
      user_id: input.userId,
      score: result.score,
      status: result.status,
      rules_triggered: result.rulesTriggered,
      details: result.details,
    }));

    let held = false;
    if (result.status === FraudStatus.HELD) {
      const order = await this.orderRepo.findOne({ where: { id: orderId } });
      if (order && order.status !== OrderStatus.CANCELLED) {
        order.status = OrderStatus.PAYMENT_PENDING;
        order.notes = [
          order.notes || '',
          `[FRAUD HOLD] score=${result.score} rules=${result.rulesTriggered.join(',')}`,
        ].filter(Boolean).join('\n');
        await this.orderRepo.save(order);
        held = true;
      }
    }

    // Emit event for downstream consumers (lifecycle marketing suppresses, observability logs)
    this.eventBus.publish(
      held ? 'fraud.held' : (result.status === FraudStatus.REVIEW ? 'fraud.review' : 'fraud.cleared'),
      { orderId, userId: input.userId, score: result.score, rules: result.rulesTriggered },
      { aggregateId: `order:${orderId}`, actorId: input.userId ?? undefined },
    ).catch(() => {});

    return { signal, held };
  }

  // Admin queue
  listForReview(opts: { limit?: number; status?: FraudStatus } = {}) {
    const qb = this.signalRepo.createQueryBuilder('s').orderBy('s.score', 'DESC').addOrderBy('s.created_at', 'DESC');
    if (opts.status) qb.andWhere('s.status = :st', { st: opts.status });
    else qb.andWhere('s.status IN (:...sts)', { sts: [FraudStatus.REVIEW, FraudStatus.HELD] });
    qb.take(Math.max(1, Math.min(opts.limit || 50, 200)));
    return qb.getMany();
  }

  async stats() {
    const [total, held, review, rejected, approved] = await Promise.all([
      this.signalRepo.count(),
      this.signalRepo.count({ where: { status: FraudStatus.HELD } }),
      this.signalRepo.count({ where: { status: FraudStatus.REVIEW } }),
      this.signalRepo.count({ where: { status: FraudStatus.REJECTED } }),
      this.signalRepo.count({ where: { status: FraudStatus.APPROVED } }),
    ]);
    return { total, held, review, rejected, approved };
  }

  async approve(signalId: number, adminId: number, note?: string) {
    const s = await this.signalRepo.findOne({ where: { id: signalId } });
    if (!s) throw new NotFoundException();
    s.status = FraudStatus.APPROVED;
    s.reviewed_by = adminId;
    s.reviewed_at = new Date();
    s.review_note = note?.slice(0, 500) || null;
    await this.signalRepo.save(s);

    // Unhold the order
    const order = await this.orderRepo.findOne({ where: { id: s.order_id } });
    if (order && order.status === OrderStatus.PAYMENT_PENDING) {
      order.status = OrderStatus.CONFIRMED;
      await this.orderRepo.save(order);
    }
    this.eventBus.publish('fraud.approved', { signalId: s.id, orderId: s.order_id, adminId }, { aggregateId: `order:${s.order_id}`, actorId: adminId }).catch(() => {});
    return s;
  }

  async reject(signalId: number, adminId: number, note?: string) {
    const s = await this.signalRepo.findOne({ where: { id: signalId } });
    if (!s) throw new NotFoundException();
    s.status = FraudStatus.REJECTED;
    s.reviewed_by = adminId;
    s.reviewed_at = new Date();
    s.review_note = note?.slice(0, 500) || null;
    await this.signalRepo.save(s);

    const order = await this.orderRepo.findOne({ where: { id: s.order_id } });
    if (order && order.status !== OrderStatus.CANCELLED) {
      order.status = OrderStatus.CANCELLED;
      order.cancelled_at = new Date();
      order.cancel_reason = `Fraud rejection: ${note || 'admin review'}`;
      await this.orderRepo.save(order);
    }
    this.eventBus.publish('fraud.rejected', { signalId: s.id, orderId: s.order_id, adminId }, { aggregateId: `order:${s.order_id}`, actorId: adminId }).catch(() => {});
    return s;
  }
}
