/**
 * BARSHA CART RECOMMENDATIONS COMPONENT
 * =====================================
 * Next-generation cart-based recommendations for checkout flow.
 *
 * Features:
 * - Cart complement suggestions
 * - Quick add to cart
 * - Conversion-optimized layout
 * - Mobile-first design
 */

import { Component, Input, OnInit, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NextGenRecommendationsService, RecommendedProduct } from '../../../services/next-gen-recommendations.service';

@Component({
  selector: 'app-cart-recommendations-nextgen',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <section class="cart-recs" *ngIf="recommendations.length > 0" role="complementary" aria-label="Produits complémentaires">
      <header class="cart-recs-header">
        <div class="cart-recs-title-group">
          <h3 class="cart-recs-title">{{ title }}</h3>
          <p class="cart-recs-subtitle" *ngIf="subtitle">{{ subtitle }}</p>
        </div>
        <span class="cart-recs-badge" *ngIf="showAiBadge">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z"/>
          </svg>
          IA
        </span>
      </header>

      <div class="cart-recs-grid" [class.compact]="compact">
        <article
          *ngFor="let product of recommendations; let i = index"
          class="cart-rec-card"
          [attr.data-position]="i + 1"
        >
          <a
            [routerLink]="['/produit', product.id + '-' + slugify(product.name)]"
            class="cart-rec-link"
            (click)="onProductClick(product, i)"
          >
            <div class="cart-rec-image-wrapper">
              <img
                [src]="product.image"
                [alt]="product.name"
                class="cart-rec-image"
                loading="lazy"
              >
              <div class="cart-rec-overlay">
                <span class="view-product">Voir</span>
              </div>
            </div>
          </a>

          <div class="cart-rec-info">
            <h4 class="cart-rec-name">{{ product.name }}</h4>
            <p class="cart-rec-price">{{ product.price }}</p>

            <p class="cart-rec-reason" *ngIf="showReason && product.reasonText">
              {{ product.reasonText }}
            </p>
          </div>

          <button
            *ngIf="showQuickAdd"
            class="cart-rec-add-btn"
            (click)="onQuickAdd(product)"
            [attr.aria-label]="'Ajouter ' + product.name + ' au panier'"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Ajouter
          </button>
        </article>
      </div>

      <!-- Loading State -->
      <div class="cart-recs-loading" *ngIf="isLoading">
        <div class="cart-rec-skeleton" *ngFor="let i of [1,2,3,4]">
          <div class="skeleton-image"></div>
          <div class="skeleton-text"></div>
          <div class="skeleton-price"></div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .cart-recs {
      padding: 1.5rem;
      background: linear-gradient(180deg, #fafafa 0%, #fff 100%);
      border-radius: 12px;
      margin: 1rem 0;
    }

    .cart-recs-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.25rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid #eee;
    }

    .cart-recs-title-group {
      flex: 1;
    }

    .cart-recs-title {
      font-family: 'std95', sans-serif;
      font-size: 1.125rem;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 0.25rem;
      letter-spacing: 0.02em;
    }

    .cart-recs-subtitle {
      font-family: 'std55', sans-serif;
      font-size: 0.875rem;
      color: #666;
      margin: 0;
    }

    .cart-recs-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.35rem 0.6rem;
      background: linear-gradient(135deg, #1a1a1a 0%, #333 100%);
      color: #fff;
      border-radius: 20px;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.05em;
    }

    .cart-recs-badge svg {
      width: 10px;
      height: 10px;
    }

    .cart-recs-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
    }

    .cart-recs-grid.compact {
      grid-template-columns: repeat(2, 1fr);
    }

    .cart-rec-card {
      display: flex;
      flex-direction: column;
      background: #fff;
      border-radius: 8px;
      overflow: hidden;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .cart-rec-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }

    .cart-rec-link {
      text-decoration: none;
      color: inherit;
    }

    .cart-rec-image-wrapper {
      position: relative;
      aspect-ratio: 3/4;
      overflow: hidden;
      background: #f5f5f5;
    }

    .cart-rec-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }

    .cart-rec-card:hover .cart-rec-image {
      transform: scale(1.03);
    }

    .cart-rec-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s ease;
    }

    .cart-rec-card:hover .cart-rec-overlay {
      background: rgba(0,0,0,0.2);
    }

    .view-product {
      opacity: 0;
      transform: translateY(10px);
      padding: 0.5rem 1rem;
      background: #fff;
      color: #1a1a1a;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: 4px;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    .cart-rec-card:hover .view-product {
      opacity: 1;
      transform: translateY(0);
    }

    .cart-rec-info {
      padding: 0.75rem;
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .cart-rec-name {
      font-family: 'std55', sans-serif;
      font-size: 0.8rem;
      font-weight: 500;
      color: #1a1a1a;
      margin: 0 0 0.25rem;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .cart-rec-price {
      font-family: 'std95', sans-serif;
      font-size: 0.85rem;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 0.5rem;
    }

    .cart-rec-reason {
      font-family: 'std45', sans-serif;
      font-size: 0.7rem;
      color: #888;
      margin: 0;
      font-style: italic;
      line-height: 1.3;
    }

    .cart-rec-add-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      width: calc(100% - 1.5rem);
      margin: 0 0.75rem 0.75rem;
      padding: 0.6rem;
      background: #1a1a1a;
      color: #fff;
      border: none;
      border-radius: 4px;
      font-family: 'std55', sans-serif;
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s ease, transform 0.1s ease;
    }

    .cart-rec-add-btn:hover {
      background: #333;
    }

    .cart-rec-add-btn:active {
      transform: scale(0.98);
    }

    .cart-rec-add-btn svg {
      width: 14px;
      height: 14px;
    }

    /* Loading skeleton */
    .cart-recs-loading {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
    }

    .cart-rec-skeleton {
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

    .skeleton-text {
      height: 14px;
      margin: 0.75rem;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }

    .skeleton-price {
      height: 16px;
      width: 60%;
      margin: 0 0.75rem 0.75rem;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* Responsive */
    @media (max-width: 900px) {
      .cart-recs-grid {
        grid-template-columns: repeat(3, 1fr);
      }
      .cart-recs-loading {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 600px) {
      .cart-recs {
        padding: 1rem;
        margin: 0.75rem 0;
      }

      .cart-recs-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem;
      }

      .cart-recs-loading {
        grid-template-columns: repeat(2, 1fr);
      }

      .cart-recs-title {
        font-size: 1rem;
      }

      .cart-rec-name {
        font-size: 0.75rem;
      }

      .cart-rec-price {
        font-size: 0.8rem;
      }
    }
  `]
})
export class CartRecommendationsNextGenComponent implements OnInit, OnChanges {
  @Input() cartProductIds: number[] = [];
  @Input() title: string = 'Complétez votre panier';
  @Input() subtitle: string = 'Articles qui accompagnent parfaitement votre sélection';
  @Input() limit: number = 4;
  @Input() showAiBadge: boolean = true;
  @Input() showReason: boolean = true;
  @Input() showQuickAdd: boolean = true;
  @Input() compact: boolean = false;

  @Output() productClicked = new EventEmitter<{ product: RecommendedProduct; position: number }>();
  @Output() quickAddClicked = new EventEmitter<RecommendedProduct>();

  recommendations: RecommendedProduct[] = [];
  isLoading: boolean = false;
  private lastRequestKey: string | null = null;

  constructor(private recommendationsService: NextGenRecommendationsService) {}

  ngOnInit(): void {
    this.loadRecommendations();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['cartProductIds'] && !changes['cartProductIds'].firstChange) {
      this.loadRecommendations();
    }
  }

  private loadRecommendations(): void {
    const normalizedIds = Array.from(
      new Set((this.cartProductIds || []).filter((id): id is number => Number.isFinite(id)))
    ).sort((left, right) => left - right);

    if (normalizedIds.length === 0) {
      this.recommendations = [];
      this.lastRequestKey = null;
      return;
    }

    const requestKey = `${normalizedIds.join(',')}::${this.limit}`;
    if (this.lastRequestKey === requestKey) {
      return;
    }

    this.lastRequestKey = requestKey;

    this.isLoading = true;

    this.recommendationsService.getCartRecommendations(normalizedIds, this.limit).subscribe({
      next: (response) => {
        this.recommendations = response.products || [];
        this.isLoading = false;

        // Track impressions
        if (this.recommendations.length > 0) {
          this.recommendations.forEach((product) => {
            this.recommendationsService.trackImpression(product);
          });
        }
      },
      error: (err) => {
        console.error('Error loading cart recommendations:', err);
        this.recommendations = [];
        this.isLoading = false;
        this.lastRequestKey = null;
      }
    });
  }

  onProductClick(product: RecommendedProduct, position: number): void {
    this.recommendationsService.trackClick(product);
    this.productClicked.emit({ product, position });
  }

  onQuickAdd(product: RecommendedProduct): void {
    this.recommendationsService.trackAddToCart(product);
    this.quickAddClicked.emit(product);
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
