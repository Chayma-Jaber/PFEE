import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CustomerSignal } from '../wave4/wave4.entities';
import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { EventBusService } from '../platform/events/event-bus.service';

export interface PropensityScores {
  userId: number;
  email: string | null;
  name: string | null;
  // Existing wave4 signals (we read them, don't duplicate)
  clv: number;
  churnScore: number;
  daysSinceLastOrder: number | null;
  // New propensity outputs
  nextPurchaseInDays: number | null;     // expected number of days until next order
  nextPurchaseConfidence: number;         // 0..1
  predictedNextCategory: string | null;
  refundProbability: number;              // 0..1
  vipUpgradeProbability: number;          // 0..1
  recommendedActions: string[];
  lifecycleStage: 'NEW' | 'GROWING' | 'LOYAL' | 'AT_RISK' | 'LAPSED';
}

@Injectable()
export class PropensityService {
  private readonly logger = new Logger(PropensityService.name);

  constructor(
    @InjectRepository(CustomerSignal) private readonly signalRepo: Repository<CustomerSignal>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    private readonly eventBus: EventBusService,
  ) {}

  async scoreUser(userId: number): Promise<PropensityScores> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new Error('user not found');

    const signal = await this.signalRepo.findOne({ where: { user_id: userId } });
    const clv = Number(signal?.clv || 0);
    const churn = Number(signal?.churn_score || 0);
    const daysSince = signal?.days_since_last_order ?? null;

    // Pull last 10 orders for cadence + categories
    const recentOrders = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoin('order_items', 'oi', 'oi.order_id = o.id')
      .leftJoin('products', 'p', 'p.id = oi.product_id')
      .select([
        'o.id AS oid',
        'o.created_at AS createdAt',
        'p.famille AS famille',
      ])
      .where('o.user_id = :u', { u: userId })
      .andWhere("o.status NOT IN ('cancelled','failed','CANCELLED','FAILED')")
      .orderBy('o.created_at', 'DESC')
      .limit(50)
      .getRawMany();

    // Average inter-order interval (in days)
    const orderTimes = recentOrders
      .map((r) => new Date(r.createdAt).getTime())
      .filter(Boolean)
      .sort((a, b) => a - b);
    let avgGapDays: number | null = null;
    if (orderTimes.length >= 2) {
      let sum = 0;
      for (let i = 1; i < orderTimes.length; i++) sum += (orderTimes[i] - orderTimes[i - 1]) / 86400000;
      avgGapDays = sum / (orderTimes.length - 1);
    }

    let nextPurchaseInDays: number | null = null;
    if (avgGapDays != null && daysSince != null) {
      // Predicted = max(0, avgGap - daysSince). If overdue, returns 0.
      nextPurchaseInDays = Math.max(0, Math.round(avgGapDays - daysSince));
    }
    const nextPurchaseConfidence = orderTimes.length >= 4 ? 0.8 : orderTimes.length >= 2 ? 0.5 : 0.2;

    // Predicted next category = most frequent in last 5 orders
    const cats = recentOrders.map((r) => r.famille).filter(Boolean) as string[];
    let predictedNextCategory: string | null = null;
    if (cats.length > 0) {
      const counts = new Map<string, number>();
      cats.forEach((c) => counts.set(c, (counts.get(c) || 0) + 1));
      predictedNextCategory = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }

    // Simple refund probability: ratio of cancelled/refunded orders
    const cancelled = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.user_id = :u', { u: userId })
      .andWhere("o.status IN ('cancelled','CANCELLED','REFUNDED')")
      .getCount();
    const totalEver = await this.orderRepo.count({ where: { user_id: userId } });
    const refundProbability = totalEver > 0 ? Math.min(1, cancelled / totalEver) : 0;

    // VIP upgrade probability: function of CLV growth + low churn + multiple orders
    let vipUpgradeProbability = 0;
    if (clv > 1500) vipUpgradeProbability = 0.85;
    else if (clv > 800 && churn < 50) vipUpgradeProbability = 0.55;
    else if (totalEver >= 3 && churn < 30) vipUpgradeProbability = 0.35;
    else vipUpgradeProbability = 0.1;

    // Lifecycle stage
    let lifecycleStage: PropensityScores['lifecycleStage'] = 'NEW';
    if (totalEver === 0) lifecycleStage = 'NEW';
    else if (churn >= 80) lifecycleStage = 'LAPSED';
    else if (churn >= 60) lifecycleStage = 'AT_RISK';
    else if (totalEver >= 3 && churn < 30) lifecycleStage = 'LOYAL';
    else if (totalEver >= 1) lifecycleStage = 'GROWING';

    // Recommended actions
    const actions: string[] = [];
    if (lifecycleStage === 'AT_RISK' || lifecycleStage === 'LAPSED') actions.push('Send winback offer');
    if (lifecycleStage === 'LOYAL' && vipUpgradeProbability > 0.5) actions.push('Invite to VIP tier');
    if (nextPurchaseInDays != null && nextPurchaseInDays <= 3) actions.push('Send timely product nudge');
    if (predictedNextCategory) actions.push(`Recommend ${predictedNextCategory} this week`);
    if (refundProbability > 0.3) actions.push('Manual review — high refund rate');

    return {
      userId,
      email: user.email || null,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || null,
      clv,
      churnScore: churn,
      daysSinceLastOrder: daysSince,
      nextPurchaseInDays,
      nextPurchaseConfidence,
      predictedNextCategory,
      refundProbability: Math.round(refundProbability * 100) / 100,
      vipUpgradeProbability: Math.round(vipUpgradeProbability * 100) / 100,
      recommendedActions: actions,
      lifecycleStage,
    };
  }

  // Score all customers — emits events for each high-priority action
  async scoreAll(limit = 1000) {
    const customers = await this.userRepo
      .createQueryBuilder('u').where('LOWER(u.role) = :r', { r: 'customer' }).take(limit).getMany();

    let scored = 0, churningEvents = 0;
    for (const u of customers) {
      try {
        const sc = await this.scoreUser(u.id);
        scored++;
        // Fire churning event for lifecycle marketing pickup
        if (sc.lifecycleStage === 'AT_RISK' || sc.lifecycleStage === 'LAPSED') {
          this.eventBus.publish('customer.churning', {
            userId: u.id, churnScore: sc.churnScore, lifecycleStage: sc.lifecycleStage,
          }, { aggregateId: `user:${u.id}`, actorId: u.id }).catch(() => {});
          churningEvents++;
        }
      } catch (err) {
        this.logger.warn(`scoreUser(${u.id}) failed`);
      }
    }
    return { scored, churningEvents };
  }

  async topByMetric(metric: 'clv' | 'churnScore' | 'vipUpgradeProbability' | 'refundProbability', limit = 20) {
    const customers = await this.userRepo
      .createQueryBuilder('u').where('LOWER(u.role) = :r', { r: 'customer' }).take(2000).getMany();
    const scores = await Promise.all(customers.map((u) => this.scoreUser(u.id).catch(() => null)));
    return scores
      .filter(Boolean)
      .sort((a: any, b: any) => Number(b![metric]) - Number(a![metric]))
      .slice(0, limit);
  }
}
