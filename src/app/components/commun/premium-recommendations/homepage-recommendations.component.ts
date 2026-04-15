/**
 * Homepage Recommendations Component
 * ===================================
 * Displays multiple recommendation sections on the homepage.
 */

import { Component, OnInit, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PremiumRecommendationsComponent } from './premium-recommendations.component';
import { PremiumRecommendationsService, RecommendationSet } from '../../../services/premium-recommendations.service';

interface RecommendationSection {
  id: string;
  strategy: 'trending' | 'new_arrivals' | 'seasonal' | 'editorial' | 'personalized';
  title: string;
  subtitle: string;
  limit: number;
  showBadge: boolean;
  showViewAll: boolean;
  viewAllLink?: string;
}

@Component({
  selector: 'app-homepage-recommendations',
  standalone: true,
  imports: [CommonModule, PremiumRecommendationsComponent],
  template: `
    <div class="homepage-recommendations">
      <!-- Personalized Section (logged in users) -->
      <app-premium-recommendations
        *ngIf="isLoggedIn"
        strategy="personalized"
        [wishlist]="userWishlist"
        [orders]="userOrders"
        [viewedProducts]="viewedProducts"
        [limit]="8"
        [showBadge]="true"
        [showReason]="true"
        title="Selectionne pour vous"
        subtitle="Base sur vos preferences"
      ></app-premium-recommendations>

      <!-- Editorial Selection -->
      <app-premium-recommendations
        strategy="editorial"
        [limit]="6"
        [showBadge]="true"
        [showReason]="false"
        title="Selection editoriale"
        subtitle="Choisis par nos stylistes"
      ></app-premium-recommendations>

      <!-- Trending -->
      <app-premium-recommendations
        strategy="trending"
        [limit]="8"
        [family]="selectedFamily"
        [showBadge]="false"
        [showViewAll]="true"
        viewAllLink="/shop"
        title="Tendances Barsha"
        subtitle="Les pieces les plus convoitees"
      ></app-premium-recommendations>

      <!-- New Arrivals -->
      <app-premium-recommendations
        strategy="new_arrivals"
        [limit]="8"
        [family]="selectedFamily"
        [showBadge]="false"
        [showViewAll]="true"
        viewAllLink="/nouveautes"
        title="Nouveautes"
        subtitle="Fraichement arrivees"
      ></app-premium-recommendations>

      <!-- Seasonal Picks -->
      <app-premium-recommendations
        strategy="seasonal"
        [limit]="8"
        [family]="selectedFamily"
        [showBadge]="true"
        [showReason]="true"
      ></app-premium-recommendations>
    </div>
  `,
  styles: [`
    .homepage-recommendations {
      display: flex;
      flex-direction: column;
      gap: 3rem;
      padding: 2rem 0;
    }

    @media (max-width: 768px) {
      .homepage-recommendations {
        gap: 2rem;
        padding: 1rem 0;
      }
    }
  `]
})
export class HomepageRecommendationsComponent implements OnInit {
  @Input() selectedFamily?: string;

  isLoggedIn = false;
  userWishlist: any[] = [];
  userOrders: any[] = [];
  viewedProducts: number[] = [];

  ngOnInit(): void {
    // Check if user is logged in
    const token = localStorage.getItem('jwt');
    this.isLoggedIn = !!token;

    // Load user data if logged in
    if (this.isLoggedIn) {
      this.loadUserData();
    }

    // Load viewed products from session
    this.loadViewedProducts();
  }

  private loadUserData(): void {
    try {
      const wishlistStr = localStorage.getItem('wishlist');
      if (wishlistStr) {
        this.userWishlist = JSON.parse(wishlistStr);
      }

      const ordersStr = localStorage.getItem('orders');
      if (ordersStr) {
        this.userOrders = JSON.parse(ordersStr);
      }
    } catch (e) {
      console.error('Error loading user data:', e);
    }
  }

  private loadViewedProducts(): void {
    try {
      const viewedStr = sessionStorage.getItem('viewed_products');
      if (viewedStr) {
        this.viewedProducts = JSON.parse(viewedStr);
      }
    } catch (e) {
      console.error('Error loading viewed products:', e);
    }
  }
}
