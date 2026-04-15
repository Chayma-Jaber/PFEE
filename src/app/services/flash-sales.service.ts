import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { environementDev } from '../../environements/environementDev';

export interface FlashSaleProduct {
  id: number;
  sku: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  currentPrice: number;
  flashSalePrice: number;
  flashSaleDiscount: number;
  flashSaleEndTime: string;
  stockRemaining: number;
  firstImageUrl: string;
  secondImageUrl?: string;
  discount: boolean;
  discountValue: number;
  isAvailable: boolean;
  totalStock: number;
  variants?: any[];
}

export interface FlashSale {
  id: number;
  name: string;
  description: string;
  discountPercentage: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  isCurrentlyActive: boolean;
  isUpcoming: boolean;
  isEnded: boolean;
  timeRemainingSeconds: number;
  bannerImage: string;
  bannerMobileImage?: string;
  backgroundColor: string;
  textColor: string;
  showOnHomepage: boolean;
  priority: number;
  productCount: number;
  products?: FlashSaleProduct[];
}

export interface PromoCodeValidation {
  valid: boolean;
  code: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountAmount?: number;
  minPurchase?: number;
  message: string;
}

export interface PromoCodeInfo {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minPurchase?: number;
  maxDiscount?: number;
  expiresAt?: string;
  description?: string;
  isValid: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FlashSalesService {
  private apiUrl = environementDev.backendAiUrl || environementDev.api;

  constructor(private http: HttpClient) {}

  /**
   * Get all active flash sales
   */
  getActiveFlashSales(includeUpcoming: boolean = false): Observable<FlashSale[]> {
    const params = includeUpcoming ? '?include_upcoming=true' : '';
    return this.http.get<{ flashSales: FlashSale[]; count: number }>(
      `${this.apiUrl}/api/promotions/flash-sales${params}`
    ).pipe(
      map(response => response.flashSales),
      catchError(error => {
        console.error('Error fetching flash sales:', error);
        return of([]);
      })
    );
  }

  /**
   * Get flash sales to display on homepage
   */
  getHomepageFlashSales(limit: number = 3): Observable<FlashSale[]> {
    return this.http.get<{ flashSales: FlashSale[]; count: number }>(
      `${this.apiUrl}/api/promotions/flash-sales/homepage?limit=${limit}`
    ).pipe(
      map(response => response.flashSales),
      catchError(error => {
        console.error('Error fetching homepage flash sales:', error);
        return of([]);
      })
    );
  }

  /**
   * Get a specific flash sale with its products
   */
  getFlashSale(id: number): Observable<FlashSale | null> {
    return this.http.get<FlashSale>(
      `${this.apiUrl}/api/promotions/flash-sales/${id}`
    ).pipe(
      catchError(error => {
        console.error('Error fetching flash sale:', error);
        return of(null);
      })
    );
  }

  /**
   * Get products for a flash sale with pagination
   */
  getFlashSaleProducts(
    flashSaleId: number,
    page: number = 1,
    limit: number = 20
  ): Observable<{
    flashSale: { id: number; name: string; discountPercentage: number; endTime: string; timeRemainingSeconds: number };
    products: FlashSaleProduct[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    return this.http.get<any>(
      `${this.apiUrl}/api/promotions/flash-sales/${flashSaleId}/products?page=${page}&limit=${limit}`
    ).pipe(
      catchError(error => {
        console.error('Error fetching flash sale products:', error);
        return of({
          flashSale: { id: flashSaleId, name: '', discountPercentage: 0, endTime: '', timeRemainingSeconds: 0 },
          products: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
        });
      })
    );
  }

  /**
   * Validate a promo code
   */
  validatePromoCode(code: string, orderTotal: number): Observable<PromoCodeValidation> {
    return this.http.post<PromoCodeValidation>(
      `${this.apiUrl}/api/promotions/validate-code`,
      { code, order_total: orderTotal }
    ).pipe(
      catchError(error => {
        console.error('Error validating promo code:', error);
        return of({
          valid: false,
          code: code,
          message: 'Erreur lors de la validation du code'
        });
      })
    );
  }

  /**
   * Get public info about a promo code
   */
  getPromoCodeInfo(code: string): Observable<PromoCodeInfo | null> {
    return this.http.get<PromoCodeInfo>(
      `${this.apiUrl}/api/promotions/codes/${code}`
    ).pipe(
      catchError(error => {
        console.error('Error fetching promo code info:', error);
        return of(null);
      })
    );
  }

  /**
   * Calculate remaining time components from seconds
   */
  calculateTimeRemaining(seconds: number): { days: number; hours: number; minutes: number; seconds: number } {
    if (seconds <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return { days, hours, minutes, seconds: secs };
  }

  /**
   * Check if flash sale is urgent (less than 1 hour remaining)
   */
  isUrgent(endTime: string): boolean {
    const now = new Date();
    const end = new Date(endTime);
    const diffMs = end.getTime() - now.getTime();
    const oneHour = 60 * 60 * 1000;
    return diffMs > 0 && diffMs < oneHour;
  }

  /**
   * Format discount for display
   */
  formatDiscount(discountType: 'percentage' | 'fixed', discountValue: number): string {
    if (discountType === 'percentage') {
      return `-${discountValue}%`;
    }
    return `-${discountValue.toFixed(3)} TND`;
  }
}
