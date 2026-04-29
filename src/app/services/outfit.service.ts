/**
 * BARSHA OUTFIT SERVICE
 * ======================
 * Connects to the Shop the Look / Outfits backend API.
 * Provides curated outfit browsing and one-click add-to-cart.
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
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
  private readonly searchApiUrl = `${environementDev.apiSearchDev}/indexes/products/search`;

  // Cache for featured outfits
  private featuredOutfitsSubject = new BehaviorSubject<Outfit[]>([]);
  public featuredOutfits$ = this.featuredOutfitsSubject.asObservable();

  constructor(
    private http: HttpClient
  ) {}

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
      switchMap((response) =>
        this.normalizeOutfits((response as any)?.outfits || [], options.limit || 12).pipe(
          map((outfits) => ({
            outfits,
            total: (response as any)?.total || outfits.length,
            page: (response as any)?.page || 1,
            limit: (response as any)?.limit || options.limit || 12,
            totalPages: (response as any)?.totalPages || 1,
          }))
        )
      ),
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
      switchMap((outfits) => this.normalizeOutfits(outfits, limit)),
      tap(outfits => this.featuredOutfitsSubject.next(outfits)),
      catchError(error => {
        console.error('Error fetching featured outfits:', error);
        return this.loadFallbackOutfits(limit);
      })
    );
  }

  /**
   * Get outfit by ID with all items
   */
  getOutfitById(outfitId: number): Observable<Outfit | null> {
    return this.http.get<{ outfit: Outfit }>(`${this.apiUrl}/${outfitId}`).pipe(
      switchMap(response => this.normalizeOutfits(response.outfit ? [response.outfit] : [], 1)),
      map(outfits => outfits[0] || null),
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
      switchMap(response => this.normalizeOutfits(response.outfit ? [response.outfit] : [], 1)),
      map(outfits => outfits[0] || null),
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
      switchMap((outfits) => this.normalizeOutfits(outfits, limit)),
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

  private normalizeOutfits(outfits: any[], fallbackLimit: number): Observable<Outfit[]> {
    const normalized = (outfits || [])
      .map((outfit) => this.normalizeOutfit(outfit))
      .filter((outfit): outfit is Outfit => !!outfit);

    const needsFallback = normalized.length === 0 || normalized.some((outfit) => !outfit.coverImage || !outfit.totalPrice);
    if (!needsFallback) {
      return of(normalized);
    }

    return this.loadFallbackOutfits(fallbackLimit, normalized);
  }

  private normalizeOutfit(outfit: any): Outfit | null {
    if (!outfit) return null;

    const productIds = Array.isArray(outfit.products)
      ? outfit.products.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id))
      : [];

    const normalizedTitle = outfit.title || outfit.name || 'Look Barsha';
    const normalizedSlug = outfit.slug || this.slugify(normalizedTitle);
    const normalizedTags = Array.isArray(outfit.styleTags)
      ? outfit.styleTags
      : Array.isArray(outfit.style_tags)
        ? outfit.style_tags
        : [];

    return {
      id: Number(outfit.id),
      title: normalizedTitle,
      slug: normalizedSlug,
      description: outfit.description || '',
      styleTags: normalizedTags,
      occasion: outfit.occasion || 'casual',
      season: outfit.season || 'all_season',
      family: outfit.family || 'UNISEX',
      coverImage: outfit.coverImage || outfit.image_url || outfit.imageUrl || '',
      isFeatured: outfit.isFeatured ?? outfit.is_featured ?? true,
      isActive: outfit.isActive ?? outfit.is_published ?? true,
      viewCount: Number(outfit.viewCount ?? outfit.view_count ?? 0),
      addToCartCount: Number(outfit.addToCartCount ?? outfit.like_count ?? 0),
      totalPrice: Number(outfit.totalPrice ?? outfit.total_price ?? 0),
      productCount: Number(outfit.productCount ?? productIds.length ?? 0),
      createdBy: outfit.createdBy ?? outfit.created_by,
      createdAt: outfit.createdAt ?? outfit.created_at ?? new Date().toISOString(),
      updatedAt: outfit.updatedAt ?? outfit.updated_at ?? new Date().toISOString(),
      items: Array.isArray(outfit.items) ? outfit.items : [],
    };
  }

  private loadFallbackOutfits(limit: number, existing: Outfit[] = []): Observable<Outfit[]> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`,
      'Content-Type': 'application/json'
    });
    const body = {
      q: '',
      filter: 'disponible = true',
      sort: ['id:desc'],
      limit: Math.max(limit * 3, 12)
    };

    return this.http.post<any>(this.searchApiUrl, body, { headers }).pipe(
      map((response) => {
        const hits = Array.isArray(response?.hits) ? response.hits : [];
        const catalogOutfits = this.createFallbackOutfitsFromProducts(hits, limit);
        return existing.length > 0
          ? existing.map((outfit, index) => this.mergeOutfitWithFallback(outfit, catalogOutfits[index]))
          : catalogOutfits;
      }),
      catchError(() => of(existing))
    );
  }

  private createFallbackOutfitsFromProducts(products: any[], limit: number): Outfit[] {
    const validProducts = (products || []).filter((product: any) => product?.id).slice(0, limit * 3);
    const outfits: Outfit[] = [];

    for (let index = 0; index < validProducts.length; index += 3) {
      const group = validProducts.slice(index, index + 3);
      if (group.length === 0) continue;

      const first = group[0];
      const title = `Look ${first.nom || first.title || first.name || first.id}`;
      const items = group.map((product: any, itemIndex: number) => ({
        id: Number(`${product.id}${itemIndex}`),
        outfitId: Number(`90${index}`),
        productId: Number(product.id),
        position: itemIndex + 1,
        product: {
          id: Number(product.id),
          sku: product.sku || product.reference || `LOOK-${product.id}`,
          title: product.nom || product.title || product.name || `Produit #${product.id}`,
          price: Number(product.price || product.prix || product.currentPrice || 0),
          currentPrice: Number(product.currentPrice || product.prix || product.price || 0),
          discount: Boolean(product.discount),
          discountValue: Number(product.discountValue || 0),
          firstImageUrl: product.firstImageUrl || product.firstImg?.url || product.image?.url || product.image || 'assets/images/placeholder.png',
          famille: product.Famille || product.famille || 'UNISEX',
          isAvailable: true,
          totalStock: 1,
        },
        createdAt: new Date().toISOString(),
      }));

      outfits.push({
        id: Number(`90${index}`),
        title,
        slug: this.slugify(title),
        description: `Sélection inspirée de notre catalogue`,
        styleTags: [first.Ligne || first.category || 'Style'],
        occasion: 'casual',
        season: 'all_season',
        family: first.Famille || first.famille || 'UNISEX',
        coverImage: items[0]?.product.firstImageUrl,
        isFeatured: true,
        isActive: true,
        viewCount: 0,
        addToCartCount: 0,
        totalPrice: items.reduce((sum, item) => sum + (item.product.currentPrice || item.product.price || 0), 0),
        productCount: items.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items,
      });
    }

    return outfits.slice(0, limit);
  }

  private mergeOutfitWithFallback(outfit: Outfit, fallback?: Outfit): Outfit {
    if (!fallback) {
      return outfit;
    }

    return {
      ...fallback,
      ...outfit,
      coverImage: outfit.coverImage || fallback.coverImage,
      totalPrice: outfit.totalPrice || fallback.totalPrice,
      productCount: outfit.productCount || fallback.productCount,
      items: outfit.items && outfit.items.length > 0 ? outfit.items : fallback.items,
    };
  }

  private slugify(text: string): string {
    return (text || 'look-barsha')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
