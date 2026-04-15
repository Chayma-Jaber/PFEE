import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AiRecommendationsService, RecommendedProduct, RecommendationResponse } from '../../../services/ai-recommendations.service';
import { BehaviorAnalyticsService } from '../../../services/behavior-analytics.service';

@Component({
  selector: 'app-ai-recommendations',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ai-recommendations.component.html',
  styleUrl: './ai-recommendations.component.scss'
})
export class AiRecommendationsComponent implements OnInit, OnChanges {
  @Input() type: 'personalized' | 'similar' | 'complementary' = 'personalized';
  @Input() productId?: number;
  @Input() productName?: string;
  @Input() limit: number = 8;
  @Input() title?: string;
  @Input() showAiBadge: boolean = true;

  products: RecommendedProduct[] = [];
  isLoading = false;
  errorMessage = '';
  source: string = '';

  constructor(
    private aiService: AiRecommendationsService,
    private analytics: BehaviorAnalyticsService
  ) {}

  ngOnInit(): void {
    this.loadRecommendations();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Reload if product context changes
    if (changes['productId'] || changes['productName'] || changes['type']) {
      this.loadRecommendations();
    }
  }

  private loadRecommendations(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.products = [];

    let request$;

    switch (this.type) {
      case 'similar':
        if (this.productId && this.productName) {
          request$ = this.aiService.getSimilarProducts(this.productId, this.productName, this.limit);
        } else {
          this.isLoading = false;
          return;
        }
        break;

      case 'complementary':
        if (this.productId && this.productName) {
          request$ = this.aiService.getComplementaryProducts(this.productId, this.productName, this.limit);
        } else {
          this.isLoading = false;
          return;
        }
        break;

      case 'personalized':
      default:
        request$ = this.aiService.getPersonalizedRecommendations(this.limit);
        break;
    }

    request$.subscribe({
      next: (response: RecommendationResponse) => {
        this.isLoading = false;
        this.products = response.products;
        this.source = response.source;

        if (this.products.length === 0) {
          this.errorMessage = 'Aucune recommandation disponible pour le moment.';
        } else {
          // Track recommendation impressions
          const productIds = this.products.map(p => p.id);
          this.analytics.trackRecommendationImpression(productIds, this.type, this.source);
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error loading recommendations:', err);
        this.errorMessage = 'Impossible de charger les recommandations.';
      }
    });
  }

  getTitle(): string {
    if (this.title) {
      return this.title;
    }

    switch (this.type) {
      case 'similar':
        return 'Dans le m\u00eame style';
      case 'complementary':
        return 'Pour compl\u00e9ter ce look';
      case 'personalized':
      default:
        return 'S\u00e9lectionn\u00e9 pour vous';
    }
  }

  getSubtitle(): string {
    switch (this.type) {
      case 'similar':
        return 'Des pi\u00e8ces avec la m\u00eame esth\u00e9tique que vous aimez';
      case 'complementary':
        return 'Des articles soigneusement choisis pour cr\u00e9er un ensemble harmonieux';
      case 'personalized':
      default:
        return 'Bas\u00e9 sur vos go\u00fbts et votre historique de navigation';
    }
  }

  trackByProductId(index: number, product: RecommendedProduct): number {
    return product.id;
  }

  onProductClick(product: RecommendedProduct, position: number): void {
    this.analytics.trackRecommendationClick(product.id, this.type, position, this.source);
  }
}
