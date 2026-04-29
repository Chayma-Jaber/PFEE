/**
 * BARSHA NEXT-GENERATION RECOMMENDATIONS SERVICE
 * ==============================================
 * Version: 3.0.0
 *
 * Premium recommendation service with:
 * - 20+ strategies
 * - Full analytics tracking
 * - Intelligent caching
 * - Error resilience
 * - A/B testing support
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject, Subject, forkJoin } from 'rxjs';
import { map, catchError, tap, shareReplay, debounceTime, switchMap, take } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';
import { UserPreferencesService, RecommendationContext } from './user-preferences.service';

// ============================================================================
// INTERFACES
// ============================================================================

export interface RecommendedProduct {
  id: number;
  reference: string;
  name: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  image: string;
  secondImage?: string;
  url: string;
  family: string;
  category?: string;
  colors: string[];
  styleProfile?: string;

  // Scoring
  score: number;
  confidence: number;
  position: number;

  // Explainability
  strategy: string;
  reasonKey: string;
  reasonText: string;

  // Analytics
  recommendationId: string;
  experimentVariant?: string;
}

export interface RecommendationResponse {
  strategy: string;
  title: string;
  subtitle?: string;
  products: RecommendedProduct[];
  metadata: {
    totalCandidates: number;
    executionTimeMs: number;
    cacheHit: boolean;
    experimentId?: string;
  };
}

export interface MultiStrategyResponse {
  strategies: { [key: string]: RecommendationResponse };
  requested: string[];
  timestamp: string;
}

export interface PDPBundleResponse {
  complete_the_look: RecommendationResponse;
  similar: RecommendationResponse;
  complementary: RecommendationResponse;
  frequently_bought_together: RecommendationResponse;
  premium_alternative: RecommendationResponse;
  affordable_alternative: RecommendationResponse;
  product_id: number;
  timestamp: string;
}

export interface HomepageBundleResponse {
  trending: RecommendationResponse;
  new_arrivals: RecommendationResponse;
  seasonal: RecommendationResponse;
  editorial: RecommendationResponse;
  timestamp: string;
}

export interface UserContext {
  userId?: string;
  sessionId?: string;
  viewedProductIds: number[];
  wishlistProductIds: number[];
  cartProductIds: number[];
  purchasedProductIds: number[];
  preferredCategories?: string[];
  preferredColors?: string[];
  deviceType?: string;
}

export interface AnalyticsEvent {
  eventType: 'impression' | 'click' | 'add_to_cart' | 'purchase';
  recommendationId: string;
  productId: number;
  strategy: string;
  position: number;
  sessionId?: string;
  userId?: string;
}

export interface StrategyInfo {
  id: string;
  name: string;
  description: string;
}

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const CACHE_TTL = {
  trending: 3 * 60 * 1000,      // 3 minutes
  new_arrivals: 10 * 60 * 1000, // 10 minutes
  seasonal: 60 * 60 * 1000,     // 1 hour
  editorial: 30 * 60 * 1000,    // 30 minutes
  similar: 5 * 60 * 1000,       // 5 minutes
  complementary: 5 * 60 * 1000, // 5 minutes
  default: 5 * 60 * 1000        // 5 minutes
};

// ============================================================================
// SERVICE
// ============================================================================

@Injectable({
  providedIn: 'root'
})
export class NextGenRecommendationsService {
  private readonly apiUrl = `${environementDev.backendAiUrl}/api/recommendations/v3`;
  private readonly analyticsApiUrl = `${environementDev.api}/api/analytics`;
  private readonly analyticsEnabled = (environementDev as any).enableAnalytics !== false;
  private cache = new Map<string, CacheEntry<any>>();
  private trackedImpressions = new Set<string>();

  // Analytics event buffer for batching
  private analyticsBuffer: AnalyticsEvent[] = [];
  private analyticsFlush$ = new Subject<void>();

  // Loading states
  private loadingStrategies = new BehaviorSubject<Set<string>>(new Set());
  public loadingStrategies$ = this.loadingStrategies.asObservable();

  constructor(
    private http: HttpClient,
    private userPreferencesService: UserPreferencesService
  ) {
    // Setup analytics batching
    this.analyticsFlush$
      .pipe(debounceTime(2000))
      .subscribe(() => this.flushAnalytics());
  }

  // ========================================================================
  // PRIVATE HELPERS
  // ========================================================================

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwt');
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  private getCacheKey(strategy: string, params: any): string {
    return `${strategy}_${JSON.stringify(params)}`;
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() < entry.expiry) {
      return entry.data as T;
    }
    if (entry) {
      this.cache.delete(key);
    }
    return null;
  }

  private setCache<T>(key: string, data: T, strategy: string): void {
    const ttl = CACHE_TTL[strategy as keyof typeof CACHE_TTL] || CACHE_TTL.default;
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl
    });
  }

  private setLoading(strategy: string, loading: boolean): void {
    const current = this.loadingStrategies.value;
    if (loading) {
      current.add(strategy);
    } else {
      current.delete(strategy);
    }
    this.loadingStrategies.next(new Set(current));
  }

  private ensureAbsoluteUrl(url?: string): string {
    const value = (url || '').toString().trim();
    if (!value) return 'assets/images/placeholder.png';
    if (value.startsWith('http') || value.startsWith('data:') || value.startsWith('assets/')) {
      return value;
    }
    return `https://barsha.com.tn/${value.replace(/^\/+/, '')}`;
  }

  private normalizeRecommendationResponse(response: any, fallbackTitle: string): RecommendationResponse {
    if (response?.products) {
      return {
        strategy: response.strategy || '',
        title: response.title || fallbackTitle,
        subtitle: response.subtitle || '',
        products: (response.products || []).map((product: any, index: number) => ({
          ...product,
          id: Number(product.id || product.product_id || 0),
          price: Number(product.price || product.currentPrice || 0),
          originalPrice: product.originalPrice != null ? Number(product.originalPrice) : undefined,
          discountPercent: product.discountPercent != null ? Number(product.discountPercent) : undefined,
          image: this.ensureAbsoluteUrl(product.image),
          secondImage: product.secondImage ? this.ensureAbsoluteUrl(product.secondImage) : undefined,
          name: product.name || product.nom || `Produit #${product.id || product.product_id}`,
          family: product.family || product.famille || 'UNISEX',
          url: product.url || `/produit/${product.id || product.product_id}`,
          colors: Array.isArray(product.colors) ? product.colors : [],
          position: Number(product.position ?? index),
        })),
        metadata: {
          totalCandidates: Number(response?.metadata?.totalCandidates || response?.total_candidates || 0),
          executionTimeMs: Number(response?.metadata?.executionTimeMs || 0),
          cacheHit: Boolean(response?.metadata?.cacheHit),
          experimentId: response?.metadata?.experimentId,
        }
      };
    }

    const results = Array.isArray(response?.results) ? response.results : [];
    return {
      strategy: response?.strategy || '',
      title: response?.title || fallbackTitle,
      subtitle: response?.subtitle || response?.explanation || '',
      products: results.map((item: any, index: number) => {
        const product = item?.product || item?.product_data || {};
        const currentPrice = Number(product.currentPrice || product.prix || product.price || 0);
        const originalPrice = Number(product.prix || product.price || currentPrice);
        return {
          id: Number(product.id || item.product_id || 0),
          reference: product.reference || product.sku || '',
          name: product.nom || product.name || `Produit #${product.id || item.product_id}`,
          price: currentPrice,
          originalPrice: originalPrice > currentPrice ? originalPrice : undefined,
          discountPercent: originalPrice > currentPrice && currentPrice > 0
            ? Math.round((1 - currentPrice / originalPrice) * 100)
            : undefined,
          image: this.ensureAbsoluteUrl(product.image),
          secondImage: product.secondImage ? this.ensureAbsoluteUrl(product.secondImage) : undefined,
          url: product.url || `/produit/${product.id || item.product_id}`,
          family: product.famille || product.family || 'UNISEX',
          category: product.category || '',
          colors: Array.isArray(product.colors) ? product.colors : [],
          styleProfile: product.styleProfile || '',
          score: Number(item.score || 0),
          confidence: Number(item.confidence || item.score || 0),
          position: Number(item.position ?? index),
          strategy: item.strategy || response?.strategy || '',
          reasonKey: item.reasonKey || item.reason_key || '',
          reasonText: item.reasonText || item.reason || '',
          recommendationId: item.recommendationId || `${response?.strategy || 'rec'}-${product.id || item.product_id}-${index}`,
          experimentVariant: item.experimentVariant,
        };
      }),
      metadata: {
        totalCandidates: Number(response?.total_candidates || response?.count || results.length || 0),
        executionTimeMs: Number(response?.metadata?.executionTimeMs || 0),
        cacheHit: Boolean(response?.metadata?.cacheHit),
        experimentId: response?.metadata?.experimentId,
      }
    };
  }

  private emptyResponse(strategy: string, title: string): RecommendationResponse {
    return {
      strategy,
      title,
      products: [],
      metadata: {
        totalCandidates: 0,
        executionTimeMs: 0,
        cacheHit: false
      }
    };
  }

  // ========================================================================
  // PRODUCT DETAIL PAGE ENDPOINTS
  // ========================================================================

  getSimilarProducts(productId: number, limit: number = 8, family?: string): Observable<RecommendationResponse> {
    const cacheKey = this.getCacheKey('similar', { productId, limit, family });
    const cached = this.getFromCache<RecommendationResponse>(cacheKey);
    if (cached) {
      return of({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });
    }

    this.setLoading('similar', true);
    let params = new HttpParams().set('limit', limit.toString());
    if (family) params = params.set('family', family);

    return this.http.get<RecommendationResponse>(
      `${this.apiUrl}/similar/${productId}`,
      { headers: this.getHeaders(), params }
    ).pipe(
      map(response => this.normalizeRecommendationResponse(response, 'Dans le même style')),
      tap(response => {
        this.setCache(cacheKey, response, 'similar');
        this.setLoading('similar', false);
      }),
      catchError(error => {
        console.error('Error fetching similar products:', error);
        this.setLoading('similar', false);
        return of(this.emptyResponse('similar', 'Dans le même style'));
      })
    );
  }

  getComplementaryProducts(productId: number, limit: number = 6, family?: string): Observable<RecommendationResponse> {
    const cacheKey = this.getCacheKey('complementary', { productId, limit, family });
    const cached = this.getFromCache<RecommendationResponse>(cacheKey);
    if (cached) {
      return of({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });
    }

    this.setLoading('complementary', true);
    let params = new HttpParams().set('limit', limit.toString());
    if (family) params = params.set('family', family);

    return this.http.get<RecommendationResponse>(
      `${this.apiUrl}/complementary/${productId}`,
      { headers: this.getHeaders(), params }
    ).pipe(
      map(response => this.normalizeRecommendationResponse(response, 'Pour compléter ce look')),
      tap(response => {
        this.setCache(cacheKey, response, 'complementary');
        this.setLoading('complementary', false);
      }),
      catchError(error => {
        console.error('Error fetching complementary products:', error);
        this.setLoading('complementary', false);
        return of(this.emptyResponse('complementary', 'Pour compléter ce look'));
      })
    );
  }

  getCompleteTheLook(productId: number, limit: number = 4): Observable<RecommendationResponse> {
    const cacheKey = this.getCacheKey('complete_the_look', { productId, limit });
    const cached = this.getFromCache<RecommendationResponse>(cacheKey);
    if (cached) {
      return of({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });
    }

    this.setLoading('complete_the_look', true);

    return this.http.get<RecommendationResponse>(
      `${this.apiUrl}/complete-look/${productId}`,
      { headers: this.getHeaders(), params: new HttpParams().set('limit', limit.toString()) }
    ).pipe(
      map(response => this.normalizeRecommendationResponse(response, 'Le look complet')),
      tap(response => {
        this.setCache(cacheKey, response, 'similar');
        this.setLoading('complete_the_look', false);
      }),
      catchError(error => {
        console.error('Error fetching complete the look:', error);
        this.setLoading('complete_the_look', false);
        return of(this.emptyResponse('complete_the_look', 'Le look complet'));
      })
    );
  }

  getFrequentlyBoughtTogether(productId: number, limit: number = 4): Observable<RecommendationResponse> {
    const cacheKey = this.getCacheKey('frequently_bought_together', { productId, limit });
    const cached = this.getFromCache<RecommendationResponse>(cacheKey);
    if (cached) {
      return of({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });
    }

    this.setLoading('frequently_bought_together', true);

    return this.http.get<RecommendationResponse>(
      `${this.apiUrl}/frequently-bought-together/${productId}`,
      { headers: this.getHeaders(), params: new HttpParams().set('limit', limit.toString()) }
    ).pipe(
      map(response => this.normalizeRecommendationResponse(response, 'Souvent achetés ensemble')),
      tap(response => {
        this.setCache(cacheKey, response, 'similar');
        this.setLoading('frequently_bought_together', false);
      }),
      catchError(error => {
        console.error('Error fetching frequently bought together:', error);
        this.setLoading('frequently_bought_together', false);
        return of(this.emptyResponse('frequently_bought_together', 'Souvent achetés ensemble'));
      })
    );
  }

  getPremiumAlternatives(productId: number, limit: number = 4): Observable<RecommendationResponse> {
    const cacheKey = this.getCacheKey('premium_alternative', { productId, limit });
    const cached = this.getFromCache<RecommendationResponse>(cacheKey);
    if (cached) {
      return of({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });
    }

    this.setLoading('premium_alternative', true);

    return this.http.get<RecommendationResponse>(
      `${this.apiUrl}/premium-alternatives/${productId}`,
      { headers: this.getHeaders(), params: new HttpParams().set('limit', limit.toString()) }
    ).pipe(
      map(response => this.normalizeRecommendationResponse(response, 'Version premium')),
      tap(response => {
        this.setCache(cacheKey, response, 'similar');
        this.setLoading('premium_alternative', false);
      }),
      catchError(error => {
        console.error('Error fetching premium alternatives:', error);
        this.setLoading('premium_alternative', false);
        return of(this.emptyResponse('premium_alternative', 'Version premium'));
      })
    );
  }

  getAffordableAlternatives(productId: number, limit: number = 4): Observable<RecommendationResponse> {
    const cacheKey = this.getCacheKey('affordable_alternative', { productId, limit });
    const cached = this.getFromCache<RecommendationResponse>(cacheKey);
    if (cached) {
      return of({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });
    }

    this.setLoading('affordable_alternative', true);

    return this.http.get<RecommendationResponse>(
      `${this.apiUrl}/affordable-alternatives/${productId}`,
      { headers: this.getHeaders(), params: new HttpParams().set('limit', limit.toString()) }
    ).pipe(
      map(response => this.normalizeRecommendationResponse(response, 'Alternatives accessibles')),
      tap(response => {
        this.setCache(cacheKey, response, 'similar');
        this.setLoading('affordable_alternative', false);
      }),
      catchError(error => {
        console.error('Error fetching affordable alternatives:', error);
        this.setLoading('affordable_alternative', false);
        return of(this.emptyResponse('affordable_alternative', 'Alternatives accessibles'));
      })
    );
  }

  // ========================================================================
  // HOMEPAGE ENDPOINTS
  // ========================================================================

  getTrending(limit: number = 8, family?: string, category?: string): Observable<RecommendationResponse> {
    const cacheKey = this.getCacheKey('trending', { limit, family, category });
    const cached = this.getFromCache<RecommendationResponse>(cacheKey);
    if (cached) {
      return of({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });
    }

    this.setLoading('trending', true);
    let params = new HttpParams().set('limit', limit.toString());
    if (family) params = params.set('family', family);
    if (category) params = params.set('category', category);

    return this.http.get<RecommendationResponse>(
      `${this.apiUrl}/trending`,
      { headers: this.getHeaders(), params }
    ).pipe(
      map(response => this.normalizeRecommendationResponse(response, 'Tendances Barsha')),
      tap(response => {
        this.setCache(cacheKey, response, 'trending');
        this.setLoading('trending', false);
      }),
      catchError(error => {
        console.error('Error fetching trending:', error);
        this.setLoading('trending', false);
        return of(this.emptyResponse('trending', 'Tendances Barsha'));
      })
    );
  }

  getNewArrivals(limit: number = 8, family?: string): Observable<RecommendationResponse> {
    const cacheKey = this.getCacheKey('new_arrivals', { limit, family });
    const cached = this.getFromCache<RecommendationResponse>(cacheKey);
    if (cached) {
      return of({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });
    }

    this.setLoading('new_arrivals', true);
    let params = new HttpParams().set('limit', limit.toString());
    if (family) params = params.set('family', family);

    return this.http.get<RecommendationResponse>(
      `${this.apiUrl}/new-arrivals`,
      { headers: this.getHeaders(), params }
    ).pipe(
      map(response => this.normalizeRecommendationResponse(response, 'Nouveautés')),
      tap(response => {
        this.setCache(cacheKey, response, 'new_arrivals');
        this.setLoading('new_arrivals', false);
      }),
      catchError(error => {
        console.error('Error fetching new arrivals:', error);
        this.setLoading('new_arrivals', false);
        return of(this.emptyResponse('new_arrivals', 'Nouveautés'));
      })
    );
  }

  getSeasonal(limit: number = 8, family?: string): Observable<RecommendationResponse> {
    const cacheKey = this.getCacheKey('seasonal', { limit, family });
    const cached = this.getFromCache<RecommendationResponse>(cacheKey);
    if (cached) {
      return of({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });
    }

    this.setLoading('seasonal', true);
    let params = new HttpParams().set('limit', limit.toString());
    if (family) params = params.set('family', family);

    return this.http.get<RecommendationResponse>(
      `${this.apiUrl}/seasonal`,
      { headers: this.getHeaders(), params }
    ).pipe(
      map(response => this.normalizeRecommendationResponse(response, 'Sélection de saison')),
      tap(response => {
        this.setCache(cacheKey, response, 'seasonal');
        this.setLoading('seasonal', false);
      }),
      catchError(error => {
        console.error('Error fetching seasonal:', error);
        this.setLoading('seasonal', false);
        return of(this.emptyResponse('seasonal', 'Sélection de saison'));
      })
    );
  }

  getEditorial(limit: number = 6): Observable<RecommendationResponse> {
    const cacheKey = this.getCacheKey('editorial', { limit });
    const cached = this.getFromCache<RecommendationResponse>(cacheKey);
    if (cached) {
      return of({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });
    }

    this.setLoading('editorial', true);

    return this.http.get<RecommendationResponse>(
      `${this.apiUrl}/editorial`,
      { headers: this.getHeaders(), params: new HttpParams().set('limit', limit.toString()) }
    ).pipe(
      map(response => this.normalizeRecommendationResponse(response, 'Sélection éditoriale')),
      tap(response => {
        this.setCache(cacheKey, response, 'editorial');
        this.setLoading('editorial', false);
      }),
      catchError(error => {
        console.error('Error fetching editorial:', error);
        this.setLoading('editorial', false);
        return of(this.emptyResponse('editorial', 'Sélection éditoriale'));
      })
    );
  }

  getStyleDiscovery(style: string, limit: number = 8, family?: string): Observable<RecommendationResponse> {
    const cacheKey = this.getCacheKey('style_discovery', { style, limit, family });
    const cached = this.getFromCache<RecommendationResponse>(cacheKey);
    if (cached) {
      return of({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });
    }

    this.setLoading('style_discovery', true);
    let params = new HttpParams().set('limit', limit.toString());
    if (family) params = params.set('family', family);

    return this.http.get<RecommendationResponse>(
      `${this.apiUrl}/style/${style}`,
      { headers: this.getHeaders(), params }
    ).pipe(
      map(response => this.normalizeRecommendationResponse(response, `Style ${style}`)),
      tap(response => {
        this.setCache(cacheKey, response, 'similar');
        this.setLoading('style_discovery', false);
      }),
      catchError(error => {
        console.error('Error fetching style discovery:', error);
        this.setLoading('style_discovery', false);
        return of(this.emptyResponse('style_discovery', `Style ${style}`));
      })
    );
  }

  // ========================================================================
  // PERSONALIZATION ENDPOINTS
  // ========================================================================

  getPersonalized(context: UserContext, limit: number = 8): Observable<RecommendationResponse> {
    this.setLoading('personalized', true);

    const body = {
      user_id: context.userId,
      session_id: context.sessionId,
      viewed_product_ids: context.viewedProductIds,
      wishlist_product_ids: context.wishlistProductIds,
      cart_product_ids: context.cartProductIds,
      purchased_product_ids: context.purchasedProductIds,
      preferred_categories: context.preferredCategories || [],
      preferred_colors: context.preferredColors || [],
      device_type: context.deviceType || 'desktop'
    };

    return this.http.post<RecommendationResponse>(
      `${this.apiUrl}/personalized`,
      body,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => this.normalizeRecommendationResponse(response, 'Sélectionné pour vous')),
      tap(() => this.setLoading('personalized', false)),
      catchError(error => {
        console.error('Error fetching personalized:', error);
        this.setLoading('personalized', false);
        return of(this.emptyResponse('personalized', 'Sélectionné pour vous'));
      })
    );
  }

  getBecauseYouViewed(viewedIds: number[], limit: number = 8): Observable<RecommendationResponse> {
    this.setLoading('because_you_viewed', true);

    return this.http.post<RecommendationResponse>(
      `${this.apiUrl}/because-you-viewed`,
      { viewed_product_ids: viewedIds },
      { headers: this.getHeaders() }
    ).pipe(
      map(response => this.normalizeRecommendationResponse(response, 'Car vous avez consulté')),
      tap(() => this.setLoading('because_you_viewed', false)),
      catchError(error => {
        console.error('Error fetching because you viewed:', error);
        this.setLoading('because_you_viewed', false);
        return of(this.emptyResponse('because_you_viewed', 'Car vous avez consulté'));
      })
    );
  }

  getCustomersAlsoLiked(productIds: number[], limit: number = 8): Observable<RecommendationResponse> {
    this.setLoading('customers_also_liked', true);

    return this.http.post<RecommendationResponse>(
      `${this.apiUrl}/customers-also-liked`,
      { product_ids: productIds },
      { headers: this.getHeaders() }
    ).pipe(
      map(response => this.normalizeRecommendationResponse(response, 'Les clients ont aussi aimé')),
      tap(() => this.setLoading('customers_also_liked', false)),
      catchError(error => {
        console.error('Error fetching customers also liked:', error);
        this.setLoading('customers_also_liked', false);
        return of(this.emptyResponse('customers_also_liked', 'Les clients ont aussi aimé'));
      })
    );
  }

  /**
   * Get fully personalized recommendations using the UserPreferencesService.
   * This automatically fetches user context from the backend and uses it
   * for personalized recommendations.
   */
  getPersonalizedWithContext(limit: number = 8): Observable<RecommendationResponse> {
    this.setLoading('personalized', true);

    return this.userPreferencesService.getRecommendationContext().pipe(
      switchMap((prefContext: RecommendationContext) => {
        const body = {
          user_id: prefContext.user_id,
          session_id: prefContext.session_id,
          preferred_styles: prefContext.preferred_styles || [],
          preferred_colors: prefContext.preferred_colors || [],
          preferred_categories: prefContext.preferred_categories || [],
          preferred_occasions: prefContext.preferred_occasions || [],
          category_affinity: prefContext.category_affinity || {},
          price_sensitivity: prefContext.price_sensitivity,
          min_price: prefContext.min_price,
          max_price: prefContext.max_price,
          size_top: prefContext.size_top,
          size_bottom: prefContext.size_bottom,
          profile_completeness: prefContext.profile_completeness,
          limit
        };

        return this.http.post<RecommendationResponse>(
          `${this.apiUrl}/personalized`,
          body,
          { headers: this.getHeaders() }
        );
      }),
      map(response => this.normalizeRecommendationResponse(response, 'Sélectionné pour vous')),
      tap(() => this.setLoading('personalized', false)),
      catchError(error => {
        console.error('Error fetching personalized with context:', error);
        this.setLoading('personalized', false);
        return of(this.emptyResponse('personalized', 'Sélectionné pour vous'));
      })
    );
  }

  /**
   * Get style-matched recommendations based on user's preferred styles.
   * Uses the UserPreferencesService to determine user's style preferences.
   */
  getStyleMatchedForUser(limit: number = 8, family?: string): Observable<RecommendationResponse> {
    this.setLoading('style_matched', true);

    return this.userPreferencesService.getRecommendationContext().pipe(
      switchMap((prefContext: RecommendationContext) => {
        const styles = prefContext.preferred_styles || [];

        if (styles.length === 0) {
          this.setLoading('style_matched', false);
          return of(this.emptyResponse('style_matched', 'Votre style'));
        }

        // Use the first preferred style
        const primaryStyle = styles[0];
        return this.getStyleDiscovery(primaryStyle, limit, family);
      }),
      tap(() => this.setLoading('style_matched', false)),
      catchError(error => {
        console.error('Error fetching style-matched:', error);
        this.setLoading('style_matched', false);
        return of(this.emptyResponse('style_matched', 'Votre style'));
      })
    );
  }

  /**
   * Get color-matched recommendations based on user's preferred colors.
   */
  getColorMatchedForUser(limit: number = 8, family?: string): Observable<RecommendationResponse> {
    this.setLoading('color_matched', true);

    return this.userPreferencesService.getRecommendationContext().pipe(
      switchMap((prefContext: RecommendationContext) => {
        const colors = prefContext.preferred_colors || [];

        if (colors.length === 0) {
          this.setLoading('color_matched', false);
          return of(this.emptyResponse('color_matched', 'Vos couleurs'));
        }

        let params = new HttpParams()
          .set('limit', limit.toString())
          .set('colors', colors.join(','));
        if (family) params = params.set('family', family);

        return this.http.get<RecommendationResponse>(
          `${this.apiUrl}/by-colors`,
          { headers: this.getHeaders(), params }
        );
      }),
      map(response => this.normalizeRecommendationResponse(response, 'Vos couleurs')),
      tap(() => this.setLoading('color_matched', false)),
      catchError(error => {
        console.error('Error fetching color-matched:', error);
        this.setLoading('color_matched', false);
        return of(this.emptyResponse('color_matched', 'Vos couleurs'));
      })
    );
  }

  /**
   * Check if user has style preferences configured.
   */
  hasUserPreferences(): boolean {
    return this.userPreferencesService.hasPreferences();
  }

  // ========================================================================
  // CART ENDPOINTS
  // ========================================================================

  getCartRecommendations(cartProductIds: number[], limit: number = 4): Observable<RecommendationResponse> {
    const normalizedIds = Array.from(
      new Set((cartProductIds || []).filter((id): id is number => Number.isFinite(id)))
    ).sort((left, right) => left - right);
    const cacheKey = this.getCacheKey('cart_complement', { cartProductIds: normalizedIds, limit });
    const cached = this.getFromCache<RecommendationResponse>(cacheKey);
    if (cached) {
      return of({ ...cached, metadata: { ...cached.metadata, cacheHit: true } });
    }

    this.setLoading('cart_complement', true);

    return this.http.post<RecommendationResponse>(
      `${this.apiUrl}/cart-recommendations`,
      { cart_product_ids: normalizedIds, limit },
      { headers: this.getHeaders() }
    ).pipe(
      map(response => this.normalizeRecommendationResponse(response, 'Pour compléter votre commande')),
      tap((response) => {
        this.setCache(cacheKey, response, 'default');
        this.setLoading('cart_complement', false);
      }),
      catchError(error => {
        console.error('Error fetching cart recommendations:', error);
        this.setLoading('cart_complement', false);
        return of(this.emptyResponse('cart_complement', 'Pour compléter votre commande'));
      })
    );
  }

  // ========================================================================
  // BUNDLE ENDPOINTS
  // ========================================================================

  getPDPBundle(productId: number, family?: string): Observable<PDPBundleResponse> {
    this.setLoading('pdp_bundle', true);

    let params = new HttpParams();
    if (family) params = params.set('family', family);

    return this.http.get<PDPBundleResponse>(
      `${this.apiUrl}/pdp-bundle/${productId}`,
      { headers: this.getHeaders(), params }
    ).pipe(
      tap(() => this.setLoading('pdp_bundle', false)),
      catchError(error => {
        console.error('Error fetching PDP bundle:', error);
        this.setLoading('pdp_bundle', false);
        return of({
          complete_the_look: this.emptyResponse('complete_the_look', 'Le look complet'),
          similar: this.emptyResponse('similar', 'Dans le même style'),
          complementary: this.emptyResponse('complementary', 'Pour compléter ce look'),
          frequently_bought_together: this.emptyResponse('frequently_bought_together', 'Souvent achetés ensemble'),
          premium_alternative: this.emptyResponse('premium_alternative', 'Version premium'),
          affordable_alternative: this.emptyResponse('affordable_alternative', 'Alternatives accessibles'),
          product_id: productId,
          timestamp: new Date().toISOString()
        });
      })
    );
  }

  getHomepageBundle(family?: string): Observable<HomepageBundleResponse> {
    this.setLoading('homepage_bundle', true);

    let params = new HttpParams();
    if (family) params = params.set('family', family);

    return this.http.get<HomepageBundleResponse>(
      `${this.apiUrl}/homepage-bundle`,
      { headers: this.getHeaders(), params }
    ).pipe(
      tap(() => this.setLoading('homepage_bundle', false)),
      catchError(error => {
        console.error('Error fetching homepage bundle:', error);
        this.setLoading('homepage_bundle', false);
        return of({
          trending: this.emptyResponse('trending', 'Tendances Barsha'),
          new_arrivals: this.emptyResponse('new_arrivals', 'Nouveautés'),
          seasonal: this.emptyResponse('seasonal', 'Sélection de saison'),
          editorial: this.emptyResponse('editorial', 'Sélection éditoriale'),
          timestamp: new Date().toISOString()
        });
      })
    );
  }

  // ========================================================================
  // ANALYTICS
  // ========================================================================

  trackImpression(product: RecommendedProduct): void {
    if (!this.analyticsEnabled) return;

    const impressionKey = `${product.recommendationId}:${product.id}:${product.position}`;
    if (this.trackedImpressions.has(impressionKey)) {
      return;
    }

    this.trackedImpressions.add(impressionKey);
    this.analyticsBuffer.push({
      eventType: 'impression',
      recommendationId: product.recommendationId,
      productId: product.id,
      strategy: product.strategy,
      position: product.position,
      sessionId: this.getSessionId(),
      userId: this.getUserId()
    });
    this.analyticsFlush$.next();
  }

  trackClick(product: RecommendedProduct): void {
    if (!this.analyticsEnabled) return;
    this.analyticsBuffer.push({
      eventType: 'click',
      recommendationId: product.recommendationId,
      productId: product.id,
      strategy: product.strategy,
      position: product.position,
      sessionId: this.getSessionId(),
      userId: this.getUserId()
    });
    this.flushAnalytics(); // Immediate flush for clicks
  }

  trackAddToCart(product: RecommendedProduct): void {
    if (!this.analyticsEnabled) return;
    this.analyticsBuffer.push({
      eventType: 'add_to_cart',
      recommendationId: product.recommendationId,
      productId: product.id,
      strategy: product.strategy,
      position: product.position,
      sessionId: this.getSessionId(),
      userId: this.getUserId()
    });
    this.flushAnalytics(); // Immediate flush
  }

  trackPurchase(product: RecommendedProduct): void {
    if (!this.analyticsEnabled) return;
    this.analyticsBuffer.push({
      eventType: 'purchase',
      recommendationId: product.recommendationId,
      productId: product.id,
      strategy: product.strategy,
      position: product.position,
      sessionId: this.getSessionId(),
      userId: this.getUserId()
    });
    this.flushAnalytics(); // Immediate flush
  }

  private flushAnalytics(): void {
    if (!this.analyticsEnabled) return;
    if (this.analyticsBuffer.length === 0) return;

    const events = [...this.analyticsBuffer];
    this.analyticsBuffer = [];

    const eventTypeMap: Record<AnalyticsEvent['eventType'], string> = {
      impression: 'recommendation_impression',
      click: 'recommendation_click',
      add_to_cart: 'recommendation_add_to_cart',
      purchase: 'recommendation_purchase',
    };

    events.forEach(event => {
      this.http.post(
        `${this.analyticsApiUrl}/event`,
        {
          event_type: eventTypeMap[event.eventType],
          product_id: event.productId,
          session_id: event.sessionId,
          recommendation_type: event.strategy,
          recommendation_position: event.position,
          recommendation_source: 'next_gen_recommendations',
          event_data: {
            recommendation_id: event.recommendationId,
            strategy: event.strategy,
            original_event_type: event.eventType,
            tracked_user_id: event.userId,
            timestamp: new Date().toISOString(),
          }
        },
        { headers: this.getHeaders() }
      ).subscribe({
        error: err => console.error('Analytics tracking error:', err)
      });
    });
  }

  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('barsha_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('barsha_session_id', sessionId);
    }
    return sessionId;
  }

  private getUserId(): string | undefined {
    const direct = localStorage.getItem('userId');
    if (direct) return direct;

    const userStr = localStorage.getItem('user');
    if (!userStr) return undefined;

    try {
      const user = JSON.parse(userStr);
      return user?.id ? String(user.id) : undefined;
    } catch {
      return undefined;
    }
  }

  // ========================================================================
  // UTILITY
  // ========================================================================

  getStrategies(): Observable<StrategyInfo[]> {
    return this.http.get<{ strategies: StrategyInfo[] }>(
      `${this.apiUrl}/strategies`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.strategies),
      catchError(() => of([]))
    );
  }

  getHealth(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health`, { headers: this.getHeaders() });
  }

  invalidateCache(strategy?: string): void {
    if (strategy) {
      // Invalidate specific strategy
      const keysToDelete: string[] = [];
      this.cache.forEach((_, key) => {
        if (key.startsWith(strategy)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      // Invalidate all
      this.cache.clear();
    }
  }

  isLoading(strategy: string): boolean {
    return this.loadingStrategies.value.has(strategy);
  }
}
