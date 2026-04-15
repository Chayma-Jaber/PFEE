/**
 * BARSHA OUTFIT SERVICE
 * ======================
 * Connects to the Shop the Look / Outfits backend API.
 * Provides curated outfit browsing and one-click add-to-cart.
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';

export interface OutfitProduct {
  id: number;
  sku: string;
  title: string;
  price: number;
  currentPrice: number;
  discount: boolean;
  discountValue: number;
  firstImageUrl: string;
  famille: string;
  isAvailable: boolean;
  totalStock: number;
}

export interface OutfitItem {
  id: number;
  outfitId: number;
  productId: number;
  position: number;
  stylingNote?: string;
  recommendedColor?: string;
  recommendedSize?: string;
  product: OutfitProduct;
  createdAt: string;
}

export interface Outfit {
  id: number;
  title: string;
  slug: string;
  description?: string;
  styleTags: string[];
  occasion: string;
  season: string;
  family: string;
  coverImage?: string;
  isFeatured: boolean;
  isActive: boolean;
  viewCount: number;
  addToCartCount: number;
  totalPrice: number;
  productCount: number;
  createdBy?: number;
  createdAt: string;
  updatedAt: string;
  items?: OutfitItem[];
}

export interface OutfitListResponse {
  outfits: Outfit[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OccasionCount {
  occasion: string;
  count: number;
  label: string;
}

export interface AddAllToCartResult {
  success: boolean;
  added: number;
  failed: number;
  message: string;
  details?: Array<{
    productId: number;
    success: boolean;
    error?: string;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class OutfitService {
  private readonly apiUrl = `${environementDev.backendAiUrl}/api/outfits`;

  // Cache for featured outfits
  private featuredOutfitsSubject = new BehaviorSubject<Outfit[]>([]);
  public featuredOutfits$ = this.featuredOutfitsSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwt');
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  /**
   * Get all active outfits with filters
   */
  getOutfits(options: {
    page?: number;
    limit?: number;
    family?: string;
    occasion?: string;
    season?: string;
    style?: string;
    search?: string;
    featured?: boolean;
  } = {}): Observable<OutfitListResponse> {
    let params = new HttpParams();

    if (options.page) params = params.set('page', options.page.toString());
    if (options.limit) params = params.set('limit', options.limit.toString());
    if (options.family) params = params.set('family', options.family);
    if (options.occasion) params = params.set('occasion', options.occasion);
    if (options.season) params = params.set('season', options.season);
    if (options.style) params = params.set('style', options.style);
    if (options.search) params = params.set('search', options.search);
    if (options.featured !== undefined) params = params.set('featured', options.featured.toString());

    return this.http.get<OutfitListResponse>(this.apiUrl, { params }).pipe(
      catchError(error => {
        console.error('Error fetching outfits:', error);
        return of({ outfits: [], total: 0, page: 1, limit: 12, totalPages: 0 });
      })
    );
  }

  /**
   * Get featured outfits for homepage
   */
  getFeaturedOutfits(limit: number = 6): Observable<Outfit[]> {
    return this.http.get<{ outfits: Outfit[] }>(`${this.apiUrl}/featured`, {
      params: new HttpParams().set('limit', limit.toString())
    }).pipe(
      map(response => response.outfits || []),
      tap(outfits => this.featuredOutfitsSubject.next(outfits)),
      catchError(error => {
        console.error('Error fetching featured outfits:', error);
        return of([]);
      })
    );
  }

  /**
   * Get outfit by ID with all items
   */
  getOutfitById(outfitId: number): Observable<Outfit | null> {
    return this.http.get<{ outfit: Outfit }>(`${this.apiUrl}/${outfitId}`).pipe(
      map(response => response.outfit),
      catchError(error => {
        console.error('Error fetching outfit:', error);
        return of(null);
      })
    );
  }

  /**
   * Get outfit by slug (SEO-friendly URL)
   */
  getOutfitBySlug(slug: string): Observable<Outfit | null> {
    return this.http.get<{ outfit: Outfit }>(`${this.apiUrl}/slug/${slug}`).pipe(
      map(response => response.outfit),
      catchError(error => {
        console.error('Error fetching outfit by slug:', error);
        return of(null);
      })
    );
  }

  /**
   * Get outfits containing a specific product ("Complete the Look")
   */
  getOutfitsForProduct(productId: number, limit: number = 3): Observable<Outfit[]> {
    return this.http.get<{ outfits: Outfit[] }>(`${this.apiUrl}/for-product/${productId}`, {
      params: new HttpParams().set('limit', limit.toString())
    }).pipe(
      map(response => response.outfits || []),
      catchError(error => {
        console.error('Error fetching outfits for product:', error);
        return of([]);
      })
    );
  }

  /**
   * Get all occasions with outfit counts
   */
  getOccasions(): Observable<OccasionCount[]> {
    return this.http.get<{ occasions: OccasionCount[] }>(`${this.apiUrl}/occasions`).pipe(
      map(response => response.occasions || []),
      catchError(error => {
        console.error('Error fetching occasions:', error);
        return of([]);
      })
    );
  }

  /**
   * Add all items from an outfit to cart (requires authentication)
   */
  addAllToCart(outfitId: number, options: {
    skipUnavailable?: boolean;
    selectedSizes?: Record<number, string>;
  } = {}): Observable<AddAllToCartResult> {
    return this.http.post<AddAllToCartResult>(
      `${this.apiUrl}/${outfitId}/add-all-to-cart`,
      options,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => {
        console.error('Error adding outfit to cart:', error);
        return of({
          success: false,
          added: 0,
          failed: 0,
          message: error.error?.detail || 'Erreur lors de l\'ajout au panier'
        });
      })
    );
  }

  /**
   * Get occasion label in French
   */
  getOccasionLabel(occasion: string): string {
    const labels: Record<string, string> = {
      'casual': 'Casual',
      'formal': 'Formel',
      'business': 'Business',
      'sport': 'Sport',
      'party': 'Soirée',
      'beach': 'Plage',
      'wedding': 'Mariage',
      'date': 'Rendez-vous',
      'travel': 'Voyage',
      'everyday': 'Quotidien'
    };
    return labels[occasion] || occasion;
  }

  /**
   * Get season label in French
   */
  getSeasonLabel(season: string): string {
    const labels: Record<string, string> = {
      'spring': 'Printemps',
      'summer': 'Été',
      'fall': 'Automne',
      'winter': 'Hiver',
      'all_season': 'Toutes saisons'
    };
    return labels[season] || season;
  }

  /**
   * Get family label in French
   */
  getFamilyLabel(family: string): string {
    const labels: Record<string, string> = {
      'MEN': 'Homme',
      'WOMEN': 'Femme',
      'KIDS': 'Enfants',
      'UNISEX': 'Unisexe'
    };
    return labels[family] || family;
  }

  /**
   * Generate outfit URL
   */
  getOutfitUrl(outfit: Outfit): string {
    return `/looks/${outfit.slug}`;
  }
}
