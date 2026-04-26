import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// Admin components
import { AdminLayoutComponent } from './components/admin-layout/admin-layout.component';
import { AdminDashboardComponent } from './components/dashboard/dashboard.component';
import { AdminOrdersComponent } from './components/orders/orders.component';
import { AdminOrderDetailComponent } from './components/order-detail/order-detail.component';
import { AdminProductsComponent } from './components/products/products.component';
import { AdminCustomersComponent } from './components/customers/customers.component';
import { AdminCouponsComponent } from './components/coupons/coupons.component';
import { AdminReturnsComponent } from './components/returns/returns.component';
import { AdminContentComponent } from './components/content/content.component';
import { AIAnalyticsComponent } from './components/ai-analytics/ai-analytics.component';
import { AdminLoginComponent } from './components/login/admin-login.component';
import { AdminReportsComponent } from './components/reports/reports.component';
import { AdminSettingsComponent } from './components/settings/settings.component';
import { AdminSupportComponent } from './components/support/support.component';
import { AdminFAQComponent } from './components/faq/faq.component';
import { AdminOutfitsComponent } from './components/outfits/outfits.component';
import { AdminAlertsComponent } from './components/alerts/alerts.component';
import { AdminLoyaltyComponent } from './components/loyalty/loyalty.component';
import { AdminGiftCardsComponent } from './components/gift-cards/gift-cards.component';
import { AdminCategoriesComponent } from './components/categories/categories.component';
import { AdminReviewsComponent } from './components/reviews/reviews.component';
import { AdminBundlesComponent } from './components/bundles/bundles.component';
import { AdminNotificationsComponent } from './components/notifications/notifications.component';
import { AdminAdvancedComponent } from './components/advanced/advanced.component';
import { AdminWave2Component } from './components/wave2/wave2.component';
import { AdminWave3Component } from './components/wave3/wave3.component';
import { AdminWave4Component } from './components/wave4/wave4.component';
import { AdminSmsComponent } from './components/sms/sms.component';
import { AdminEmailAnalyticsComponent } from './components/email-analytics/email-analytics.component';
import { AdminWarehousesComponent } from './components/warehouses/warehouses.component';

// Expansion roadmap admin pages
import { AdminFraudComponent } from './components/fraud/fraud.component';
import { AdminSubscriptionsComponent } from './components/subscriptions/subscriptions.component';
import { AdminDynamicPricingComponent } from './components/dynamic-pricing/dynamic-pricing.component';
import { AdminFeatureFlagsComponent } from './components/feature-flags/feature-flags.component';
import { AdminMarketplaceComponent } from './components/marketplace/marketplace.component';
import { AdminB2BComponent } from './components/b2b/b2b.component';
import { AdminPreorderComponent } from './components/preorder/preorder.component';
import { AdminConfiguratorComponent } from './components/configurator/configurator.component';
import { AdminLifecycleComponent } from './components/lifecycle/lifecycle.component';
import { AdminReplenishmentComponent } from './components/replenishment/replenishment.component';
import { AdminPropensityComponent } from './components/propensity/propensity.component';
import { AdminCmsComponent } from './components/cms/cms.component';
import { AdminErpComponent } from './components/erp/erp.component';
import { AdminFiscalComponent } from './components/fiscal/fiscal.component';
import { AdminUgcModerationComponent } from './components/ugc-moderation/ugc-moderation.component';
import { AdminGdprComponent } from './components/gdpr/gdpr.component';
import { AdminPlatformComponent } from './components/platform/platform.component';

// Guards
import { AdminGuard } from './guards/admin.guard';

const routes: Routes = [
  // Login route (no guard)
  { path: 'login', component: AdminLoginComponent },

  // Protected admin routes
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [AdminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'orders', component: AdminOrdersComponent },
      { path: 'orders/:id', component: AdminOrderDetailComponent },
      { path: 'products', component: AdminProductsComponent },
      { path: 'categories', component: AdminCategoriesComponent },
      { path: 'reviews', component: AdminReviewsComponent },
      { path: 'bundles', component: AdminBundlesComponent },
      { path: 'notifications', component: AdminNotificationsComponent },
      { path: 'advanced', component: AdminAdvancedComponent },
      { path: 'wave2', component: AdminWave2Component },
      { path: 'wave3', component: AdminWave3Component },
      { path: 'wave4', component: AdminWave4Component },
      { path: 'customers', component: AdminCustomersComponent },
      { path: 'coupons', component: AdminCouponsComponent },
      { path: 'returns', component: AdminReturnsComponent },
      { path: 'content', component: AdminContentComponent },
      { path: 'reports', component: AdminReportsComponent },
      { path: 'support', component: AdminSupportComponent },
      { path: 'faq', component: AdminFAQComponent },
      { path: 'ai-analytics', component: AIAnalyticsComponent },
      { path: 'outfits', component: AdminOutfitsComponent },
      { path: 'alerts', component: AdminAlertsComponent },
      { path: 'loyalty', component: AdminLoyaltyComponent },
      { path: 'gift-cards', component: AdminGiftCardsComponent },
      { path: 'sms', component: AdminSmsComponent },
      { path: 'email-analytics', component: AdminEmailAnalyticsComponent },
      { path: 'warehouses', component: AdminWarehousesComponent },
      // Expansion roadmap routes
      { path: 'fraud', component: AdminFraudComponent },
      { path: 'subscriptions', component: AdminSubscriptionsComponent },
      { path: 'dynamic-pricing', component: AdminDynamicPricingComponent },
      { path: 'feature-flags', component: AdminFeatureFlagsComponent },
      { path: 'marketplace', component: AdminMarketplaceComponent },
      { path: 'b2b', component: AdminB2BComponent },
      { path: 'preorder', component: AdminPreorderComponent },
      { path: 'configurator', component: AdminConfiguratorComponent },
      { path: 'lifecycle', component: AdminLifecycleComponent },
      { path: 'replenishment', component: AdminReplenishmentComponent },
      { path: 'propensity', component: AdminPropensityComponent },
      { path: 'cms', component: AdminCmsComponent },
      { path: 'erp', component: AdminErpComponent },
      { path: 'fiscal', component: AdminFiscalComponent },
      { path: 'ugc-moderation', component: AdminUgcModerationComponent },
      { path: 'gdpr', component: AdminGdprComponent },
      { path: 'platform', component: AdminPlatformComponent },
      { path: 'settings', component: AdminSettingsComponent }
    ]
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    // Standalone components
    AdminLayoutComponent,
    AdminDashboardComponent,
    AdminOrdersComponent,
    AdminOrderDetailComponent,
    AdminProductsComponent,
    AdminCustomersComponent,
    AdminCouponsComponent,
    AdminReturnsComponent,
    AdminContentComponent,
    AIAnalyticsComponent,
    AdminLoginComponent,
    AdminReportsComponent,
    AdminSettingsComponent,
    AdminSupportComponent,
    AdminFAQComponent,
    AdminOutfitsComponent,
    AdminAlertsComponent,
    AdminLoyaltyComponent,
    AdminGiftCardsComponent,
    AdminCategoriesComponent,
    AdminReviewsComponent,
    AdminBundlesComponent,
    AdminNotificationsComponent,
    AdminAdvancedComponent,
    AdminWave2Component,
    AdminWave3Component,
    AdminWave4Component,
    AdminSmsComponent,
    AdminEmailAnalyticsComponent,
    AdminWarehousesComponent,
    AdminFraudComponent,
    AdminSubscriptionsComponent,
    AdminDynamicPricingComponent,
    AdminFeatureFlagsComponent,
    AdminMarketplaceComponent,
    AdminB2BComponent,
    AdminPreorderComponent,
    AdminConfiguratorComponent,
    AdminLifecycleComponent,
    AdminReplenishmentComponent,
    AdminPropensityComponent,
    AdminCmsComponent,
    AdminErpComponent,
    AdminFiscalComponent,
    AdminUgcModerationComponent,
    AdminGdprComponent,
    AdminPlatformComponent
  ],
  providers: [AdminGuard]
})
export class AdminModule {}
