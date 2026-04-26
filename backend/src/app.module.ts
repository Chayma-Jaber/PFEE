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

// Storefront extras (wave 2)
import { StorefrontModule } from './storefront/storefront.module';

// Scheduler (wave 2 automation)
import { SchedulerModule } from './scheduler/scheduler.module';

// Shipping (Wave 3 productization)
import { ShippingModule } from './shipping/shipping.module';

// Wave 4 — Advanced admin + CRM
import { Wave4Module } from './wave4/wave4.module';

// Post-Wave-4 roadmap — SMS adapter (Twilio / Infobip / Console dev-default)
import { SmsModule } from './sms/sms.module';

// Post-Wave-4 roadmap — Multi-warehouse stock
import { WarehousesModule } from './warehouses/warehouses.module';

// Expansion Tier 1 — Sizing / fit advisor
import { SizingModule } from './sizing/sizing.module';

// Expansion Tier 1 — Fraud & chargeback engine
import { FraudModule } from './fraud/fraud.module';

// Expansion platform — Domain event bus (global)
import { EventsModule } from './platform/events/events.module';

// Expansion platform — Observability (metrics + correlation ids + error sink)
import { ObservabilityModule } from './platform/observability/observability.module';

// Expansion Tier 1 — Dynamic pricing engine
import { DynamicPricingModule } from './dynamic-pricing/dynamic-pricing.module';

// Expansion Tier 1 — Subscription & recurring commerce
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

// Expansion Tier 2
import { MarketplaceModule } from './marketplace/marketplace.module';
import { B2BModule } from './b2b/b2b.module';
import { PreorderModule } from './preorder/preorder.module';
import { ConfiguratorModule } from './configurator/configurator.module';
import { LifecycleModule } from './lifecycle/lifecycle.module';

// Expansion Tier 3
import { ReplenishmentModule } from './replenishment/replenishment.module';
import { PropensityModule } from './propensity/propensity.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';

// Expansion Tier 4
import { CmsModule } from './cms/cms.module';
import { ErpModule } from './erp/erp.module';
import { FiscalModule } from './fiscal/fiscal.module';
import { UgcModerationModule } from './ugc-moderation/ugc-moderation.module';
import { GdprModule } from './gdpr/gdpr.module';

// Expansion scheduler — wires all 6 time-driven expansion services to cron
import { ExpansionSchedulerModule } from './platform/schedulers/expansion-scheduler.module';

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

    // Storefront extras (wave 2 — customer-facing)
    StorefrontModule,

    // Scheduler (wave 2 automation: auto-cancel + scheduled campaigns)
    SchedulerModule,

    // Shipping (delivery providers + tracking)
    ShippingModule,

    // Wave 4 — Advanced admin + CRM modules (20)
    Wave4Module,

    // Post-wave-4 — SMS transport layer
    SmsModule,

    // Post-wave-4 — Multi-warehouse stock
    WarehousesModule,

    // Expansion Tier 1 — Sizing / fit advisor
    SizingModule,

    // Expansion Tier 1 — Fraud & chargeback engine
    FraudModule,

    // Global platform — domain event bus
    EventsModule,

    // Global platform — observability (metrics, correlation ids, error sink)
    ObservabilityModule,

    // Expansion Tier 1 — Dynamic pricing engine
    DynamicPricingModule,

    // Expansion Tier 1 — Subscription & recurring commerce
    SubscriptionsModule,

    // Expansion Tier 2
    MarketplaceModule,
    B2BModule,
    PreorderModule,
    ConfiguratorModule,
    LifecycleModule,

    // Expansion Tier 3
    ReplenishmentModule,
    PropensityModule,
    FeatureFlagsModule,

    // Expansion Tier 4
    CmsModule,
    ErpModule,
    FiscalModule,
    UgcModerationModule,
    GdprModule,

    // Expansion scheduler — cron triggers for the time-driven expansion modules
    ExpansionSchedulerModule,
  ],
})
export class AppModule {}
