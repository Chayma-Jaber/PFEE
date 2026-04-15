/**
 * BARSHA BUNDLES SECTION COMPONENT
 * ==================================
 * Displays a horizontal scrollable section of bundle deals.
 * Used on homepage and category pages.
 */

import { Component, OnInit, Input, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { BundleService, Bundle, AddBundleToCartResult } from '../../../services/bundle.service';
import { BundleCardComponent } from '../bundle-card/bundle-card.component';
import { CartService, CartItem } from '../../../services/cart.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-bundles-section',
  standalone: true,
  imports: [CommonModule, RouterModule, BundleCardComponent, ToastModule],
  providers: [MessageService],
  template: `
    <section class="bundles-section" *ngIf="bundles.length > 0 || isLoading">
      <div class="section-container">
        <!-- Header -->
        <div class="section-header">
          <div class="header-content">
            <span class="section-badge">
              <i class="fas fa-gift"></i>
              Offres Speciales
            </span>
            <h2 class="section-title">{{ title }}</h2>
            <p class="section-subtitle" *ngIf="subtitle">{{ subtitle }}</p>
          </div>
          <a routerLink="/offres-groupees" class="view-all-link" *ngIf="showViewAll">
            Voir toutes les offres
            <i class="fas fa-arrow-right"></i>
          </a>
        </div>

        <!-- Loading State -->
        <div class="bundles-loading" *ngIf="isLoading">
          <div class="skeleton-card" *ngFor="let i of [1,2,3,4]">
            <div class="skeleton-image"></div>
            <div class="skeleton-content">
              <div class="skeleton-line"></div>
              <div class="skeleton-line short"></div>
              <div class="skeleton-line price"></div>
            </div>
          </div>
        </div>

        <!-- Bundles Carousel -->
        <div class="bundles-carousel" *ngIf="!isLoading">
          <button
            class="carousel-nav prev"
            (click)="scrollPrev()"
            *ngIf="canScrollPrev"
            aria-label="Precedent"
          >
            <i class="fas fa-chevron-left"></i>
          </button>

          <div class="bundles-track" #bundlesTrack (scroll)="onScroll()">
            <app-bundle-card
              *ngFor="let bundle of bundles; trackBy: trackByBundleId"
              [bundle]="bundle"
              [showDescription]="true"
              (addToCart)="handleAddToCart($event)"
              class="bundle-slide"
            ></app-bundle-card>
          </div>

          <button
            class="carousel-nav next"
            (click)="scrollNext()"
            *ngIf="canScrollNext"
            aria-label="Suivant"
          >
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>

        <!-- Empty State -->
        <div class="empty-state" *ngIf="!isLoading && bundles.length === 0">
          <i class="fas fa-box-open"></i>
          <p>Aucune offre groupee disponible pour le moment</p>
        </div>
      </div>
    </section>

    <p-toast position="bottom-right"></p-toast>
  `,
  styles: [`
    .bundles-section {
      padding: 60px 0;
      background: linear-gradient(180deg, #fff 0%, #fafafa 100%);
    }

    .section-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 20px;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 40px;
    }

    .header-content {
      max-width: 500px;
    }

    .section-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, #e53935 0%, #c62828 100%);
      color: #fff;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }

    .section-title {
      font-size: 32px;
      font-weight: 700;
      color: #1a1a2e;
      margin: 0 0 8px;
      line-height: 1.2;
    }

    .section-subtitle {
      font-size: 16px;
      color: #666;
      margin: 0;
    }

    .view-all-link {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #1a1a2e;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      transition: color 0.2s ease;
      white-space: nowrap;
    }

    .view-all-link:hover {
      color: #e53935;
    }

    .view-all-link i {
      font-size: 12px;
      transition: transform 0.2s ease;
    }

    .view-all-link:hover i {
      transform: translateX(4px);
    }

    /* Loading Skeleton */
    .bundles-loading {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
    }

    .skeleton-card {
      background: #fff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
    }

    .skeleton-image {
      aspect-ratio: 1;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    .skeleton-content {
      padding: 16px;
    }

    .skeleton-line {
      height: 16px;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
      margin-bottom: 12px;
    }

    .skeleton-line.short {
      width: 70%;
    }

    .skeleton-line.price {
      width: 50%;
      height: 24px;
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    /* Carousel */
    .bundles-carousel {
      position: relative;
    }

    .bundles-track {
      display: flex;
      gap: 24px;
      overflow-x: auto;
      scroll-behavior: smooth;
      scrollbar-width: none;
      -ms-overflow-style: none;
      padding: 10px 0;
    }

    .bundles-track::-webkit-scrollbar {
      display: none;
    }

    .bundle-slide {
      flex: 0 0 calc(25% - 18px);
      min-width: 280px;
      max-width: 320px;
    }

    .carousel-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 48px;
      height: 48px;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .carousel-nav:hover {
      background: #1a1a2e;
      color: #fff;
      border-color: #1a1a2e;
    }

    .carousel-nav.prev {
      left: -24px;
    }

    .carousel-nav.next {
      right: -24px;
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #888;
    }

    .empty-state i {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .empty-state p {
      font-size: 16px;
      margin: 0;
    }

    /* Responsive */
    @media (max-width: 1200px) {
      .bundle-slide {
        flex: 0 0 calc(33.333% - 16px);
      }

      .bundles-loading {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 768px) {
      .bundles-section {
        padding: 40px 0;
      }

      .section-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
      }

      .section-title {
        font-size: 24px;
      }

      .bundle-slide {
        flex: 0 0 calc(50% - 12px);
        min-width: 240px;
      }

      .bundles-loading {
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }

      .carousel-nav {
        display: none;
      }
    }

    @media (max-width: 480px) {
      .bundle-slide {
        flex: 0 0 85%;
        min-width: 260px;
      }

      .bundles-loading {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class BundlesSectionComponent implements OnInit {
  @Input() title: string = 'Nos Offres Groupees';
  @Input() subtitle: string = 'Economisez en achetant nos lots soigneusement selectionnes';
  @Input() limit: number = 6;
  @Input() showViewAll: boolean = true;

  @ViewChild('bundlesTrack') bundlesTrack!: ElementRef<HTMLDivElement>;

  bundles: Bundle[] = [];
  isLoading = true;

  canScrollPrev = false;
  canScrollNext = true;

  constructor(
    private bundleService: BundleService,
    private cartService: CartService,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadBundles();
  }

  private loadBundles(): void {
    this.isLoading = true;

    this.bundleService.getFeaturedBundles(this.limit).subscribe({
      next: (bundles) => {
        this.bundles = bundles;
        this.isLoading = false;
        setTimeout(() => this.updateScrollState(), 100);
      },
      error: (err) => {
        console.error('Error loading bundles:', err);
        this.isLoading = false;
      }
    });
  }

  scrollPrev(): void {
    if (this.bundlesTrack?.nativeElement) {
      this.bundlesTrack.nativeElement.scrollBy({ left: -320, behavior: 'smooth' });
    }
  }

  scrollNext(): void {
    if (this.bundlesTrack?.nativeElement) {
      this.bundlesTrack.nativeElement.scrollBy({ left: 320, behavior: 'smooth' });
    }
  }

  onScroll(): void {
    this.updateScrollState();
  }

  private updateScrollState(): void {
    if (this.bundlesTrack?.nativeElement) {
      const track = this.bundlesTrack.nativeElement;
      this.canScrollPrev = track.scrollLeft > 0;
      this.canScrollNext = track.scrollLeft < track.scrollWidth - track.clientWidth - 10;
    }
  }

  handleAddToCart(bundle: Bundle): void {
    const token = localStorage.getItem('jwt');
    if (!token) {
      this.messageService.add({
        severity: 'info',
        summary: 'Connexion requise',
        detail: 'Veuillez vous connecter pour ajouter ce lot au panier',
        life: 3000
      });
      this.router.navigate(['/login']);
      return;
    }

    this.bundleService.addBundleToCart(bundle.id).subscribe({
      next: (result: AddBundleToCartResult) => {
        if (result.success && result.itemsToAdd.length > 0) {
          // Add each item to cart locally
          let addedCount = 0;
          for (const item of result.itemsToAdd) {
            const cartItem: CartItem = {
              product: item.product as any,
              image: item.image,
              quantity: item.quantity,
              selectedColor: item.selectedColor,
              selectedSize: item.selectedSize,
              ean13: item.ean13
            };
            this.cartService.addToCartDirectly(cartItem);
            addedCount++;
          }

          this.messageService.add({
            severity: 'success',
            summary: 'Lot ajoute',
            detail: `${addedCount} article(s) ajoute(s) au panier`,
            life: 3000
          });

          // Show savings message
          if (bundle.savingsAmount > 0) {
            setTimeout(() => {
              this.messageService.add({
                severity: 'info',
                summary: 'Economie',
                detail: `Vous economisez ${this.bundleService.formatPrice(bundle.savingsAmount)} avec ce lot!`,
                life: 4000
              });
            }, 500);
          }
        } else if (result.unavailableItems.length > 0) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Ajout partiel',
            detail: `${result.addedCount} article(s) ajoute(s). ${result.unavailableItems.length} article(s) non disponible(s).`,
            life: 4000
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: result.message || 'Impossible d\'ajouter le lot au panier',
            life: 3000
          });
        }
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Impossible d\'ajouter le lot au panier',
          life: 3000
        });
      }
    });
  }

  trackByBundleId(index: number, bundle: Bundle): number {
    return bundle.id;
  }
}
