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
    AdminGiftCardsComponent
  ],
  providers: [AdminGuard]
})
export class AdminModule {}
