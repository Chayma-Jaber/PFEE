/**
 * BARSHA RECENTLY VIEWED COMPONENT
 * ==================================
 * Displays recently viewed products with "Continue Shopping" functionality.
 * Premium feature for better user experience.
 *
 * Features:
 * - Horizontal scrollable carousel of product cards
 * - Product image, title, price, optional discount badge
 * - Click to navigate to product detail
 * - "Clear history" button
 * - Responsive design (4 items desktop, 2 mobile)
 * - Elegant styling with hover effects and smooth scrolling
 * - Handle empty state gracefully
 */

import { Component, OnInit, Input, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { RecentlyViewedService, RecentlyViewedProduct } from '../../../services/recently-viewed.service';

@Component({
  selector: 'app-recently-viewed',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <section class="recently-viewed-section" *ngIf="products.length > 0">
      <div class="section-header">
        <h2 class="section-title">
          <i class="fas fa-history"></i>
          {{ title }}
        </h2>
        <div class="section-actions" *ngIf="showClearButton">
          <button class="clear-btn" (click)="clearHistory()">
            <i class="fas fa-trash-alt"></i>
            Effacer l'historique
          </button>
        </div>
      </div>

      <div class="products-carousel" [class.compact]="compactMode">
        <button
          class="nav-btn prev"
          (click)="scrollLeft()"
          *ngIf="showNavigation && canScrollLeft"
          aria-label="Produits precedents"
        >
          <i class="fas fa-chevron-left"></i>
        </button>

        <div class="products-container" #productsContainer (scroll)="onScroll()">
          <div
            class="product-card"
            *ngFor="let product of displayProducts; let i = index"
            (click)="navigateToProduct(product)"
          >
            <div class="product-image">
              <img
                [src]="product.image"
                [alt]="product.name"
                loading="lazy"
                (error)="onImageError($event)"
              >
              <!-- Discount Badge -->
              <span class="discount-badge" *ngIf="product.discount && product.discountValue">
                -{{ product.discountValue }}%
              </span>
              <button
                class="remove-btn"
                (click)="removeProduct(product, $event)"
                *ngIf="showRemoveButton"
                aria-label="Supprimer de l'historique"
              >
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="product-info">
              <h3 class="product-name">{{ product.name }}</h3>
              <div class="product-pricing">
                <p class="product-price">{{ product.price | number:'1.3-3' }} TND</p>
                <p class="original-price" *ngIf="product.discount && product.originalPrice">
                  {{ product.originalPrice | number:'1.3-3' }} TND
                </p>
              </div>
              <span class="viewed-time" *ngIf="showViewedTime">
                {{ getRelativeTime(product.viewedAt) }}
              </span>
            </div>
          </div>
        </div>

        <button
          class="nav-btn next"
          (click)="scrollRight()"
          *ngIf="showNavigation && canScrollRight"
          aria-label="Produits suivants"
        >
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>

      <!-- Continue Shopping CTA -->
      <div class="continue-shopping" *ngIf="showContinueShopping && lastViewed">
        <span>Continuer avec</span>
        <a [routerLink]="getProductUrl(lastViewed)" class="continue-link">
          {{ lastViewed.name }}
          <i class="fas fa-arrow-right"></i>
        </a>
      </div>
    </section>

    <!-- Empty State -->
    <section class="recently-viewed-empty" *ngIf="products.length === 0 && showEmptyState">
      <div class="empty-content">
        <i class="fas fa-history empty-icon"></i>
        <h3>Aucun produit consulte recemment</h3>
        <p>Les produits que vous consultez apparaitront ici.</p>
        <a routerLink="/shop" class="browse-link">
          Parcourir nos produits
          <i class="fas fa-arrow-right"></i>
        </a>
      </div>
    </section>
  `,
  styles: [`
    .recently-viewed-section {
      padding: 30px 0;
      margin-top: 20px;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding: 0 15px;
      flex-wrap: wrap;
      gap: 10px;
    }

    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #1a1a2e;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .section-title i {
      color: #667eea;
    }

    .clear-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: transparent;
      border: 1px solid #ddd;
      border-radius: 25px;
      font-size: 12px;
      color: #666;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .clear-btn:hover {
      background: #1a1a2e;
      border-color: #1a1a2e;
      color: white;
    }

    .products-carousel {
      position: relative;
      padding: 0 50px;
    }

    .products-container {
      display: flex;
      gap: 20px;
      overflow-x: auto;
      scroll-behavior: smooth;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      -ms-overflow-style: none;
      padding: 10px 5px;
    }

    .products-container::-webkit-scrollbar {
      display: none;
    }

    .nav-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 44px;
      height: 44px;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10;
      transition: all 0.3s ease;
      box-shadow: 0 2px 10px rgba(0,0,0,0.08);
    }

    .nav-btn:hover {
      background: #1a1a2e;
      color: white;
      border-color: #1a1a2e;
      box-shadow: 0 4px 15px rgba(26,26,46,0.2);
    }

    .nav-btn.prev {
      left: 0;
    }

    .nav-btn.next {
      right: 0;
    }

    .product-card {
      flex: 0 0 auto;
      width: calc((100% - 60px) / 4);
      min-width: 180px;
      max-width: 220px;
      cursor: pointer;
      transition: all 0.3s ease;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }

    .products-carousel.compact .product-card {
      width: 140px;
      min-width: 120px;
    }

    .product-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 8px 25px rgba(0,0,0,0.1);
    }

    .product-image {
      position: relative;
      aspect-ratio: 3/4;
      overflow: hidden;
      background: #f8f9fa;
    }

    .product-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.4s ease;
    }

    .product-card:hover .product-image img {
      transform: scale(1.08);
    }

    .discount-badge {
      position: absolute;
      top: 10px;
      left: 10px;
      background: linear-gradient(135deg, #e74c3c, #c0392b);
      color: white;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 700;
      border-radius: 4px;
      letter-spacing: 0.5px;
      box-shadow: 0 2px 8px rgba(231,76,60,0.3);
    }

    .remove-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 28px;
      height: 28px;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px);
      border: none;
      border-radius: 50%;
      color: white;
      font-size: 11px;
      cursor: pointer;
      opacity: 0;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .product-card:hover .remove-btn {
      opacity: 1;
    }

    .remove-btn:hover {
      background: #e74c3c;
      transform: scale(1.1);
    }

    .product-info {
      padding: 15px 12px;
    }

    .product-name {
      font-size: 13px;
      font-weight: 500;
      color: #333;
      margin: 0 0 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.4;
    }

    .products-carousel.compact .product-name {
      font-size: 11px;
    }

    .product-pricing {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .product-price {
      font-size: 15px;
      font-weight: 700;
      color: #1a1a2e;
      margin: 0;
    }

    .products-carousel.compact .product-price {
      font-size: 12px;
    }

    .original-price {
      font-size: 12px;
      color: #999;
      text-decoration: line-through;
      margin: 0;
    }

    .viewed-time {
      display: block;
      font-size: 11px;
      color: #999;
      margin-top: 6px;
    }

    .continue-shopping {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-top: 25px;
      padding: 18px 20px;
      background: linear-gradient(135deg, #f8f9fa, #fff);
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      font-size: 14px;
    }

    .continue-shopping span {
      color: #666;
    }

    .continue-link {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #1a1a2e;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.3s ease;
      max-width: 200px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .continue-link:hover {
      color: #667eea;
    }

    .continue-link i {
      font-size: 12px;
      transition: transform 0.3s ease;
    }

    .continue-link:hover i {
      transform: translateX(4px);
    }

    /* Empty State Styles */
    .recently-viewed-empty {
      padding: 40px 20px;
      text-align: center;
    }

    .empty-content {
      max-width: 300px;
      margin: 0 auto;
    }

    .empty-icon {
      font-size: 48px;
      color: #ddd;
      margin-bottom: 15px;
    }

    .empty-content h3 {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin: 0 0 8px;
    }

    .empty-content p {
      font-size: 13px;
      color: #666;
      margin: 0 0 20px;
    }

    .browse-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #1a1a2e;
      font-weight: 600;
      text-decoration: none;
      padding: 10px 20px;
      border: 1px solid #1a1a2e;
      border-radius: 25px;
      transition: all 0.3s ease;
    }

    .browse-link:hover {
      background: #1a1a2e;
      color: white;
    }

    /* Responsive Styles - 4 items desktop, 2 mobile */
    @media (max-width: 1200px) {
      .product-card {
        width: calc((100% - 45px) / 3);
        min-width: 160px;
      }
    }

    @media (max-width: 992px) {
      .products-carousel {
        padding: 0 15px;
      }

      .product-card {
        width: calc((100% - 30px) / 2);
        min-width: 150px;
      }

      .nav-btn {
        width: 36px;
        height: 36px;
        font-size: 12px;
      }
    }

    @media (max-width: 768px) {
      .section-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }

      .section-title {
        font-size: 16px;
      }

      .products-carousel {
        padding: 0 10px;
      }

      .products-container {
        gap: 12px;
      }

      .product-card {
        width: calc(50% - 6px);
        min-width: 140px;
        max-width: 180px;
      }

      .nav-btn {
        display: none;
      }

      .product-info {
        padding: 12px 10px;
      }

      .product-name {
        font-size: 12px;
      }

      .product-price {
        font-size: 14px;
      }

      .continue-shopping {
        flex-direction: column;
        gap: 8px;
        padding: 15px;
      }
    }

    @media (max-width: 480px) {
      .recently-viewed-section {
        padding: 20px 0;
      }

      .product-card {
        width: calc(50% - 6px);
        min-width: 130px;
      }

      .product-info {
        padding: 10px 8px;
      }

      .product-name {
        font-size: 11px;
      }

      .product-price {
        font-size: 13px;
      }

      .discount-badge {
        font-size: 10px;
        padding: 3px 8px;
      }
    }
  `]
})
export class RecentlyViewedComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() title: string = 'Vus recemment';
  @Input() maxProducts: number = 10;
  @Input() compactMode: boolean = false;
  @Input() showNavigation: boolean = true;
  @Input() showRemoveButton: boolean = true;
  @Input() showClearButton: boolean = false;
  @Input() showViewedTime: boolean = false;
  @Input() showContinueShopping: boolean = true;
  @Input() showEmptyState: boolean = false;

  @ViewChild('productsContainer') productsContainerRef!: ElementRef<HTMLDivElement>;

  products: RecentlyViewedProduct[] = [];
  displayProducts: RecentlyViewedProduct[] = [];
  lastViewed: RecentlyViewedProduct | null = null;

  canScrollLeft = false;
  canScrollRight = false;

  private subscription?: Subscription;

  constructor(
    private recentlyViewedService: RecentlyViewedService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.subscription = this.recentlyViewedService.recentlyViewed$.subscribe(products => {
      this.products = products;
      this.displayProducts = products.slice(0, this.maxProducts);
      this.lastViewed = products.length > 0 ? products[0] : null;
      // Delay scroll state update to allow DOM to render
      setTimeout(() => this.updateScrollState(), 100);
    });

    // For logged-in users, hydrate from backend (cross-device recently-viewed)
    this.recentlyViewedService.loadFromBackend(this.maxProducts).subscribe((r: any) => {
      const items = r?.items || [];
      for (const p of items) {
        this.recentlyViewedService.addProduct({
          id: p.id,
          title: p.title,
          currentPrice: p.currentPrice,
          price: p.price,
          image: p.firstImageUrl,
          firstImg: { url: p.firstImageUrl },
        });
      }
    });
  }

  ngAfterViewInit(): void {
    this.updateScrollState();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  navigateToProduct(product: RecentlyViewedProduct): void {
    const slug = this.generateSlug(product);
    this.router.navigate(['/produit', slug]);
  }

  getProductUrl(product: RecentlyViewedProduct): string {
    return `/produit/${this.generateSlug(product)}`;
  }

  private generateSlug(product: RecentlyViewedProduct): string {
    const nameSlug = product.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${product.id}-${nameSlug}`;
  }

  removeProduct(product: RecentlyViewedProduct, event: Event): void {
    event.stopPropagation();
    this.recentlyViewedService.removeProduct(product.id);
  }

  clearHistory(): void {
    this.recentlyViewedService.clearAll();
  }

  scrollLeft(): void {
    const container = this.productsContainerRef?.nativeElement;
    if (container) {
      const scrollAmount = this.getScrollAmount();
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    }
  }

  scrollRight(): void {
    const container = this.productsContainerRef?.nativeElement;
    if (container) {
      const scrollAmount = this.getScrollAmount();
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  }

  private getScrollAmount(): number {
    // Calculate scroll amount based on viewport width
    const viewportWidth = window.innerWidth;
    if (viewportWidth >= 1200) {
      return 400; // Scroll about 2 items on desktop
    } else if (viewportWidth >= 768) {
      return 300;
    } else {
      return 200;
    }
  }

  onScroll(): void {
    this.updateScrollState();
  }

  private updateScrollState(): void {
    const container = this.productsContainerRef?.nativeElement;
    if (container) {
      this.canScrollLeft = container.scrollLeft > 10;
      this.canScrollRight = container.scrollLeft < container.scrollWidth - container.clientWidth - 10;
    }
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/images/placeholder-product.jpg';
  }

  getRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) {
      return 'A l\'instant';
    } else if (minutes < 60) {
      return `Il y a ${minutes} min`;
    } else if (hours < 24) {
      return `Il y a ${hours}h`;
    } else if (days === 1) {
      return 'Hier';
    } else {
      return `Il y a ${days} jours`;
    }
  }
}
