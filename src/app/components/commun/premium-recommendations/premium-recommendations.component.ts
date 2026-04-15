/**
 * Barsha Premium Recommendations Component
 * =========================================
 * A premium, fashion-aware recommendation component for luxury e-commerce.
 *
 * Features:
 * - Multiple display modes (grid, carousel, compact)
 * - Elegant loading states
 * - Explainable AI badges
 * - Analytics integration
 * - Responsive design
 */

import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PremiumRecommendationsService, RecommendationSet, RecommendedProduct, RecommendationStrategy } from '../../../services/premium-recommendations.service';

@Component({
  selector: 'app-premium-recommendations',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <section
      class="premium-recommendations"
      [class.loading]="isLoading"
      [class.empty]="!isLoading && (!recommendations || !recommendations.products || recommendations.products.length === 0)"
      [attr.data-strategy]="strategy"
      *ngIf="recommendations?.products?.length || isLoading"
    >
      <!-- Section Header -->
      <div class="section-header">
        <div class="header-content">
          <h2 class="section-title">{{ recommendations?.title || title }}</h2>
          <p class="section-subtitle" *ngIf="recommendations?.subtitle || subtitle">
            {{ recommendations?.subtitle || subtitle }}
          </p>
        </div>

        <div class="header-actions" *ngIf="showBadge || showViewAll">
          <span class="ai-badge" *ngIf="showBadge">
            <svg class="sparkle-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor"/>
            </svg>
            Barsha IA
          </span>
          <a
            class="view-all-link"
            *ngIf="showViewAll && viewAllLink"
            [routerLink]="viewAllLink"
          >
            Voir tout
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </a>
        </div>
      </div>

      <!-- Loading State -->
      <div class="products-grid" *ngIf="isLoading">
        <div class="product-skeleton" *ngFor="let i of [1,2,3,4,5,6,7,8].slice(0, limit)">
          <div class="skeleton-image"></div>
          <div class="skeleton-content">
            <div class="skeleton-title"></div>
            <div class="skeleton-price"></div>
            <div class="skeleton-reason"></div>
          </div>
        </div>
      </div>

      <!-- Products Grid -->
      <div
        class="products-grid"
        [class.grid-4]="limit >= 8"
        [class.grid-3]="limit >= 5 && limit < 8"
        [class.grid-2]="limit < 5"
        [class.carousel-mode]="displayMode === 'carousel'"
        *ngIf="!isLoading && recommendations?.products?.length"
      >
        <article
          class="product-card"
          *ngFor="let product of recommendations?.products; let i = index; trackBy: trackByProductId"
          (click)="onProductClick(product, i)"
        >
          <!-- Product Image -->
          <a [routerLink]="['/produit', product.id]" class="product-image-link">
            <div class="product-image-container">
              <img
                [src]="product.image"
                [alt]="product.name"
                class="product-image primary"
                loading="lazy"
                (error)="onImageError($event)"
              />
              <img
                *ngIf="product.secondImage"
                [src]="product.secondImage"
                [alt]="product.name"
                class="product-image secondary"
                loading="lazy"
              />

              <!-- Badges -->
              <div class="product-badges">
                <span class="badge discount" *ngIf="product.discount && product.discount > 0">
                  -{{ product.discount }}%
                </span>
                <span class="badge new" *ngIf="product.reasonKey === 'new_arrival'">
                  Nouveau
                </span>
              </div>

              <!-- Quick Actions -->
              <div class="quick-actions">
                <button
                  class="quick-action-btn wishlist"
                  (click)="onAddToWishlist($event, product)"
                  title="Ajouter aux favoris"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </button>
              </div>
            </div>
          </a>

          <!-- Product Info -->
          <div class="product-info">
            <!-- Colors -->
            <div class="product-colors" *ngIf="product.colors && product.colors.length > 0">
              <span
                class="color-dot"
                *ngFor="let color of product.colors.slice(0, 4)"
                [attr.data-color]="color.toLowerCase()"
                [title]="color"
              ></span>
              <span class="more-colors" *ngIf="product.colors.length > 4">
                +{{ product.colors.length - 4 }}
              </span>
            </div>

            <!-- Name -->
            <a [routerLink]="['/produit', product.id]" class="product-name">
              {{ product.name }}
            </a>

            <!-- Price -->
            <div class="product-price">
              <span class="current-price">{{ product.price }}</span>
              <span class="original-price" *ngIf="product.originalPrice">
                {{ product.originalPrice }}
              </span>
            </div>

            <!-- Reason Badge -->
            <div class="recommendation-reason" *ngIf="showReason && product.reason">
              <svg class="reason-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
              <span class="reason-text">{{ product.reason }}</span>
            </div>
          </div>
        </article>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="!isLoading && (!recommendations || !recommendations.products || recommendations.products.length === 0)">
        <p>Aucune recommandation disponible pour le moment.</p>
      </div>
    </section>
  `,
  styles: [`
    .premium-recommendations {
      padding: 2rem 0;
      margin: 0 auto;
      max-width: 1400px;
    }

    /* Section Header */
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 1.5rem;
      padding: 0 1rem;
    }

    .header-content {
      flex: 1;
    }

    .section-title {
      font-family: 'std95', sans-serif;
      font-size: 1.75rem;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 0.25rem 0;
      letter-spacing: -0.02em;
    }

    .section-subtitle {
      font-family: 'std55', sans-serif;
      font-size: 0.95rem;
      color: #666;
      margin: 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .ai-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.35rem 0.75rem;
      background: linear-gradient(135deg, #1a1a1a 0%, #333 100%);
      color: #fff;
      font-size: 0.75rem;
      font-weight: 500;
      border-radius: 100px;
      letter-spacing: 0.02em;
    }

    .sparkle-icon {
      width: 12px;
      height: 12px;
      animation: sparkle 2s ease-in-out infinite;
    }

    @keyframes sparkle {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(0.9); }
    }

    .view-all-link {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.875rem;
      color: #1a1a1a;
      text-decoration: none;
      font-weight: 500;
      transition: opacity 0.2s;
    }

    .view-all-link:hover {
      opacity: 0.7;
    }

    .view-all-link svg {
      width: 16px;
      height: 16px;
    }

    /* Products Grid */
    .products-grid {
      display: grid;
      gap: 1.5rem;
      padding: 0 1rem;
    }

    .products-grid.grid-4 {
      grid-template-columns: repeat(4, 1fr);
    }

    .products-grid.grid-3 {
      grid-template-columns: repeat(3, 1fr);
    }

    .products-grid.grid-2 {
      grid-template-columns: repeat(2, 1fr);
    }

    /* Product Card */
    .product-card {
      background: #fff;
      border-radius: 8px;
      overflow: hidden;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .product-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 24px rgba(0,0,0,0.08);
    }

    .product-image-link {
      display: block;
      text-decoration: none;
    }

    .product-image-container {
      position: relative;
      aspect-ratio: 3/4;
      overflow: hidden;
      background: #f5f5f5;
    }

    .product-image {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: opacity 0.4s ease;
    }

    .product-image.secondary {
      opacity: 0;
    }

    .product-card:hover .product-image.primary {
      opacity: 0;
    }

    .product-card:hover .product-image.secondary {
      opacity: 1;
    }

    /* Product Badges */
    .product-badges {
      position: absolute;
      top: 0.75rem;
      left: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .badge {
      padding: 0.25rem 0.5rem;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .badge.discount {
      background: #dc2626;
      color: #fff;
    }

    .badge.new {
      background: #1a1a1a;
      color: #fff;
    }

    /* Quick Actions */
    .quick-actions {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .product-card:hover .quick-actions {
      opacity: 1;
    }

    .quick-action-btn {
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 50%;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.2s, transform 0.2s;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .quick-action-btn:hover {
      background: #1a1a1a;
      transform: scale(1.1);
    }

    .quick-action-btn:hover svg {
      stroke: #fff;
    }

    .quick-action-btn svg {
      width: 18px;
      height: 18px;
      stroke: #1a1a1a;
    }

    /* Product Info */
    .product-info {
      padding: 1rem;
    }

    .product-colors {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      margin-bottom: 0.5rem;
    }

    .color-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 1px solid rgba(0,0,0,0.1);
    }

    .color-dot[data-color="noir"] { background: #1a1a1a; }
    .color-dot[data-color="blanc"] { background: #fff; border-color: #ddd; }
    .color-dot[data-color="bleu"] { background: #2563eb; }
    .color-dot[data-color="rouge"] { background: #dc2626; }
    .color-dot[data-color="rose"] { background: #ec4899; }
    .color-dot[data-color="vert"] { background: #16a34a; }
    .color-dot[data-color="beige"] { background: #d4a574; }
    .color-dot[data-color="gris"] { background: #6b7280; }
    .color-dot[data-color="marron"] { background: #78350f; }
    .color-dot[data-color="marine"] { background: #1e3a5f; }

    .more-colors {
      font-size: 0.7rem;
      color: #666;
    }

    .product-name {
      display: block;
      font-family: 'std55', sans-serif;
      font-size: 0.9rem;
      color: #1a1a1a;
      text-decoration: none;
      margin-bottom: 0.5rem;
      line-height: 1.3;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .product-name:hover {
      text-decoration: underline;
    }

    .product-price {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .current-price {
      font-family: 'std95', sans-serif;
      font-size: 1rem;
      color: #1a1a1a;
    }

    .original-price {
      font-size: 0.85rem;
      color: #999;
      text-decoration: line-through;
    }

    /* Recommendation Reason */
    .recommendation-reason {
      display: flex;
      align-items: flex-start;
      gap: 0.35rem;
      padding: 0.5rem;
      background: #f8f8f8;
      border-radius: 6px;
      margin-top: 0.5rem;
    }

    .reason-icon {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      color: #666;
      margin-top: 0.1rem;
    }

    .reason-text {
      font-size: 0.75rem;
      color: #666;
      line-height: 1.4;
    }

    /* Skeleton Loading */
    .product-skeleton {
      background: #fff;
      border-radius: 8px;
      overflow: hidden;
    }

    .skeleton-image {
      aspect-ratio: 3/4;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    .skeleton-content {
      padding: 1rem;
    }

    .skeleton-title {
      height: 16px;
      background: #f0f0f0;
      border-radius: 4px;
      margin-bottom: 0.5rem;
      width: 80%;
    }

    .skeleton-price {
      height: 14px;
      background: #f0f0f0;
      border-radius: 4px;
      margin-bottom: 0.5rem;
      width: 40%;
    }

    .skeleton-reason {
      height: 32px;
      background: #f0f0f0;
      border-radius: 6px;
      width: 100%;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: #666;
    }

    /* Responsive */
    @media (max-width: 1200px) {
      .products-grid.grid-4 {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 900px) {
      .products-grid.grid-4,
      .products-grid.grid-3 {
        grid-template-columns: repeat(2, 1fr);
      }

      .section-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
      }

      .section-title {
        font-size: 1.5rem;
      }
    }

    @media (max-width: 600px) {
      .premium-recommendations {
        padding: 1.5rem 0;
      }

      .products-grid {
        gap: 1rem;
        padding: 0 0.75rem;
      }

      .section-header {
        padding: 0 0.75rem;
      }

      .section-title {
        font-size: 1.25rem;
      }

      .product-info {
        padding: 0.75rem;
      }

      .product-name {
        font-size: 0.85rem;
      }

      .current-price {
        font-size: 0.9rem;
      }
    }
  `]
})
export class PremiumRecommendationsComponent implements OnInit, OnChanges {
  private recommendationsService = inject(PremiumRecommendationsService);

  // Inputs
  @Input() strategy: RecommendationStrategy = 'trending';
  @Input() productId?: number;
  @Input() productName?: string;
  @Input() limit: number = 8;
  @Input() family?: string;
  @Input() style?: string;
  @Input() cartProductIds?: number[];

  // Display options
  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() showBadge: boolean = true;
  @Input() showReason: boolean = true;
  @Input() showViewAll: boolean = false;
  @Input() viewAllLink?: string;
  @Input() displayMode: 'grid' | 'carousel' | 'compact' = 'grid';

  // User context for personalized recommendations
  @Input() wishlist: any[] = [];
  @Input() orders: any[] = [];
  @Input() viewedProducts: number[] = [];

  // Outputs
  @Output() productClick = new EventEmitter<{ product: RecommendedProduct; position: number }>();
  @Output() loaded = new EventEmitter<RecommendationSet>();
  @Output() addToWishlist = new EventEmitter<RecommendedProduct>();

  // State
  isLoading = true;
  recommendations: RecommendationSet | null = null;

  ngOnInit(): void {
    this.loadRecommendations();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['strategy'] || changes['productId'] || changes['family'] || changes['cartProductIds']) {
      this.loadRecommendations();
    }
  }

  loadRecommendations(): void {
    this.isLoading = true;

    let request$;

    switch (this.strategy) {
      case 'similar':
        if (!this.productId) return;
        request$ = this.recommendationsService.getSimilarProducts(this.productId, this.limit);
        break;

      case 'complementary':
        if (!this.productId) return;
        request$ = this.recommendationsService.getComplementaryProducts(this.productId, this.limit);
        break;

      case 'complete_the_look':
        if (!this.productId) return;
        request$ = this.recommendationsService.getCompleteTheLook(this.productId, this.limit);
        break;

      case 'premium_alternative':
        if (!this.productId) return;
        request$ = this.recommendationsService.getPremiumAlternatives(this.productId, this.limit);
        break;

      case 'affordable_alternative':
        if (!this.productId) return;
        request$ = this.recommendationsService.getAffordableAlternatives(this.productId, this.limit);
        break;

      case 'trending':
        request$ = this.recommendationsService.getTrendingProducts(this.limit, this.family);
        break;

      case 'new_arrivals':
        request$ = this.recommendationsService.getNewArrivals(this.limit, this.family);
        break;

      case 'seasonal':
        request$ = this.recommendationsService.getSeasonalPicks(this.limit, this.family);
        break;

      case 'editorial':
        request$ = this.recommendationsService.getEditorialSelection(this.limit);
        break;

      case 'personalized':
        request$ = this.recommendationsService.getPersonalizedRecommendations(
          this.wishlist,
          this.orders,
          this.viewedProducts,
          this.limit
        );
        break;

      case 'cart_recommendations':
        if (!this.cartProductIds?.length) return;
        request$ = this.recommendationsService.getCartRecommendations(this.cartProductIds, this.limit);
        break;

      case 'style':
        if (!this.style) return;
        request$ = this.recommendationsService.getStyleRecommendations(
          this.style as any,
          this.limit
        );
        break;

      default:
        request$ = this.recommendationsService.getTrendingProducts(this.limit, this.family);
    }

    request$.subscribe({
      next: (data) => {
        this.recommendations = data && data.products ? data : { products: [], metadata: {} };
        this.isLoading = false;
        this.loaded.emit(data);
      },
      error: (err) => {
        console.error('Error loading recommendations:', err);
        this.recommendations = { products: [], metadata: {} };
        this.isLoading = false;
      }
    });
  }

  trackByProductId(index: number, product: RecommendedProduct): number {
    return product.id;
  }

  onProductClick(product: RecommendedProduct, position: number): void {
    this.productClick.emit({ product, position });
  }

  onAddToWishlist(event: Event, product: RecommendedProduct): void {
    event.preventDefault();
    event.stopPropagation();
    this.addToWishlist.emit(product);
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'https://barsha.com.tn/assets/images/placeholder.jpg';
  }
}
