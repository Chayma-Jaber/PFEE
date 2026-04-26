import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, LessThanOrEqual } from 'typeorm';

import { Order, OrderStatus } from '../orders/entities/order.entity';
import { NewsletterCampaign } from '../newsletter/entities/newsletter-campaign.entity';
import { NewsletterSubscriber } from '../newsletter/entities/newsletter-subscriber.entity';
import { EmailService } from '../email/email.service';

/**
 * Background automation jobs for Wave 2 modules.
 * - Every hour: auto-cancel orders still in PENDING > 24h
 * - Every 5 min: dispatch scheduled campaigns whose send time has arrived
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(NewsletterCampaign) private readonly campaignRepo: Repository<NewsletterCampaign>,
    @InjectRepository(NewsletterSubscriber) private readonly subRepo: Repository<NewsletterSubscriber>,
    private readonly emailService: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'auto-cancel-stale-orders' })
  async autoCancelStaleOrders(): Promise<void> {
    const threshold = new Date();
    threshold.setHours(threshold.getHours() - 24);

    try {
      const stale = await this.orderRepo.find({
        where: { status: OrderStatus.PENDING, created_at: LessThan(threshold) },
      });

      if (stale.length === 0) return;

      for (const o of stale) {
        o.status = OrderStatus.CANCELLED;
        o.cancelled_at = new Date();
        o.cancel_reason = 'Auto-cancelled: pending > 24h';
        await this.orderRepo.save(o);
      }
      this.logger.log(`Auto-cancelled ${stale.length} stale pending orders`);
    } catch (err: any) {
      this.logger.warn(`Auto-cancel cron failed: ${err.message}`);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'dispatch-scheduled-campaigns' })
  async dispatchScheduledCampaigns(): Promise<void> {
    const now = new Date();
    try {
      // SCHEDULED campaigns whose sent_at (used as scheduled_at) has passed
      const due = await this.campaignRepo.find({
        where: { status: 'SCHEDULED', sent_at: LessThanOrEqual(now) },
      });

      if (due.length === 0) return;

      for (const c of due) {
        const subs = await this.subRepo
          .createQueryBuilder('n')
          .where('n.is_confirmed = :conf', { conf: true })
          .andWhere('n.unsubscribed_at IS NULL')
          .getMany();

        try {
          if (subs.length > 0) {
            await this.emailService.sendNewsletter(
              subs.map((s) => s.email),
              { subject: c.subject, htmlBody: c.body },
            );
          }
          c.status = 'SENT';
          c.sent_count = subs.length;
          c.sent_at = new Date();
          await this.campaignRepo.save(c);
          this.logger.log(`Campaign "${c.name}" dispatched to ${subs.length} subscribers`);
        } catch (err: any) {
          this.logger.warn(`Campaign ${c.id} send failed: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Campaign dispatch cron failed: ${err.message}`);
    }
  }
}
