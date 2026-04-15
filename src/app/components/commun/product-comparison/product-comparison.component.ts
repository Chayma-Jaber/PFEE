import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProductComparisonService, ComparisonProduct } from '../../../services/product-comparison.service';
import { CartService, CartItem } from '../../../services/cart.service';
import { ProductService } from '../../../services/product.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-product-comparison',
  standalone: true,
  imports: [CommonModule, RouterModule, ToastModule],
  providers: [MessageService],
  template: `
    <div class="comparison-page">
      <!-- Header -->
      <div class="comparison-header">
        <div class="container">
          <h1 class="comparison-title">Comparaison de produits</h1>
          <p class="comparison-subtitle" *ngIf="products.length > 0">
            Comparez jusqu'a {{ maxProducts }} produits cote a cote
          </p>
        </div>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="products.length === 0">
        <div class="empty-icon">
          <i class="fas fa-balance-scale"></i>
        </div>
        <h2>Aucun produit a comparer</h2>
        <p>Ajoutez des produits a votre liste de comparaison pour les comparer cote a cote.</p>
        <button class="btn-shop" routerLink="/">
          <i class="fas fa-shopping-bag"></i>
          Parcourir les produits
        </button>
      </div>

      <!-- Comparison Table -->
      <div class="comparison-container" *ngIf="products.length > 0">
        <div class="comparison-actions">
          <button class="btn-clear" (click)="clearAll()">
            <i class="fas fa-trash-alt"></i>
            Tout effacer
          </button>
        </div>

        <div class="comparison-table-wrapper">
          <table class="comparison-table">
            <!-- Product Images Row -->
            <tr class="row-images">
              <th class="attribute-label">Produit</th>
              <td *ngFor="let product of products" class="product-cell">
                <div class="product-card-compare">
                  <button class="remove-btn" (click)="removeProduct(product.id)" title="Retirer">
                    <i class="fas fa-times"></i>
                  </button>
                  <div class="product-image-wrapper">
                    <img [src]="product.image" [alt]="product.title" class="product-image">
                  </div>
                  <h3 class="product-title">{{ product.title }}</h3>
                </div>
              </td>
              <td *ngFor="let _ of emptySlots" class="product-cell empty-slot">
                <div class="add-product-slot">
                  <i class="fas fa-plus-circle"></i>
                  <span>Ajouter un produit</span>
                </div>
              </td>
            </tr>

            <!-- Price Row -->
            <tr class="row-price" [class.highlight-diff]="hasDifference('price')">
              <th class="attribute-label">Prix</th>
              <td *ngFor="let product of products" class="product-cell">
                <div class="price-container">
                  <span class="current-price">{{ product.currentPrice.toFixed(3) }} TND</span>
                  <div *ngIf="product.discount" class="discount-info">
                    <span class="original-price">{{ product.price.toFixed(3) }} TND</span>
                    <span class="discount-badge">-{{ product.discountValue }}%</span>
                  </div>
                </div>
              </td>
              <td *ngFor="let _ of emptySlots" class="product-cell empty-slot">-</td>
            </tr>

            <!-- Category/Family Row -->
            <tr class="row-category" [class.highlight-diff]="hasDifference('Famille')">
              <th class="attribute-label">Categorie</th>
              <td *ngFor="let product of products" class="product-cell">
                {{ product.Famille || '-' }}
              </td>
              <td *ngFor="let _ of emptySlots" class="product-cell empty-slot">-</td>
            </tr>

            <!-- Material Row -->
            <tr class="row-material" [class.highlight-diff]="hasDifference('material')">
              <th class="attribute-label">Materiau</th>
              <td *ngFor="let product of products" class="product-cell">
                {{ product.material || '-' }}
              </td>
              <td *ngFor="let _ of emptySlots" class="product-cell empty-slot">-</td>
            </tr>

            <!-- Sizes Row -->
            <tr class="row-sizes" [class.highlight-diff]="hasDifference('sizes')">
              <th class="attribute-label">Tailles disponibles</th>
              <td *ngFor="let product of products" class="product-cell">
                <div class="sizes-list" *ngIf="product.sizes && product.sizes.length > 0; else noSizes">
                  <span class="size-tag" *ngFor="let size of product.sizes">{{ size }}</span>
                </div>
                <ng-template #noSizes>-</ng-template>
              </td>
              <td *ngFor="let _ of emptySlots" class="product-cell empty-slot">-</td>
            </tr>

            <!-- Colors Row -->
            <tr class="row-colors" [class.highlight-diff]="hasDifference('colors')">
              <th class="attribute-label">Couleurs disponibles</th>
              <td *ngFor="let product of products" class="product-cell">
                <div class="colors-list" *ngIf="product.colors && product.colors.length > 0; else noColors">
                  <span class="color-tag" *ngFor="let color of product.colors">{{ color }}</span>
                </div>
                <ng-template #noColors>-</ng-template>
              </td>
              <td *ngFor="let _ of emptySlots" class="product-cell empty-slot">-</td>
            </tr>

            <!-- Rating Row -->
            <tr class="row-rating" [class.highlight-diff]="hasDifference('rating')">
              <th class="attribute-label">Note</th>
              <td *ngFor="let product of products" class="product-cell">
                <div class="rating-display" *ngIf="product.rating; else noRating">
                  <div class="stars">
                    <i *ngFor="let star of getStars(product.rating)"
                       class="fas fa-star"
                       [class.filled]="star <= product.rating"
                       [class.half]="star - 0.5 === product.rating"></i>
                  </div>
                  <span class="rating-value">{{ product.rating }}/5</span>
                </div>
                <ng-template #noRating>
                  <span class="no-rating">Pas encore note</span>
                </ng-template>
              </td>
              <td *ngFor="let _ of emptySlots" class="product-cell empty-slot">-</td>
            </tr>

            <!-- Stock Status Row -->
            <tr class="row-stock" [class.highlight-diff]="hasDifference('inStock')">
              <th class="attribute-label">Disponibilite</th>
              <td *ngFor="let product of products" class="product-cell">
                <span class="stock-status" [class.in-stock]="product.inStock" [class.out-of-stock]="!product.inStock">
                  <i [class]="product.inStock ? 'fas fa-check-circle' : 'fas fa-times-circle'"></i>
                  {{ product.inStock ? 'En stock' : 'Rupture de stock' }}
                </span>
              </td>
              <td *ngFor="let _ of emptySlots" class="product-cell empty-slot">-</td>
            </tr>

            <!-- Actions Row -->
            <tr class="row-actions">
              <th class="attribute-label">Actions</th>
              <td *ngFor="let product of products" class="product-cell">
                <div class="action-buttons">
                  <button class="btn-view" [routerLink]="['/produit', getProductSlug(product)]">
                    <i class="fas fa-eye"></i>
                    Voir le produit
                  </button>
                  <button class="btn-cart"
                          [disabled]="!product.inStock"
                          (click)="goToProduct(product)">
                    <i class="fas fa-shopping-cart"></i>
                    Ajouter au panier
                  </button>
                </div>
              </td>
              <td *ngFor="let _ of emptySlots" class="product-cell empty-slot">-</td>
            </tr>
          </table>
        </div>
      </div>

      <p-toast></p-toast>
    </div>
  `,
  styles: [`
    .comparison-page {
      min-height: 100vh;
      background-color: #f8f9fa;
      padding-bottom: 80px;
    }

    .comparison-header {
      background-color: #fff;
      padding: 2rem 0;
      border-bottom: 1px solid #e9ecef;
      margin-bottom: 2rem;
    }

    .comparison-title {
      font-size: 1.75rem;
      font-weight: 600;
      color: #212529;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .comparison-subtitle {
      color: #6c757d;
      margin: 0;
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      max-width: 500px;
      margin: 0 auto;
    }

    .empty-icon {
      font-size: 4rem;
      color: #dee2e6;
      margin-bottom: 1.5rem;
    }

    .empty-state h2 {
      font-size: 1.5rem;
      color: #212529;
      margin-bottom: 1rem;
    }

    .empty-state p {
      color: #6c757d;
      margin-bottom: 2rem;
    }

    .btn-shop {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background-color: #000;
      color: #fff;
      border: none;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .btn-shop:hover {
      background-color: #333;
    }

    /* Comparison Container */
    .comparison-container {
      padding: 0 1rem;
    }

    .comparison-actions {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 1rem;
    }

    .btn-clear {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background-color: #dc3545;
      color: #fff;
      border: none;
      font-size: 0.85rem;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .btn-clear:hover {
      background-color: #c82333;
    }

    /* Comparison Table */
    .comparison-table-wrapper {
      overflow-x: auto;
      background-color: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      -webkit-overflow-scrolling: touch;
    }

    .comparison-table {
      width: 100%;
      min-width: 800px;
      border-collapse: collapse;
    }

    .comparison-table tr {
      border-bottom: 1px solid #e9ecef;
    }

    .comparison-table tr:last-child {
      border-bottom: none;
    }

    .attribute-label {
      position: sticky;
      left: 0;
      background-color: #f8f9fa;
      padding: 1rem;
      text-align: left;
      font-weight: 600;
      font-size: 0.9rem;
      color: #495057;
      min-width: 150px;
      z-index: 1;
      border-right: 1px solid #e9ecef;
    }

    .product-cell {
      padding: 1rem;
      text-align: center;
      min-width: 200px;
      vertical-align: middle;
    }

    .empty-slot {
      background-color: #f8f9fa;
      color: #adb5bd;
    }

    .add-product-slot {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      color: #adb5bd;
    }

    .add-product-slot i {
      font-size: 2rem;
    }

    /* Highlight differences */
    .highlight-diff {
      background-color: #fff3cd;
    }

    .highlight-diff .attribute-label {
      background-color: #ffeeba;
    }

    /* Product Card in Comparison */
    .product-card-compare {
      position: relative;
    }

    .remove-btn {
      position: absolute;
      top: -0.5rem;
      right: 0;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background-color: #dc3545;
      color: #fff;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      transition: background-color 0.2s;
      z-index: 2;
    }

    .remove-btn:hover {
      background-color: #c82333;
    }

    .product-image-wrapper {
      width: 150px;
      height: 200px;
      margin: 0 auto 1rem;
      overflow: hidden;
    }

    .product-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .product-title {
      font-size: 0.9rem;
      font-weight: 500;
      color: #212529;
      margin: 0;
      line-height: 1.4;
    }

    /* Price */
    .price-container {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .current-price {
      font-size: 1.1rem;
      font-weight: 600;
      color: #212529;
    }

    .discount-info {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .original-price {
      text-decoration: line-through;
      color: #6c757d;
      font-size: 0.85rem;
    }

    .discount-badge {
      background-color: #dc3545;
      color: #fff;
      padding: 0.15rem 0.4rem;
      font-size: 0.75rem;
      font-weight: 600;
    }

    /* Sizes */
    .sizes-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      justify-content: center;
    }

    .size-tag {
      padding: 0.25rem 0.5rem;
      background-color: #e9ecef;
      font-size: 0.8rem;
      border-radius: 4px;
    }

    /* Colors */
    .colors-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      justify-content: center;
    }

    .color-tag {
      padding: 0.25rem 0.5rem;
      background-color: #e9ecef;
      font-size: 0.8rem;
      border-radius: 4px;
    }

    /* Rating */
    .rating-display {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
    }

    .stars {
      display: flex;
      gap: 0.15rem;
    }

    .stars i {
      color: #dee2e6;
      font-size: 0.9rem;
    }

    .stars i.filled {
      color: #ffc107;
    }

    .rating-value {
      font-size: 0.85rem;
      color: #6c757d;
    }

    .no-rating {
      color: #adb5bd;
      font-style: italic;
      font-size: 0.85rem;
    }

    /* Stock Status */
    .stock-status {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.35rem 0.75rem;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 500;
    }

    .stock-status.in-stock {
      background-color: #d4edda;
      color: #155724;
    }

    .stock-status.out-of-stock {
      background-color: #f8d7da;
      color: #721c24;
    }

    /* Action Buttons */
    .action-buttons {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .btn-view, .btn-cart {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.6rem 1rem;
      font-size: 0.8rem;
      border: none;
      cursor: pointer;
      transition: background-color 0.2s;
      text-decoration: none;
    }

    .btn-view {
      background-color: #fff;
      border: 1px solid #000;
      color: #000;
    }

    .btn-view:hover {
      background-color: #f8f9fa;
    }

    .btn-cart {
      background-color: #000;
      color: #fff;
    }

    .btn-cart:hover:not(:disabled) {
      background-color: #333;
    }

    .btn-cart:disabled {
      background-color: #6c757d;
      cursor: not-allowed;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .comparison-header {
        padding: 1.5rem 1rem;
      }

      .comparison-title {
        font-size: 1.25rem;
      }

      .attribute-label {
        min-width: 120px;
        padding: 0.75rem;
        font-size: 0.8rem;
      }

      .product-cell {
        min-width: 180px;
        padding: 0.75rem;
      }

      .product-image-wrapper {
        width: 120px;
        height: 160px;
      }

      .product-title {
        font-size: 0.8rem;
      }

      .current-price {
        font-size: 1rem;
      }

      .btn-view, .btn-cart {
        padding: 0.5rem 0.75rem;
        font-size: 0.75rem;
      }
    }

    /* Container */
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 1rem;
    }
  `]
})
export class ProductComparisonComponent implements OnInit, OnDestroy {
  products: ComparisonProduct[] = [];
  maxProducts: number = 4;
  emptySlots: number[] = [];

  private subscription: Subscription = new Subscription();

  constructor(
    private comparisonService: ProductComparisonService,
    private cartService: CartService,
    private productService: ProductService,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.maxProducts = this.comparisonService.getMaxProducts();

    this.subscription.add(
      this.comparisonService.comparedProducts$.subscribe(products => {
        this.products = products;
        this.updateEmptySlots();
      })
    );

    this.subscription.add(
      this.comparisonService.toastMessage$.subscribe(toast => {
        if (toast) {
          this.messageService.add({
            severity: toast.type === 'error' ? 'error' : toast.type === 'warning' ? 'warn' : 'success',
            summary: toast.type === 'error' ? 'Erreur' : toast.type === 'warning' ? 'Attention' : 'Succes',
            detail: toast.message,
            life: 3000
          });
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private updateEmptySlots(): void {
    const remaining = this.maxProducts - this.products.length;
    this.emptySlots = remaining > 0 ? Array(remaining).fill(0) : [];
  }

  removeProduct(productId: number): void {
    this.comparisonService.removeFromComparison(productId);
  }

  clearAll(): void {
    this.comparisonService.clearComparison();
  }

  getProductSlug(product: ComparisonProduct): string {
    const titleSlug = product.title
      .toLowerCase()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ç]/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return `${product.id}-${titleSlug}`;
  }

  goToProduct(product: ComparisonProduct): void {
    this.router.navigate(['/produit', this.getProductSlug(product)]);
  }

  getStars(rating: number): number[] {
    return [1, 2, 3, 4, 5];
  }

  /**
   * Check if products have different values for a given attribute
   */
  hasDifference(attribute: string): boolean {
    if (this.products.length < 2) return false;

    const values = this.products.map(p => {
      switch (attribute) {
        case 'price':
          return p.currentPrice;
        case 'Famille':
          return p.Famille || '';
        case 'material':
          return p.material || '';
        case 'sizes':
          return (p.sizes || []).sort().join(',');
        case 'colors':
          return (p.colors || []).sort().join(',');
        case 'rating':
          return p.rating ?? 0;
        case 'inStock':
          return p.inStock;
        default:
          return '';
      }
    });

    return !values.every(v => v === values[0]);
  }
}
