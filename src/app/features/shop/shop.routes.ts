import { Routes } from '@angular/router';
import { ShopComponent } from '../../components/pages/shop/shop.component';
import { DetailProduitComponent } from '../../components/pages/detail-produit/detail-produit.component';
import { CategorieComponent } from '../../components/pages/categorie/categorie.component';

export const SHOP_ROUTES: Routes = [
  { path: 'tn/:categoryId', component: ShopComponent },
  { path: 'shop/:categoryId', component: ShopComponent }, // For backward compatibility
  { path: 'categorie/:id', component: CategorieComponent },
  { path: 'produit/:id', component: DetailProduitComponent },
  { path: 'produit/:slug', component: DetailProduitComponent },
];
