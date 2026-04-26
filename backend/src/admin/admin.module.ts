import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from '../email/email.module';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminFaqController } from './admin-faq.controller';
import { AdminSupportController } from './admin-support.controller';
import { AdminGiftCardsController } from './admin-gift-cards.controller';
import { AdminReportsController } from './admin-reports.controller';
import { AdminCategoriesController } from './admin-categories.controller';
import { AdminReviewsController } from './admin-reviews.controller';
import { AdminBundlesController } from './admin-bundles.controller';
import { AdminNotificationsController } from './admin-notifications.controller';
import { AdminLoyaltyController } from './admin-loyalty.controller';
import { AdminCustomer360Controller } from './admin-customer360.controller';
import { AdminAdvancedController } from './admin-advanced.controller';
import { AdminQaController } from './admin-qa.controller';
import { AdminWave2Controller } from './admin-wave2.controller';
import { AdminWave3Controller } from './admin-wave3.controller';

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
import { Category } from '../categories/entities/category.entity';
import { ProductReview } from '../reviews/entities/product-review.entity';
import { Bundle } from '../bundles/entities/bundle.entity';
import { BundleItem } from '../bundles/entities/bundle-item.entity';
import { LoyaltyAccount } from '../loyalty/entities/loyalty-account.entity';
import { LoyaltyTransaction } from '../loyalty/entities/loyalty-transaction.entity';
import { SearchQuery } from '../analytics/entities/search-query.entity';
import { StockMovement } from '../analytics/entities/stock-movement.entity';
import { CartItem } from '../cart/entities/cart-item.entity';
import { NewsletterSubscriber } from '../newsletter/entities/newsletter-subscriber.entity';
import { NewsletterCampaign } from '../newsletter/entities/newsletter-campaign.entity';
import { PricingRule } from '../promotions/entities/pricing-rule.entity';
import { CouponUsage } from '../promotions/entities/coupon-usage.entity';
import { ProductQA } from '../product-qa/entities/product-qa.entity';
import { FunnelEvent } from '../analytics/entities/funnel-event.entity';
import { CannedResponse } from '../support/entities/canned-response.entity';
import { SearchSynonym } from '../search/entities/search-synonym.entity';
import { HomepageBlock } from './entities/homepage-block.entity';
import { AbTest, AbTestEvent } from './entities/ab-test.entity';
import { ProductPosition } from './entities/product-position.entity';

@Module({
  imports: [
    ConfigModule,
    EmailModule,
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
      Category,
      ProductReview,
      Bundle,
      BundleItem,
      LoyaltyAccount,
      LoyaltyTransaction,
      SearchQuery,
      StockMovement,
      CartItem,
      NewsletterSubscriber,
      NewsletterCampaign,
      PricingRule,
      CouponUsage,
      ProductQA,
      FunnelEvent,
      CannedResponse,
      SearchSynonym,
      HomepageBlock,
      AbTest,
      AbTestEvent,
      ProductPosition,
    ]),
  ],
  controllers: [
    AdminController,
    AdminFaqController,
    AdminSupportController,
    AdminGiftCardsController,
    AdminReportsController,
    AdminCategoriesController,
    AdminReviewsController,
    AdminBundlesController,
    AdminNotificationsController,
    AdminLoyaltyController,
    AdminCustomer360Controller,
    AdminAdvancedController,
    AdminQaController,
    AdminWave2Controller,
    AdminWave3Controller,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
