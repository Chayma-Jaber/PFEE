import { Routes } from '@angular/router';
import { CompteComponent } from '../../components/pages/compte/compte.component';
import { FavorisComponent } from '../../components/pages/favoris/favoris.component';
import { OrderDetailsComponent } from '../../components/pages/order-details/order-details.component';

export const ACCOUNT_ROUTES: Routes = [
  { path: 'profile', component: CompteComponent },
  { path: 'favoris', component: FavorisComponent },
  { path: 'order-details/:id', component: OrderDetailsComponent },
];
