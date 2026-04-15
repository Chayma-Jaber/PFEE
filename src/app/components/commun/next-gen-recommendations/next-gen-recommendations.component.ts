/**
 * BARSHA NEXT-GENERATION RECOMMENDATIONS COMPONENT
 * =================================================
 * Version: 3.0.0
 *
 * Premium recommendation display with:
 * - Luxury fashion aesthetics
 * - Full accessibility (WCAG 2.1 AA)
 * - Analytics tracking
 * - Intelligent loading states
 * - Fashion-forward UI
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ElementRef,
  ViewChildren,
  QueryList,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import {
  NextGenRecommendationsService,
  RecommendedProduct,
  RecommendationResponse,
  UserContext
} from '../../../services/next-gen-recommendations.service';

type Strategy =
  | 'similar'
  | 'complementary'
  | 'complete_the_look'
  | 'premium_alternative'
  | 'affordable_alternative'
  | 'trending'
  | 'new_arrivals'
  | 'seasonal'
  | 'editorial'
  | 'personalized'
  | 'cart_complement'
  | 'style_discovery'
  | 'because_you_viewed'
  | 'frequently_bought_together'
  | 'customers_also_liked';

@Component({
  selector: 'app-next-gen-recommendations',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="ng-recommendations"
      [class.ng-featured]="featured"
      [class.ng-compact]="compact"
      *ngIf="shouldShow"
      [attr.aria-label]="title"
      role="region"
    >
      <!-- Header -->
      <header class="ng-header" *ngIf="showHeader">
        <div class="ng-header-content">
          <div class="ng-titles">
            <h2 class="ng-title">{{ title }}</h2>
            <p class="ng-subtitle" *ngIf="subtitle">{{ subtitle }}</p>
          </div>

          <div class="ng-header-actions">
            <!-- AI Badge -->
            <div class="ng-ai-badge" *ngIf="showAiBadge" aria-label="Recommandation intelligente">
              <svg class="ng-sparkle" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z"/>
              </svg>
              <span>IA</span>
            </div>

            <!-- View All Link -->
            <a
              *ngIf="showViewAll && viewAllLink"
              [routerLink]="viewAllLink"
              class="ng-view-all"
              [attr.aria-label]="'Voir tous les ' + title"
            >
              Voir tout
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </a>
          </div>
        </div>
      </header>

      <!-- Loading State -->
      <div class="ng-loading" *ngIf="isLoading" role="status" aria-label="Chargement en cours">
        <div class="ng-skeleton-grid" [class.grid-4]="limit >= 8" [class.grid-3]="limit >= 5 && limit < 8" [class.grid-2]="limit < 5">
          <article class="ng-skeleton" *ngFor="let i of skeletonArray">
            <div class="ng-skeleton-image">
              <div class="ng-shimmer"></div>
            </div>
            <div class="ng-skeleton-content">
              <div class="ng-skeleton-colors"></div>
              <div class="ng-skeleton-title"></div>
              <div class="ng-skeleton-price"></div>
              <div class="ng-skeleton-reason"></div>
            </div>
          </article>
        </div>
      </div>

      <!-- Products Grid -->
      <div
        class="ng-products-grid"
        [class.grid-4]="limit >= 8"
        [class.grid-3]="limit >= 5 && limit < 8"
        [class.grid-2]="limit < 5"
        *ngIf="!isLoading && products.length > 0"
        role="list"
      >
        <article
          #productCard
          class="ng-product-card"
          *ngFor="let product of products; let i = index; trackBy: trackByProductId"
          role="listitem"
          [attr.data-position]="i"
          [attr.data-strategy]="strategy"
          (mouseenter)="onProductHover(product, i)"
        >
          <!-- Product Image Container -->
          <a
            [routerLink]="['/produit', product.id]"
            class="ng-image-link"
            (click)="onProductClick(product, i)"
            [attr.aria-label]="'Voir ' + product.name"
          >
            <div class="ng-image-container">
              <!-- Primary Image -->
              <img
                [src]="product.image"
                [alt]="product.name"
                class="ng-image ng-image-primary"
                loading="lazy"
                (error)="onImageError($event)"
              />

              <!-- Secondary Image (Hover) -->
              <img
                *ngIf="product.secondImage"
                [src]="product.secondImage"
                [alt]="product.name + ' - vue alternative'"
                class="ng-image ng-image-secondary"
                loading="lazy"
              />

              <!-- Badges -->
              <div class="ng-badges">
                <span class="ng-badge ng-badge-discount" *ngIf="product.discountPercent && product.discountPercent > 0">
                  -{{ product.discountPercent }}%
                </span>
                <span class="ng-badge ng-badge-new" *ngIf="product.reasonKey === 'new_arrival'">
                  Nouveau
                </span>
                <span class="ng-badge ng-badge-trending" *ngIf="product.reasonKey === 'trending_now'">
                  Tendance
                </span>
              </div>

              <!-- Quick Actions -->
              <div class="ng-quick-actions" role="group" aria-label="Actions rapides">
                <button
                  class="ng-quick-btn ng-btn-wishlist"
                  (click)="onWishlistClick($event, product)"
                  [attr.aria-label]="'Ajouter ' + product.name + ' aux favoris'"
                  title="Ajouter aux favoris"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </button>
                <button
                  class="ng-quick-btn ng-btn-quickview"
                  (click)="onQuickView($event, product)"
                  [attr.aria-label]="'Aperçu rapide de ' + product.name"
                  title="Aperçu rapide"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>

              <!-- Confidence Indicator (subtle) -->
              <div
                class="ng-confidence"
                *ngIf="showConfidence && product.confidence > 0.7"
                [attr.aria-label]="'Confiance: ' + (product.confidence * 100).toFixed(0) + '%'"
                title="Recommandation forte"
              >
                <span class="ng-confidence-dot" [class.high]="product.confidence > 0.8"></span>
              </div>
            </div>
          </a>

          <!-- Product Info -->
          <div class="ng-product-info">
            <!-- Color Options -->
            <div class="ng-colors" *ngIf="product.colors && product.colors.length > 0" role="list" aria-label="Couleurs disponibles">
              <span
                class="ng-color-dot"
                *ngFor="let color of product.colors.slice(0, 4)"
                [attr.data-color]="color.toLowerCase()"
                [title]="color"
                role="listitem"
              ></span>
              <span class="ng-color-more" *ngIf="product.colors.length > 4">
                +{{ product.colors.length - 4 }}
              </span>
            </div>

            <!-- Product Name -->
            <a
              [routerLink]="['/produit', product.id]"
              class="ng-product-name"
              (click)="onProductClick(product, i)"
            >
              {{ product.name }}
            </a>

            <!-- Price -->
            <div class="ng-price-container">
              <span class="ng-price" [class.ng-price-sale]="product.discountPercent">
                {{ product.price.toFixed(3) }} TND
              </span>
              <span class="ng-price-original" *ngIf="product.originalPrice">
                {{ product.originalPrice.toFixed(3) }} TND
              </span>
            </div>

            <!-- Reason Badge -->
            <div class="ng-reason" *ngIf="showReason && product.reasonText">
              <svg class="ng-reason-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
              <span>{{ product.reasonText }}</span>
            </div>
          </div>
        </article>
      </div>

      <!-- Empty State -->
      <div class="ng-empty" *ngIf="!isLoading && products.length === 0" role="status">
        <svg class="ng-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
        <p class="ng-empty-text">{{ emptyMessage || 'Aucune recommandation disponible' }}</p>
        <a routerLink="/shop" class="ng-empty-cta" *ngIf="showEmptyCta">Découvrir la collection</a>
      </div>

      <!-- Performance Metadata (dev only) -->
      <div class="ng-metadata" *ngIf="showMetadata && metadata">
        <span>{{ metadata.totalCandidates }} candidats</span>
        <span>{{ metadata.executionTimeMs.toFixed(0) }}ms</span>
        <span *ngIf="metadata.cacheHit">Cache</span>
      </div>
    </section>
  `,
  styles: [`
    /* ================================================================
       BARSHA NEXT-GEN RECOMMENDATIONS - PREMIUM STYLES
       ================================================================ */

    :host {
      display: block;
      --ng-primary: #1a1a1a;
      --ng-secondary: #666;
      --ng-accent: #8b7355;
      --ng-bg: #ffffff;
      --ng-bg-alt: #fafafa;
      --ng-border: #e5e5e5;
      --ng-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
      --ng-radius: 8px;
      --ng-transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      --ng-font-title: 'std95', -apple-system, BlinkMacSystemFont, sans-serif;
      --ng-font-body: 'std55', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    /* Section Container */
    .ng-recommendations {
      padding: 3rem 0;
      background: var(--ng-bg);
    }

    .ng-recommendations.ng-featured {
      background: linear-gradient(180deg, #f8f9fc 0%, var(--ng-bg) 100%);
      padding: 4rem 0;
      margin: 1.5rem 0;
      border-radius: var(--ng-radius);
      position: relative;
      overflow: hidden;
    }

    .ng-recommendations.ng-featured::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(102, 126, 234, 0.2), transparent);
    }

    .ng-recommendations.ng-compact {
      padding: 2rem 0;
    }

    /* Header */
    .ng-header {
      max-width: 1400px;
      margin: 0 auto 2rem;
      padding: 0 1.5rem;
    }

    .ng-header-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 1.5rem;
    }

    .ng-titles {
      flex: 1;
    }

    .ng-title {
      font-family: var(--ng-font-title);
      font-size: 1.85rem;
      font-weight: 600;
      color: var(--ng-primary);
      margin: 0;
      letter-spacing: -0.03em;
      line-height: 1.15;
      position: relative;
    }

    .ng-featured .ng-title {
      font-size: 2rem;
    }

    .ng-featured .ng-title::after {
      content: '';
      display: block;
      width: 40px;
      height: 2px;
      background: linear-gradient(90deg, #667eea, #764ba2);
      margin-top: 0.75rem;
      border-radius: 1px;
    }

    .ng-subtitle {
      font-family: var(--ng-font-body);
      font-size: 0.95rem;
      color: var(--ng-secondary);
      margin: 0.75rem 0 0;
      line-height: 1.45;
      letter-spacing: 0.01em;
    }

    .ng-header-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    /* AI Badge - Premium Styling */
    .ng-ai-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.45rem 0.85rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      border-radius: 24px;
      font-family: var(--ng-font-body);
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
      position: relative;
      overflow: hidden;
    }

    .ng-ai-badge::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      animation: ai-shimmer 3s infinite;
    }

    @keyframes ai-shimmer {
      0% { left: -100%; }
      50%, 100% { left: 100%; }
    }

    .ng-sparkle {
      width: 12px;
      height: 12px;
      animation: sparkle 2s ease-in-out infinite;
      filter: drop-shadow(0 0 2px rgba(255,255,255,0.5));
    }

    @keyframes sparkle {
      0%, 100% { opacity: 0.8; transform: scale(1) rotate(0deg); }
      50% { opacity: 1; transform: scale(1.15) rotate(180deg); }
    }

    /* View All Link - Premium Styling */
    .ng-view-all {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-family: var(--ng-font-body);
      font-size: 0.88rem;
      color: var(--ng-primary);
      text-decoration: none;
      padding: 0.6rem 1rem;
      border-radius: 6px;
      background: transparent;
      transition: all 0.25s ease;
      letter-spacing: 0.01em;
    }

    .ng-view-all:hover {
      background: rgba(0, 0, 0, 0.04);
      color: var(--ng-primary);
    }

    .ng-view-all svg {
      width: 16px;
      height: 16px;
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .ng-view-all:hover svg {
      transform: translateX(4px);
    }

    /* Products Grid */
    .ng-products-grid,
    .ng-skeleton-grid {
      display: grid;
      gap: 1.5rem;
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }

    .grid-4 { grid-template-columns: repeat(4, 1fr); }
    .grid-3 { grid-template-columns: repeat(3, 1fr); }
    .grid-2 { grid-template-columns: repeat(2, 1fr); }

    /* Product Card - Premium Styling */
    .ng-product-card {
      position: relative;
      background: var(--ng-bg);
      border-radius: var(--ng-radius);
      overflow: hidden;
      transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
                  box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .ng-product-card::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: var(--ng-radius);
      border: 1px solid transparent;
      pointer-events: none;
      transition: border-color 0.3s ease;
    }

    .ng-product-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.12),
                  0 8px 20px rgba(0, 0, 0, 0.08);
    }

    .ng-product-card:hover::after {
      border-color: rgba(0, 0, 0, 0.05);
    }

    /* Image Container */
    .ng-image-link {
      display: block;
      text-decoration: none;
    }

    .ng-image-container {
      position: relative;
      aspect-ratio: 3 / 4;
      overflow: hidden;
      background: var(--ng-bg-alt);
      border-radius: var(--ng-radius) var(--ng-radius) 0 0;
    }

    .ng-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: opacity 0.4s ease, transform 0.6s ease;
    }

    .ng-image-secondary {
      position: absolute;
      top: 0;
      left: 0;
      opacity: 0;
    }

    .ng-product-card:hover .ng-image-primary {
      opacity: 0;
    }

    .ng-product-card:hover .ng-image-secondary {
      opacity: 1;
    }

    .ng-product-card:hover .ng-image {
      transform: scale(1.03);
    }

    /* Badges */
    .ng-badges {
      position: absolute;
      top: 0.75rem;
      left: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      z-index: 2;
    }

    .ng-badge {
      display: inline-block;
      padding: 0.4rem 0.65rem;
      font-family: var(--ng-font-body);
      font-size: 0.68rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      border-radius: 4px;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }

    .ng-badge-discount {
      background: linear-gradient(135deg, #c41e3a, #9a1830);
      color: #fff;
      box-shadow: 0 2px 8px rgba(196, 30, 58, 0.3);
    }

    .ng-badge-new {
      background: linear-gradient(135deg, #1a1a1a, #333);
      color: #fff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .ng-badge-trending {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: #fff;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    /* Quick Actions - Premium Styling */
    .ng-quick-actions {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      opacity: 0;
      transform: translateX(10px);
      transition: opacity 0.35s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      z-index: 2;
    }

    .ng-product-card:hover .ng-quick-actions {
      opacity: 1;
      transform: translateX(0);
    }

    .ng-quick-btn {
      width: 42px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: none;
      border-radius: 50%;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.12);
    }

    .ng-quick-btn:hover {
      background: var(--ng-primary);
      color: #fff;
      transform: scale(1.12);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
    }

    .ng-quick-btn:active {
      transform: scale(0.95);
    }

    .ng-quick-btn:focus-visible {
      outline: 2px solid var(--ng-accent);
      outline-offset: 3px;
    }

    .ng-quick-btn svg {
      width: 18px;
      height: 18px;
      transition: transform 0.2s ease;
    }

    .ng-btn-wishlist:hover svg {
      fill: currentColor;
    }

    /* Confidence Indicator */
    .ng-confidence {
      position: absolute;
      bottom: 0.75rem;
      right: 0.75rem;
      z-index: 2;
    }

    .ng-confidence-dot {
      display: block;
      width: 8px;
      height: 8px;
      background: #4ade80;
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
    }

    .ng-confidence-dot.high {
      background: #22c55e;
      box-shadow: 0 0 12px rgba(34, 197, 94, 0.6);
    }

    /* Product Info */
    .ng-product-info {
      padding: 1rem;
    }

    /* Colors */
    .ng-colors {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin-bottom: 0.6rem;
    }

    .ng-color-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 1px solid var(--ng-border);
      transition: transform 0.2s ease;
    }

    .ng-color-dot:hover {
      transform: scale(1.2);
    }

    /* Color mappings */
    .ng-color-dot[data-color="noir"] { background: #1a1a1a; }
    .ng-color-dot[data-color="blanc"] { background: #ffffff; }
    .ng-color-dot[data-color="beige"] { background: #f5f5dc; }
    .ng-color-dot[data-color="marine"] { background: #1a237e; }
    .ng-color-dot[data-color="bleu"] { background: #2196f3; }
    .ng-color-dot[data-color="rouge"] { background: #f44336; }
    .ng-color-dot[data-color="rose"] { background: #e91e63; }
    .ng-color-dot[data-color="gris"] { background: #9e9e9e; }
    .ng-color-dot[data-color="vert"] { background: #4caf50; }
    .ng-color-dot[data-color="marron"] { background: #795548; }
    .ng-color-dot[data-color="camel"] { background: #c19a6b; }
    .ng-color-dot[data-color="bordeaux"] { background: #800020; }
    .ng-color-dot[data-color="or"] { background: linear-gradient(135deg, #ffd700, #b8860b); }
    .ng-color-dot[data-color="argent"] { background: linear-gradient(135deg, #c0c0c0, #808080); }

    .ng-color-more {
      font-family: var(--ng-font-body);
      font-size: 0.75rem;
      color: var(--ng-secondary);
    }

    /* Product Name */
    .ng-product-name {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      font-family: var(--ng-font-body);
      font-size: 0.9rem;
      color: var(--ng-primary);
      text-decoration: none;
      line-height: 1.4;
      margin-bottom: 0.5rem;
      transition: color 0.2s ease;
    }

    .ng-product-name:hover {
      color: var(--ng-accent);
    }

    /* Price */
    .ng-price-container {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .ng-price {
      font-family: var(--ng-font-title);
      font-size: 1rem;
      font-weight: 600;
      color: var(--ng-primary);
    }

    .ng-price.ng-price-sale {
      color: #c41e3a;
    }

    .ng-price-original {
      font-family: var(--ng-font-body);
      font-size: 0.85rem;
      color: var(--ng-secondary);
      text-decoration: line-through;
    }

    /* Reason Badge - Premium Styling */
    .ng-reason {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.5rem 0.75rem;
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08));
      border: 1px solid rgba(102, 126, 234, 0.12);
      border-radius: 6px;
      font-family: var(--ng-font-body);
      font-size: 0.72rem;
      color: #5a5a5a;
      letter-spacing: 0.02em;
      transition: all 0.2s ease;
    }

    .ng-product-card:hover .ng-reason {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.12), rgba(118, 75, 162, 0.12));
      border-color: rgba(102, 126, 234, 0.2);
    }

    .ng-reason-icon {
      width: 12px;
      height: 12px;
      color: #667eea;
      opacity: 0.8;
    }

    /* Skeleton Loading */
    .ng-skeleton {
      background: var(--ng-bg);
      border-radius: var(--ng-radius);
      overflow: hidden;
    }

    .ng-skeleton-image {
      aspect-ratio: 3 / 4;
      background: var(--ng-bg-alt);
      position: relative;
      overflow: hidden;
    }

    .ng-shimmer {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.5) 50%,
        transparent 100%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s ease-in-out infinite;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .ng-skeleton-content {
      padding: 1rem;
    }

    .ng-skeleton-colors {
      width: 60px;
      height: 14px;
      background: var(--ng-bg-alt);
      border-radius: 4px;
      margin-bottom: 0.6rem;
    }

    .ng-skeleton-title {
      width: 100%;
      height: 16px;
      background: var(--ng-bg-alt);
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }

    .ng-skeleton-price {
      width: 70px;
      height: 18px;
      background: var(--ng-bg-alt);
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }

    .ng-skeleton-reason {
      width: 120px;
      height: 24px;
      background: var(--ng-bg-alt);
      border-radius: 4px;
    }

    /* Empty State */
    .ng-empty {
      text-align: center;
      padding: 4rem 2rem;
      max-width: 400px;
      margin: 0 auto;
    }

    .ng-empty-icon {
      width: 64px;
      height: 64px;
      color: var(--ng-border);
      margin-bottom: 1.5rem;
    }

    .ng-empty-text {
      font-family: var(--ng-font-body);
      font-size: 1rem;
      color: var(--ng-secondary);
      margin: 0 0 1.5rem;
    }

    .ng-empty-cta {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      background: var(--ng-primary);
      color: #fff;
      font-family: var(--ng-font-body);
      font-size: 0.9rem;
      text-decoration: none;
      border-radius: 4px;
      transition: var(--ng-transition);
    }

    .ng-empty-cta:hover {
      background: #333;
    }

    /* Metadata (dev) */
    .ng-metadata {
      display: flex;
      justify-content: center;
      gap: 1rem;
      padding: 1rem;
      font-family: monospace;
      font-size: 0.7rem;
      color: var(--ng-secondary);
      opacity: 0.5;
    }

    /* ================================================================
       RESPONSIVE STYLES
       ================================================================ */

    @media (max-width: 1200px) {
      .grid-4 { grid-template-columns: repeat(3, 1fr); }
    }

    @media (max-width: 900px) {
      .ng-recommendations { padding: 2rem 0; }

      .ng-header-content {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }

      .ng-header-actions {
        width: 100%;
        justify-content: space-between;
      }

      .ng-title { font-size: 1.5rem; }
      .ng-subtitle { font-size: 0.9rem; }

      .grid-4, .grid-3 { grid-template-columns: repeat(2, 1fr); }
      .ng-products-grid, .ng-skeleton-grid { gap: 1rem; padding: 0 1rem; }
    }

    @media (max-width: 600px) {
      .ng-recommendations { padding: 1.5rem 0; }
      .ng-header { margin-bottom: 1.5rem; padding: 0 1rem; }
      .ng-title { font-size: 1.25rem; }

      .ng-products-grid, .ng-skeleton-grid {
        gap: 0.75rem;
        padding: 0 0.75rem;
      }

      .ng-product-info { padding: 0.75rem; }
      .ng-product-name { font-size: 0.85rem; }
      .ng-price { font-size: 0.9rem; }

      .ng-quick-actions {
        opacity: 1;
        transform: translateX(0);
      }

      .ng-quick-btn {
        width: 36px;
        height: 36px;
      }
    }

    @media (max-width: 480px) {
      .ng-products-grid, .ng-skeleton-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 0.5rem;
      }

      .ng-ai-badge { display: none; }

      .ng-badges { top: 0.5rem; left: 0.5rem; }
      .ng-badge { padding: 0.25rem 0.4rem; font-size: 0.65rem; }

      .ng-product-info { padding: 0.5rem; }
      .ng-colors { margin-bottom: 0.4rem; }
      .ng-color-dot { width: 12px; height: 12px; }
      .ng-product-name { font-size: 0.8rem; }
      .ng-price { font-size: 0.85rem; }
      .ng-reason { display: none; }
    }

    /* High contrast mode */
    @media (prefers-contrast: high) {
      .ng-product-card { border: 2px solid var(--ng-primary); }
      .ng-badge { border: 1px solid currentColor; }
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .ng-product-card,
      .ng-image,
      .ng-quick-actions,
      .ng-view-all svg {
        transition: none;
      }

      .ng-shimmer,
      .ng-sparkle {
        animation: none;
      }
    }
  `]
})
export class NextGenRecommendationsComponent implements OnInit, OnChanges, OnDestroy {
  // ========================================================================
  // INPUTS
  // ========================================================================

  @Input() strategy: Strategy = 'trending';
  @Input() productId?: number;
  @Input() limit: number = 8;
  @Input() family?: string;
  @Input() style?: string;

  // User context for personalized strategies
  @Input() userContext?: UserContext;
  @Input() cartProductIds?: number[];
  @Input() viewedProductIds?: number[];

  // Display options
  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() showHeader: boolean = true;
  @Input() showAiBadge: boolean = true;
  @Input() showReason: boolean = true;
  @Input() showViewAll: boolean = false;
  @Input() viewAllLink?: string;
  @Input() showConfidence: boolean = false;
  @Input() showMetadata: boolean = false;
  @Input() showEmptyCta: boolean = true;
  @Input() featured: boolean = false;
  @Input() compact: boolean = false;
  @Input() emptyMessage?: string;

  // ========================================================================
  // OUTPUTS
  // ========================================================================

  @Output() productClick = new EventEmitter<{ product: RecommendedProduct; position: number }>();
  @Output() productHover = new EventEmitter<{ product: RecommendedProduct; position: number }>();
  @Output() wishlistClick = new EventEmitter<RecommendedProduct>();
  @Output() quickViewClick = new EventEmitter<RecommendedProduct>();
  @Output() loaded = new EventEmitter<RecommendationResponse>();
  @Output() error = new EventEmitter<Error>();

  // ========================================================================
  // COMPONENT STATE
  // ========================================================================

  products: RecommendedProduct[] = [];
  isLoading: boolean = true;
  metadata?: RecommendationResponse['metadata'];
  skeletonArray: number[] = [];

  @ViewChildren('productCard') productCards!: QueryList<ElementRef>;

  private destroy$ = new Subject<void>();
  private impressionObserver?: IntersectionObserver;

  constructor(
    private recommendationsService: NextGenRecommendationsService,
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef
  ) {}

  // ========================================================================
  // LIFECYCLE
  // ========================================================================

  ngOnInit(): void {
    this.skeletonArray = Array.from({ length: this.limit }, (_, i) => i);
    this.loadRecommendations();
    this.setupImpressionTracking();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productId'] || changes['strategy'] || changes['family'] ||
        changes['userContext'] || changes['cartProductIds']) {
      this.loadRecommendations();
    }

    if (changes['limit']) {
      this.skeletonArray = Array.from({ length: this.limit }, (_, i) => i);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.impressionObserver) {
      this.impressionObserver.disconnect();
    }
  }

  // ========================================================================
  // DATA LOADING
  // ========================================================================

  private loadRecommendations(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    const request$ = this.getStrategyRequest();

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        this.products = response?.products || [];
        this.metadata = response?.metadata || { totalCandidates: 0, executionTimeMs: 0, cacheHit: false };

        if (!this.title) {
          this.title = response.title;
        }
        if (!this.subtitle && response.subtitle) {
          this.subtitle = response.subtitle;
        }

        this.isLoading = false;
        this.loaded.emit(response);
        this.cdr.markForCheck();

        // Setup impression tracking after render
        setTimeout(() => this.observeProductImpressions(), 100);
      },
      error: (err) => {
        console.error('Recommendation loading error:', err);
        this.products = [];
        this.isLoading = false;
        this.error.emit(err);
        this.cdr.markForCheck();
      }
    });
  }

  private getStrategyRequest() {
    const service = this.recommendationsService;

    switch (this.strategy) {
      case 'similar':
        return service.getSimilarProducts(this.productId!, this.limit, this.family);

      case 'complementary':
        return service.getComplementaryProducts(this.productId!, this.limit, this.family);

      case 'complete_the_look':
        return service.getCompleteTheLook(this.productId!, this.limit);

      case 'premium_alternative':
        return service.getPremiumAlternatives(this.productId!, this.limit);

      case 'affordable_alternative':
        return service.getAffordableAlternatives(this.productId!, this.limit);

      case 'frequently_bought_together':
        return service.getFrequentlyBoughtTogether(this.productId!, this.limit);

      case 'trending':
        return service.getTrending(this.limit, this.family);

      case 'new_arrivals':
        return service.getNewArrivals(this.limit, this.family);

      case 'seasonal':
        return service.getSeasonal(this.limit, this.family);

      case 'editorial':
        return service.getEditorial(this.limit);

      case 'personalized':
        return service.getPersonalized(this.userContext!, this.limit);

      case 'cart_complement':
        return service.getCartRecommendations(this.cartProductIds || [], this.limit);

      case 'style_discovery':
        return service.getStyleDiscovery(this.style || 'casual', this.limit, this.family);

      case 'because_you_viewed':
        return service.getBecauseYouViewed(this.viewedProductIds || [], this.limit);

      case 'customers_also_liked':
        return service.getCustomersAlsoLiked(
          this.viewedProductIds || this.cartProductIds || [],
          this.limit
        );

      default:
        return service.getTrending(this.limit, this.family);
    }
  }

  // ========================================================================
  // ANALYTICS
  // ========================================================================

  private setupImpressionTracking(): void {
    if (typeof IntersectionObserver === 'undefined') return;

    this.impressionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const position = parseInt(
              (entry.target as HTMLElement).dataset['position'] || '0',
              10
            );
            const product = this.products[position];
            if (product) {
              this.recommendationsService.trackImpression(product);
            }
          }
        });
      },
      { threshold: 0.5 }
    );
  }

  private observeProductImpressions(): void {
    if (!this.impressionObserver || !this.productCards) return;

    this.productCards.forEach(card => {
      this.impressionObserver!.observe(card.nativeElement);
    });
  }

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  onProductClick(product: RecommendedProduct, position: number): void {
    this.recommendationsService.trackClick(product);
    this.productClick.emit({ product, position });
  }

  onProductHover(product: RecommendedProduct, position: number): void {
    this.productHover.emit({ product, position });
  }

  onWishlistClick(event: Event, product: RecommendedProduct): void {
    event.preventDefault();
    event.stopPropagation();
    this.wishlistClick.emit(product);
  }

  onQuickView(event: Event, product: RecommendedProduct): void {
    event.preventDefault();
    event.stopPropagation();
    this.quickViewClick.emit(product);
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/images/placeholder.png';
  }

  // ========================================================================
  // UTILITIES
  // ========================================================================

  trackByProductId(index: number, product: RecommendedProduct): number {
    return product.id;
  }

  get shouldShow(): boolean {
    return this.isLoading || (this.products && this.products.length > 0);
  }
}
