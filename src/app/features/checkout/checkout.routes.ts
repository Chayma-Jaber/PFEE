import { Routes } from '@angular/router';
import { PanierComponent } from '../../components/pages/panier/panier.component';
import { CheckoutComponent } from '../../components/pages/checkout/checkout.component';
import { OrderConfirmationComponent } from '../../components/pages/order-confirmation/order-confirmation.component';
import { SignComponent } from '../../components/pages/sign/sign.component';

export const CHECKOUT_ROUTES: Routes = [
  { path: 'cart', component: PanierComponent },
  { path: 'checkout', component: CheckoutComponent },
  { path: 'sign', component: SignComponent },
  { path: 'order-confirmation/:id', component: OrderConfirmationComponent },
];
