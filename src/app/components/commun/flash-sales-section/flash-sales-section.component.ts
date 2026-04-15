import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FlashSaleBannerComponent } from '../flash-sale-banner/flash-sale-banner.component';
import { FlashSaleCardComponent } from '../flash-sale-card/flash-sale-card.component';
import { FlashSaleCountdownComponent } from '../flash-sale-countdown/flash-sale-countdown.component';
import { FlashSalesService, FlashSale, FlashSaleProduct } from '../../../services/flash-sales.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-flash-sales-section',
  standalone: true,
  imports: [CommonModule, FlashSaleBannerComponent, FlashSaleCardComponent, FlashSaleCountdownComponent],
  template: `
    <section class="flash-sales-section" *ngIf="hasActiveFlashSales && !isLoading">
      <!-- Main Flash Sale Banner -->
      <div class="banner-wrapper" *ngIf="primaryFlashSale && showBanner">
        <app-flash-sale-banner
          [flashSale]="primaryFlashSale"
          [closable]="true"
          (viewSale)="navigateToFlashSale($event)"
          (closed)="onBannerClosed()">
        </app-flash-sale-banner>
      </div>

      <!-- Flash Sale Products Grid -->
      <div class="products-section" *ngIf="primaryFlashSale && primaryFlashSale.products && primaryFlashSale.products.length > 0">
        <div class="section-header">
          <div class="header-left">
            <div class="flash-icon">
              <i class="fas fa-bolt"></i>
            </div>
            <div class="header-text">
              <h2>{{ primaryFlashSale.name }}</h2>
              <p class="subtitle">Offres a durée limitée - Jusqu'a -{{ primaryFlashSale.discountPercentage }}%</p>
            </div>
          </div>
          <div class="header-right">
            <div class="countdown-wrapper">
              <span class="ends-in">Se termine dans:</span>
              <app-flash-sale-countdown
                [endTime]="primaryFlashSale.endTime"
                [showLabel]="false"
                [showDays]="true"
                [compact]="true"
                [showUrgentBadge]="false">
              </app-flash-sale-countdown>
            </div>
            <button class="view-all-btn" (click)="navigateToFlashSale(primaryFlashSale)">
              Voir tout <i class="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>

        <div class="products-grid">
          <app-flash-sale-card
            *ngFor="let product of displayedProducts; trackBy: trackByProductId"
            [product]="product"
            (cardClick)="navigateToProduct($event)"
            (addToCart)="onAddToCart($event)">
          </app-flash-sale-card>
        </div>

        <div class="view-more" *ngIf="primaryFlashSale.products.length > maxProductsDisplay">
          <button class="view-more-btn" (click)="navigateToFlashSale(primaryFlashSale)">
            Voir les {{ primaryFlashSale.products.length - maxProductsDisplay }} autres produits
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>

      <!-- Additional Flash Sales (smaller cards) -->
      <div class="additional-sales" *ngIf="additionalFlashSales.length > 0">
        <h3 class="additional-title">Autres ventes flash</h3>
        <div class="additional-grid">
          <div class="mini-flash-sale-card"
               *ngFor="let sale of additionalFlashSales"
               (click)="navigateToFlashSale(sale)"
               [style.background]="getGradient(sale.backgroundColor)">
            <div class="mini-content">
              <span class="mini-discount">-{{ sale.discountPercentage }}%</span>
              <h4 class="mini-name">{{ sale.name }}</h4>
              <app-flash-sale-countdown
                [endTime]="sale.endTime"
                [showLabel]="false"
                [showDays]="false"
                [compact]="true"
                [showUrgentBadge]="false">
              </app-flash-sale-countdown>
              <span class="mini-products">{{ sale.productCount }} produits</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Loading state -->
    <div class="loading-state" *ngIf="isLoading">
      <div class="loading-skeleton">
        <div class="skeleton-banner"></div>
        <div class="skeleton-grid">
          <div class="skeleton-card" *ngFor="let i of [1,2,3,4]"></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .flash-sales-section {
      padding: 32px 0;
    }

    .banner-wrapper {
      max-width: 1200px;
      margin: 0 auto 32px;
      padding: 0 16px;
    }

    /* Products section */
    .products-section {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 16px;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .flash-icon {
      width: 50px;
      height: 50px;
      background: linear-gradient(135deg, #FF4444, #FF6B35);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      animation: iconPulse 2s infinite;
    }

    @keyframes iconPulse {
      0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.4); }
      50% { transform: scale(1.05); box-shadow: 0 0 20px 5px rgba(255, 68, 68, 0.3); }
    }

    .header-text h2 {
      font-size: 24px;
      font-weight: 700;
      color: #333;
      margin: 0;
    }

    .subtitle {
      font-size: 14px;
      color: #666;
      margin: 4px 0 0 0;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 24px;
    }

    .countdown-wrapper {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #f5f5f5;
      padding: 8px 16px;
      border-radius: 8px;
    }

    .ends-in {
      font-size: 12px;
      color: #666;
      font-weight: 500;
    }

    .view-all-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      background: transparent;
      border: 2px solid #FF4444;
      color: #FF4444;
      padding: 10px 20px;
      border-radius: 25px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .view-all-btn:hover {
      background: #FF4444;
      color: white;
    }

    .view-all-btn i {
      transition: transform 0.3s ease;
    }

    .view-all-btn:hover i {
      transform: translateX(4px);
    }

    /* Products grid */
    .products-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
    }

    /* View more */
    .view-more {
      text-align: center;
      margin-top: 24px;
    }

    .view-more-btn {
      background: transparent;
      border: none;
      color: #FF4444;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.3s ease;
    }

    .view-more-btn:hover {
      color: #E03E3E;
    }

    .view-more-btn i {
      transition: transform 0.3s ease;
    }

    .view-more-btn:hover i {
      transform: translateX(4px);
    }

    /* Additional sales */
    .additional-sales {
      max-width: 1200px;
      margin: 48px auto 0;
      padding: 0 16px;
    }

    .additional-title {
      font-size: 18px;
      font-weight: 600;
      color: #333;
      margin: 0 0 16px 0;
    }

    .additional-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    .mini-flash-sale-card {
      border-radius: 12px;
      padding: 20px;
      color: white;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .mini-flash-sale-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent);
      pointer-events: none;
    }

    .mini-flash-sale-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
    }

    .mini-content {
      position: relative;
      z-index: 1;
    }

    .mini-discount {
      font-size: 32px;
      font-weight: 900;
      display: block;
      margin-bottom: 8px;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    .mini-name {
      font-size: 16px;
      font-weight: 600;
      margin: 0 0 12px 0;
    }

    .mini-products {
      display: block;
      font-size: 12px;
      opacity: 0.8;
      margin-top: 12px;
    }

    /* Loading skeleton */
    .loading-state {
      max-width: 1200px;
      margin: 0 auto;
      padding: 32px 16px;
    }

    .loading-skeleton {
      animation: pulse 1.5s infinite;
    }

    .skeleton-banner {
      height: 200px;
      background: #e0e0e0;
      border-radius: 12px;
      margin-bottom: 32px;
    }

    .skeleton-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
    }

    .skeleton-card {
      aspect-ratio: 0.75;
      background: #e0e0e0;
      border-radius: 12px;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* Responsive */
    @media (max-width: 1024px) {
      .products-grid {
        grid-template-columns: repeat(3, 1fr);
      }

      .skeleton-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 768px) {
      .section-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .header-right {
        width: 100%;
        justify-content: space-between;
      }

      .products-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }

      .skeleton-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .additional-grid {
        grid-template-columns: 1fr;
      }

      .header-text h2 {
        font-size: 20px;
      }

      .flash-icon {
        width: 40px;
        height: 40px;
        font-size: 18px;
      }
    }

    @media (max-width: 480px) {
      .countdown-wrapper {
        flex-direction: column;
        gap: 4px;
        padding: 6px 12px;
      }

      .view-all-btn {
        padding: 8px 16px;
        font-size: 13px;
      }
    }
  `]
})
export class FlashSalesSectionComponent implements OnInit, OnDestroy {
  @Input() maxProductsDisplay: number = 4;
  @Input() showBanner: boolean = true;

  flashSales: FlashSale[] = [];
  isLoading = true;
  private subscription?: Subscription;

  constructor(
    private flashSalesService: FlashSalesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadFlashSales();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private loadFlashSales(): void {
    this.isLoading = true;
    this.subscription = this.flashSalesService.getHomepageFlashSales(3).subscribe({
      next: (sales) => {
        this.flashSales = sales;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading flash sales:', err);
        this.isLoading = false;
      }
    });
  }

  get hasActiveFlashSales(): boolean {
    return this.flashSales.length > 0;
  }

  get primaryFlashSale(): FlashSale | null {
    return this.flashSales.length > 0 ? this.flashSales[0] : null;
  }

  get additionalFlashSales(): FlashSale[] {
    return this.flashSales.slice(1);
  }

  get displayedProducts(): FlashSaleProduct[] {
    if (!this.primaryFlashSale?.products) return [];
    return this.primaryFlashSale.products.slice(0, this.maxProductsDisplay);
  }

  navigateToFlashSale(sale: FlashSale): void {
    this.router.navigate(['/vente-flash', sale.id]);
  }

  navigateToProduct(product: FlashSaleProduct): void {
    const slug = this.slugify(product.title);
    this.router.navigate(['/produit', `${product.id}-${slug}`]);
  }

  onAddToCart(product: FlashSaleProduct): void {
    // Emit event or call cart service
    console.log('Add to cart:', product);
    // TODO: Integrate with cart service
  }

  onBannerClosed(): void {
    // Banner was closed, could track this
  }

  trackByProductId(index: number, product: FlashSaleProduct): number {
    return product.id;
  }

  getGradient(color: string): string {
    return `linear-gradient(135deg, ${color}, ${this.darkenColor(color, 30)})`;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private darkenColor(hex: string, percent: number): string {
    hex = hex.replace('#', '');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    r = Math.max(0, Math.floor(r * (1 - percent / 100)));
    g = Math.max(0, Math.floor(g * (1 - percent / 100)));
    b = Math.max(0, Math.floor(b * (1 - percent / 100)));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
}
