import { Routes } from '@angular/router';
import { HomeAllComponent } from './components/pages/home-all/home-all.component';
import { Error404Component } from './components/commun/error404/error404.component';
import { OutfitGalleryComponent } from './components/pages/outfit-gallery/outfit-gallery.component';
import { OutfitDetailComponent } from './components/pages/outfit-detail/outfit-detail.component';
import { SharedWishlistComponent } from './components/pages/shared-wishlist/shared-wishlist.component';
import { ProductComparisonComponent } from './components/commun/product-comparison/product-comparison.component';
import { StoreLocatorComponent } from './components/pages/store-locator/store-locator.component';
import { FlashSaleDetailComponent } from './components/pages/flash-sale-detail/flash-sale-detail.component';

export const routes: Routes = [
  // Home route — matches /fr/ (because baseHref is /fr/)
  { path: '', component: HomeAllComponent },

  // Shop the Look routes
  { path: 'looks', component: OutfitGalleryComponent },
  { path: 'looks/:slug', component: OutfitDetailComponent },

  // Shared Wishlist (public route)
  { path: 'wishlist/shared/:token', component: SharedWishlistComponent },

  // Product Comparison
  { path: 'compare', component: ProductComparisonComponent },

  // Store Locator
  { path: 'stores', component: StoreLocatorComponent },

  // Flash Sales
  { path: 'vente-flash/:id', component: FlashSaleDetailComponent },

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

  // Admin back-office module (lazy loaded)
  {
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.module').then(m => m.AdminModule)
  },

  // Error pages
  { path: '404', component: Error404Component },

  // Wildcard fallback (must be last)
  { path: '**', redirectTo: '/404' }
];
