/**
 * BARSHA OUTFIT DETAIL PAGE
 * ==========================
 * Displays a complete outfit with all items and styling notes.
 * Route: /looks/:slug
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { OutfitService, Outfit, OutfitItem } from '../../../services/outfit.service';
import { CartService, CartItem } from '../../../services/cart.service';
import { BreadcrumbComponent } from '../../commun/breadcrumb/breadcrumb.component';
import { TitleService } from '../../../services/title.service';
import { SeoService } from '../../../services/seo.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-outfit-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, BreadcrumbComponent, ToastModule],
  providers: [MessageService],
  template: `
    <!-- Loading -->
    <section class="loading-container" *ngIf="isLoading">
      <div class="dots-container">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
    </section>

    <div class="outfit-detail-page" *ngIf="!isLoading && outfit">
      <!-- Breadcrumb -->
      <div class="container">
        <app-breadcrumb></app-breadcrumb>
      </div>

      <!-- Main Content -->
      <div class="container">
        <div class="outfit-layout">
          <!-- Left: Cover Image -->
          <div class="outfit-cover-section">
            <div class="cover-image-wrapper">
              <img
                [src]="outfit.coverImage || outfit.items?.[0]?.product?.firstImageUrl"
                [alt]="outfit.title"
                class="cover-image"
                (error)="onImageError($event)"
              >
              <div class="outfit-badges">
                <span class="badge occasion" *ngIf="outfit.occasion">
                  {{ outfitService.getOccasionLabel(outfit.occasion) }}
                </span>
                <span class="badge season" *ngIf="outfit.season !== 'all_season'">
                  {{ outfitService.getSeasonLabel(outfit.season) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Right: Details -->
          <div class="outfit-details-section">
            <div class="outfit-header">
              <span class="family-badge">{{ outfitService.getFamilyLabel(outfit.family) }}</span>
              <h1 class="outfit-title">{{ outfit.title }}</h1>
              <p class="outfit-description" *ngIf="outfit.description">{{ outfit.description }}</p>
            </div>

            <!-- Style Tags -->
            <div class="style-tags" *ngIf="outfit.styleTags?.length">
              <span class="tag" *ngFor="let tag of outfit.styleTags">{{ tag }}</span>
            </div>

            <!-- Stats -->
            <div class="outfit-stats">
              <div class="stat">
                <i class="fas fa-layer-group"></i>
                <span>{{ outfit.productCount }} pièces</span>
              </div>
              <div class="stat">
                <i class="fas fa-eye"></i>
                <span>{{ outfit.viewCount }} vues</span>
              </div>
            </div>

            <!-- Total Price & Add All -->
            <div class="price-action-section">
              <div class="total-price">
                <span class="label">Total du look</span>
                <span class="amount">{{ outfit.totalPrice | number:'1.3-3' }} TND</span>
              </div>
              <button
                class="add-all-btn"
                (click)="addAllToCart()"
                [disabled]="isAddingAll"
              >
                <i class="fas" [class.fa-cart-plus]="!isAddingAll" [class.fa-spinner]="isAddingAll" [class.fa-spin]="isAddingAll"></i>
                {{ isAddingAll ? 'Ajout en cours...' : 'Ajouter tout au panier' }}
              </button>
            </div>

            <!-- Items List -->
            <div class="outfit-items">
              <h2 class="items-title">
                <i class="fas fa-tshirt"></i>
                Composez ce look
              </h2>

              <div class="item-card" *ngFor="let item of outfit.items; let i = index">
                <div class="item-number">{{ i + 1 }}</div>
                <div class="item-image">
                  <a [routerLink]="getProductUrl(item.product)">
                    <img
                      [src]="item.product.firstImageUrl"
                      [alt]="item.product.title"
                      loading="lazy"
                    >
                  </a>
                </div>
                <div class="item-info">
                  <a [routerLink]="getProductUrl(item.product)" class="item-title">
                    {{ item.product.title }}
                  </a>
                  <p class="item-styling" *ngIf="item.stylingNote">
                    <i class="fas fa-magic"></i>
                    {{ item.stylingNote }}
                  </p>
                  <div class="item-meta">
                    <span class="item-price" *ngIf="item.product.discount">
                      <span class="current">{{ item.product.currentPrice | number:'1.3-3' }} TND</span>
                      <span class="original">{{ item.product.price | number:'1.3-3' }} TND</span>
                      <span class="discount">-{{ item.product.discountValue }}%</span>
                    </span>
                    <span class="item-price" *ngIf="!item.product.discount">
                      {{ item.product.currentPrice | number:'1.3-3' }} TND
                    </span>
                  </div>
                  <div class="item-recommendations" *ngIf="item.recommendedColor || item.recommendedSize">
                    <span *ngIf="item.recommendedColor">
                      <i class="fas fa-palette"></i> {{ item.recommendedColor }}
                    </span>
                    <span *ngIf="item.recommendedSize">
                      <i class="fas fa-ruler"></i> {{ item.recommendedSize }}
                    </span>
                  </div>
                </div>
                <div class="item-actions">
                  <span class="availability" [class.available]="item.product.isAvailable" [class.unavailable]="!item.product.isAvailable">
                    {{ item.product.isAvailable ? 'En stock' : 'Rupture' }}
                  </span>
                  <a [routerLink]="getProductUrl(item.product)" class="view-btn">
                    Voir
                    <i class="fas fa-arrow-right"></i>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Related Outfits -->
      <section class="related-outfits" *ngIf="relatedOutfits.length > 0">
        <div class="container">
          <h2>Looks similaires</h2>
          <div class="related-grid">
            <div class="related-card" *ngFor="let related of relatedOutfits" [routerLink]="['/looks', related.slug]">
              <img [src]="related.coverImage || related.items?.[0]?.product?.firstImageUrl" [alt]="related.title">
              <div class="related-info">
                <h3>{{ related.title }}</h3>
                <span>{{ related.totalPrice | number:'1.3-3' }} TND</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Not Found -->
    <div class="not-found" *ngIf="!isLoading && !outfit">
      <i class="fas fa-exclamation-circle"></i>
      <h2>Look introuvable</h2>
      <p>Ce look n'existe plus ou a été archivé</p>
      <a routerLink="/looks" class="back-btn">Voir tous les looks</a>
    </div>

    <p-toast position="bottom-right"></p-toast>
  `,
  styles: [`
    .outfit-detail-page {
      min-height: 100vh;
      background: #fafafa;
      padding-bottom: 60px;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 20px;
    }

    /* Loading */
    .loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 60vh;
    }

    .dots-container {
      display: flex;
      gap: 8px;
    }

    .dot {
      width: 12px;
      height: 12px;
      background: #667eea;
      border-radius: 50%;
      animation: pulse 1.5s ease-in-out infinite;
    }

    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    .dot:nth-child(4) { animation-delay: 0.6s; }
    .dot:nth-child(5) { animation-delay: 0.8s; }

    @keyframes pulse {
      0%, 100% { transform: scale(0.8); opacity: 0.5; }
      50% { transform: scale(1.2); opacity: 1; }
    }

    /* Layout */
    .outfit-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 60px;
      padding: 40px 0;
    }

    /* Cover Section */
    .cover-image-wrapper {
      position: relative;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
    }

    .cover-image {
      width: 100%;
      aspect-ratio: 3/4;
      object-fit: cover;
    }

    .outfit-badges {
      position: absolute;
      top: 20px;
      left: 20px;
      display: flex;
      gap: 10px;
    }

    .badge {
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .badge.occasion {
      background: #667eea;
      color: #fff;
    }

    .badge.season {
      background: rgba(255, 255, 255, 0.9);
      color: #333;
    }

    /* Details Section */
    .outfit-header {
      margin-bottom: 24px;
    }

    .family-badge {
      display: inline-block;
      padding: 4px 12px;
      background: #f0f0f0;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }

    .outfit-title {
      font-size: 36px;
      font-weight: 700;
      color: #1a1a2e;
      margin: 0 0 12px;
      line-height: 1.2;
    }

    .outfit-description {
      font-size: 16px;
      color: #666;
      line-height: 1.6;
      margin: 0;
    }

    .style-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 24px;
    }

    .tag {
      padding: 6px 14px;
      background: #f5f5f5;
      border-radius: 16px;
      font-size: 13px;
      color: #555;
    }

    .outfit-stats {
      display: flex;
      gap: 24px;
      margin-bottom: 30px;
    }

    .stat {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #888;
    }

    .stat i {
      color: #667eea;
    }

    /* Price & Action */
    .price-action-section {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border-radius: 16px;
      padding: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
    }

    .total-price .label {
      display: block;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      margin-bottom: 4px;
    }

    .total-price .amount {
      font-size: 28px;
      font-weight: 700;
      color: #fff;
    }

    .add-all-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 32px;
      background: #fff;
      color: #1a1a2e;
      border: none;
      border-radius: 30px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .add-all-btn:hover:not(:disabled) {
      background: #667eea;
      color: #fff;
      transform: scale(1.02);
    }

    .add-all-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    /* Items */
    .outfit-items {
      border-top: 1px solid #e0e0e0;
      padding-top: 32px;
    }

    .items-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 20px;
      font-weight: 600;
      color: #1a1a2e;
      margin: 0 0 24px;
    }

    .items-title i {
      color: #667eea;
    }

    .item-card {
      display: flex;
      gap: 16px;
      padding: 20px;
      background: #fff;
      border-radius: 12px;
      margin-bottom: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .item-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
    }

    .item-number {
      width: 28px;
      height: 28px;
      background: #667eea;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .item-image {
      width: 100px;
      flex-shrink: 0;
    }

    .item-image img {
      width: 100%;
      aspect-ratio: 3/4;
      object-fit: cover;
      border-radius: 8px;
    }

    .item-info {
      flex: 1;
    }

    .item-title {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a2e;
      text-decoration: none;
      display: block;
      margin-bottom: 6px;
    }

    .item-title:hover {
      color: #667eea;
    }

    .item-styling {
      font-size: 13px;
      color: #888;
      font-style: italic;
      margin: 0 0 8px;
    }

    .item-styling i {
      color: #667eea;
      margin-right: 6px;
    }

    .item-meta {
      margin-bottom: 8px;
    }

    .item-price {
      font-size: 15px;
      font-weight: 600;
      color: #1a1a2e;
    }

    .item-price .current {
      color: #1a1a2e;
    }

    .item-price .original {
      text-decoration: line-through;
      color: #999;
      font-weight: 400;
      margin-left: 8px;
    }

    .item-price .discount {
      background: #e74c3c;
      color: #fff;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      margin-left: 8px;
    }

    .item-recommendations {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: #888;
    }

    .item-recommendations i {
      color: #667eea;
      margin-right: 4px;
    }

    .item-actions {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: space-between;
    }

    .availability {
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 12px;
    }

    .availability.available {
      background: #d4edda;
      color: #155724;
    }

    .availability.unavailable {
      background: #f8d7da;
      color: #721c24;
    }

    .view-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: #f5f5f5;
      color: #333;
      text-decoration: none;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
    }

    .view-btn:hover {
      background: #1a1a2e;
      color: #fff;
    }

    /* Related Outfits */
    .related-outfits {
      background: #fff;
      padding: 60px 0;
      margin-top: 40px;
    }

    .related-outfits h2 {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 30px;
      text-align: center;
    }

    .related-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
    }

    .related-card {
      cursor: pointer;
      border-radius: 12px;
      overflow: hidden;
      transition: transform 0.3s ease;
    }

    .related-card:hover {
      transform: translateY(-5px);
    }

    .related-card img {
      width: 100%;
      aspect-ratio: 3/4;
      object-fit: cover;
    }

    .related-info {
      padding: 12px;
      background: #fafafa;
    }

    .related-info h3 {
      font-size: 14px;
      font-weight: 600;
      margin: 0 0 4px;
    }

    .related-info span {
      font-size: 13px;
      color: #666;
    }

    /* Not Found */
    .not-found {
      text-align: center;
      padding: 100px 20px;
      color: #888;
    }

    .not-found i {
      font-size: 64px;
      margin-bottom: 20px;
      opacity: 0.4;
    }

    .not-found h2 {
      font-size: 28px;
      color: #333;
      margin: 0 0 10px;
    }

    .not-found p {
      font-size: 16px;
      margin: 0 0 24px;
    }

    .back-btn {
      display: inline-block;
      padding: 14px 28px;
      background: #1a1a2e;
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
    }

    /* Responsive */
    @media (max-width: 992px) {
      .outfit-layout {
        grid-template-columns: 1fr;
        gap: 30px;
      }

      .related-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 768px) {
      .outfit-title {
        font-size: 26px;
      }

      .price-action-section {
        flex-direction: column;
        gap: 16px;
        text-align: center;
      }

      .add-all-btn {
        width: 100%;
        justify-content: center;
      }

      .item-card {
        flex-wrap: wrap;
      }

      .item-actions {
        flex-direction: row;
        width: 100%;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #eee;
      }
    }
  `]
})
export class OutfitDetailComponent implements OnInit {
  outfit: Outfit | null = null;
  relatedOutfits: Outfit[] = [];
  isLoading = true;
  isAddingAll = false;

  constructor(
    public outfitService: OutfitService,
    private cartService: CartService,
    private titleService: TitleService,
    private seoService: SeoService,
    private messageService: MessageService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      if (slug) {
        this.loadOutfit(slug);
      } else {
        this.isLoading = false;
      }
    });
  }

  private loadOutfit(slug: string): void {
    this.isLoading = true;

    this.outfitService.getOutfitBySlug(slug).subscribe({
      next: (outfit) => {
        this.outfit = outfit;
        this.isLoading = false;

        if (outfit) {
          this.titleService.setSpecificTitle(outfit.title);
          this.seoService.updateDescription(
            outfit.description || `Découvrez le look "${outfit.title}" - ${outfit.productCount} pièces sélectionnées par nos stylistes`
          );
          this.loadRelatedOutfits();
        }
      },
      error: (err) => {
        console.error('Error loading outfit:', err);
        this.isLoading = false;
      }
    });
  }

  private loadRelatedOutfits(): void {
    if (!this.outfit) return;

    this.outfitService.getOutfits({
      limit: 4,
      family: this.outfit.family,
      occasion: this.outfit.occasion
    }).subscribe({
      next: (response) => {
        this.relatedOutfits = response.outfits.filter(o => o.id !== this.outfit?.id).slice(0, 4);
      }
    });
  }

  addAllToCart(): void {
    if (!this.outfit || this.isAddingAll) return;

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

    this.isAddingAll = true;

    this.outfitService.addAllToCart(this.outfit.id, { skipUnavailable: true }).subscribe({
      next: (result) => {
        this.isAddingAll = false;
        if (result.success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Look ajouté au panier',
            detail: `${result.added} article(s) ajouté(s) avec succès`,
            life: 4000
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
      error: () => {
        this.isAddingAll = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Impossible d\'ajouter le look au panier',
          life: 3000
        });
      }
    });
  }

  getProductUrl(product: any): string {
    if (!product) return '/';
    const slug = product.title?.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'produit';
    return `/produit/${product.id}-${slug}`;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/images/placeholder-outfit.jpg';
  }
}
