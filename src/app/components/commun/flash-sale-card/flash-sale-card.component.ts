import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlashSaleCountdownComponent } from '../flash-sale-countdown/flash-sale-countdown.component';
import { FlashSaleProduct } from '../../../services/flash-sales.service';

@Component({
  selector: 'app-flash-sale-card',
  standalone: true,
  imports: [CommonModule, FlashSaleCountdownComponent],
  template: `
    <article class="flash-sale-card" (click)="onCardClick()">
      <!-- Discount badge -->
      <div class="discount-badge">
        <i class="fas fa-bolt"></i>
        <span>-{{ product.flashSaleDiscount }}%</span>
      </div>

      <!-- Product image -->
      <div class="image-container">
        <img [src]="product.firstImageUrl"
             [alt]="product.title"
             class="product-image primary"
             loading="lazy"
             onerror="this.src='assets/images/placeholder.png'">
        <img *ngIf="product.secondImageUrl"
             [src]="product.secondImageUrl"
             [alt]="product.title"
             class="product-image secondary"
             loading="lazy">

        <!-- Stock indicator overlay -->
        <div class="stock-overlay" *ngIf="product.stockRemaining <= lowStockThreshold && product.stockRemaining > 0">
          <div class="stock-warning">
            <i class="fas fa-fire"></i>
            <span>Plus que {{ product.stockRemaining }} !</span>
          </div>
          <div class="stock-bar">
            <div class="stock-fill" [style.width.%]="stockPercentage"></div>
          </div>
        </div>

        <!-- Out of stock overlay -->
        <div class="out-of-stock-overlay" *ngIf="product.stockRemaining <= 0">
          <span>Rupture de stock</span>
        </div>
      </div>

      <!-- Product info -->
      <div class="product-info">
        <h3 class="product-title">{{ product.title }}</h3>

        <!-- Prices -->
        <div class="price-container">
          <span class="sale-price">{{ product.flashSalePrice.toFixed(3) }} TND</span>
          <span class="original-price">{{ product.price.toFixed(3) }} TND</span>
          <span class="savings">Economisez {{ savings.toFixed(3) }} TND</span>
        </div>

        <!-- Countdown -->
        <div class="countdown-container" *ngIf="product.flashSaleEndTime">
          <app-flash-sale-countdown
            [endTime]="product.flashSaleEndTime"
            [showLabel]="false"
            [showDays]="false"
            [compact]="true"
            [showUrgentBadge]="false"
            (expired)="onExpired()">
          </app-flash-sale-countdown>
        </div>

        <!-- Add to cart button -->
        <button class="add-to-cart-btn"
                [disabled]="product.stockRemaining <= 0 || isAdding"
                (click)="onAddToCart($event)">
          <span *ngIf="!isAdding && product.stockRemaining > 0">
            <i class="fas fa-shopping-bag"></i> Ajouter au panier
          </span>
          <span *ngIf="isAdding">
            <i class="fas fa-spinner fa-spin"></i> Ajout...
          </span>
          <span *ngIf="product.stockRemaining <= 0">
            <i class="fas fa-times"></i> Indisponible
          </span>
        </button>
      </div>

      <!-- Flash sale ribbon -->
      <div class="flash-ribbon">
        <span>VENTE FLASH</span>
      </div>
    </article>
  `,
  styles: [`
    .flash-sale-card {
      position: relative;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      transition: all 0.3s ease;
      cursor: pointer;
      border: 2px solid transparent;
    }

    .flash-sale-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
      border-color: #FF4444;
    }

    /* Discount badge */
    .discount-badge {
      position: absolute;
      top: 12px;
      left: 12px;
      z-index: 5;
      background: linear-gradient(135deg, #FF4444, #FF6B35);
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 4px;
      box-shadow: 0 2px 8px rgba(255, 68, 68, 0.4);
      animation: badgePulse 2s infinite;
    }

    .discount-badge i {
      font-size: 12px;
      animation: boltFlash 1s infinite;
    }

    @keyframes badgePulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }

    @keyframes boltFlash {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* Flash ribbon */
    .flash-ribbon {
      position: absolute;
      top: 20px;
      right: -35px;
      background: linear-gradient(135deg, #FFD700, #FFA500);
      color: #333;
      padding: 4px 40px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1px;
      transform: rotate(45deg);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      z-index: 4;
    }

    /* Image container */
    .image-container {
      position: relative;
      aspect-ratio: 1;
      overflow: hidden;
      background: #f8f8f8;
    }

    .product-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: all 0.4s ease;
    }

    .product-image.secondary {
      position: absolute;
      top: 0;
      left: 0;
      opacity: 0;
    }

    .flash-sale-card:hover .product-image.primary {
      opacity: 0;
    }

    .flash-sale-card:hover .product-image.secondary {
      opacity: 1;
    }

    /* Stock overlay */
    .stock-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
      padding: 20px 12px 12px;
    }

    .stock-warning {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #FFD700;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .stock-warning i {
      animation: flame 0.5s infinite alternate;
    }

    @keyframes flame {
      0% { transform: scale(1); }
      100% { transform: scale(1.2); }
    }

    .stock-bar {
      height: 4px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      overflow: hidden;
    }

    .stock-fill {
      height: 100%;
      background: linear-gradient(90deg, #FF4444, #FFD700);
      border-radius: 2px;
      transition: width 0.3s ease;
    }

    /* Out of stock */
    .out-of-stock-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 16px;
      font-weight: 700;
      text-transform: uppercase;
    }

    /* Product info */
    .product-info {
      padding: 16px;
    }

    .product-title {
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin: 0 0 12px 0;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* Prices */
    .price-container {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 12px;
    }

    .sale-price {
      font-size: 20px;
      font-weight: 800;
      color: #FF4444;
    }

    .original-price {
      font-size: 14px;
      color: #999;
      text-decoration: line-through;
    }

    .savings {
      font-size: 11px;
      color: #28a745;
      font-weight: 600;
      background: #e8f5e9;
      padding: 2px 8px;
      border-radius: 10px;
      width: 100%;
      text-align: center;
      margin-top: 4px;
    }

    /* Countdown */
    .countdown-container {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 8px;
      margin-bottom: 12px;
    }

    /* Add to cart button */
    .add-to-cart-btn {
      width: 100%;
      padding: 12px 16px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: linear-gradient(135deg, #FF4444, #FF6B35);
      color: white;
    }

    .add-to-cart-btn:hover:not(:disabled) {
      background: linear-gradient(135deg, #E03E3E, #E55A28);
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(255, 68, 68, 0.4);
    }

    .add-to-cart-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    /* Responsive */
    @media (max-width: 576px) {
      .flash-sale-card {
        border-radius: 8px;
      }

      .discount-badge {
        padding: 4px 10px;
        font-size: 12px;
      }

      .flash-ribbon {
        padding: 3px 35px;
        font-size: 8px;
        right: -38px;
      }

      .product-info {
        padding: 12px;
      }

      .product-title {
        font-size: 13px;
      }

      .sale-price {
        font-size: 18px;
      }

      .add-to-cart-btn {
        padding: 10px 12px;
        font-size: 13px;
      }
    }
  `]
})
export class FlashSaleCardComponent {
  @Input() product!: FlashSaleProduct;
  @Input() lowStockThreshold: number = 5;

  @Output() addToCart = new EventEmitter<FlashSaleProduct>();
  @Output() cardClick = new EventEmitter<FlashSaleProduct>();
  @Output() expired = new EventEmitter<FlashSaleProduct>();

  isAdding = false;

  get savings(): number {
    return this.product.price - this.product.flashSalePrice;
  }

  get stockPercentage(): number {
    // Assume max stock of 20 for visual purposes
    const maxStock = 20;
    return Math.min(100, (this.product.stockRemaining / maxStock) * 100);
  }

  onCardClick(): void {
    this.cardClick.emit(this.product);
  }

  onAddToCart(event: Event): void {
    event.stopPropagation();
    if (this.product.stockRemaining <= 0 || this.isAdding) return;

    this.isAdding = true;
    this.addToCart.emit(this.product);

    // Reset after animation
    setTimeout(() => {
      this.isAdding = false;
    }, 1000);
  }

  onExpired(): void {
    this.expired.emit(this.product);
  }
}
