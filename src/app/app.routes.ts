import { Routes } from '@angular/router';
import { HomeAllComponent } from './components/pages/home-all/home-all.component';
import { Error404Component } from './components/commun/error404/error404.component';
import { OutfitGalleryComponent } from './components/pages/outfit-gallery/outfit-gallery.component';
import { OutfitDetailComponent } from './components/pages/outfit-detail/outfit-detail.component';
import { SharedWishlistComponent } from './components/pages/shared-wishlist/shared-wishlist.component';
import { ProductComparisonComponent } from './components/commun/product-comparison/product-comparison.component';
import { StoreLocatorComponent } from './components/pages/store-locator/store-locator.component';
import { FlashSaleDetailComponent } from './components/pages/flash-sale-detail/flash-sale-detail.component';
import { StylistPageComponent } from './components/pages/stylist-page/stylist-page.component';
import { B2bPortalComponent } from './components/pages/b2b-portal/b2b-portal.component';
import { CmsPageComponent } from './components/pages/cms-page/cms-page.component';
import { ConfiguratorPageComponent } from './components/pages/configurator-page/configurator-page.component';
import { SellerPortalComponent } from './components/pages/seller-portal/seller-portal.component';

export const routes: Routes = [
  // Studio Look — Mannequin composer (Wave 3)
  {
    path: 'studio-look',
    loadComponent: () =>
      import('./components/pages/studio-look/studio-look.component').then((m) => m.StudioLookComponent)
  },

  // Expansion roadmap — customer-facing standalone pages
  { path: 'stylist', component: StylistPageComponent },
  { path: 'b2b', component: B2bPortalComponent },
  { path: 'seller', component: SellerPortalComponent },
  { path: 'page/:slug', component: CmsPageComponent },
  { path: 'configurator', component: ConfiguratorPageComponent },
  { path: 'configurator/:slug', component: ConfiguratorPageComponent },

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
