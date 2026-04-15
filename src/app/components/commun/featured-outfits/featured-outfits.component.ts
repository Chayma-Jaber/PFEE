/**
 * BARSHA FEATURED OUTFITS COMPONENT
 * ===================================
 * Displays featured/curated outfits on the homepage.
 * Premium "Shop the Look" section with carousel.
 */

import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { OutfitService, Outfit, AddAllToCartResult } from '../../../services/outfit.service';
import { OutfitCardComponent } from '../outfit-card/outfit-card.component';
import { CartService } from '../../../services/cart.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-featured-outfits',
  standalone: true,
  imports: [CommonModule, RouterModule, OutfitCardComponent, ToastModule],
  providers: [MessageService],
  template: `
    <section class="featured-outfits-section" *ngIf="outfits.length > 0 || isLoading">
      <div class="section-container">
        <!-- Header -->
        <div class="section-header">
          <div class="header-content">
            <span class="section-badge">
              <i class="fas fa-magic"></i>
              Inspirations
            </span>
            <h2 class="section-title">{{ title }}</h2>
            <p class="section-subtitle" *ngIf="subtitle">{{ subtitle }}</p>
          </div>
          <a routerLink="/looks" class="view-all-link">
            Voir tous les looks
            <i class="fas fa-arrow-right"></i>
          </a>
        </div>

        <!-- Loading State -->
        <div class="outfits-loading" *ngIf="isLoading">
          <div class="skeleton-card" *ngFor="let i of [1,2,3,4]">
            <div class="skeleton-image"></div>
            <div class="skeleton-content">
              <div class="skeleton-line"></div>
              <div class="skeleton-line short"></div>
            </div>
          </div>
        </div>

        <!-- Outfits Grid/Carousel -->
        <div class="outfits-carousel" *ngIf="!isLoading">
          <button
            class="carousel-nav prev"
            (click)="scrollPrev()"
            *ngIf="canScrollPrev"
            aria-label="Précédent"
          >
            <i class="fas fa-chevron-left"></i>
          </button>

          <div class="outfits-track" #outfitsTrack>
            <app-outfit-card
              *ngFor="let outfit of outfits; trackBy: trackByOutfitId"
              [outfit]="outfit"
              [showOccasion]="true"
              [showQuickAdd]="true"
              (addToCart)="handleAddAllToCart($event)"
              class="outfit-slide"
            ></app-outfit-card>
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
        <div class="empty-state" *ngIf="!isLoading && outfits.length === 0">
          <i class="fas fa-tshirt"></i>
          <p>Aucun look disponible pour le moment</p>
        </div>
      </div>
    </section>

    <p-toast position="bottom-right"></p-toast>
  `,
  styles: [`
    .featured-outfits-section {
      padding: 60px 0;
      background: linear-gradient(180deg, #fafafa 0%, #fff 100%);
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
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
    }

    .view-all-link:hover {
      color: #667eea;
    }

    .view-all-link i {
      font-size: 12px;
      transition: transform 0.2s ease;
    }

    .view-all-link:hover i {
      transform: translateX(4px);
    }

    /* Loading Skeleton */
    .outfits-loading {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
    }

    .skeleton-card {
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
    }

    .skeleton-image {
      aspect-ratio: 3/4;
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
      margin-bottom: 10px;
    }

    .skeleton-line.short {
      width: 60%;
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    /* Carousel */
    .outfits-carousel {
      position: relative;
    }

    .outfits-track {
      display: flex;
      gap: 24px;
      overflow-x: auto;
      scroll-behavior: smooth;
      scrollbar-width: none;
      -ms-overflow-style: none;
      padding: 10px 0;
    }

    .outfits-track::-webkit-scrollbar {
      display: none;
    }

    .outfit-slide {
      flex: 0 0 calc(25% - 18px);
      min-width: 280px;
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
      .outfit-slide {
        flex: 0 0 calc(33.333% - 16px);
      }

      .outfits-loading {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 768px) {
      .featured-outfits-section {
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

      .outfit-slide {
        flex: 0 0 calc(50% - 12px);
        min-width: 220px;
      }

      .outfits-loading {
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }

      .carousel-nav {
        display: none;
      }
    }

    @media (max-width: 480px) {
      .outfit-slide {
        flex: 0 0 85%;
        min-width: 260px;
      }

      .outfits-loading {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class FeaturedOutfitsComponent implements OnInit {
  @Input() title: string = 'Shop the Look';
  @Input() subtitle: string = 'Looks complets sélectionnés par nos stylistes';
  @Input() limit: number = 6;
  @Input() family?: string;

  outfits: Outfit[] = [];
  isLoading = true;

  canScrollPrev = false;
  canScrollNext = true;

  constructor(
    private outfitService: OutfitService,
    private cartService: CartService,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadFeaturedOutfits();
  }

  private loadFeaturedOutfits(): void {
    this.isLoading = true;

    this.outfitService.getFeaturedOutfits(this.limit).subscribe({
      next: (outfits) => {
        this.outfits = outfits;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading featured outfits:', err);
        this.isLoading = false;
      }
    });
  }

  scrollPrev(): void {
    const track = document.querySelector('.outfits-track');
    if (track) {
      track.scrollBy({ left: -320, behavior: 'smooth' });
      this.updateScrollState();
    }
  }

  scrollNext(): void {
    const track = document.querySelector('.outfits-track');
    if (track) {
      track.scrollBy({ left: 320, behavior: 'smooth' });
      this.updateScrollState();
    }
  }

  private updateScrollState(): void {
    setTimeout(() => {
      const track = document.querySelector('.outfits-track');
      if (track) {
        this.canScrollPrev = track.scrollLeft > 0;
        this.canScrollNext = track.scrollLeft < track.scrollWidth - track.clientWidth - 10;
      }
    }, 100);
  }

  handleAddAllToCart(outfit: Outfit): void {
    const token = localStorage.getItem('jwt');
    if (!token) {
      this.messageService.add({
        severity: 'info',
        summary: 'Connexion requise',
        detail: 'Veuillez vous connecter pour ajouter le look complet',
        life: 3000
      });
      this.router.navigate(['/login']);
      return;
    }

    this.outfitService.addAllToCart(outfit.id, { skipUnavailable: true }).subscribe({
      next: (result: AddAllToCartResult) => {
        if (result.success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Look ajouté',
            detail: `${result.added} article(s) ajouté(s) au panier`,
            life: 3000
          });
        } else {
          this.messageService.add({
            severity: 'warn',
            summary: 'Ajout partiel',
            detail: result.message,
            life: 4000
          });
        }
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Impossible d\'ajouter le look au panier',
          life: 3000
        });
      }
    });
  }

  trackByOutfitId(index: number, outfit: Outfit): number {
    return outfit.id;
  }
}
