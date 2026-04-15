/**
 * BARSHA BUNDLE SERVICE
 * ======================
 * Connects to the Bundle Deals backend API.
 * Provides bundle browsing and add-to-cart functionality.
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';

export interface BundleProduct {
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
  variants?: BundleProductVariant[];
}

export interface BundleProductVariant {
  id: number;
  color: string;
  colorCode: string;
  size: string;
  ean13: string;
  isInStock: boolean;
  availableQuantity: number;
}

export interface BundleItem {
  id: number;
  bundleId: number;
  productId: string;
  quantity: number;
  position: number;
  product: BundleProduct | null;
}

export interface Bundle {
  id: number;
  name: string;
  description?: string;
  discountPercentage: number;
  isActive: boolean;
  createdAt: string;
  imageUrl?: string;
  startDate?: string;
  endDate?: string;
  position: number;
  viewCount: number;
  purchaseCount: number;
  items: BundleItem[];
  totalOriginalPrice: number;
  bundlePrice: number;
  savingsAmount: number;
  productCount: number;
}

export interface BundleListResponse {
  bundles: Bundle[];
  total: number;
  limit: number;
  offset: number;
}

export interface AddBundleToCartItem {
  product: BundleProduct;
  quantity: number;
  selectedColor: string;
  selectedSize: string;
  ean13: string;
  image: string;
}

export interface AddBundleToCartResult {
  success: boolean;
  itemsToAdd: AddBundleToCartItem[];
  addedCount: number;
  unavailableItems: Array<{
    productId: string;
    title?: string;
    reason: string;
  }>;
  bundleDiscount: number;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class BundleService {
  private readonly apiUrl = `${environementDev.backendAiUrl}/api/bundles`;

  // Cache for featured bundles
  private featuredBundlesSubject = new BehaviorSubject<Bundle[]>([]);
  public featuredBundles$ = this.featuredBundlesSubject.asObservable();

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
   * Get all active bundles
   */
  getBundles(options: {
    limit?: number;
    offset?: number;
    activeOnly?: boolean;
  } = {}): Observable<BundleListResponse> {
    let params = new HttpParams();

    if (options.limit) params = params.set('limit', options.limit.toString());
    if (options.offset) params = params.set('offset', options.offset.toString());
    if (options.activeOnly !== undefined) params = params.set('active_only', options.activeOnly.toString());

    return this.http.get<BundleListResponse>(this.apiUrl, { params }).pipe(
      catchError(error => {
        console.error('Error fetching bundles:', error);
        return of({ bundles: [], total: 0, limit: 10, offset: 0 });
      })
    );
  }

  /**
   * Get featured bundles for homepage display
   */
  getFeaturedBundles(limit: number = 4): Observable<Bundle[]> {
    return this.http.get<{ bundles: Bundle[] }>(`${this.apiUrl}/featured`, {
      params: new HttpParams().set('limit', limit.toString())
    }).pipe(
      map(response => response.bundles || []),
      tap(bundles => this.featuredBundlesSubject.next(bundles)),
      catchError(error => {
        console.error('Error fetching featured bundles:', error);
        return of([]);
      })
    );
  }

  /**
   * Get bundle by ID with all product details
   */
  getBundle(bundleId: number): Observable<{ bundle: Bundle; isActive: boolean } | null> {
    return this.http.get<{ bundle: Bundle; isActive: boolean }>(`${this.apiUrl}/${bundleId}`).pipe(
      catchError(error => {
        console.error('Error fetching bundle:', error);
        return of(null);
      })
    );
  }

  /**
   * Add all items from a bundle to cart (requires authentication)
   * Returns items that should be added to cart on the client side
   */
  addBundleToCart(bundleId: number, options: {
    selectedVariants?: Record<string, string>;
  } = {}): Observable<AddBundleToCartResult> {
    return this.http.post<AddBundleToCartResult>(
      `${this.apiUrl}/${bundleId}/add-to-cart`,
      { selected_variants: options.selectedVariants || {} },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => {
        console.error('Error adding bundle to cart:', error);
        return of({
          success: false,
          itemsToAdd: [],
          addedCount: 0,
          unavailableItems: [],
          bundleDiscount: 0,
          message: error.error?.detail || 'Erreur lors de l\'ajout au panier'
        });
      })
    );
  }

  /**
   * Calculate bundle pricing
   */
  calculateBundlePrice(bundle: Bundle): {
    originalPrice: number;
    bundlePrice: number;
    savings: number;
  } {
    return {
      originalPrice: bundle.totalOriginalPrice,
      bundlePrice: bundle.bundlePrice,
      savings: bundle.savingsAmount
    };
  }

  /**
   * Format price in TND
   */
  formatPrice(price: number): string {
    return price.toFixed(3) + ' TND';
  }

  /**
   * Check if bundle is currently available
   */
  isBundleAvailable(bundle: Bundle): boolean {
    if (!bundle.isActive) return false;

    const now = new Date();

    if (bundle.startDate && new Date(bundle.startDate) > now) {
      return false;
    }

    if (bundle.endDate && new Date(bundle.endDate) < now) {
      return false;
    }

    // Check if all products have at least one available item
    const availableProducts = bundle.items.filter(item => item.product && item.product.isAvailable);
    return availableProducts.length > 0;
  }

  /**
   * Get the first product images for bundle preview
   */
  getBundlePreviewImages(bundle: Bundle, maxImages: number = 4): string[] {
    return bundle.items
      .filter(item => item.product && item.product.firstImageUrl)
      .slice(0, maxImages)
      .map(item => item.product!.firstImageUrl);
  }
}
