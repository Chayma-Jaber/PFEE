/**
 * BARSHA OUTFIT CARD COMPONENT
 * =============================
 * Displays a single outfit in a premium card format.
 * Used in outfit galleries, homepage featured section, and PDP.
 */

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Outfit, OutfitService } from '../../../services/outfit.service';

@Component({
  selector: 'app-outfit-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <article class="outfit-card" [class.compact]="compact" [class.featured]="outfit.isFeatured">
      <a [routerLink]="['/looks', outfit.slug]" class="outfit-link">
        <!-- Cover Image -->
        <div class="outfit-image-wrapper">
          <img
            [src]="outfit.coverImage || outfit.items?.[0]?.product?.firstImageUrl || 'assets/images/placeholder.jpg'"
            [alt]="outfit.title"
            class="outfit-cover"
            loading="lazy"
            (error)="onImageError($event)"
          >

          <!-- Product Count Badge -->
          <span class="product-count-badge">
            <i class="fas fa-layer-group"></i>
            {{ outfit.productCount }} pièces
          </span>

          <!-- Occasion Badge -->
          <span class="occasion-badge" *ngIf="showOccasion && outfit.occasion">
            {{ outfitService.getOccasionLabel(outfit.occasion) }}
          </span>

          <!-- Hover Overlay -->
          <div class="outfit-overlay">
            <span class="view-look-btn">
              <i class="fas fa-eye"></i>
              Voir le look
            </span>
          </div>
        </div>

        <!-- Info Section -->
        <div class="outfit-info">
          <h3 class="outfit-title">{{ outfit.title }}</h3>

          <div class="outfit-meta" *ngIf="!compact">
            <span class="outfit-season" *ngIf="outfit.season !== 'all_season'">
              <i class="fas fa-calendar-alt"></i>
              {{ outfitService.getSeasonLabel(outfit.season) }}
            </span>
            <span class="outfit-family">
              {{ outfitService.getFamilyLabel(outfit.family) }}
            </span>
          </div>

          <!-- Style Tags -->
          <div class="outfit-tags" *ngIf="showTags && outfit.styleTags && outfit.styleTags.length > 0">
            <span class="style-tag" *ngFor="let tag of (outfit.styleTags || []).slice(0, 3)">
              {{ tag }}
            </span>
          </div>

          <!-- Total Price -->
          <div class="outfit-price">
            <span class="total-label">Total look</span>
            <span class="total-amount">{{ outfit.totalPrice | number:'1.3-3' }} TND</span>
          </div>

          <!-- Product Thumbnails Preview -->
          <div class="product-preview" *ngIf="showPreview && outfit.items && outfit.items.length">
            <div
              class="preview-thumb"
              *ngFor="let item of (outfit.items || []).slice(0, 4); let i = index"
              [class.more]="i === 3 && (outfit.items || []).length > 4"
            >
              <img
                [src]="item.product.firstImageUrl"
                [alt]="item.product.title"
                *ngIf="i < 3 || (outfit.items || []).length <= 4"
              >
              <span class="more-count" *ngIf="i === 3 && (outfit.items || []).length > 4">
                +{{ (outfit.items || []).length - 3 }}
              </span>
            </div>
          </div>
        </div>
      </a>

      <!-- Quick Add All Button -->
      <button
        class="quick-add-btn"
        *ngIf="showQuickAdd"
        (click)="onAddAllToCart($event)"
        [disabled]="isAddingToCart"
      >
        <i class="fas" [class.fa-cart-plus]="!isAddingToCart" [class.fa-spinner]="isAddingToCart" [class.fa-spin]="isAddingToCart"></i>
        {{ isAddingToCart ? 'Ajout...' : 'Tout ajouter' }}
      </button>
    </article>
  `,
  styles: [`
    .outfit-card {
      position: relative;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .outfit-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.12);
    }

    .outfit-card.featured {
      border: 2px solid #667eea;
    }

    .outfit-link {
      text-decoration: none;
      color: inherit;
      display: block;
    }

    .outfit-image-wrapper {
      position: relative;
      aspect-ratio: 3/4;
      overflow: hidden;
      background: #f5f5f5;
    }

    .outfit-cover {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.5s ease;
    }

    .outfit-card:hover .outfit-cover {
      transform: scale(1.05);
    }

    .product-count-badge {
      position: absolute;
      top: 12px;
      left: 12px;
      background: rgba(0, 0, 0, 0.75);
      color: #fff;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .occasion-badge {
      position: absolute;
      top: 12px;
      right: 12px;
      background: #667eea;
      color: #fff;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .outfit-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .outfit-card:hover .outfit-overlay {
      opacity: 1;
    }

    .view-look-btn {
      background: #fff;
      color: #1a1a2e;
      padding: 12px 24px;
      border-radius: 25px;
      font-weight: 600;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      transform: translateY(10px);
      transition: transform 0.3s ease;
    }

    .outfit-card:hover .view-look-btn {
      transform: translateY(0);
    }

    .outfit-info {
      padding: 16px;
    }

    .outfit-title {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a2e;
      margin: 0 0 8px;
      line-height: 1.3;
    }

    .outfit-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
      font-size: 12px;
      color: #666;
    }

    .outfit-meta i {
      margin-right: 4px;
      color: #999;
    }

    .outfit-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 12px;
    }

    .style-tag {
      background: #f0f0f0;
      color: #555;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }

    .outfit-price {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 12px;
      border-top: 1px solid #eee;
    }

    .total-label {
      font-size: 12px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .total-amount {
      font-size: 18px;
      font-weight: 700;
      color: #1a1a2e;
    }

    .product-preview {
      display: flex;
      gap: 6px;
      margin-top: 12px;
    }

    .preview-thumb {
      width: 40px;
      height: 50px;
      border-radius: 4px;
      overflow: hidden;
      background: #f5f5f5;
    }

    .preview-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .preview-thumb.more {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #eee;
    }

    .more-count {
      font-size: 12px;
      font-weight: 600;
      color: #666;
    }

    .quick-add-btn {
      position: absolute;
      bottom: 16px;
      right: 16px;
      background: #1a1a2e;
      color: #fff;
      border: none;
      padding: 10px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.3s ease, transform 0.3s ease, background 0.2s ease;
    }

    .outfit-card:hover .quick-add-btn {
      opacity: 1;
      transform: translateY(0);
    }

    .quick-add-btn:hover:not(:disabled) {
      background: #667eea;
    }

    .quick-add-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    /* Compact Mode */
    .outfit-card.compact {
      border-radius: 8px;
    }

    .outfit-card.compact .outfit-image-wrapper {
      aspect-ratio: 1;
    }

    .outfit-card.compact .outfit-info {
      padding: 10px;
    }

    .outfit-card.compact .outfit-title {
      font-size: 14px;
      margin-bottom: 6px;
    }

    .outfit-card.compact .outfit-price {
      padding-top: 8px;
    }

    .outfit-card.compact .total-amount {
      font-size: 15px;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .outfit-title {
        font-size: 14px;
      }

      .total-amount {
        font-size: 16px;
      }

      .quick-add-btn {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `]
})
export class OutfitCardComponent {
  @Input() outfit!: Outfit;
  @Input() compact: boolean = false;
  @Input() showOccasion: boolean = true;
  @Input() showTags: boolean = false;
  @Input() showPreview: boolean = false;
  @Input() showQuickAdd: boolean = true;

  @Output() addToCart = new EventEmitter<Outfit>();

  isAddingToCart = false;

  constructor(public outfitService: OutfitService) {}

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/images/placeholder.jpg';
  }

  onAddAllToCart(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.isAddingToCart) return;

    this.isAddingToCart = true;
    this.addToCart.emit(this.outfit);

    // Reset after animation
    setTimeout(() => {
      this.isAddingToCart = false;
    }, 2000);
  }
}
