/**
 * BARSHA STOCK ALERT SERVICE
 * ============================
 * Manages back-in-stock alerts for out-of-stock products.
 * Supports both logged-in users and guest users (via email).
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';

export interface StockAlert {
  id: number;
  user_id?: number;
  email?: string;
  product_id: string;
  size?: string;
  color?: string;
  is_notified: boolean;
  created_at: string;
  notified_at?: string;
  product_name?: string;
  product_image?: string;
  product_price?: string;
}

export interface CreateStockAlertRequest {
  product_id: string;
  email?: string;
  size?: string;
  color?: string;
  product_name?: string;
  product_image?: string;
  product_price?: string;
}

export interface StockAlertResponse {
  success: boolean;
  message: string;
  alert: StockAlert;
  already_subscribed: boolean;
}

export interface MyAlertsResponse {
  alerts: StockAlert[];
  stats: {
    active: number;
    notified: number;
    total: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CheckAlertResponse {
  has_alert: boolean;
  alert_id?: number;
  size?: string;
  color?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StockAlertService {
  private readonly apiUrl = `${environementDev.backendAiUrl}/api/stock-alerts`;

  // Track alerts locally for quick checks
  private alertsMapSubject = new BehaviorSubject<Map<string, StockAlert[]>>(new Map());
  public alertsMap$ = this.alertsMapSubject.asObservable();

  constructor(private http: HttpClient) {
    // Load alerts on init if user is logged in
    if (localStorage.getItem('jwt')) {
      this.loadMyAlerts();
    }
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwt');
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  /**
   * Create a back-in-stock alert
   * @param productId Product ID to track
   * @param email Email for guest users (optional if logged in)
   * @param size Specific size to track (optional)
   * @param color Specific color to track (optional)
   * @param productName Product name for display
   * @param productImage Product image URL
   * @param productPrice Product price string
   */
  createAlert(
    productId: string,
    email?: string,
    size?: string,
    color?: string,
    productName?: string,
    productImage?: string,
    productPrice?: string
  ): Observable<StockAlertResponse> {
    const request: CreateStockAlertRequest = {
      product_id: productId,
      email,
      size,
      color,
      product_name: productName,
      product_image: productImage,
      product_price: productPrice
    };

    return this.http.post<StockAlertResponse>(
      this.apiUrl,
      request,
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.alert) {
          this.addToLocalMap(productId, response.alert);
        }
      }),
      catchError(error => {
        console.error('Error creating stock alert:', error);
        throw error;
      })
    );
  }

  /**
   * Get all stock alerts for the current user
   */
  getMyAlerts(page: number = 1, limit: number = 20, includeNotified: boolean = false): Observable<MyAlertsResponse> {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('limit', limit.toString());
    params.set('include_notified', includeNotified.toString());

    return this.http.get<MyAlertsResponse>(
      `${this.apiUrl}/my-alerts?${params.toString()}`,
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
        this.updateLocalMapFromAlerts(response.alerts);
      }),
      catchError(error => {
        console.error('Error fetching stock alerts:', error);
        return of({
          alerts: [],
          stats: { active: 0, notified: 0, total: 0 },
          pagination: { page: 1, limit: 20, total: 0, pages: 0 }
        });
      })
    );
  }

  /**
   * Delete a stock alert
   */
  deleteAlert(alertId: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.apiUrl}/${alertId}`,
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.removeFromLocalMap(alertId);
        }
      }),
      catchError(error => {
        console.error('Error deleting stock alert:', error);
        throw error;
      })
    );
  }

  /**
   * Check if user has an alert for a specific product
   */
  hasAlert(productId: string, size?: string, color?: string, email?: string): Observable<CheckAlertResponse> {
    const params = new URLSearchParams();
    if (size) params.set('size', size);
    if (color) params.set('color', color);
    if (email) params.set('email', email);

    return this.http.post<CheckAlertResponse>(
      `${this.apiUrl}/check/${productId}?${params.toString()}`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => {
        console.error('Error checking stock alert:', error);
        return of({ has_alert: false, alert_id: undefined, size: undefined, color: undefined });
      })
    );
  }

  /**
   * Check locally if user has alert for product (synchronous)
   */
  hasAlertLocal(productId: string): boolean {
    const alerts = this.alertsMapSubject.value.get(productId);
    return alerts !== undefined && alerts.length > 0;
  }

  /**
   * Get alerts for a specific product from local cache
   */
  getAlertsForProduct(productId: string): StockAlert[] {
    return this.alertsMapSubject.value.get(productId) || [];
  }

  // ========================================================================
  // Local State Management
  // ========================================================================

  private loadMyAlerts(): void {
    this.getMyAlerts().subscribe();
  }

  private addToLocalMap(productId: string, alert: StockAlert): void {
    const current = this.alertsMapSubject.value;
    const existing = current.get(productId) || [];

    // Check if alert already exists
    const exists = existing.some(a => a.id === alert.id);
    if (!exists) {
      existing.push(alert);
      current.set(productId, existing);
      this.alertsMapSubject.next(new Map(current));
    }
  }

  private removeFromLocalMap(alertId: number): void {
    const current = this.alertsMapSubject.value;
    let removed = false;

    current.forEach((alerts, productId) => {
      const filtered = alerts.filter(a => a.id !== alertId);
      if (filtered.length !== alerts.length) {
        removed = true;
        if (filtered.length === 0) {
          current.delete(productId);
        } else {
          current.set(productId, filtered);
        }
      }
    });

    if (removed) {
      this.alertsMapSubject.next(new Map(current));
    }
  }

  private updateLocalMapFromAlerts(alerts: StockAlert[]): void {
    const newMap = new Map<string, StockAlert[]>();

    alerts.forEach(alert => {
      if (!alert.is_notified) {
        const existing = newMap.get(alert.product_id) || [];
        existing.push(alert);
        newMap.set(alert.product_id, existing);
      }
    });

    this.alertsMapSubject.next(newMap);
  }

  /**
   * Clear local state (call on logout)
   */
  clearLocalState(): void {
    this.alertsMapSubject.next(new Map());
  }

  /**
   * Refresh alerts from server
   */
  refreshAlerts(): void {
    if (localStorage.getItem('jwt')) {
      this.loadMyAlerts();
    }
  }
}
