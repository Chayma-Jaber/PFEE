/**
 * Product Detail Page Recommendations Component
 * ==============================================
 * Displays all relevant recommendation sections on product detail pages.
 */

import { Component, Input, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PremiumRecommendationsComponent } from './premium-recommendations.component';

@Component({
  selector: 'app-product-recommendations',
  standalone: true,
  imports: [CommonModule, PremiumRecommendationsComponent],
  template: `
    <div class="product-recommendations" *ngIf="productId">
      <!-- Complete The Look - Featured Section -->
      <section class="featured-section complete-look-section">
        <app-premium-recommendations
          strategy="complete_the_look"
          [productId]="productId"
          [limit]="4"
          [showBadge]="true"
          [showReason]="true"
          title="Le look complet"
          subtitle="Notre selection de styliste"
        ></app-premium-recommendations>
      </section>

      <!-- Similar Products -->
      <app-premium-recommendations
        strategy="similar"
        [productId]="productId"
        [limit]="8"
        [showBadge]="true"
        [showReason]="true"
        title="Dans le meme style"
        [subtitle]="'Inspire de ' + (productName || 'cet article')"
      ></app-premium-recommendations>

      <!-- Complementary Products -->
      <app-premium-recommendations
        strategy="complementary"
        [productId]="productId"
        [limit]="6"
        [showBadge]="true"
        [showReason]="true"
        title="Pour completer ce look"
        subtitle="Nos suggestions pour vous"
      ></app-premium-recommendations>

      <!-- Price Alternatives (show one or the other based on price point) -->
      <div class="alternatives-section">
        <app-premium-recommendations
          *ngIf="showPremiumAlternatives"
          strategy="premium_alternative"
          [productId]="productId"
          [limit]="4"
          [showBadge]="false"
          [showReason]="true"
          title="Version premium"
          subtitle="Pour un look plus raffine"
        ></app-premium-recommendations>

        <app-premium-recommendations
          *ngIf="showAffordableAlternatives"
          strategy="affordable_alternative"
          [productId]="productId"
          [limit]="4"
          [showBadge]="false"
          [showReason]="true"
          title="Alternatives accessibles"
          subtitle="Meme style, petit prix"
        ></app-premium-recommendations>
      </div>
    </div>
  `,
  styles: [`
    .product-recommendations {
      display: flex;
      flex-direction: column;
      gap: 3rem;
      padding: 2rem 0;
      margin-top: 2rem;
      border-top: 1px solid #eee;
    }

    .featured-section {
      background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%);
      padding: 2rem 0;
      margin: 0 -1rem;
      border-radius: 12px;
    }

    .complete-look-section {
      margin-bottom: 1rem;
    }

    .alternatives-section {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    @media (max-width: 768px) {
      .product-recommendations {
        gap: 2rem;
        padding: 1.5rem 0;
      }

      .featured-section {
        margin: 0 -0.75rem;
        padding: 1.5rem 0;
      }
    }
  `]
})
export class ProductRecommendationsComponent implements OnInit, OnChanges {
  @Input() productId!: number;
  @Input() productName?: string;
  @Input() productPrice?: number;
  @Input() productCategory?: string;

  showPremiumAlternatives = true;
  showAffordableAlternatives = false;

  ngOnInit(): void {
    this.updateAlternativesDisplay();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productPrice']) {
      this.updateAlternativesDisplay();
    }
  }

  private updateAlternativesDisplay(): void {
    // Show affordable alternatives for higher-priced items
    // Show premium alternatives for lower-priced items
    if (this.productPrice) {
      if (this.productPrice > 100) {
        this.showAffordableAlternatives = true;
        this.showPremiumAlternatives = false;
      } else if (this.productPrice < 50) {
        this.showPremiumAlternatives = true;
        this.showAffordableAlternatives = false;
      } else {
        // Mid-range: show both
        this.showPremiumAlternatives = true;
        this.showAffordableAlternatives = true;
      }
    }
  }
}
