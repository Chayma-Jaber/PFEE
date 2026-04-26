import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { CustomerSignal } from './wave4.entities';
import { Coupon, CouponDiscountType } from '../promotions/entities/coupon.entity';
import { Notification, NotificationType } from '../notifications/entities/notification.entity';
import { EmailService } from '../email/email.service';

/**
 * Wave 4 retention automation:
 * - Daily at 03:00: win-back coupon to customers inactive 60+ days (once per 180 days)
 * - Hourly: detect orders delivered >7d ago without review_requested_at and send review request
 */
@Injectable()
export class Wave4SchedulerService {
  private readonly logger = new Logger(Wave4SchedulerService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(CustomerSignal) private readonly signalRepo: Repository<CustomerSignal>,
    @InjectRepository(Coupon) private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(Notification) private readonly notifRepo: Repository<Notification>,
    private readonly emailService: EmailService,
  ) {}

  @Cron('0 3 * * *', { name: 'winback-automation' })
  async runWinback(): Promise<void> {
    try {
      const signals = await this.signalRepo
        .createQueryBuilder('s')
        .where('s.days_since_last_order >= 60')
        .andWhere('s.days_since_last_order < 180')
        .getMany();

      let sent = 0;
      for (const s of signals) {
        const code = `WB-${s.user_id}-${Date.now().toString(36).slice(-5)}`.toUpperCase();
        const exists = await this.couponRepo.findOne({ where: { description: `Win-back user ${s.user_id}` } });
        if (exists) continue;

        const validTo = new Date();
        validTo.setDate(validTo.getDate() + 21);
        const c = this.couponRepo.create({
          code,
          description: `Win-back user ${s.user_id}`,
          discount_type: CouponDiscountType.PERCENTAGE,
          discount_value: 25,
          valid_from: new Date(),
          valid_to: validTo,
          usage_limit: 1,
          per_user_limit: 1,
          is_active: true,
        } as any);
        await this.couponRepo.save(c);

        const user = await this.userRepo.findOne({ where: { id: s.user_id } });
        if (!user) continue;

        await this.notifRepo.save(this.notifRepo.create({
          user_id: user.id,
          type: NotificationType.PROMOTION,
          title: 'Vous nous manquez ! -25% offerts',
          message: `Revenez avec ${code} — 25% sur votre prochaine commande, valable 21 jours.`,
          action_url: '/tn/shop',
          is_read: false,
        }));

        try {
          await this.emailService.sendCartRecovery(user.email, [user.first_name, user.last_name].filter(Boolean).join(' '), code, 25, validTo);
        } catch {}
        sent++;
      }
      if (sent > 0) this.logger.log(`Win-back: issued ${sent} coupons`);
    } catch (err: any) {
      this.logger.warn(`Win-back cron failed: ${err.message}`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'review-request' })
  async runReviewRequest(): Promise<void> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const orders = await this.orderRepo.find({
        where: {
          status: OrderStatus.DELIVERED,
          review_requested_at: IsNull() as any,
          delivered_at: LessThan(sevenDaysAgo) as any,
        },
        take: 50,
      });

      let requested = 0;
      for (const o of orders) {
        if (!o.user_id) continue;
        await this.notifRepo.save(this.notifRepo.create({
          user_id: o.user_id,
          type: NotificationType.ORDER,
          title: 'Comment s\'est passée votre commande ?',
          message: `Partagez votre avis sur votre commande ${o.reference} et gagnez 50 points de fidélité.`,
          action_url: `/account/orders/${o.id}`,
          is_read: false,
        }));
        o.review_requested_at = new Date();
        await this.orderRepo.save(o);
        requested++;
      }
      if (requested > 0) this.logger.log(`Review requests sent: ${requested}`);
    } catch (err: any) {
      this.logger.warn(`Review request cron failed: ${err.message}`);
    }
  }
}
