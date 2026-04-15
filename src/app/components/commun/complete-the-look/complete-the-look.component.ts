/**
 * BARSHA COMPLETE THE LOOK COMPONENT
 * ====================================
 * Shows outfits containing the current product on PDP.
 * Premium "Shop the Look" integration.
 */

import { Component, OnInit, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { OutfitService, Outfit } from '../../../services/outfit.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-complete-the-look',
  standalone: true,
  imports: [CommonModule, RouterModule, ToastModule],
  providers: [MessageService],
  template: `
    <section class="complete-the-look" *ngIf="outfits.length > 0 || isLoading">
      <!-- Header -->
      <div class="section-header">
        <div class="header-icon">
          <i class="fas fa-magic"></i>
        </div>
        <h2 class="section-title">Complétez le look</h2>
        <p class="section-subtitle">Ce produit fait partie de looks sélectionnés</p>
      </div>

      <!-- Loading -->
      <div class="loading-skeleton" *ngIf="isLoading">
        <div class="skeleton-card" *ngFor="let i of [1,2]">
          <div class="skeleton-image"></div>
          <div class="skeleton-content">
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
          </div>
        </div>
      </div>

      <!-- Outfits List -->
      <div class="outfits-list" *ngIf="!isLoading">
        <div class="outfit-item" *ngFor="let outfit of outfits" (click)="navigateToOutfit(outfit)">
          <!-- Cover -->
          <div class="outfit-cover">
            <img
              [src]="outfit.coverImage || outfit.items?.[0]?.product?.firstImageUrl"
              [alt]="outfit.title"
              loading="lazy"
              (error)="onImageError($event)"
            >
            <div class="item-count">
              <i class="fas fa-layer-group"></i>
              {{ outfit.productCount }} pièces
            </div>
          </div>

          <!-- Info -->
          <div class="outfit-info">
            <div class="outfit-meta">
              <span class="occasion" *ngIf="outfit.occasion">
                {{ outfitService.getOccasionLabel(outfit.occasion) }}
              </span>
            </div>
            <h3 class="outfit-title">{{ outfit.title }}</h3>
            <div class="outfit-price">
              <span class="label">Total look</span>
              <span class="amount">{{ outfit.totalPrice | number:'1.3-3' }} TND</span>
            </div>

            <!-- Mini Product Preview -->
            <div class="products-preview" *ngIf="outfit.items && outfit.items.length">
              <div class="preview-item" *ngFor="let item of (outfit.items || []).slice(0, 3)">
                <img [src]="item.product.firstImageUrl" [alt]="item.product.title">
              </div>
              <div class="preview-more" *ngIf="(outfit.items || []).length > 3">
                +{{ (outfit.items || []).length - 3 }}
              </div>
            </div>
          </div>

          <!-- Action -->
          <div class="outfit-action">
            <button class="view-look-btn" (click)="navigateToOutfit(outfit); $event.stopPropagation()">
              Voir le look
              <i class="fas fa-arrow-right"></i>
            </button>
            <button
              class="add-all-btn"
              (click)="addAllToCart(outfit, $event)"
              [disabled]="addingOutfitId === outfit.id"
            >
              <i class="fas" [class.fa-cart-plus]="addingOutfitId !== outfit.id" [class.fa-spinner]="addingOutfitId === outfit.id" [class.fa-spin]="addingOutfitId === outfit.id"></i>
              Tout ajouter
            </button>
          </div>
        </div>
      </div>

      <!-- View All Link -->
      <div class="view-all" *ngIf="!isLoading && outfits.length > 0">
        <a routerLink="/looks" class="view-all-link">
          Explorer tous les looks
          <i class="fas fa-arrow-right"></i>
        </a>
      </div>
    </section>

    <p-toast position="bottom-right"></p-toast>
  `,
  styles: [`
    .complete-the-look {
      margin: 40px 0;
      padding: 30px;
      background: linear-gradient(135deg, #f8f9fa 0%, #fff 100%);
      border-radius: 16px;
      border: 1px solid #eee;
    }

    .section-header {
      text-align: center;
      margin-bottom: 30px;
    }

    .header-icon {
      width: 50px;
      height: 50px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }

    .header-icon i {
      color: #fff;
      font-size: 20px;
    }

    .section-title {
      font-size: 22px;
      font-weight: 700;
      color: #1a1a2e;
      margin: 0 0 8px;
    }

    .section-subtitle {
      font-size: 14px;
      color: #888;
      margin: 0;
    }

    /* Loading */
    .loading-skeleton {
      display: flex;
      gap: 20px;
    }

    .skeleton-card {
      flex: 1;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
    }

    .skeleton-image {
      height: 150px;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    .skeleton-content {
      padding: 16px;
    }

    .skeleton-line {
      height: 14px;
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

    /* Outfits List */
    .outfits-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .outfit-item {
      display: flex;
      gap: 20px;
      padding: 16px;
      background: #fff;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      border: 1px solid #eee;
    }

    .outfit-item:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
      border-color: #667eea;
    }

    .outfit-cover {
      position: relative;
      width: 120px;
      flex-shrink: 0;
    }

    .outfit-cover img {
      width: 100%;
      aspect-ratio: 3/4;
      object-fit: cover;
      border-radius: 8px;
    }

    .item-count {
      position: absolute;
      bottom: 8px;
      left: 8px;
      background: rgba(0, 0, 0, 0.75);
      color: #fff;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .outfit-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .outfit-meta {
      margin-bottom: 8px;
    }

    .occasion {
      display: inline-block;
      padding: 4px 10px;
      background: #667eea;
      color: #fff;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .outfit-title {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a2e;
      margin: 0 0 8px;
    }

    .outfit-price {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }

    .outfit-price .label {
      font-size: 12px;
      color: #888;
    }

    .outfit-price .amount {
      font-size: 16px;
      font-weight: 700;
      color: #1a1a2e;
    }

    .products-preview {
      display: flex;
      gap: 6px;
      margin-top: auto;
    }

    .preview-item {
      width: 36px;
      height: 45px;
      border-radius: 4px;
      overflow: hidden;
      background: #f5f5f5;
    }

    .preview-item img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .preview-more {
      width: 36px;
      height: 45px;
      border-radius: 4px;
      background: #eee;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 600;
      color: #666;
    }

    .outfit-action {
      display: flex;
      flex-direction: column;
      gap: 8px;
      justify-content: center;
    }

    .view-look-btn,
    .add-all-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .view-look-btn {
      background: #1a1a2e;
      color: #fff;
      border: none;
    }

    .view-look-btn:hover {
      background: #667eea;
    }

    .add-all-btn {
      background: #fff;
      color: #1a1a2e;
      border: 1px solid #ddd;
    }

    .add-all-btn:hover:not(:disabled) {
      background: #f5f5f5;
      border-color: #1a1a2e;
    }

    .add-all-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    /* View All */
    .view-all {
      text-align: center;
      margin-top: 24px;
    }

    .view-all-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      transition: color 0.2s;
    }

    .view-all-link:hover {
      color: #1a1a2e;
    }

    .view-all-link i {
      font-size: 12px;
      transition: transform 0.2s;
    }

    .view-all-link:hover i {
      transform: translateX(4px);
    }

    /* Responsive */
    @media (max-width: 768px) {
      .complete-the-look {
        padding: 20px;
        margin: 30px 0;
      }

      .outfit-item {
        flex-direction: column;
      }

      .outfit-cover {
        width: 100%;
      }

      .outfit-cover img {
        aspect-ratio: 16/9;
      }

      .outfit-action {
        flex-direction: row;
        margin-top: 12px;
      }

      .view-look-btn,
      .add-all-btn {
        flex: 1;
      }
    }
  `]
})
export class CompleteTheLookComponent implements OnInit, OnChanges {
  @Input() productId!: number;
  @Input() limit: number = 2;

  outfits: Outfit[] = [];
  isLoading = true;
  addingOutfitId: number | null = null;

  constructor(
    public outfitService: OutfitService,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.productId) {
      this.loadOutfits();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productId'] && !changes['productId'].firstChange) {
      this.loadOutfits();
    }
  }

  private loadOutfits(): void {
    if (!this.productId) {
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.outfitService.getOutfitsForProduct(this.productId, this.limit).subscribe({
      next: (outfits) => {
        this.outfits = outfits;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading outfits for product:', err);
        this.isLoading = false;
      }
    });
  }

  navigateToOutfit(outfit: Outfit): void {
    this.router.navigate(['/looks', outfit.slug]);
  }

  addAllToCart(outfit: Outfit, event: Event): void {
    event.stopPropagation();

    const token = localStorage.getItem('jwt');
    if (!token) {
      this.messageService.add({
        severity: 'info',
        summary: 'Connexion requise',
        detail: 'Veuillez vous connecter pour ajouter le look',
        life: 3000
      });
      this.router.navigate(['/login']);
      return;
    }

    this.addingOutfitId = outfit.id;

    this.outfitService.addAllToCart(outfit.id, { skipUnavailable: true }).subscribe({
      next: (result) => {
        this.addingOutfitId = null;
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
      error: () => {
        this.addingOutfitId = null;
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Impossible d\'ajouter le look au panier',
          life: 3000
        });
      }
    });
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/images/placeholder-outfit.jpg';
  }
}
