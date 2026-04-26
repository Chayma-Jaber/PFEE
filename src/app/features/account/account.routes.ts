import { Routes } from '@angular/router';
import { CompteComponent } from '../../components/pages/compte/compte.component';
import { FavorisComponent } from '../../components/pages/favoris/favoris.component';
import { OrderDetailsComponent } from '../../components/pages/order-details/order-details.component';
import { SupportComponent } from '../../components/pages/support/support.component';
import { LoyaltyDashboardComponent } from '../../components/commun/loyalty-dashboard/loyalty-dashboard.component';
import { GiftCardsComponent } from '../../components/commun/gift-cards/gift-cards.component';
import { ReferralDashboardComponent } from '../../components/commun/referral-dashboard/referral-dashboard.component';
import { OrderTrackingComponent } from '../../components/pages/order-tracking/order-tracking.component';
import { ReturnsPortalComponent } from '../../components/pages/returns-portal/returns-portal.component';
import { SubscriptionsPortalComponent } from '../../components/pages/subscriptions-portal/subscriptions-portal.component';
import { GdprPortalComponent } from '../../components/pages/gdpr-portal/gdpr-portal.component';

export const ACCOUNT_ROUTES: Routes = [
  { path: 'profile', component: CompteComponent },
  { path: 'favoris', component: FavorisComponent },
  { path: 'order-details/:id', component: OrderDetailsComponent },
  { path: 'orders/:orderId/tracking', component: OrderTrackingComponent },
  { path: 'returns', component: ReturnsPortalComponent },
  { path: 'subscriptions', component: SubscriptionsPortalComponent },
  { path: 'data-privacy', component: GdprPortalComponent },
  { path: 'support', component: SupportComponent },
  { path: 'loyalty', component: LoyaltyDashboardComponent },
  { path: 'gift-cards', component: GiftCardsComponent },
  { path: 'referrals', component: ReferralDashboardComponent },
];
