import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { FlashSalesService, FlashSale, FlashSaleProduct } from '../../../services/flash-sales.service';
import { FlashSaleCountdownComponent } from '../../commun/flash-sale-countdown/flash-sale-countdown.component';
import { FlashSaleCardComponent } from '../../commun/flash-sale-card/flash-sale-card.component';
import { TitleService } from '../../../services/title.service';

@Component({
  selector: 'app-flash-sale-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, FlashSaleCountdownComponent, FlashSaleCardComponent],
  template: `
    <!-- Loading state -->
    <div class="loading-container" *ngIf="isLoading">
      <div class="spinner"></div>
      <p>Chargement de la vente flash...</p>
    </div>

    <!-- Error state -->
    <div class="error-container" *ngIf="error && !isLoading">
      <i class="fas fa-exclamation-circle"></i>
      <h2>Vente flash introuvable</h2>
      <p>{{ error }}</p>
      <button class="back-btn" routerLink="/">
        <i class="fas fa-arrow-left"></i> Retour a l'accueil
      </button>
    </div>

    <!-- Flash sale content -->
    <div class="flash-sale-page" *ngIf="flashSale && !isLoading && !error">
      <!-- Hero section -->
      <section class="hero-section" [style.background]="heroBackground">
        <div class="hero-overlay"></div>
        <div class="hero-content">
          <div class="breadcrumb">
            <a routerLink="/">Accueil</a>
            <span>/</span>
            <span>Vente Flash</span>
          </div>

          <div class="flash-badge">
            <i class="fas fa-bolt"></i>
            <span>VENTE FLASH</span>
          </div>

          <h1>{{ flashSale.name }}</h1>
          <p class="description" *ngIf="flashSale.description">{{ flashSale.description }}</p>

          <div class="discount-highlight">
            <span class="value">-{{ flashSale.discountPercentage }}%</span>
            <span class="text">sur tous les produits</span>
          </div>

          <div class="countdown-wrapper">
            <span class="countdown-label" *ngIf="!flashSale.isEnded">
              {{ flashSale.isUpcoming ? 'Commence dans:' : 'Se termine dans:' }}
            </span>
            <span class="countdown-label ended" *ngIf="flashSale.isEnded">
              Cette vente flash est terminee
            </span>
            <app-flash-sale-countdown
              *ngIf="!flashSale.isEnded"
              [endTime]="flashSale.isUpcoming ? flashSale.startTime : flashSale.endTime"
              [showLabel]="false"
              [showDays]="true"
              [showUrgentBadge]="true"
              (expired)="onCountdownExpired()">
            </app-flash-sale-countdown>
          </div>
        </div>
      </section>

      <!-- Products section -->
      <section class="products-section" *ngIf="!flashSale.isUpcoming">
        <div class="section-header">
          <h2>{{ products.length }} produits en promotion</h2>
          <div class="sort-options">
            <select [(ngModel)]="sortBy" (change)="sortProducts()" class="sort-select">
              <option value="default">Trier par</option>
              <option value="price-asc">Prix croissant</option>
              <option value="price-desc">Prix decroissant</option>
              <option value="discount">Meilleure remise</option>
              <option value="stock">Stock disponible</option>
            </select>
          </div>
        </div>

        <div class="products-grid" *ngIf="products.length > 0">
          <app-flash-sale-card
            *ngFor="let product of paginatedProducts; trackBy: trackByProductId"
            [product]="product"
            (cardClick)="navigateToProduct($event)"
            (addToCart)="onAddToCart($event)">
          </app-flash-sale-card>
        </div>

        <div class="no-products" *ngIf="products.length === 0">
          <i class="fas fa-box-open"></i>
          <p>Aucun produit disponible pour cette vente flash.</p>
        </div>

        <!-- Pagination -->
        <div class="pagination" *ngIf="totalPages > 1">
          <button
            class="page-btn"
            [disabled]="currentPage === 1"
            (click)="changePage(currentPage - 1)">
            <i class="fas fa-chevron-left"></i>
          </button>

          <ng-container *ngFor="let page of visiblePages">
            <button
              *ngIf="page !== '...'"
              class="page-btn"
              [class.active]="page === currentPage"
              (click)="changePage(page)">
              {{ page }}
            </button>
            <span *ngIf="page === '...'" class="ellipsis">...</span>
          </ng-container>

          <button
            class="page-btn"
            [disabled]="currentPage === totalPages"
            (click)="changePage(currentPage + 1)">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </section>

      <!-- Upcoming sale message -->
      <section class="upcoming-section" *ngIf="flashSale.isUpcoming">
        <div class="upcoming-content">
          <i class="fas fa-clock"></i>
          <h2>Bientot disponible!</h2>
          <p>Cette vente flash n'a pas encore commence. Revenez bientot pour profiter des offres!</p>
          <button class="notify-btn">
            <i class="fas fa-bell"></i> Me notifier au lancement
          </button>
        </div>
      </section>
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@700&display=swap');

    .loading-container, .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 50vh;
      text-align: center;
      padding: 40px 20px;
    }

    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #FF4444;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .error-container i {
      font-size: 64px;
      color: #FF4444;
      margin-bottom: 20px;
    }

    .error-container h2 {
      margin: 0 0 10px;
      color: #333;
    }

    .error-container p {
      color: #666;
      margin-bottom: 20px;
    }

    .back-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #333;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 25px;
      cursor: pointer;
      font-weight: 600;
      transition: background 0.3s ease;
    }

    .back-btn:hover {
      background: #555;
    }

    /* Hero section */
    .hero-section {
      position: relative;
      padding: 80px 20px;
      color: white;
      text-align: center;
      overflow: hidden;
    }

    .hero-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(0,0,0,0.4), rgba(0,0,0,0.6));
    }

    .hero-content {
      position: relative;
      z-index: 1;
      max-width: 800px;
      margin: 0 auto;
    }

    .breadcrumb {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      font-size: 14px;
      margin-bottom: 20px;
      opacity: 0.9;
    }

    .breadcrumb a {
      color: white;
      text-decoration: none;
    }

    .breadcrumb a:hover {
      text-decoration: underline;
    }

    .flash-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.2);
      padding: 8px 20px;
      border-radius: 25px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 2px;
      margin-bottom: 20px;
    }

    .flash-badge i {
      animation: blink 0.5s infinite alternate;
    }

    @keyframes blink {
      0% { opacity: 0.5; }
      100% { opacity: 1; }
    }

    .hero-content h1 {
      font-size: 48px;
      font-weight: 800;
      margin: 0 0 15px;
      text-transform: uppercase;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
    }

    .description {
      font-size: 18px;
      opacity: 0.9;
      margin: 0 0 25px;
    }

    .discount-highlight {
      margin-bottom: 30px;
    }

    .discount-highlight .value {
      font-size: 72px;
      font-weight: 900;
      display: block;
      text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.4);
      animation: pulse 2s infinite;
    }

    .discount-highlight .text {
      font-size: 18px;
      opacity: 0.9;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.02); }
    }

    .countdown-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 15px;
    }

    .countdown-label {
      font-size: 16px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .countdown-label.ended {
      color: #FFD700;
      font-size: 20px;
    }

    /* Products section */
    .products-section {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      flex-wrap: wrap;
      gap: 15px;
    }

    .section-header h2 {
      font-size: 24px;
      font-weight: 700;
      color: #333;
      margin: 0;
    }

    .sort-select {
      padding: 10px 35px 10px 15px;
      border: 2px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      background: white;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23333' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
    }

    .products-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
    }

    .no-products {
      text-align: center;
      padding: 60px 20px;
      color: #666;
    }

    .no-products i {
      font-size: 64px;
      margin-bottom: 20px;
      color: #ccc;
    }

    /* Pagination */
    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      margin-top: 40px;
    }

    .page-btn {
      width: 40px;
      height: 40px;
      border: 2px solid #ddd;
      background: white;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .page-btn:hover:not(:disabled) {
      border-color: #FF4444;
      color: #FF4444;
    }

    .page-btn.active {
      background: #FF4444;
      border-color: #FF4444;
      color: white;
    }

    .page-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .ellipsis {
      padding: 0 8px;
      color: #999;
    }

    /* Upcoming section */
    .upcoming-section {
      padding: 80px 20px;
      text-align: center;
    }

    .upcoming-content {
      max-width: 500px;
      margin: 0 auto;
    }

    .upcoming-content i {
      font-size: 64px;
      color: #FF4444;
      margin-bottom: 20px;
    }

    .upcoming-content h2 {
      font-size: 28px;
      margin: 0 0 15px;
      color: #333;
    }

    .upcoming-content p {
      font-size: 16px;
      color: #666;
      margin-bottom: 25px;
    }

    .notify-btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: linear-gradient(135deg, #FF4444, #FF6B35);
      color: white;
      border: none;
      padding: 14px 28px;
      border-radius: 30px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .notify-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(255, 68, 68, 0.4);
    }

    /* Responsive */
    @media (max-width: 1024px) {
      .products-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 768px) {
      .hero-section {
        padding: 50px 15px;
      }

      .hero-content h1 {
        font-size: 32px;
      }

      .discount-highlight .value {
        font-size: 48px;
      }

      .products-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }

      .section-header {
        flex-direction: column;
        text-align: center;
      }
    }

    @media (max-width: 480px) {
      .hero-content h1 {
        font-size: 26px;
      }

      .discount-highlight .value {
        font-size: 40px;
      }

      .products-grid {
        gap: 12px;
      }
    }
  `]
})
export class FlashSaleDetailComponent implements OnInit, OnDestroy {
  flashSale: FlashSale | null = null;
  products: FlashSaleProduct[] = [];
  isLoading = true;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  itemsPerPage = 12;
  totalPages = 1;

  // Sorting
  sortBy = 'default';

  private subscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private flashSalesService: FlashSalesService,
    private titleService: TitleService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = +params['id'];
      if (id) {
        this.loadFlashSale(id);
      } else {
        this.error = 'ID de vente flash invalide';
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private loadFlashSale(id: number): void {
    this.isLoading = true;
    this.subscription = this.flashSalesService.getFlashSale(id).subscribe({
      next: (sale) => {
        if (sale) {
          this.flashSale = sale;
          this.products = sale.products || [];
          this.totalPages = Math.ceil(this.products.length / this.itemsPerPage);
          this.titleService.setSpecificTitle(`Vente Flash - ${sale.name}`);
        } else {
          this.error = 'Cette vente flash n\'existe pas ou n\'est plus disponible.';
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading flash sale:', err);
        this.error = 'Erreur lors du chargement de la vente flash.';
        this.isLoading = false;
      }
    });
  }

  get heroBackground(): string {
    const bgColor = this.flashSale?.backgroundColor || '#FF4444';
    if (this.flashSale?.bannerImage) {
      return `url(${this.flashSale.bannerImage})`;
    }
    return `linear-gradient(135deg, ${bgColor} 0%, ${this.darkenColor(bgColor, 30)} 100%)`;
  }

  get paginatedProducts(): FlashSaleProduct[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.products.slice(start, start + this.itemsPerPage);
  }

  get visiblePages(): (number | string)[] {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (this.totalPages <= maxVisible) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (this.currentPage > 3) {
        pages.push('...');
      }

      const start = Math.max(2, this.currentPage - 1);
      const end = Math.min(this.totalPages - 1, this.currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (this.currentPage < this.totalPages - 2) {
        pages.push('...');
      }

      pages.push(this.totalPages);
    }

    return pages;
  }

  sortProducts(): void {
    const productsCopy = [...this.products];

    switch (this.sortBy) {
      case 'price-asc':
        productsCopy.sort((a, b) => a.flashSalePrice - b.flashSalePrice);
        break;
      case 'price-desc':
        productsCopy.sort((a, b) => b.flashSalePrice - a.flashSalePrice);
        break;
      case 'discount':
        productsCopy.sort((a, b) => b.flashSaleDiscount - a.flashSaleDiscount);
        break;
      case 'stock':
        productsCopy.sort((a, b) => b.stockRemaining - a.stockRemaining);
        break;
      default:
        // Keep original order
        break;
    }

    this.products = productsCopy;
    this.currentPage = 1;
  }

  changePage(page: number | string): void {
    if (typeof page === 'number' && page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      window.scrollTo({ top: 400, behavior: 'smooth' });
    }
  }

  navigateToProduct(product: FlashSaleProduct): void {
    const slug = this.slugify(product.title);
    this.router.navigate(['/produit', `${product.id}-${slug}`]);
  }

  onAddToCart(product: FlashSaleProduct): void {
    console.log('Add to cart:', product);
    // TODO: Integrate with cart service
  }

  onCountdownExpired(): void {
    // Reload the page to update status
    window.location.reload();
  }

  trackByProductId(index: number, product: FlashSaleProduct): number {
    return product.id;
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
