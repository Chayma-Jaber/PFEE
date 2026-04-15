import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';

interface AIStats {
  period_days: number;
  assistant: {
    sessions: number;
    messages: number;
    product_clicks: number;
    add_to_carts: number;
    click_rate: number;
  };
  visual_search: {
    uploads: number;
    result_clicks: number;
    add_to_carts: number;
    click_rate: number;
  };
  recommendations: {
    impressions: number;
    clicks: number;
    add_to_carts: number;
    click_rate: number;
    cart_rate: number;
  };
  total_events: number;
}

interface RecommendationPerformance {
  type: string;
  impressions: number;
  clicks: number;
  add_to_carts: number;
  click_rate: number;
  cart_rate: number;
}

interface TrendingProduct {
  product_id: number;
  score: number;
}

@Component({
  selector: 'app-ai-analytics',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ai-analytics-dashboard">
      <div class="dashboard-header">
        <h1>AI Analytics Dashboard</h1>
        <div class="period-selector">
          <button [class.active]="selectedPeriod === 7" (click)="loadData(7)">7 jours</button>
          <button [class.active]="selectedPeriod === 30" (click)="loadData(30)">30 jours</button>
          <button [class.active]="selectedPeriod === 90" (click)="loadData(90)">90 jours</button>
        </div>
      </div>

      <div class="loading" *ngIf="isLoading">
        <div class="spinner"></div>
        <p>Chargement des analytiques...</p>
      </div>

      <div class="analytics-content" *ngIf="!isLoading && aiStats">
        <!-- AI Module Overview -->
        <div class="section-title">
          <h2>Performance des Modules IA</h2>
          <span class="period-badge">{{ selectedPeriod }} derniers jours</span>
        </div>

        <div class="stats-grid">
          <!-- Assistant Stats -->
          <div class="stat-card assistant">
            <div class="card-header">
              <i class="fas fa-robot"></i>
              <h3>Assistant IA</h3>
            </div>
            <div class="card-body">
              <div class="stat-row">
                <span class="label">Sessions</span>
                <span class="value">{{ aiStats.assistant.sessions | number }}</span>
              </div>
              <div class="stat-row">
                <span class="label">Messages</span>
                <span class="value">{{ aiStats.assistant.messages | number }}</span>
              </div>
              <div class="stat-row">
                <span class="label">Clics produits</span>
                <span class="value">{{ aiStats.assistant.product_clicks | number }}</span>
              </div>
              <div class="stat-row">
                <span class="label">Ajouts panier</span>
                <span class="value highlight">{{ aiStats.assistant.add_to_carts | number }}</span>
              </div>
              <div class="stat-row rate">
                <span class="label">Taux d'engagement</span>
                <span class="value">{{ aiStats.assistant.click_rate | number:'1.1-1' }}%</span>
              </div>
            </div>
          </div>

          <!-- Visual Search Stats -->
          <div class="stat-card visual-search">
            <div class="card-header">
              <i class="fas fa-camera"></i>
              <h3>Recherche Visuelle</h3>
            </div>
            <div class="card-body">
              <div class="stat-row">
                <span class="label">Recherches</span>
                <span class="value">{{ aiStats.visual_search.uploads | number }}</span>
              </div>
              <div class="stat-row">
                <span class="label">Clics résultats</span>
                <span class="value">{{ aiStats.visual_search.result_clicks | number }}</span>
              </div>
              <div class="stat-row">
                <span class="label">Ajouts panier</span>
                <span class="value highlight">{{ aiStats.visual_search.add_to_carts | number }}</span>
              </div>
              <div class="stat-row rate">
                <span class="label">Taux de clic</span>
                <span class="value">{{ aiStats.visual_search.click_rate | number:'1.1-1' }}%</span>
              </div>
            </div>
          </div>

          <!-- Recommendations Stats -->
          <div class="stat-card recommendations">
            <div class="card-header">
              <i class="fas fa-magic"></i>
              <h3>Recommandations</h3>
            </div>
            <div class="card-body">
              <div class="stat-row">
                <span class="label">Impressions</span>
                <span class="value">{{ aiStats.recommendations.impressions | number }}</span>
              </div>
              <div class="stat-row">
                <span class="label">Clics</span>
                <span class="value">{{ aiStats.recommendations.clicks | number }}</span>
              </div>
              <div class="stat-row">
                <span class="label">Ajouts panier</span>
                <span class="value highlight">{{ aiStats.recommendations.add_to_carts | number }}</span>
              </div>
              <div class="stat-row rate">
                <span class="label">Taux de clic</span>
                <span class="value">{{ aiStats.recommendations.click_rate | number:'1.1-1' }}%</span>
              </div>
              <div class="stat-row rate">
                <span class="label">Taux panier</span>
                <span class="value">{{ aiStats.recommendations.cart_rate | number:'1.2-2' }}%</span>
              </div>
            </div>
          </div>

          <!-- Total Events -->
          <div class="stat-card total">
            <div class="card-header">
              <i class="fas fa-chart-line"></i>
              <h3>Total Événements</h3>
            </div>
            <div class="card-body centered">
              <div class="big-number">{{ aiStats.total_events | number }}</div>
              <p>événements trackés</p>
            </div>
          </div>
        </div>

        <!-- Recommendation Performance by Type -->
        <div class="section" *ngIf="recommendationPerformance.length > 0">
          <h2>Performance par Type de Recommandation</h2>
          <div class="performance-table">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Impressions</th>
                  <th>Clics</th>
                  <th>Ajouts Panier</th>
                  <th>CTR</th>
                  <th>Taux Panier</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let perf of recommendationPerformance">
                  <td class="type-name">{{ formatTypeName(perf.type) }}</td>
                  <td>{{ perf.impressions | number }}</td>
                  <td>{{ perf.clicks | number }}</td>
                  <td>{{ perf.add_to_carts | number }}</td>
                  <td [class.good]="perf.click_rate > 5" [class.great]="perf.click_rate > 10">
                    {{ perf.click_rate | number:'1.1-1' }}%
                  </td>
                  <td [class.good]="perf.cart_rate > 1" [class.great]="perf.cart_rate > 3">
                    {{ perf.cart_rate | number:'1.2-2' }}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Trending Products -->
        <div class="section" *ngIf="trendingProducts.length > 0">
          <h2>Produits Tendance (7 derniers jours)</h2>
          <div class="trending-grid">
            <div class="trending-item" *ngFor="let product of trendingProducts; let i = index">
              <span class="rank">#{{ i + 1 }}</span>
              <span class="product-id">Produit {{ product.product_id }}</span>
              <span class="score">Score: {{ product.score | number:'1.0-0' }}</span>
            </div>
          </div>
        </div>

        <!-- No Data State -->
        <div class="no-data" *ngIf="aiStats.total_events === 0">
          <i class="fas fa-info-circle"></i>
          <h3>Pas encore de données</h3>
          <p>Les analytiques apparaîtront ici une fois que les utilisateurs interagiront avec les fonctionnalités IA.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ai-analytics-dashboard {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;

      h1 {
        font-size: 24px;
        font-weight: 700;
        color: #1a1a2e;
        margin: 0;
      }

      .period-selector {
        display: flex;
        gap: 8px;

        button {
          padding: 8px 16px;
          border: 1px solid #e0e0e0;
          background: #fff;
          border-radius: 6px;
          font-size: 13px;
          color: #666;
          cursor: pointer;
          transition: all 0.2s;

          &:hover {
            border-color: #1a1a2e;
            color: #1a1a2e;
          }

          &.active {
            background: #1a1a2e;
            border-color: #1a1a2e;
            color: #fff;
          }
        }
      }
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 60px;

      .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid #f0f0f0;
        border-top-color: #1a1a2e;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      p {
        margin-top: 16px;
        color: #666;
      }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;

      h2 {
        font-size: 18px;
        font-weight: 600;
        color: #1a1a2e;
        margin: 0;
      }

      .period-badge {
        font-size: 12px;
        padding: 4px 10px;
        background: #f0f0f0;
        border-radius: 12px;
        color: #666;
      }
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 40px;

      @media (max-width: 1200px) {
        grid-template-columns: repeat(2, 1fr);
      }

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
      }
    }

    .stat-card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      overflow: hidden;

      .card-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 16px 20px;
        border-bottom: 1px solid #f0f0f0;

        i {
          font-size: 18px;
          color: #666;
        }

        h3 {
          font-size: 14px;
          font-weight: 600;
          color: #333;
          margin: 0;
        }
      }

      &.assistant .card-header i { color: #6366f1; }
      &.visual-search .card-header i { color: #ec4899; }
      &.recommendations .card-header i { color: #8b5cf6; }
      &.total .card-header i { color: #10b981; }

      .card-body {
        padding: 16px 20px;

        &.centered {
          text-align: center;
          padding: 30px 20px;

          .big-number {
            font-size: 36px;
            font-weight: 700;
            color: #1a1a2e;
          }

          p {
            color: #666;
            margin: 8px 0 0;
          }
        }
      }

      .stat-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid #f8f8f8;

        &:last-child {
          border-bottom: none;
        }

        &.rate {
          background: #f8f8f8;
          margin: 8px -20px -16px;
          padding: 12px 20px;
          border-radius: 0 0 12px 12px;
        }

        .label {
          font-size: 13px;
          color: #666;
        }

        .value {
          font-size: 14px;
          font-weight: 600;
          color: #333;

          &.highlight {
            color: #10b981;
          }
        }
      }
    }

    .section {
      margin-bottom: 40px;

      h2 {
        font-size: 18px;
        font-weight: 600;
        color: #1a1a2e;
        margin: 0 0 20px;
      }
    }

    .performance-table {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      overflow: hidden;

      table {
        width: 100%;
        border-collapse: collapse;

        th, td {
          padding: 14px 16px;
          text-align: left;
          border-bottom: 1px solid #f0f0f0;
        }

        th {
          background: #f8f8f8;
          font-size: 12px;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
        }

        td {
          font-size: 14px;
          color: #333;

          &.type-name {
            font-weight: 500;
          }

          &.good { color: #f59e0b; }
          &.great { color: #10b981; font-weight: 600; }
        }
      }
    }

    .trending-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;

      @media (max-width: 1000px) {
        grid-template-columns: repeat(3, 1fr);
      }

      @media (max-width: 600px) {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .trending-item {
      background: #fff;
      border-radius: 8px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);

      .rank {
        font-size: 18px;
        font-weight: 700;
        color: #1a1a2e;
      }

      .product-id {
        font-size: 13px;
        color: #666;
      }

      .score {
        font-size: 12px;
        color: #10b981;
        font-weight: 500;
      }
    }

    .no-data {
      text-align: center;
      padding: 60px 20px;
      background: #f8f8f8;
      border-radius: 12px;

      i {
        font-size: 48px;
        color: #ccc;
        margin-bottom: 20px;
      }

      h3 {
        font-size: 18px;
        color: #333;
        margin: 0 0 10px;
      }

      p {
        font-size: 14px;
        color: #666;
        margin: 0;
      }
    }
  `]
})
export class AIAnalyticsComponent implements OnInit {
  aiStats: AIStats | null = null;
  recommendationPerformance: RecommendationPerformance[] = [];
  trendingProducts: TrendingProduct[] = [];
  selectedPeriod = 30;
  isLoading = true;

  private apiUrl = environementDev.api;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadData(this.selectedPeriod);
  }

  loadData(days: number): void {
    this.selectedPeriod = days;
    this.isLoading = true;

    this.http.get<any>(`${this.apiUrl}/api/admin/analytics/ai-dashboard?days=${days}`).subscribe({
      next: (data) => {
        this.aiStats = data.ai_stats;
        this.recommendationPerformance = data.recommendation_performance || [];
        this.trendingProducts = data.trending_products || [];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading AI analytics:', err);
        // Set default empty stats
        this.aiStats = {
          period_days: days,
          assistant: { sessions: 0, messages: 0, product_clicks: 0, add_to_carts: 0, click_rate: 0 },
          visual_search: { uploads: 0, result_clicks: 0, add_to_carts: 0, click_rate: 0 },
          recommendations: { impressions: 0, clicks: 0, add_to_carts: 0, click_rate: 0, cart_rate: 0 },
          total_events: 0
        };
        this.isLoading = false;
      }
    });
  }

  formatTypeName(type: string): string {
    const names: Record<string, string> = {
      'similar': 'Articles Similaires',
      'complementary': 'Complémentaires',
      'personalized': 'Personnalisés',
      'trending': 'Tendances',
      'recently_viewed': 'Vus Récemment',
      'because_you_viewed': 'Car vous avez vu',
      'cart_based': 'Basé sur Panier',
      'cart_complement': 'Compléments Panier',
      'frequently_bought': 'Souvent Achetés',
      'frequently_bought_together': 'Achetés Ensemble',
      'complete_the_look': 'Look Complet',
      'premium_alternative': 'Alternative Premium',
      'affordable_alternative': 'Alternative Abordable',
      'new_arrivals': 'Nouveautés',
      'seasonal': 'Saison',
      'editorial': 'Sélection Éditoriale',
      'style_discovery': 'Découverte Style',
      'customers_also_liked': 'Clients ont aimé',
      'post_purchase': 'Post-Achat'
    };
    return names[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  getStrategyIcon(type: string): string {
    const icons: Record<string, string> = {
      'similar': 'fa-copy',
      'complementary': 'fa-puzzle-piece',
      'personalized': 'fa-user-circle',
      'trending': 'fa-fire',
      'complete_the_look': 'fa-tshirt',
      'new_arrivals': 'fa-star',
      'seasonal': 'fa-snowflake',
      'editorial': 'fa-gem',
      'cart_complement': 'fa-shopping-cart',
      'post_purchase': 'fa-check-circle'
    };
    return icons[type] || 'fa-magic';
  }

  getPerformanceClass(rate: number, threshold1: number = 5, threshold2: number = 10): string {
    if (rate >= threshold2) return 'great';
    if (rate >= threshold1) return 'good';
    return '';
  }
}
