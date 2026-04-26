import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminWave4Controller } from './admin-wave4.controller';
import { StorefrontWave4Controller } from './storefront-wave4.controller';
import { Wave4SchedulerService } from './wave4-scheduler.service';
import {
  CustomerTag, CustomerNote, OrderComment, AdminTask,
  DeliverySlot, PickupLocation, CustomerSignal, DailyDeal,
  ReferralShare, UgcPost, AuditDiff,
} from './wave4.entities';
import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { SupportTicket } from '../support/entities/support-ticket.entity';
import { Coupon } from '../promotions/entities/coupon.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';
import { FraudModule } from '../fraud/fraud.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerTag, CustomerNote, OrderComment, AdminTask,
      DeliverySlot, PickupLocation, CustomerSignal, DailyDeal,
      ReferralShare, UgcPost, AuditDiff,
      User, Order, Product, SupportTicket, Coupon, Notification,
    ]),
    EmailModule,
    SmsModule,
    FraudModule,
  ],
  controllers: [AdminWave4Controller, StorefrontWave4Controller],
  providers: [Wave4SchedulerService],
})
export class Wave4Module {}
