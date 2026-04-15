import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';

// Core modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EmailModule } from './email/email.module';
import { MediaModule } from './media/media.module';

// Catalog modules
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { SearchModule } from './search/search.module';

// Commerce modules
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';

// Customer engagement modules
import { SupportModule } from './support/support.module';
import { FaqModule } from './faq/faq.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AlertsModule } from './alerts/alerts.module';

// Wishlist & collections
import { WishlistModule } from './wishlist/wishlist.module';
import { OutfitsModule } from './outfits/outfits.module';
import { BundlesModule } from './bundles/bundles.module';

// Marketing modules
import { PromotionsModule } from './promotions/promotions.module';
import { NewsletterModule } from './newsletter/newsletter.module';

// Premium modules
import { LoyaltyModule } from './loyalty/loyalty.module';
import { GiftCardsModule } from './gift-cards/gift-cards.module';
import { ReferralsModule } from './referrals/referrals.module';

// Content modules
import { ReviewsModule } from './reviews/reviews.module';
import { ProductQAModule } from './product-qa/product-qa.module';

// AI & Recommendations
import { RecommendationsModule } from './recommendations/recommendations.module';
import { AiModule } from './ai/ai.module';

// Analytics
import { AnalyticsModule } from './analytics/analytics.module';

// Health
import { HealthModule } from './health/health.module';

// Admin
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Database
    DatabaseModule,

    // Core
    AuthModule,
    UsersModule,
    EmailModule,
    MediaModule,

    // Catalog
    ProductsModule,
    CategoriesModule,
    SearchModule,

    // Commerce
    CartModule,
    OrdersModule,
    PaymentsModule,

    // Customer engagement
    SupportModule,
    FaqModule,
    NotificationsModule,
    AlertsModule,

    // Wishlist & collections
    WishlistModule,
    OutfitsModule,
    BundlesModule,

    // Marketing
    PromotionsModule,
    NewsletterModule,

    // Premium
    LoyaltyModule,
    GiftCardsModule,
    ReferralsModule,

    // Content
    ReviewsModule,
    ProductQAModule,

    // AI & Recommendations
    RecommendationsModule,
    AiModule,

    // Analytics
    AnalyticsModule,

    // Health
    HealthModule,

    // Admin
    AdminModule,
  ],
})
export class AppModule {}
