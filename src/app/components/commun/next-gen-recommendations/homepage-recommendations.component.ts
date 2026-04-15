/**
 * BARSHA HOMEPAGE RECOMMENDATIONS ORCHESTRATOR
 * =============================================
 * Displays all recommendation sections for the homepage.
 *
 * Sections:
 * 1. Sélectionné pour vous (personalized) - Authenticated users only
 * 2. Tendances Barsha (trending)
 * 3. Nouveautés (new_arrivals)
 * 4. Sélection de saison (seasonal)
 * 5. Sélection éditoriale (editorial)
 * 6. Car vous avez consulté (because_you_viewed) - If viewed products
 * 7. Style Discovery - Optional
 */

import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NextGenRecommendationsComponent } from './next-gen-recommendations.component';
import { UserContext } from '../../../services/next-gen-recommendations.service';

@Component({
  selector: 'app-homepage-recommendations',
  standalone: true,
  imports: [CommonModule, NextGenRecommendationsComponent],
  template: `
    <div class="homepage-recommendations">
      <!-- PERSONALIZED (Authenticated Users Only) -->
      <section class="hp-section hp-section-personalized" *ngIf="isAuthenticated && userContext">
        <app-next-gen-recommendations
          strategy="personalized"
          [userContext]="userContext"
          [limit]="8"
          [showAiBadge]="true"
          [showReason]="true"
          [featured]="true"
          title="Sélectionné pour vous"
          subtitle="Basé sur vos préférences"
        ></app-next-gen-recommendations>
      </section>

      <!-- BECAUSE YOU VIEWED (If has viewed products) -->
      <section class="hp-section" *ngIf="viewedProductIds && viewedProductIds.length > 0">
        <app-next-gen-recommendations
          strategy="because_you_viewed"
          [viewedProductIds]="viewedProductIds"
          [limit]="8"
          [showAiBadge]="true"
          [showReason]="true"
          title="Car vous avez consulté"
        ></app-next-gen-recommendations>
      </section>

      <!-- TRENDING -->
      <section class="hp-section">
        <app-next-gen-recommendations
          strategy="trending"
          [family]="selectedFamily"
          [limit]="8"
          [showAiBadge]="false"
          [showReason]="false"
          [showViewAll]="true"
          viewAllLink="/shop"
          title="Tendances Barsha"
          subtitle="Les pièces les plus convoitées"
        ></app-next-gen-recommendations>
      </section>

      <!-- NEW ARRIVALS -->
      <section class="hp-section">
        <app-next-gen-recommendations
          strategy="new_arrivals"
          [family]="selectedFamily"
          [limit]="8"
          [showAiBadge]="false"
          [showReason]="true"
          [showViewAll]="true"
          viewAllLink="/tn/1-nouveautes"
          title="Nouveautés"
          subtitle="Fraîchement arrivées"
        ></app-next-gen-recommendations>
      </section>

      <!-- EDITORIAL SELECTION -->
      <section class="hp-section hp-section-editorial">
        <app-next-gen-recommendations
          strategy="editorial"
          [limit]="6"
          [showAiBadge]="true"
          [showReason]="true"
          [featured]="true"
          title="Sélection éditoriale"
          subtitle="Choisis par nos stylistes"
        ></app-next-gen-recommendations>
      </section>

      <!-- SEASONAL -->
      <section class="hp-section">
        <app-next-gen-recommendations
          strategy="seasonal"
          [family]="selectedFamily"
          [limit]="8"
          [showAiBadge]="true"
          [showReason]="true"
        ></app-next-gen-recommendations>
      </section>

      <!-- STYLE DISCOVERY (Optional) -->
      <section class="hp-section hp-section-styles" *ngIf="showStyleDiscovery">
        <div class="style-discovery-header">
          <h2>Découvrez votre style</h2>
          <p>Explorez différentes esthétiques</p>
        </div>
        <div class="style-grid">
          <app-next-gen-recommendations
            *ngFor="let style of styleOptions"
            strategy="style_discovery"
            [style]="style.id"
            [family]="selectedFamily"
            [limit]="4"
            [showAiBadge]="false"
            [showReason]="false"
            [showHeader]="true"
            [compact]="true"
            [title]="style.title"
          ></app-next-gen-recommendations>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .homepage-recommendations {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .hp-section {
      /* Individual sections */
    }

    .hp-section-personalized,
    .hp-section-editorial {
      margin: 1rem 0;
    }

    .hp-section-styles {
      background: linear-gradient(180deg, #fafafa 0%, #fff 100%);
      padding: 3rem 0;
      margin-top: 2rem;
    }

    .style-discovery-header {
      text-align: center;
      max-width: 600px;
      margin: 0 auto 2rem;
      padding: 0 1.5rem;
    }

    .style-discovery-header h2 {
      font-family: 'std95', sans-serif;
      font-size: 1.75rem;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 0.5rem;
    }

    .style-discovery-header p {
      font-family: 'std55', sans-serif;
      font-size: 1rem;
      color: #666;
      margin: 0;
    }

    .style-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 2rem;
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }

    @media (max-width: 900px) {
      .style-grid {
        grid-template-columns: 1fr;
        gap: 1.5rem;
      }
    }

    @media (max-width: 600px) {
      .hp-section-styles { padding: 2rem 0; }
      .style-discovery-header h2 { font-size: 1.5rem; }
    }
  `]
})
export class HomepageRecommendationsComponent implements OnInit {
  @Input() isAuthenticated: boolean = false;
  @Input() userContext?: UserContext;
  @Input() selectedFamily?: string;
  @Input() viewedProductIds?: number[];
  @Input() showStyleDiscovery: boolean = false;

  styleOptions = [
    { id: 'casual', title: 'Style Casual' },
    { id: 'chic', title: 'Style Chic' },
    { id: 'sporty', title: 'Style Sportif' },
    { id: 'elegant', title: 'Style Élégant' }
  ];

  ngOnInit(): void {
    // Load viewed products from localStorage if not provided
    if (!this.viewedProductIds) {
      const stored = localStorage.getItem('recentlyViewed');
      if (stored) {
        try {
          this.viewedProductIds = JSON.parse(stored);
        } catch (e) {
          this.viewedProductIds = [];
        }
      }
    }

    // Check authentication
    if (!this.userContext) {
      const jwt = localStorage.getItem('jwt');
      this.isAuthenticated = !!jwt;

      if (this.isAuthenticated) {
        // Build user context from localStorage
        this.userContext = {
          userId: localStorage.getItem('userId') || undefined,
          sessionId: sessionStorage.getItem('barsha_session_id') || undefined,
          viewedProductIds: this.viewedProductIds || [],
          wishlistProductIds: this.getWishlistIds(),
          cartProductIds: this.getCartIds(),
          purchasedProductIds: []
        };
      }
    }
  }

  private getWishlistIds(): number[] {
    try {
      const wishlist = localStorage.getItem('wishlist');
      if (wishlist) {
        const items = JSON.parse(wishlist);
        return items.map((item: any) => item.id || item.productId).filter(Boolean);
      }
    } catch (e) {}
    return [];
  }

  private getCartIds(): number[] {
    try {
      const cart = localStorage.getItem('cart');
      if (cart) {
        const items = JSON.parse(cart);
        return items.map((item: any) => item.productId || item.id).filter(Boolean);
      }
    } catch (e) {}
    return [];
  }
}
