/**
 * BARSHA BUNDLE CARD COMPONENT
 * =============================
 * Displays a bundle deal card with product images,
 * pricing, savings, and add-to-cart functionality.
 */

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Bundle, BundleService } from '../../../services/bundle.service';

@Component({
  selector: 'app-bundle-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <article class="bundle-card" [class.unavailable]="!isAvailable">
      <!-- Bundle Image Grid -->
      <div class="bundle-images">
        <div class="images-grid" [class.single]="previewImages.length === 1"
             [class.double]="previewImages.length === 2"
             [class.triple]="previewImages.length === 3"
             [class.quad]="previewImages.length >= 4">
          <div class="image-cell" *ngFor="let img of previewImages; let i = index">
            <img [src]="img"
                 [alt]="bundle.name + ' - Article ' + (i + 1)"
                 loading="lazy"
                 onerror="this.src='assets/images/placeholder.png'">
          </div>
          <div class="image-cell placeholder" *ngIf="previewImages.length === 0">
            <i class="fas fa-box-open"></i>
          </div>
        </div>

        <!-- Discount Badge -->
        <div class="discount-badge" *ngIf="bundle.discountPercentage > 0">
          -{{ bundle.discountPercentage | number:'1.0-0' }}%
        </div>

        <!-- Product Count Badge -->
        <div class="product-count">
          {{ bundle.productCount }} article{{ bundle.productCount > 1 ? 's' : '' }}
        </div>
      </div>

      <!-- Bundle Info -->
      <div class="bundle-info">
        <h3 class="bundle-name">{{ bundle.name }}</h3>
        <p class="bundle-description" *ngIf="bundle.description">{{ bundle.description }}</p>

        <!-- Pricing -->
        <div class="bundle-pricing">
          <div class="price-row">
            <span class="original-price" *ngIf="bundle.discountPercentage > 0">
              {{ formatPrice(bundle.totalOriginalPrice) }}
            </span>
            <span class="bundle-price">{{ formatPrice(bundle.bundlePrice) }}</span>
          </div>
          <div class="savings-badge" *ngIf="bundle.savingsAmount > 0">
            <i class="fas fa-tags"></i>
            Economisez {{ formatPrice(bundle.savingsAmount) }}
          </div>
        </div>

        <!-- Add to Cart Button -->
        <button class="add-bundle-btn"
                (click)="onAddToCart($event)"
                [disabled]="!isAvailable || isAdding">
          <span *ngIf="!isAdding">
            <i class="fas fa-shopping-bag"></i>
            Ajouter le lot
          </span>
          <span *ngIf="isAdding" class="loading">
            <i class="fas fa-spinner fa-spin"></i>
            Ajout...
          </span>
        </button>

        <!-- Unavailable Message -->
        <div class="unavailable-msg" *ngIf="!isAvailable">
          <i class="fas fa-exclamation-circle"></i>
          Offre non disponible
        </div>
      </div>
    </article>
  `,
  styles: [`
    .bundle-card {
      background: #fff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
      transition: all 0.3s ease;
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .bundle-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }

    .bundle-card.unavailable {
      opacity: 0.7;
    }

    /* Image Grid */
    .bundle-images {
      position: relative;
      aspect-ratio: 1;
      overflow: hidden;
    }

    .images-grid {
      display: grid;
      width: 100%;
      height: 100%;
      gap: 2px;
    }

    .images-grid.single {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr;
    }

    .images-grid.double {
      grid-template-columns: repeat(2, 1fr);
      grid-template-rows: 1fr;
    }

    .images-grid.triple {
      grid-template-columns: repeat(2, 1fr);
      grid-template-rows: repeat(2, 1fr);
    }

    .images-grid.triple .image-cell:first-child {
      grid-row: span 2;
    }

    .images-grid.quad {
      grid-template-columns: repeat(2, 1fr);
      grid-template-rows: repeat(2, 1fr);
    }

    .image-cell {
      overflow: hidden;
      background: #f5f5f5;
    }

    .image-cell img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }

    .bundle-card:hover .image-cell img {
      transform: scale(1.05);
    }

    .image-cell.placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ccc;
      font-size: 48px;
    }

    /* Badges */
    .discount-badge {
      position: absolute;
      top: 12px;
      left: 12px;
      background: linear-gradient(135deg, #e53935 0%, #c62828 100%);
      color: #fff;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 2px 8px rgba(229, 57, 53, 0.4);
    }

    .product-count {
      position: absolute;
      bottom: 12px;
      right: 12px;
      background: rgba(0, 0, 0, 0.7);
      color: #fff;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    /* Bundle Info */
    .bundle-info {
      padding: 16px;
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .bundle-name {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a2e;
      margin: 0 0 6px;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .bundle-description {
      font-size: 13px;
      color: #666;
      margin: 0 0 12px;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* Pricing */
    .bundle-pricing {
      margin-top: auto;
      margin-bottom: 12px;
    }

    .price-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .original-price {
      font-size: 14px;
      color: #999;
      text-decoration: line-through;
    }

    .bundle-price {
      font-size: 20px;
      font-weight: 700;
      color: #1a1a2e;
    }

    .savings-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
      color: #fff;
      padding: 5px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }

    .savings-badge i {
      font-size: 11px;
    }

    /* Add to Cart Button */
    .add-bundle-btn {
      width: 100%;
      padding: 12px 16px;
      background: linear-gradient(135deg, #1a1a2e 0%, #2d2d44 100%);
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .add-bundle-btn:hover:not(:disabled) {
      background: linear-gradient(135deg, #2d2d44 0%, #1a1a2e 100%);
      transform: translateY(-1px);
    }

    .add-bundle-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .add-bundle-btn .loading {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Unavailable Message */
    .unavailable-msg {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      color: #e53935;
      font-size: 13px;
      font-weight: 500;
      margin-top: 8px;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .bundle-name {
        font-size: 15px;
      }

      .bundle-price {
        font-size: 18px;
      }

      .add-bundle-btn {
        padding: 10px 14px;
        font-size: 13px;
      }
    }
  `]
})
export class BundleCardComponent {
  @Input() bundle!: Bundle;
  @Input() showDescription: boolean = true;
  @Output() addToCart = new EventEmitter<Bundle>();

  isAdding = false;

  constructor(private bundleService: BundleService) {}

  get isAvailable(): boolean {
    return this.bundleService.isBundleAvailable(this.bundle);
  }

  get previewImages(): string[] {
    return this.bundleService.getBundlePreviewImages(this.bundle, 4);
  }

  formatPrice(price: number): string {
    return this.bundleService.formatPrice(price);
  }

  onAddToCart(event: Event): void {
    event.stopPropagation();
    if (!this.isAvailable || this.isAdding) return;

    this.isAdding = true;
    this.addToCart.emit(this.bundle);

    // Reset after a short delay (actual cart add is handled by parent)
    setTimeout(() => {
      this.isAdding = false;
    }, 1500);
  }
}
