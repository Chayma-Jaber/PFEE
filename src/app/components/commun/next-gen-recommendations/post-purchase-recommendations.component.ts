/**
 * BARSHA POST-PURCHASE RECOMMENDATIONS COMPONENT
 * ===============================================
 * Recommendations for order confirmation page to drive repeat purchases.
 *
 * Features:
 * - Complementary to purchased items
 * - "Complete your wardrobe" suggestions
 * - Trending items encouragement
 * - Elegant success-context design
 */

import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NextGenRecommendationsService, RecommendedProduct } from '../../../services/next-gen-recommendations.service';

@Component({
  selector: 'app-post-purchase-recommendations',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <section class="post-purchase-recs" *ngIf="recommendations.length > 0" role="complementary">
      <div class="post-purchase-header">
        <div class="header-decoration">
          <span class="decoration-line"></span>
          <svg class="header-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z"/>
          </svg>
          <span class="decoration-line"></span>
        </div>
        <h2 class="post-purchase-title">{{ title }}</h2>
        <p class="post-purchase-subtitle">{{ subtitle }}</p>
      </div>

      <div class="post-purchase-grid">
        <article
          *ngFor="let product of recommendations; let i = index"
          class="post-purchase-card"
          [attr.data-position]="i + 1"
        >
          <a
            [routerLink]="['/produit', product.id + '-' + slugify(product.name)]"
            class="card-link"
            (click)="onProductClick(product, i)"
          >
            <div class="card-image-container">
              <img
                [src]="product.image"
                [alt]="product.name"
                class="card-image"
                loading="lazy"
              >
              <div class="card-hover-overlay">
                <span class="discover-text">Découvrir</span>
              </div>
            </div>

            <div class="card-content">
              <h3 class="card-name">{{ product.name }}</h3>
              <p class="card-price">{{ product.price }}</p>
              <p class="card-reason" *ngIf="product.reasonText">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z"/>
                </svg>
                {{ product.reasonText }}
              </p>
            </div>
          </a>
        </article>
      </div>

      <div class="post-purchase-cta">
        <a routerLink="/shop" class="continue-shopping-btn">
          Continuer mes achats
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </a>
      </div>

      <!-- Loading State -->
      <div class="loading-container" *ngIf="isLoading">
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
    </section>
  `,
  styles: [`
    .post-purchase-recs {
      padding: 2.5rem 1.5rem;
      background: linear-gradient(180deg, #fff 0%, #fafafa 100%);
      margin-top: 2rem;
      border-top: 1px solid #eee;
    }

    .post-purchase-header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .header-decoration {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .decoration-line {
      width: 60px;
      height: 1px;
      background: linear-gradient(90deg, transparent, #ccc, transparent);
    }

    .header-icon {
      width: 20px;
      height: 20px;
      color: #1a1a1a;
      animation: sparkle 2s ease-in-out infinite;
    }

    @keyframes sparkle {
      0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
      50% { transform: scale(1.1) rotate(180deg); opacity: 0.8; }
    }

    .post-purchase-title {
      font-family: 'std95', sans-serif;
      font-size: 1.5rem;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 0.5rem;
      letter-spacing: 0.02em;
    }

    .post-purchase-subtitle {
      font-family: 'std55', sans-serif;
      font-size: 0.95rem;
      color: #666;
      margin: 0;
      max-width: 400px;
      margin: 0 auto;
    }

    .post-purchase-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.25rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .post-purchase-card {
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .post-purchase-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.08);
    }

    .card-link {
      text-decoration: none;
      color: inherit;
      display: block;
    }

    .card-image-container {
      position: relative;
      aspect-ratio: 3/4;
      overflow: hidden;
      background: #f8f8f8;
    }

    .card-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.4s ease;
    }

    .post-purchase-card:hover .card-image {
      transform: scale(1.05);
    }

    .card-hover-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.3s ease;
    }

    .post-purchase-card:hover .card-hover-overlay {
      background: rgba(0,0,0,0.25);
    }

    .discover-text {
      opacity: 0;
      transform: translateY(10px);
      padding: 0.6rem 1.25rem;
      background: #fff;
      color: #1a1a1a;
      font-family: 'std55', sans-serif;
      font-size: 0.85rem;
      font-weight: 500;
      border-radius: 6px;
      transition: all 0.3s ease;
    }

    .post-purchase-card:hover .discover-text {
      opacity: 1;
      transform: translateY(0);
    }

    .card-content {
      padding: 1rem;
    }

    .card-name {
      font-family: 'std55', sans-serif;
      font-size: 0.9rem;
      font-weight: 500;
      color: #1a1a1a;
      margin: 0 0 0.35rem;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .card-price {
      font-family: 'std95', sans-serif;
      font-size: 1rem;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 0.5rem;
    }

    .card-reason {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-family: 'std45', sans-serif;
      font-size: 0.75rem;
      color: #888;
      margin: 0;
      font-style: italic;
    }

    .card-reason svg {
      width: 10px;
      height: 10px;
      flex-shrink: 0;
    }

    .post-purchase-cta {
      display: flex;
      justify-content: center;
      margin-top: 2rem;
    }

    .continue-shopping-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.9rem 2rem;
      background: #1a1a1a;
      color: #fff;
      text-decoration: none;
      font-family: 'std55', sans-serif;
      font-size: 0.9rem;
      font-weight: 500;
      border-radius: 6px;
      transition: background 0.2s ease, transform 0.1s ease;
    }

    .continue-shopping-btn:hover {
      background: #333;
    }

    .continue-shopping-btn:active {
      transform: scale(0.98);
    }

    .continue-shopping-btn svg {
      width: 18px;
      height: 18px;
    }

    /* Loading */
    .loading-container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .loading-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.25rem;
    }

    .loading-card {
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
    }

    .loading-image {
      aspect-ratio: 3/4;
      background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    .loading-content {
      padding: 1rem;
    }

    .loading-text {
      height: 16px;
      background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }

    .loading-price {
      height: 20px;
      width: 50%;
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
      .post-purchase-grid,
      .loading-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 768px) {
      .post-purchase-recs {
        padding: 2rem 1rem;
      }

      .post-purchase-grid,
      .loading-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
      }

      .post-purchase-title {
        font-size: 1.25rem;
      }

      .post-purchase-subtitle {
        font-size: 0.9rem;
      }
    }

    @media (max-width: 480px) {
      .card-content {
        padding: 0.75rem;
      }

      .card-name {
        font-size: 0.8rem;
      }

      .card-price {
        font-size: 0.9rem;
      }

      .continue-shopping-btn {
        padding: 0.75rem 1.5rem;
        font-size: 0.85rem;
      }
    }
  `]
})
export class PostPurchaseRecommendationsComponent implements OnInit, OnChanges {
  @Input() purchasedProductIds: number[] = [];
  @Input() title: string = 'Vous pourriez aussi aimer';
  @Input() subtitle: string = 'Des pièces soigneusement sélectionnées pour compléter votre garde-robe';
  @Input() limit: number = 4;

  recommendations: RecommendedProduct[] = [];
  isLoading: boolean = false;

  constructor(private recommendationsService: NextGenRecommendationsService) {}

  ngOnInit(): void {
    this.loadRecommendations();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['purchasedProductIds'] && !changes['purchasedProductIds'].firstChange) {
      this.loadRecommendations();
    }
  }

  private loadRecommendations(): void {
    this.isLoading = true;

    // If we have purchased product IDs, get complementary recommendations
    // Otherwise, get trending items
    if (this.purchasedProductIds && this.purchasedProductIds.length > 0) {
      // Use because_you_viewed or complementary strategy
      this.recommendationsService.getBecauseYouViewed(this.purchasedProductIds, this.limit).subscribe({
        next: (response) => {
          this.recommendations = response.products || [];
          this.isLoading = false;
          this.trackImpressions();
        },
        error: () => {
          // Fallback to trending
          this.loadTrending();
        }
      });
    } else {
      this.loadTrending();
    }
  }

  private loadTrending(): void {
    this.recommendationsService.getTrending(this.limit).subscribe({
      next: (response) => {
        this.recommendations = response.products || [];
        this.isLoading = false;
        this.trackImpressions();
      },
      error: (err) => {
        console.error('Error loading post-purchase recommendations:', err);
        this.recommendations = [];
        this.isLoading = false;
      }
    });
  }

  private trackImpressions(): void {
    if (this.recommendations.length > 0) {
      this.recommendations.forEach((product) => {
        this.recommendationsService.trackImpression(product);
      });
    }
  }

  onProductClick(product: RecommendedProduct, _position: number): void {
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
