import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionCycle } from './entities/subscription-cycle.entity';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsStorefrontController, SubscriptionsAdminController } from './subscriptions.controller';
import { SmsModule } from '../sms/sms.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, SubscriptionCycle, Order, Product, User]),
    SmsModule,
    EmailModule,
  ],
  controllers: [SubscriptionsStorefrontController, SubscriptionsAdminController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
