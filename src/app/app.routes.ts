import { Routes } from '@angular/router';
import { HomeAllComponent } from './components/pages/home-all/home-all.component';
import { Error404Component } from './components/commun/error404/error404.component';

export const routes: Routes = [
  // Home route
  { path: '', component: HomeAllComponent },

  // Shop feature module (lazy loaded)
  {
    path: '',
    loadChildren: () => import('./features/shop/shop').then(m => m.default)
  },

  // Auth feature module (lazy loaded)
  {
    path: '',
    loadChildren: () => import('./features/auth/auth').then(m => m.default)
  },

  // Account feature module (lazy loaded)
  {
    path: '',
    loadChildren: () => import('./features/account/account').then(m => m.default)
  },

  // Checkout feature module (lazy loaded)
  {
    path: '',
    loadChildren: () => import('./features/checkout/checkout').then(m => m.default)
  },

  // Info feature module (lazy loaded)
  {
    path: '',
    loadChildren: () => import('./features/info/info').then(m => m.default)
  },

  // Error pages
  { path: '404', component: Error404Component },
  { path: '**', redirectTo: '/404' }
];
