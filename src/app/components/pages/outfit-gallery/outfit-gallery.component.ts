/**
 * BARSHA OUTFIT GALLERY PAGE
 * ===========================
 * Full-page gallery of curated outfits with filters.
 * Route: /looks
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OutfitService, Outfit, OccasionCount } from '../../../services/outfit.service';
import { OutfitCardComponent } from '../../commun/outfit-card/outfit-card.component';
import { BreadcrumbComponent } from '../../commun/breadcrumb/breadcrumb.component';
import { TitleService } from '../../../services/title.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-outfit-gallery',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, OutfitCardComponent, BreadcrumbComponent, ToastModule],
  providers: [MessageService],
  template: `
    <div class="outfit-gallery-page">
      <!-- Breadcrumb -->
      <div class="container">
        <app-breadcrumb></app-breadcrumb>
      </div>

      <!-- Hero Section -->
      <section class="gallery-hero">
        <div class="hero-content">
          <h1>Shop the Look</h1>
          <p>Découvrez nos looks complets sélectionnés par nos stylistes</p>
        </div>
      </section>

      <!-- Filters Section -->
      <section class="filters-section">
        <div class="container">
          <div class="filters-bar">
            <!-- Family Filter -->
            <div class="filter-group">
              <label>Collection</label>
              <select [(ngModel)]="filters.family" (change)="applyFilters()">
                <option value="">Tous</option>
                <option value="WOMEN">Femme</option>
                <option value="MEN">Homme</option>
                <option value="KIDS">Enfants</option>
                <option value="UNISEX">Unisexe</option>
              </select>
            </div>

            <!-- Occasion Filter -->
            <div class="filter-group">
              <label>Occasion</label>
              <select [(ngModel)]="filters.occasion" (change)="applyFilters()">
                <option value="">Toutes</option>
                <option *ngFor="let occ of occasions" [value]="occ.occasion">
                  {{ occ.label }} ({{ occ.count }})
                </option>
              </select>
            </div>

            <!-- Season Filter -->
            <div class="filter-group">
              <label>Saison</label>
              <select [(ngModel)]="filters.season" (change)="applyFilters()">
                <option value="">Toutes</option>
                <option value="spring">Printemps</option>
                <option value="summer">Été</option>
                <option value="fall">Automne</option>
                <option value="winter">Hiver</option>
                <option value="all_season">Toutes saisons</option>
              </select>
            </div>

            <!-- Search -->
            <div class="filter-group search">
              <label>Rechercher</label>
              <div class="search-input">
                <i class="fas fa-search"></i>
                <input
                  type="text"
                  [(ngModel)]="filters.search"
                  placeholder="Rechercher un look..."
                  (keyup.enter)="applyFilters()"
                >
              </div>
            </div>

            <!-- Clear Filters -->
            <button class="clear-filters-btn" (click)="clearFilters()" *ngIf="hasActiveFilters">
              <i class="fas fa-times"></i>
              Effacer
            </button>
          </div>
        </div>
      </section>

      <!-- Results Count -->
      <section class="results-section">
        <div class="container">
          <div class="results-header">
            <p class="results-count">
              {{ totalOutfits }} look{{ totalOutfits > 1 ? 's' : '' }} trouvé{{ totalOutfits > 1 ? 's' : '' }}
            </p>
            <div class="sort-options">
              <select [(ngModel)]="sortBy" (change)="applyFilters()">
                <option value="featured">Mis en avant</option>
                <option value="newest">Plus récents</option>
                <option value="popular">Populaires</option>
                <option value="price_asc">Prix croissant</option>
                <option value="price_desc">Prix décroissant</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <!-- Outfits Grid -->
      <section class="outfits-section">
        <div class="container">
          <!-- Loading State -->
          <div class="outfits-loading" *ngIf="isLoading">
            <div class="skeleton-card" *ngFor="let i of [1,2,3,4,5,6,7,8]">
              <div class="skeleton-image"></div>
              <div class="skeleton-content">
                <div class="skeleton-line"></div>
                <div class="skeleton-line short"></div>
              </div>
            </div>
          </div>

          <!-- Outfits Grid -->
          <div class="outfits-grid" *ngIf="!isLoading && outfits.length > 0">
            <app-outfit-card
              *ngFor="let outfit of outfits; trackBy: trackByOutfitId"
              [outfit]="outfit"
              [showOccasion]="true"
              [showTags]="true"
              [showQuickAdd]="true"
              (addToCart)="handleAddAllToCart($event)"
            ></app-outfit-card>
          </div>

          <!-- Empty State -->
          <div class="empty-state" *ngIf="!isLoading && outfits.length === 0">
            <i class="fas fa-tshirt"></i>
            <h3>Aucun look trouvé</h3>
            <p>Essayez de modifier vos filtres pour découvrir plus de looks</p>
            <button class="reset-btn" (click)="clearFilters()">Voir tous les looks</button>
          </div>

          <!-- Pagination -->
          <div class="pagination" *ngIf="!isLoading && totalPages > 1">
            <button
              class="page-btn"
              [disabled]="currentPage === 1"
              (click)="goToPage(currentPage - 1)"
            >
              <i class="fas fa-chevron-left"></i>
            </button>

            <span class="page-info">
              Page {{ currentPage }} sur {{ totalPages }}
            </span>

            <button
              class="page-btn"
              [disabled]="currentPage === totalPages"
              (click)="goToPage(currentPage + 1)"
            >
              <i class="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </section>
    </div>

    <p-toast position="bottom-right"></p-toast>
  `,
  styles: [`
    .outfit-gallery-page {
      min-height: 100vh;
      background: #fafafa;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 20px;
    }

    /* Hero */
    .gallery-hero {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      padding: 60px 20px;
      text-align: center;
      color: #fff;
    }

    .hero-content h1 {
      font-size: 42px;
      font-weight: 700;
      margin: 0 0 12px;
    }

    .hero-content p {
      font-size: 18px;
      opacity: 0.9;
      margin: 0;
    }

    /* Filters */
    .filters-section {
      background: #fff;
      border-bottom: 1px solid #e0e0e0;
      padding: 20px 0;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .filters-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: flex-end;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .filter-group label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: #888;
      letter-spacing: 0.5px;
    }

    .filter-group select,
    .search-input input {
      padding: 10px 14px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
      background: #fff;
      min-width: 150px;
    }

    .filter-group select:focus,
    .search-input input:focus {
      outline: none;
      border-color: #667eea;
    }

    .filter-group.search {
      flex: 1;
      min-width: 200px;
    }

    .search-input {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-input i {
      position: absolute;
      left: 12px;
      color: #888;
    }

    .search-input input {
      padding-left: 38px;
      width: 100%;
    }

    .clear-filters-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .clear-filters-btn:hover {
      background: #eee;
    }

    /* Results */
    .results-section {
      padding: 20px 0;
      background: #fff;
    }

    .results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .results-count {
      font-size: 14px;
      color: #666;
      margin: 0;
    }

    .sort-options select {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      background: #fff;
    }

    /* Outfits Grid */
    .outfits-section {
      padding: 40px 0 60px;
    }

    .outfits-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
    }

    /* Loading */
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

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 80px 20px;
      color: #888;
    }

    .empty-state i {
      font-size: 64px;
      margin-bottom: 20px;
      opacity: 0.4;
    }

    .empty-state h3 {
      font-size: 24px;
      color: #333;
      margin: 0 0 10px;
    }

    .empty-state p {
      font-size: 16px;
      margin: 0 0 24px;
    }

    .reset-btn {
      padding: 12px 24px;
      background: #1a1a2e;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    .reset-btn:hover {
      background: #667eea;
    }

    /* Pagination */
    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 20px;
      margin-top: 40px;
    }

    .page-btn {
      width: 44px;
      height: 44px;
      border: 1px solid #ddd;
      background: #fff;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .page-btn:hover:not(:disabled) {
      background: #1a1a2e;
      color: #fff;
      border-color: #1a1a2e;
    }

    .page-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .page-info {
      font-size: 14px;
      color: #666;
    }

    /* Responsive */
    @media (max-width: 1200px) {
      .outfits-grid,
      .outfits-loading {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 768px) {
      .gallery-hero {
        padding: 40px 20px;
      }

      .hero-content h1 {
        font-size: 28px;
      }

      .filters-bar {
        flex-direction: column;
        gap: 12px;
      }

      .filter-group {
        width: 100%;
      }

      .filter-group select,
      .search-input input {
        width: 100%;
      }

      .outfits-grid,
      .outfits-loading {
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }
    }

    @media (max-width: 480px) {
      .outfits-grid,
      .outfits-loading {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class OutfitGalleryComponent implements OnInit {
  outfits: Outfit[] = [];
  occasions: OccasionCount[] = [];
  isLoading = true;

  totalOutfits = 0;
  currentPage = 1;
  totalPages = 1;
  itemsPerPage = 12;

  filters = {
    family: '',
    occasion: '',
    season: '',
    search: ''
  };

  sortBy = 'featured';

  constructor(
    private outfitService: OutfitService,
    private titleService: TitleService,
    private messageService: MessageService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.titleService.setSpecificTitle('Shop the Look');
    this.loadOccasions();
    this.loadOutfits();
  }

  get hasActiveFilters(): boolean {
    return !!(this.filters.family || this.filters.occasion || this.filters.season || this.filters.search);
  }

  loadOccasions(): void {
    this.outfitService.getOccasions().subscribe(occasions => {
      this.occasions = occasions;
    });
  }

  loadOutfits(): void {
    this.isLoading = true;

    this.outfitService.getOutfits({
      page: this.currentPage,
      limit: this.itemsPerPage,
      family: this.filters.family || undefined,
      occasion: this.filters.occasion || undefined,
      season: this.filters.season || undefined,
      search: this.filters.search || undefined
    }).subscribe({
      next: (response) => {
        this.outfits = response.outfits;
        this.totalOutfits = response.total;
        this.totalPages = response.totalPages;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading outfits:', err);
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadOutfits();
  }

  clearFilters(): void {
    this.filters = {
      family: '',
      occasion: '',
      season: '',
      search: ''
    };
    this.sortBy = 'featured';
    this.applyFilters();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadOutfits();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
      next: (result) => {
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
      }
    });
  }

  trackByOutfitId(index: number, outfit: Outfit): number {
    return outfit.id;
  }
}
