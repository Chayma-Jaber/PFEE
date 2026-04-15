import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FlashSaleCountdownComponent } from '../flash-sale-countdown/flash-sale-countdown.component';
import { FlashSale } from '../../../services/flash-sales.service';

@Component({
  selector: 'app-flash-sale-banner',
  standalone: true,
  imports: [CommonModule, RouterModule, FlashSaleCountdownComponent],
  template: `
    <div class="flash-sale-banner"
         *ngIf="flashSale && !isClosed"
         [style.background]="bannerBackground"
         [style.color]="flashSale.textColor || '#FFFFFF'">

      <!-- Close button -->
      <button class="close-btn" (click)="closeBanner()" *ngIf="closable" aria-label="Fermer">
        <i class="fas fa-times"></i>
      </button>

      <!-- Animated background elements -->
      <div class="bg-effects">
        <div class="sparkle sparkle-1"></div>
        <div class="sparkle sparkle-2"></div>
        <div class="sparkle sparkle-3"></div>
        <div class="lightning lightning-1"></div>
        <div class="lightning lightning-2"></div>
      </div>

      <div class="banner-content">
        <!-- Left: Sale info -->
        <div class="sale-info">
          <div class="flash-badge">
            <i class="fas fa-bolt"></i>
            <span>VENTE FLASH</span>
          </div>
          <h2 class="sale-title">{{ flashSale.name }}</h2>
          <p class="sale-description" *ngIf="flashSale.description">{{ flashSale.description }}</p>
          <div class="discount-badge">
            <span class="discount-value">-{{ flashSale.discountPercentage }}%</span>
            <span class="discount-label">sur une selection</span>
          </div>
        </div>

        <!-- Center: Countdown -->
        <div class="countdown-section">
          <app-flash-sale-countdown
            [endTime]="flashSale.endTime"
            [showLabel]="true"
            [showDays]="true"
            [showUrgentBadge]="true"
            (expired)="onExpired()">
          </app-flash-sale-countdown>
        </div>

        <!-- Right: CTA -->
        <div class="cta-section">
          <button class="cta-button" (click)="viewProducts()">
            <span>Voir les offres</span>
            <i class="fas fa-arrow-right"></i>
          </button>
          <span class="product-count" *ngIf="flashSale.productCount > 0">
            {{ flashSale.productCount }} produits
          </span>
        </div>
      </div>

      <!-- Mobile layout -->
      <div class="banner-content-mobile">
        <div class="mobile-header">
          <div class="flash-badge-mobile">
            <i class="fas fa-bolt"></i> VENTE FLASH
          </div>
          <span class="discount-badge-mobile">-{{ flashSale.discountPercentage }}%</span>
        </div>
        <h3 class="sale-title-mobile">{{ flashSale.name }}</h3>
        <app-flash-sale-countdown
          [endTime]="flashSale.endTime"
          [showLabel]="false"
          [showDays]="false"
          [compact]="true"
          [showUrgentBadge]="false">
        </app-flash-sale-countdown>
        <button class="cta-button-mobile" (click)="viewProducts()">
          Voir les offres <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .flash-sale-banner {
      position: relative;
      overflow: hidden;
      border-radius: 12px;
      padding: 24px 32px;
      margin: 16px 0;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }

    .close-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: inherit;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      z-index: 10;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: rotate(90deg);
    }

    /* Background effects */
    .bg-effects {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      overflow: hidden;
    }

    .sparkle {
      position: absolute;
      width: 20px;
      height: 20px;
      background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%);
      border-radius: 50%;
      animation: sparkle 3s infinite;
    }

    .sparkle-1 { top: 20%; left: 10%; animation-delay: 0s; }
    .sparkle-2 { top: 60%; left: 30%; animation-delay: 1s; }
    .sparkle-3 { top: 30%; right: 20%; animation-delay: 2s; }

    .lightning {
      position: absolute;
      width: 2px;
      height: 40px;
      background: linear-gradient(180deg, rgba(255,255,255,0.8), transparent);
      animation: lightning 4s infinite;
    }

    .lightning-1 { top: 10%; left: 50%; animation-delay: 0.5s; }
    .lightning-2 { top: 40%; right: 30%; animation-delay: 2.5s; }

    @keyframes sparkle {
      0%, 100% { opacity: 0; transform: scale(0); }
      50% { opacity: 1; transform: scale(1); }
    }

    @keyframes lightning {
      0%, 90%, 100% { opacity: 0; }
      92%, 98% { opacity: 1; }
    }

    /* Desktop layout */
    .banner-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 32px;
      position: relative;
      z-index: 1;
    }

    .sale-info {
      flex: 1;
    }

    .flash-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.2);
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 2px;
      margin-bottom: 12px;
    }

    .flash-badge i {
      animation: blink 0.5s infinite alternate;
    }

    @keyframes blink {
      0% { opacity: 0.5; }
      100% { opacity: 1; }
    }

    .sale-title {
      font-size: 28px;
      font-weight: 800;
      margin: 0 0 8px 0;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .sale-description {
      font-size: 14px;
      opacity: 0.9;
      margin: 0 0 12px 0;
      max-width: 400px;
    }

    .discount-badge {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    .discount-value {
      font-size: 36px;
      font-weight: 900;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
    }

    .discount-label {
      font-size: 14px;
      opacity: 0.8;
    }

    .countdown-section {
      flex-shrink: 0;
    }

    .cta-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .cta-button {
      display: flex;
      align-items: center;
      gap: 10px;
      background: white;
      color: #333;
      border: none;
      padding: 14px 28px;
      border-radius: 30px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }

    .cta-button:hover {
      transform: translateY(-2px) scale(1.05);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }

    .cta-button i {
      transition: transform 0.3s ease;
    }

    .cta-button:hover i {
      transform: translateX(4px);
    }

    .product-count {
      font-size: 12px;
      opacity: 0.8;
    }

    /* Mobile layout */
    .banner-content-mobile {
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      position: relative;
      z-index: 1;
    }

    .mobile-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }

    .flash-badge-mobile {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .flash-badge-mobile i {
      animation: blink 0.5s infinite alternate;
    }

    .discount-badge-mobile {
      background: rgba(255, 255, 255, 0.2);
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 800;
    }

    .sale-title-mobile {
      font-size: 18px;
      font-weight: 700;
      margin: 0;
      text-align: center;
    }

    .cta-button-mobile {
      background: white;
      color: #333;
      border: none;
      padding: 10px 24px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Responsive */
    @media (max-width: 992px) {
      .banner-content {
        flex-direction: column;
        text-align: center;
      }

      .sale-description {
        margin-left: auto;
        margin-right: auto;
      }

      .discount-badge {
        justify-content: center;
      }
    }

    @media (max-width: 768px) {
      .flash-sale-banner {
        padding: 16px;
        border-radius: 8px;
        margin: 12px;
      }

      .banner-content {
        display: none;
      }

      .banner-content-mobile {
        display: flex;
      }

      .close-btn {
        top: 8px;
        right: 8px;
        width: 28px;
        height: 28px;
      }
    }
  `]
})
export class FlashSaleBannerComponent implements OnInit {
  @Input() flashSale!: FlashSale;
  @Input() closable: boolean = true;
  @Input() storageKey: string = 'flash_sale_banner_closed';

  @Output() viewSale = new EventEmitter<FlashSale>();
  @Output() closed = new EventEmitter<void>();

  isClosed = false;

  ngOnInit(): void {
    this.checkIfClosed();
  }

  get bannerBackground(): string {
    const bgColor = this.flashSale?.backgroundColor || '#FF4444';
    // Create gradient effect
    return `linear-gradient(135deg, ${bgColor} 0%, ${this.darkenColor(bgColor, 20)} 100%)`;
  }

  private checkIfClosed(): void {
    if (!this.closable) return;

    const closedData = localStorage.getItem(this.storageKey);
    if (closedData) {
      try {
        const { saleId, closedAt } = JSON.parse(closedData);
        // Re-show after 24 hours or if different sale
        const hoursSinceClosed = (Date.now() - closedAt) / (1000 * 60 * 60);
        this.isClosed = saleId === this.flashSale?.id && hoursSinceClosed < 24;
      } catch {
        this.isClosed = false;
      }
    }
  }

  closeBanner(): void {
    this.isClosed = true;
    localStorage.setItem(this.storageKey, JSON.stringify({
      saleId: this.flashSale.id,
      closedAt: Date.now()
    }));
    this.closed.emit();
  }

  viewProducts(): void {
    this.viewSale.emit(this.flashSale);
  }

  onExpired(): void {
    // Auto-hide when sale expires
    this.isClosed = true;
  }

  private darkenColor(hex: string, percent: number): string {
    // Remove # if present
    hex = hex.replace('#', '');

    // Parse RGB
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    // Darken
    r = Math.max(0, Math.floor(r * (1 - percent / 100)));
    g = Math.max(0, Math.floor(g * (1 - percent / 100)));
    b = Math.max(0, Math.floor(b * (1 - percent / 100)));

    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
}
