/**
 * BARSHA ACCOUNT RECOMMENDATIONS COMPONENT
 * ========================================
 * Personalized recommendations for user account dashboard.
 *
 * Features:
 * - Style profile based recommendations
 * - Based on purchase history
 * - Based on wishlist
 * - Recently viewed recovery
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NextGenRecommendationsService, RecommendedProduct, UserContext } from '../../../services/next-gen-recommendations.service';

@Component({
  selector: 'app-account-recommendations',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="account-recs-container" *ngIf="hasRecommendations">
      <!-- Your Style Edit Section -->
      <section class="account-recs-section style-edit" *ngIf="styleEditProducts.length > 0">
        <header class="section-header">
          <div class="header-content">
            <h2 class="section-title">Votre sélection personnalisée</h2>
            <p class="section-subtitle">Basée sur vos préférences et votre historique</p>
          </div>
          <span class="ai-badge">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z"/>
            </svg>
            Recommandation IA
          </span>
        </header>

        <div class="products-grid">
          <article
            *ngFor="let product of styleEditProducts; let i = index"
            class="product-card"
          >
            <a
              [routerLink]="['/produit', product.id + '-' + slugify(product.name)]"
              class="product-link"
              (click)="trackClick(product, i, 'personalized')"
            >
              <div class="image-wrapper">
                <img [src]="product.image" [alt]="product.name" loading="lazy">
                <div class="hover-overlay">
                  <span class="view-text">Voir le produit</span>
                </div>
              </div>
              <div class="product-info">
                <h3 class="product-name">{{ product.name }}</h3>
                <p class="product-price">{{ product.price }}</p>
                <p class="product-reason" *ngIf="product.reasonText">{{ product.reasonText }}</p>
              </div>
            </a>
          </article>
        </div>
      </section>

      <!-- Recently Viewed Recovery -->
      <section class="account-recs-section recently-viewed" *ngIf="recentlyViewedProducts.length > 0">
        <header class="section-header">
          <div class="header-content">
            <h2 class="section-title">Reprendre où vous en étiez</h2>
            <p class="section-subtitle">Articles que vous avez récemment consultés</p>
          </div>
        </header>

        <div class="products-scroll-container">
          <div class="products-scroll">
            <article
              *ngFor="let product of recentlyViewedProducts; let i = index"
              class="product-card compact"
            >
              <a
                [routerLink]="['/produit', product.id + '-' + slugify(product.name)]"
                class="product-link"
                (click)="trackClick(product, i, 'because_you_viewed')"
              >
                <div class="image-wrapper">
                  <img [src]="product.image" [alt]="product.name" loading="lazy">
                </div>
                <div class="product-info">
                  <h3 class="product-name">{{ product.name }}</h3>
                  <p class="product-price">{{ product.price }}</p>
                </div>
              </a>
            </article>
          </div>
        </div>
      </section>

      <!-- Based on Wishlist -->
      <section class="account-recs-section wishlist-based" *ngIf="wishlistBasedProducts.length > 0">
        <header class="section-header">
          <div class="header-content">
            <h2 class="section-title">Inspiré de vos favoris</h2>
            <p class="section-subtitle">Des pièces qui correspondent à vos goûts</p>
          </div>
        </header>

        <div class="products-grid small">
          <article
            *ngFor="let product of wishlistBasedProducts; let i = index"
            class="product-card"
          >
            <a
              [routerLink]="['/produit', product.id + '-' + slugify(product.name)]"
              class="product-link"
              (click)="trackClick(product, i, 'customers_also_liked')"
            >
              <div class="image-wrapper">
                <img [src]="product.image" [alt]="product.name" loading="lazy">
                <div class="hover-overlay">
                  <span class="view-text">Voir</span>
                </div>
              </div>
              <div class="product-info">
                <h3 class="product-name">{{ product.name }}</h3>
                <p class="product-price">{{ product.price }}</p>
              </div>
            </a>
          </article>
        </div>
      </section>

      <!-- Loading State -->
      <div class="loading-state" *ngIf="isLoading">
        <div class="loading-section">
          <div class="loading-header">
            <div class="loading-title"></div>
            <div class="loading-subtitle"></div>
          </div>
          <div class="loading-grid">
            <div class="loading-card" *ngFor="let i of [1,2,3,4]">
              <div class="loading-image"></div>
              <div class="loading-content">
                <div class="loading-text"></div>
                <div class="loading-price"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .account-recs-container {
      padding: 1rem 0;
    }

    .account-recs-section {
      margin-bottom: 2.5rem;
      padding: 1.5rem;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #f0f0f0;
    }

    .header-content {
      flex: 1;
    }

    .section-title {
      font-family: 'std95', sans-serif;
      font-size: 1.25rem;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 0.35rem;
      letter-spacing: 0.01em;
    }

    .section-subtitle {
      font-family: 'std55', sans-serif;
      font-size: 0.9rem;
      color: #666;
      margin: 0;
    }

    .ai-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.4rem 0.75rem;
      background: linear-gradient(135deg, #1a1a1a 0%, #333 100%);
      color: #fff;
      border-radius: 20px;
      font-family: 'std55', sans-serif;
      font-size: 0.7rem;
      font-weight: 500;
      letter-spacing: 0.03em;
    }

    .ai-badge svg {
      width: 12px;
      height: 12px;
    }

    .products-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.25rem;
    }

    .products-grid.small {
      grid-template-columns: repeat(6, 1fr);
    }

    .products-scroll-container {
      overflow-x: auto;
      margin: 0 -1.5rem;
      padding: 0 1.5rem;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .products-scroll-container::-webkit-scrollbar {
      display: none;
    }

    .products-scroll {
      display: flex;
      gap: 1rem;
      padding-bottom: 0.5rem;
    }

    .products-scroll .product-card {
      flex: 0 0 180px;
    }

    .product-card {
      background: #fff;
      border-radius: 8px;
      overflow: hidden;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .product-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }

    .product-card.compact {
      border: 1px solid #f0f0f0;
    }

    .product-link {
      text-decoration: none;
      color: inherit;
      display: block;
    }

    .image-wrapper {
      position: relative;
      aspect-ratio: 3/4;
      overflow: hidden;
      background: #f8f8f8;
    }

    .image-wrapper img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }

    .product-card:hover .image-wrapper img {
      transform: scale(1.03);
    }

    .hover-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s ease;
    }

    .product-card:hover .hover-overlay {
      background: rgba(0,0,0,0.2);
    }

    .view-text {
      opacity: 0;
      transform: translateY(8px);
      padding: 0.5rem 1rem;
      background: #fff;
      color: #1a1a1a;
      font-family: 'std55', sans-serif;
      font-size: 0.75rem;
      font-weight: 500;
      border-radius: 4px;
      transition: all 0.2s ease;
    }

    .product-card:hover .view-text {
      opacity: 1;
      transform: translateY(0);
    }

    .product-info {
      padding: 0.85rem;
    }

    .product-name {
      font-family: 'std55', sans-serif;
      font-size: 0.85rem;
      font-weight: 500;
      color: #1a1a1a;
      margin: 0 0 0.25rem;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .product-price {
      font-family: 'std95', sans-serif;
      font-size: 0.9rem;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 0.35rem;
    }

    .product-reason {
      font-family: 'std45', sans-serif;
      font-size: 0.7rem;
      color: #888;
      margin: 0;
      font-style: italic;
      line-height: 1.3;
    }

    /* Loading */
    .loading-state {
      padding: 1rem 0;
    }

    .loading-section {
      background: #fff;
      border-radius: 12px;
      padding: 1.5rem;
    }

    .loading-header {
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #f0f0f0;
    }

    .loading-title {
      height: 24px;
      width: 200px;
      background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }

    .loading-subtitle {
      height: 16px;
      width: 150px;
      background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }

    .loading-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.25rem;
    }

    .loading-card {
      border-radius: 8px;
      overflow: hidden;
    }

    .loading-image {
      aspect-ratio: 3/4;
      background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    .loading-content {
      padding: 0.85rem;
    }

    .loading-text {
      height: 14px;
      background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }

    .loading-price {
      height: 16px;
      width: 60%;
      background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* Responsive */
    @media (max-width: 1024px) {
      .products-grid {
        grid-template-columns: repeat(3, 1fr);
      }
      .products-grid.small {
        grid-template-columns: repeat(4, 1fr);
      }
      .loading-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 768px) {
      .account-recs-section {
        padding: 1.25rem;
        margin-bottom: 1.5rem;
      }

      .section-header {
        flex-direction: column;
        gap: 0.75rem;
      }

      .section-title {
        font-size: 1.1rem;
      }

      .products-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
      }

      .products-grid.small {
        grid-template-columns: repeat(3, 1fr);
      }

      .loading-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 480px) {
      .account-recs-section {
        padding: 1rem;
      }

      .products-grid.small {
        grid-template-columns: repeat(2, 1fr);
      }

      .product-info {
        padding: 0.65rem;
      }

      .product-name {
        font-size: 0.8rem;
      }

      .product-price {
        font-size: 0.85rem;
      }
    }
  `]
})
export class AccountRecommendationsComponent implements OnInit {
  styleEditProducts: RecommendedProduct[] = [];
  recentlyViewedProducts: RecommendedProduct[] = [];
  wishlistBasedProducts: RecommendedProduct[] = [];
  isLoading: boolean = true;

  constructor(private recommendationsService: NextGenRecommendationsService) {}

  ngOnInit(): void {
    this.loadAllRecommendations();
  }

  get hasRecommendations(): boolean {
    return this.styleEditProducts.length > 0 ||
           this.recentlyViewedProducts.length > 0 ||
           this.wishlistBasedProducts.length > 0;
  }

  private loadAllRecommendations(): void {
    this.isLoading = true;

    // Build user context from localStorage
    const userContext = this.buildUserContext();

    // Load personalized style edit
    this.recommendationsService.getPersonalized(userContext, 4).subscribe({
      next: (response: any) => {
        this.styleEditProducts = response.products || [];
        this.trackImpressions(this.styleEditProducts, 'personalized');
      },
      error: () => this.styleEditProducts = []
    });

    // Load recently viewed recovery
    const viewedIds = this.getRecentlyViewedIds();
    if (viewedIds.length > 0) {
      this.recommendationsService.getBecauseYouViewed(viewedIds, 8).subscribe({
        next: (response: any) => {
          this.recentlyViewedProducts = response.products || [];
          this.trackImpressions(this.recentlyViewedProducts, 'because_you_viewed');
        },
        error: () => this.recentlyViewedProducts = []
      });
    }

    // Load wishlist based
    const wishlistIds = this.getWishlistIds();
    if (wishlistIds.length > 0) {
      this.recommendationsService.getCustomersAlsoLiked(wishlistIds, 6).subscribe({
        next: (response: any) => {
          this.wishlistBasedProducts = response.products || [];
          this.trackImpressions(this.wishlistBasedProducts, 'customers_also_liked');
        },
        error: () => this.wishlistBasedProducts = []
      });
    }

    // End loading after a short delay
    setTimeout(() => {
      this.isLoading = false;
    }, 1000);
  }

  private buildUserContext(): UserContext {
    return {
      userId: localStorage.getItem('userId') || undefined,
      sessionId: sessionStorage.getItem('barsha_session_id') || undefined,
      viewedProductIds: this.getRecentlyViewedIds(),
      wishlistProductIds: this.getWishlistIds(),
      cartProductIds: this.getCartIds(),
      purchasedProductIds: []
    };
  }

  private getRecentlyViewedIds(): number[] {
    try {
      const stored = localStorage.getItem('recentlyViewed');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private getWishlistIds(): number[] {
    try {
      const wishlist = localStorage.getItem('wishlist');
      if (wishlist) {
        const items = JSON.parse(wishlist);
        return items.map((item: any) => item.id || item.productId).filter(Boolean);
      }
    } catch {}
    return [];
  }

  private getCartIds(): number[] {
    try {
      const cart = localStorage.getItem('cart');
      if (cart) {
        const items = JSON.parse(cart);
        return items.map((item: any) => item.productId || item.id).filter(Boolean);
      }
    } catch {}
    return [];
  }

  private trackImpressions(products: RecommendedProduct[], _strategy: string): void {
    products.forEach((product) => {
      this.recommendationsService.trackImpression(product);
    });
  }

  trackClick(product: RecommendedProduct, _position: number, _strategy: string): void {
    this.recommendationsService.trackClick(product);
  }

  slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
