import { Routes } from '@angular/router';
import { SizeGuideComponent } from '../../components/commun/size-guide/size-guide.component';
import { PrivacyComponent } from '../../components/commun/privacy/privacy.component';
import { OurHistoryComponent } from '../../components/commun/our-history/our-history.component';
import { CookiesPolicyComponent } from '../../components/commun/cookies-policy/cookies-policy.component';
import { AboutUsComponent } from '../../components/commun/about-us/about-us.component';
import { ContactUsComponent } from '../../components/commun/contact-us/contact-us.component';
import { FindStoreComponent } from '../../components/commun/find-store/find-store.component';
import { ShippingReturnComponent } from '../../components/commun/shipping-return/shipping-return.component';
import { GiftCardComponent } from '../../components/pages/gift-card/gift-card.component';

export const INFO_ROUTES: Routes = [
  { path: 'size-guide', component: SizeGuideComponent },
  { path: 'confidentialite', component: PrivacyComponent },
  { path: 'privacy', component: PrivacyComponent },
  { path: 'our-history', component: OurHistoryComponent },
  { path: 'cookies-policy', component: CookiesPolicyComponent },
  { path: 'about-us', component: AboutUsComponent },
  { path: 'contact-us', component: ContactUsComponent },
  { path: 'stores', component: FindStoreComponent },
  { path: 'delivery-return', component: ShippingReturnComponent },
  { path: 'gift-card', component: GiftCardComponent },
];
