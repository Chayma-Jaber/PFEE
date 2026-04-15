/**
 * @deprecated This service (v2) is deprecated.
 * Please use NextGenRecommendationsService (v3) instead for all recommendation features.
 *
 * Migration: Import from '../services/next-gen-recommendations.service'
 *
 * ========================================
 * Barsha Premium Recommendations Service
 * ========================================
 * Advanced recommendation service for luxury e-commerce experience.
 *
 * Features:
 * - Multiple recommendation strategies
 * - Fashion-aware suggestions
 * - Caching and performance optimization
 * - Explainable recommendations
 * - Analytics integration
 *
 * NOTE: This service will be removed in a future version.
 * All new features should use NextGenRecommendationsService.
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, BehaviorSubject, forkJoin } from 'rxjs';
import { map, catchError, tap, shareReplay } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RecommendedProduct {
  id: number;
  reference: string;
  name: string;
  price: string;
  originalPrice?: string;
  discount?: number;
  image: string;
  secondImage?: string;
  url: string;
  colors: string[];
  category?: string;
  family?: string;
  score: number;
  confidence: number;
  reason: string;
  reasonKey: string;
  position: number;
}

export interface RecommendationSet {
  success: boolean;
  strategy: string;
  title: string;
  subtitle: string;
  explanation: string;
  products: RecommendedProduct[];
  totalCandidates: number;
  processingTimeMs: number;
  metadata?: Record<string, any>;
}

export interface MultiRecommendationResponse {
  success: boolean;
  sets: Record<string, RecommendationSet>;
  totalProcessingTimeMs: number;
}

export type RecommendationStrategy =
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
  | 'cart_recommendations'
  | 'style';

export interface RecommendationConfig {
  strategy: RecommendationStrategy;
  productId?: number;
  limit?: number;
  family?: string;
  style?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

@Injectable({
  providedIn: 'root'
})
export class PremiumRecommendationsService {
  private apiUrl = environementDev.api || 'http://localhost:8000';
  private cache = new Map<string, { data: RecommendationSet; timestamp: number }>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwt') || '';
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    });
  }

  private getCacheKey(strategy: string, params: Record<string, any> = {}): string {
    return `${strategy}_${JSON.stringify(params)}`;
  }

  private getCached(key: string): RecommendationSet | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: RecommendationSet): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCT DETAIL PAGE RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get similar products - "Dans le meme style"
   */
  getSimilarProducts(productId: number, limit: number = 8): Observable<RecommendationSet> {
    const cacheKey = this.getCacheKey('similar', { productId, limit });
    const cached = this.getCached(cacheKey);
    if (cached) return of(cached);

    return this.http.get<RecommendationSet>(
      `${this.apiUrl}/api/recommendations/v2/similar/${productId}?limit=${limit}`,
      { headers: this.getHeaders() }
    ).pipe(
      tap(data => this.setCache(cacheKey, data)),
      catchError(err => {
        console.error('Error fetching similar products:', err);
        return of(this.emptyResponse('similar', 'Dans le meme style'));
      })
    );
  }

  /**
   * Get complementary products - "Pour completer ce look"
   */
  getComplementaryProducts(productId: number, limit: number = 6): Observable<RecommendationSet> {
    const cacheKey = this.getCacheKey('complementary', { productId, limit });
    const cached = this.getCached(cacheKey);
    if (cached) return of(cached);

    return this.http.get<RecommendationSet>(
      `${this.apiUrl}/api/recommendations/v2/complementary/${productId}?limit=${limit}`,
      { headers: this.getHeaders() }
    ).pipe(
      tap(data => this.setCache(cacheKey, data)),
      catchError(err => {
        console.error('Error fetching complementary products:', err);
        return of(this.emptyResponse('complementary', 'Pour completer ce look'));
      })
    );
  }

  /**
   * Get complete the look - "Le look complet"
   */
  getCompleteTheLook(productId: number, limit: number = 4): Observable<RecommendationSet> {
    const cacheKey = this.getCacheKey('complete_the_look', { productId, limit });
    const cached = this.getCached(cacheKey);
    if (cached) return of(cached);

    return this.http.get<RecommendationSet>(
      `${this.apiUrl}/api/recommendations/v2/complete-look/${productId}?limit=${limit}`,
      { headers: this.getHeaders() }
    ).pipe(
      tap(data => this.setCache(cacheKey, data)),
      catchError(err => {
        console.error('Error fetching complete look:', err);
        return of(this.emptyResponse('complete_the_look', 'Le look complet'));
      })
    );
  }

  /**
   * Get premium alternatives - "Version premium"
   */
  getPremiumAlternatives(productId: number, limit: number = 4): Observable<RecommendationSet> {
    return this.http.get<RecommendationSet>(
      `${this.apiUrl}/api/recommendations/v2/premium-alternatives/${productId}?limit=${limit}`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(err => {
        console.error('Error fetching premium alternatives:', err);
        return of(this.emptyResponse('premium_alternative', 'Version premium'));
      })
    );
  }

  /**
   * Get affordable alternatives - "Alternatives accessibles"
   */
  getAffordableAlternatives(productId: number, limit: number = 4): Observable<RecommendationSet> {
    return this.http.get<RecommendationSet>(
      `${this.apiUrl}/api/recommendations/v2/affordable-alternatives/${productId}?limit=${limit}`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(err => {
        console.error('Error fetching affordable alternatives:', err);
        return of(this.emptyResponse('affordable_alternative', 'Alternatives accessibles'));
      })
    );
  }

  /**
   * Get all product detail page recommendations at once
   */
  getProductPageRecommendations(productId: number): Observable<{
    similar: RecommendationSet;
    complementary: RecommendationSet;
    completeLook: RecommendationSet;
  }> {
    return forkJoin({
      similar: this.getSimilarProducts(productId, 8),
      complementary: this.getComplementaryProducts(productId, 6),
      completeLook: this.getCompleteTheLook(productId, 4)
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HOMEPAGE RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get trending products - "Tendances Barsha"
   */
  getTrendingProducts(limit: number = 8, family?: string): Observable<RecommendationSet> {
    const cacheKey = this.getCacheKey('trending', { limit, family });
    const cached = this.getCached(cacheKey);
    if (cached) return of(cached);

    let url = `${this.apiUrl}/api/recommendations/v2/trending?limit=${limit}`;
    if (family) url += `&family=${family}`;

    return this.http.get<RecommendationSet>(url, { headers: this.getHeaders() }).pipe(
      tap(data => this.setCache(cacheKey, data)),
      catchError(err => {
        console.error('Error fetching trending products:', err);
        return of(this.emptyResponse('trending', 'Tendances Barsha'));
      })
    );
  }

  /**
   * Get new arrivals - "Nouveautes"
   */
  getNewArrivals(limit: number = 8, family?: string): Observable<RecommendationSet> {
    const cacheKey = this.getCacheKey('new_arrivals', { limit, family });
    const cached = this.getCached(cacheKey);
    if (cached) return of(cached);

    let url = `${this.apiUrl}/api/recommendations/v2/new-arrivals?limit=${limit}`;
    if (family) url += `&family=${family}`;

    return this.http.get<RecommendationSet>(url, { headers: this.getHeaders() }).pipe(
      tap(data => this.setCache(cacheKey, data)),
      catchError(err => {
        console.error('Error fetching new arrivals:', err);
        return of(this.emptyResponse('new_arrivals', 'Nouveautes'));
      })
    );
  }

  /**
   * Get seasonal picks - "Selection de saison"
   */
  getSeasonalPicks(limit: number = 8, family?: string): Observable<RecommendationSet> {
    const cacheKey = this.getCacheKey('seasonal', { limit, family });
    const cached = this.getCached(cacheKey);
    if (cached) return of(cached);

    let url = `${this.apiUrl}/api/recommendations/v2/seasonal?limit=${limit}`;
    if (family) url += `&family=${family}`;

    return this.http.get<RecommendationSet>(url, { headers: this.getHeaders() }).pipe(
      tap(data => this.setCache(cacheKey, data)),
      catchError(err => {
        console.error('Error fetching seasonal picks:', err);
        return of(this.emptyResponse('seasonal', 'Selection de saison'));
      })
    );
  }

  /**
   * Get editorial selection - "Selection editoriale"
   */
  getEditorialSelection(limit: number = 6): Observable<RecommendationSet> {
    const cacheKey = this.getCacheKey('editorial', { limit });
    const cached = this.getCached(cacheKey);
    if (cached) return of(cached);

    return this.http.get<RecommendationSet>(
      `${this.apiUrl}/api/recommendations/v2/editorial?limit=${limit}`,
      { headers: this.getHeaders() }
    ).pipe(
      tap(data => this.setCache(cacheKey, data)),
      catchError(err => {
        console.error('Error fetching editorial selection:', err);
        return of(this.emptyResponse('editorial', 'Selection editoriale'));
      })
    );
  }

  /**
   * Get personalized recommendations - "Selectionne pour vous"
   */
  getPersonalizedRecommendations(
    wishlist: any[] = [],
    orders: any[] = [],
    viewedProducts: number[] = [],
    limit: number = 8
  ): Observable<RecommendationSet> {
    return this.http.post<RecommendationSet>(
      `${this.apiUrl}/api/recommendations/v2/personalized`,
      { wishlist, orders, viewedProducts, limit },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(err => {
        console.error('Error fetching personalized recommendations:', err);
        // Fallback to trending
        return this.getTrendingProducts(limit);
      })
    );
  }

  /**
   * Get all homepage recommendations at once
   */
  getHomepageRecommendations(family?: string): Observable<{
    trending: RecommendationSet;
    newArrivals: RecommendationSet;
    seasonal: RecommendationSet;
    editorial: RecommendationSet;
  }> {
    return forkJoin({
      trending: this.getTrendingProducts(8, family),
      newArrivals: this.getNewArrivals(8, family),
      seasonal: this.getSeasonalPicks(8, family),
      editorial: this.getEditorialSelection(6)
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CART RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get cart recommendations - "Pour completer votre commande"
   */
  getCartRecommendations(cartProductIds: number[], limit: number = 4): Observable<RecommendationSet> {
    if (!cartProductIds.length) {
      return of(this.emptyResponse('cart_recommendations', 'Pour completer votre commande'));
    }

    return this.http.post<RecommendationSet>(
      `${this.apiUrl}/api/recommendations/v2/cart-recommendations`,
      { cartProductIds, limit },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(err => {
        console.error('Error fetching cart recommendations:', err);
        return of(this.emptyResponse('cart_recommendations', 'Pour completer votre commande'));
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STYLE DISCOVERY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get style-based recommendations
   */
  getStyleRecommendations(
    style: 'casual' | 'chic' | 'sporty' | 'elegant' | 'bohemian' | 'minimalist' | 'trendy',
    limit: number = 8
  ): Observable<RecommendationSet> {
    return this.http.get<RecommendationSet>(
      `${this.apiUrl}/api/recommendations/v2/style/${style}?limit=${limit}`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(err => {
        console.error('Error fetching style recommendations:', err);
        return of(this.emptyResponse('style', `Style ${style}`));
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTI-STRATEGY ENDPOINT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get multiple recommendation sets in a single request
   */
  getMultipleRecommendations(
    strategies: RecommendationStrategy[],
    productId?: number,
    limit: number = 8,
    family?: string
  ): Observable<MultiRecommendationResponse> {
    return this.http.post<MultiRecommendationResponse>(
      `${this.apiUrl}/api/recommendations/v2/multi`,
      { productId, strategies, limit, family },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(err => {
        console.error('Error fetching multiple recommendations:', err);
        return of({ success: false, sets: {}, totalProcessingTimeMs: 0 });
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  private emptyResponse(strategy: string, title: string): RecommendationSet {
    return {
      success: true,
      strategy,
      title,
      subtitle: '',
      explanation: 'Aucune recommandation disponible',
      products: [],
      totalCandidates: 0,
      processingTimeMs: 0
    };
  }

  /**
   * Clear all cached recommendations
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get product URL from recommendation
   */
  getProductUrl(product: RecommendedProduct): string {
    return `/produit/${product.id}`;
  }

  /**
   * Generate product slug for URL
   */
  generateSlug(product: RecommendedProduct): string {
    const slug = product.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${product.id}-${slug}`;
  }
}
