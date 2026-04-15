import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminFaqController } from './admin-faq.controller';
import { AdminSupportController } from './admin-support.controller';
import { AdminGiftCardsController } from './admin-gift-cards.controller';
import { AdminReportsController } from './admin-reports.controller';

// Entities
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { User } from '../users/entities/user.entity';
import { Coupon } from '../promotions/entities/coupon.entity';
import { ReturnRequest } from '../orders/entities/return-request.entity';
import { Banner } from './entities/banner.entity';
import { FAQ } from '../faq/entities/faq.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { AdminLog } from '../analytics/entities/admin-log.entity';
import { SupportTicket } from '../support/entities/support-ticket.entity';
import { TicketMessage } from '../support/entities/ticket-message.entity';
import { GiftCard } from '../gift-cards/entities/gift-card.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Product,
      ProductVariant,
      User,
      Coupon,
      ReturnRequest,
      Banner,
      FAQ,
      Notification,
      AdminLog,
      SupportTicket,
      TicketMessage,
      GiftCard,
    ]),
  ],
  controllers: [
    AdminController,
    AdminFaqController,
    AdminSupportController,
    AdminGiftCardsController,
    AdminReportsController,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
