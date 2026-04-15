/**
 * BARSHA PDP RECOMMENDATIONS ORCHESTRATOR
 * =======================================
 * Displays all recommendation sections for a product detail page.
 *
 * Sections:
 * 1. Le look complet (complete_the_look) - Featured
 * 2. Souvent achetés ensemble (frequently_bought_together)
 * 3. Dans le même style (similar)
 * 4. Pour compléter ce look (complementary)
 * 5. Version premium / Alternatives accessibles (based on price)
 */

import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NextGenRecommendationsComponent } from './next-gen-recommendations.component';

@Component({
  selector: 'app-pdp-recommendations',
  standalone: true,
  imports: [CommonModule, NextGenRecommendationsComponent],
  template: `
    <div class="pdp-recommendations" *ngIf="productId">
      <!-- SECTION 1: Complete the Look (Featured) -->
      <section class="pdp-section pdp-section-featured">
        <app-next-gen-recommendations
          strategy="complete_the_look"
          [productId]="productId"
          [limit]="4"
          [showAiBadge]="true"
          [showReason]="true"
          [featured]="true"
          title="Le look complet"
          subtitle="Notre sélection de styliste"
        ></app-next-gen-recommendations>
      </section>

      <!-- SECTION 2: Frequently Bought Together -->
      <section class="pdp-section">
        <app-next-gen-recommendations
          strategy="frequently_bought_together"
          [productId]="productId"
          [limit]="4"
          [showAiBadge]="false"
          [showReason]="true"
          title="Souvent achetés ensemble"
          subtitle="Les clients ont aussi acheté"
        ></app-next-gen-recommendations>
      </section>

      <!-- SECTION 3: Similar Products -->
      <section class="pdp-section">
        <app-next-gen-recommendations
          strategy="similar"
          [productId]="productId"
          [family]="family"
          [limit]="8"
          [showAiBadge]="true"
          [showReason]="true"
          [showViewAll]="true"
          viewAllLink="/shop"
          title="Dans le même style"
          [subtitle]="'Inspiré de ' + (productName || 'cet article')"
        ></app-next-gen-recommendations>
      </section>

      <!-- SECTION 4: Complementary Products -->
      <section class="pdp-section">
        <app-next-gen-recommendations
          strategy="complementary"
          [productId]="productId"
          [family]="family"
          [limit]="6"
          [showAiBadge]="true"
          [showReason]="true"
          title="Pour compléter ce look"
          subtitle="Nos suggestions pour vous"
        ></app-next-gen-recommendations>
      </section>

      <!-- SECTION 5: Price Alternatives -->
      <section class="pdp-section pdp-section-alternatives">
        <!-- Premium Alternative (for lower-priced items) -->
        <app-next-gen-recommendations
          *ngIf="showPremiumAlternative"
          strategy="premium_alternative"
          [productId]="productId"
          [limit]="4"
          [showAiBadge]="false"
          [showReason]="true"
          [compact]="true"
          title="Version premium"
          subtitle="Pour un look plus raffiné"
        ></app-next-gen-recommendations>

        <!-- Affordable Alternative (for higher-priced items) -->
        <app-next-gen-recommendations
          *ngIf="showAffordableAlternative"
          strategy="affordable_alternative"
          [productId]="productId"
          [limit]="4"
          [showAiBadge]="false"
          [showReason]="true"
          [compact]="true"
          title="Alternatives accessibles"
          subtitle="Même style, petit prix"
        ></app-next-gen-recommendations>
      </section>
    </div>
  `,
  styles: [`
    .pdp-recommendations {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 2rem 0;
      margin-top: 2rem;
      border-top: 1px solid #eee;
    }

    .pdp-section {
      /* Individual sections */
    }

    .pdp-section-featured {
      margin-bottom: 1rem;
    }

    .pdp-section-alternatives {
      display: flex;
      flex-direction: column;
      gap: 2rem;
      background: #fafafa;
      margin: 0 -1rem;
      padding: 2rem 1rem;
      border-radius: 12px;
    }

    @media (max-width: 768px) {
      .pdp-recommendations {
        gap: 0.5rem;
        padding: 1.5rem 0;
      }

      .pdp-section-alternatives {
        margin: 0 -0.75rem;
        padding: 1.5rem 0.75rem;
      }
    }
  `]
})
export class PDPRecommendationsComponent implements OnInit, OnChanges {
  @Input() productId!: number;
  @Input() productName?: string;
  @Input() productPrice?: number;
  @Input() family?: string;

  showPremiumAlternative = true;
  showAffordableAlternative = false;

  ngOnInit(): void {
    this.updateAlternativesDisplay();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productPrice']) {
      this.updateAlternativesDisplay();
    }
  }

  private updateAlternativesDisplay(): void {
    // Show affordable alternatives for higher-priced items (> 100 TND)
    // Show premium alternatives for lower-priced items (< 60 TND)
    // Show both for mid-range items
    if (this.productPrice) {
      if (this.productPrice > 100) {
        this.showAffordableAlternative = true;
        this.showPremiumAlternative = false;
      } else if (this.productPrice < 60) {
        this.showPremiumAlternative = true;
        this.showAffordableAlternative = false;
      } else {
        // Mid-range: show both
        this.showPremiumAlternative = true;
        this.showAffordableAlternative = true;
      }
    }
  }
}
