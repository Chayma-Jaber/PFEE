import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulerService } from './scheduler.service';
import { Order } from '../orders/entities/order.entity';
import { NewsletterCampaign } from '../newsletter/entities/newsletter-campaign.entity';
import { NewsletterSubscriber } from '../newsletter/entities/newsletter-subscriber.entity';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Order, NewsletterCampaign, NewsletterSubscriber]),
    EmailModule,
  ],
  providers: [SchedulerService],
})
export class SchedulerModule {}
