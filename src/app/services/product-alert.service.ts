/**
 * BARSHA PRODUCT ALERT SERVICE
 * =============================
 * Manages price drop and back-in-stock alerts for products.
 * Premium feature for customer engagement and re-engagement.
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';

export type AlertType = 'price_drop' | 'back_in_stock';

export interface ProductAlert {
  id: number;
  product_id: number;
  product_name: string;
  product_image?: string;
  product_price: number;
  alert_type: AlertType;
  target_price?: number;  // For price drop alerts
  is_active: boolean;
  created_at: string;
  triggered_at?: string;
  notification_sent: boolean;
}

export interface CreateAlertRequest {
  product_id: number;
  alert_type: AlertType;
  target_price?: number;
  email?: string;  // For guest users
}

export interface AlertStats {
  total_alerts: number;
  price_drop_alerts: number;
  back_in_stock_alerts: number;
  triggered_alerts: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProductAlertService {
  private readonly apiUrl = `${environementDev.backendAiUrl}/api/alerts`;

  // Track active alerts locally
  private activeAlertsSubject = new BehaviorSubject<Map<number, AlertType[]>>(new Map());
  public activeAlerts$ = this.activeAlertsSubject.asObservable();

  constructor(private http: HttpClient) {
    // Load active alerts on init
    this.loadActiveAlerts();
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
   * Subscribe to price drop alert for a product
   */
  subscribePriceDropAlert(productId: number, targetPrice?: number): Observable<ProductAlert> {
    const request: CreateAlertRequest = {
      product_id: productId,
      alert_type: 'price_drop',
      target_price: targetPrice
    };

    return this.http.post<ProductAlert>(
      `${this.apiUrl}/price-drop`,
      request,
      { headers: this.getHeaders() }
    ).pipe(
      tap(alert => this.addToLocalAlerts(productId, 'price_drop')),
      catchError(error => {
        console.error('Error subscribing to price drop alert:', error);
        throw error;
      })
    );
  }

  /**
   * Subscribe to back-in-stock alert for a product
   */
  subscribeBackInStockAlert(productId: number, email?: string): Observable<ProductAlert> {
    const request: CreateAlertRequest = {
      product_id: productId,
      alert_type: 'back_in_stock',
      email: email
    };

    return this.http.post<ProductAlert>(
      `${this.apiUrl}/back-in-stock`,
      request,
      { headers: this.getHeaders() }
    ).pipe(
      tap(alert => this.addToLocalAlerts(productId, 'back_in_stock')),
      catchError(error => {
        console.error('Error subscribing to back-in-stock alert:', error);
        throw error;
      })
    );
  }

  /**
   * Get all active alerts for current user
   */
  getMyAlerts(): Observable<ProductAlert[]> {
    return this.http.get<{ alerts: ProductAlert[] }>(
      `${this.apiUrl}/my-alerts`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.alerts || []),
      tap(alerts => this.updateLocalAlertsFromServer(alerts)),
      catchError(error => {
        console.error('Error fetching alerts:', error);
        return of([]);
      })
    );
  }

  /**
   * Unsubscribe from an alert
   */
  unsubscribeAlert(alertId: number): Observable<boolean> {
    return this.http.delete<{ success: boolean }>(
      `${this.apiUrl}/${alertId}`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.success),
      tap(() => this.loadActiveAlerts()),  // Refresh local state
      catchError(error => {
        console.error('Error unsubscribing from alert:', error);
        return of(false);
      })
    );
  }

  /**
   * Unsubscribe from all alerts for a specific product
   */
  unsubscribeProductAlerts(productId: number): Observable<boolean> {
    return this.http.delete<{ success: boolean }>(
      `${this.apiUrl}/product/${productId}`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.success),
      tap(() => this.removeFromLocalAlerts(productId)),
      catchError(error => {
        console.error('Error unsubscribing from product alerts:', error);
        return of(false);
      })
    );
  }

  /**
   * Check if user has an active alert for a product
   */
  hasActiveAlert(productId: number, alertType?: AlertType): boolean {
    const alerts = this.activeAlertsSubject.value.get(productId) || [];
    if (alertType) {
      return alerts.includes(alertType);
    }
    return alerts.length > 0;
  }

  /**
   * Get alert types active for a product
   */
  getActiveAlertTypes(productId: number): AlertType[] {
    return this.activeAlertsSubject.value.get(productId) || [];
  }

  /**
   * Get alert stats for admin
   */
  getAlertStats(): Observable<AlertStats> {
    return this.http.get<AlertStats>(
      `${this.apiUrl}/stats`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => {
        console.error('Error fetching alert stats:', error);
        return of({
          total_alerts: 0,
          price_drop_alerts: 0,
          back_in_stock_alerts: 0,
          triggered_alerts: 0
        });
      })
    );
  }

  // ========================================================================
  // Local State Management
  // ========================================================================

  private loadActiveAlerts(): void {
    if (!localStorage.getItem('jwt')) {
      // For guests, load from localStorage
      const localAlerts = localStorage.getItem('barsha_product_alerts');
      if (localAlerts) {
        try {
          const parsed = JSON.parse(localAlerts) as Record<string, AlertType[]>;
          const alertMap = new Map<number, AlertType[]>();
          Object.entries(parsed).forEach(([key, value]) => {
            alertMap.set(Number(key), value);
          });
          this.activeAlertsSubject.next(alertMap);
        } catch (e) {
          this.activeAlertsSubject.next(new Map());
        }
      }
      return;
    }

    // For logged-in users, fetch from server
    this.getMyAlerts().subscribe();
  }

  private updateLocalAlertsFromServer(alerts: ProductAlert[]): void {
    const alertMap = new Map<number, AlertType[]>();

    alerts.forEach(alert => {
      if (alert.is_active) {
        const existing = alertMap.get(alert.product_id) || [];
        if (!existing.includes(alert.alert_type)) {
          existing.push(alert.alert_type);
          alertMap.set(alert.product_id, existing);
        }
      }
    });

    this.activeAlertsSubject.next(alertMap);
    this.saveToLocalStorage(alertMap);
  }

  private addToLocalAlerts(productId: number, alertType: AlertType): void {
    const current = this.activeAlertsSubject.value;
    const existing = current.get(productId) || [];
    if (!existing.includes(alertType)) {
      existing.push(alertType);
      current.set(productId, existing);
      this.activeAlertsSubject.next(new Map(current));
      this.saveToLocalStorage(current);
    }
  }

  private removeFromLocalAlerts(productId: number): void {
    const current = this.activeAlertsSubject.value;
    current.delete(productId);
    this.activeAlertsSubject.next(new Map(current));
    this.saveToLocalStorage(current);
  }

  private saveToLocalStorage(alertMap: Map<number, AlertType[]>): void {
    const obj: Record<string, AlertType[]> = {};
    alertMap.forEach((value, key) => {
      obj[key.toString()] = value;
    });
    localStorage.setItem('barsha_product_alerts', JSON.stringify(obj));
  }
}
