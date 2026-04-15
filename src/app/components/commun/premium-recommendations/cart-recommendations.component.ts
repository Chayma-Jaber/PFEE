/**
 * Cart Recommendations Component
 * ===============================
 * Displays recommendations based on cart contents at checkout.
 */

import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PremiumRecommendationsComponent } from './premium-recommendations.component';
import { RecommendedProduct } from '../../../services/premium-recommendations.service';

@Component({
  selector: 'app-cart-recommendations',
  standalone: true,
  imports: [CommonModule, PremiumRecommendationsComponent],
  template: `
    <div class="cart-recommendations" *ngIf="cartProductIds?.length">
      <div class="cart-rec-header">
        <h3 class="cart-rec-title">Pour completer votre commande</h3>
        <p class="cart-rec-subtitle">Dernieres suggestions avant validation</p>
      </div>

      <app-premium-recommendations
        strategy="cart_recommendations"
        [cartProductIds]="cartProductIds"
        [limit]="4"
        [showBadge]="true"
        [showReason]="true"
        [title]="''"
        (productClick)="onProductClick($event)"
        (addToWishlist)="onAddToWishlist($event)"
      ></app-premium-recommendations>

      <div class="quick-add-section" *ngIf="quickAddProducts.length > 0">
        <h4 class="quick-add-title">Ajout rapide</h4>
        <div class="quick-add-grid">
          <div
            class="quick-add-item"
            *ngFor="let product of quickAddProducts"
            (click)="onQuickAdd(product)"
          >
            <img [src]="product.image" [alt]="product.name" class="quick-add-image" />
            <div class="quick-add-info">
              <span class="quick-add-name">{{ product.name }}</span>
              <span class="quick-add-price">{{ product.price }}</span>
            </div>
            <button class="quick-add-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .cart-recommendations {
      background: #fafafa;
      padding: 1.5rem;
      border-radius: 12px;
      margin: 1.5rem 0;
    }

    .cart-rec-header {
      text-align: center;
      margin-bottom: 1.5rem;
    }

    .cart-rec-title {
      font-family: 'std95', sans-serif;
      font-size: 1.25rem;
      color: #1a1a1a;
      margin: 0 0 0.25rem 0;
    }

    .cart-rec-subtitle {
      font-size: 0.9rem;
      color: #666;
      margin: 0;
    }

    .quick-add-section {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid #eee;
    }

    .quick-add-title {
      font-family: 'std55', sans-serif;
      font-size: 1rem;
      color: #1a1a1a;
      margin: 0 0 1rem 0;
    }

    .quick-add-grid {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .quick-add-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      background: #fff;
      border-radius: 8px;
      cursor: pointer;
      transition: box-shadow 0.2s;
    }

    .quick-add-item:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .quick-add-image {
      width: 48px;
      height: 48px;
      object-fit: cover;
      border-radius: 6px;
    }

    .quick-add-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .quick-add-name {
      font-size: 0.85rem;
      color: #1a1a1a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .quick-add-price {
      font-size: 0.8rem;
      color: #666;
    }

    .quick-add-btn {
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 50%;
      background: #1a1a1a;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.2s;
    }

    .quick-add-btn:hover {
      transform: scale(1.1);
    }

    .quick-add-btn svg {
      width: 16px;
      height: 16px;
    }
  `]
})
export class CartRecommendationsComponent {
  @Input() cartProductIds: number[] = [];
  @Input() quickAddProducts: RecommendedProduct[] = [];

  @Output() productClick = new EventEmitter<{ product: RecommendedProduct; position: number }>();
  @Output() addToCart = new EventEmitter<RecommendedProduct>();
  @Output() addToWishlistEvent = new EventEmitter<RecommendedProduct>();

  onProductClick(event: { product: RecommendedProduct; position: number }): void {
    this.productClick.emit(event);
  }

  onQuickAdd(product: RecommendedProduct): void {
    this.addToCart.emit(product);
  }

  onAddToWishlist(product: RecommendedProduct): void {
    this.addToWishlistEvent.emit(product);
  }
}
