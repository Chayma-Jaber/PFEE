import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface DashboardStats {
  orders: {
    total: number;
    pending: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
  };
  revenue: {
    total: number;
    averageOrderValue: number;
    currency: string;
  };
  customers: {
    total: number;
    new: number;
  };
  products: {
    total: number;
    lowStock: number;
    outOfStock: number;
  };
  returns: {
    pending: number;
  };
}

export interface AdminOrder {
  id: number;
  reference: string;
  userId: number;
  status: string;
  paymentStatus: string;
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  totalAmount: number;
  shippingAddress: any;
  items: any[];
  createdAt: string;
  trackingNumber?: string;
  carrierName?: string;
  statusHistory?: any[];
}

export interface AdminProduct {
  id: number;
  sku: string;
  title: string;
  price: number;
  currentPrice: number;
  discount: boolean;
  discountValue: number;
  isActive: boolean;
  totalStock: number;
  firstImageUrl: string;
}

export interface AdminCustomer {
  id: number;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  orderCount: number;
  totalSpent: number;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  // Backend admin API - connects to unified_api.py on port 8000
  // Run: cd backend-ai && python unified_api.py
  private apiUrl = 'http://localhost:8000/api';

  // Demo mode flag - when backend is unavailable, show mock data
  private demoMode = false;
  private backendChecked = false;

  constructor(private http: HttpClient) {
    // Check if backend is available
    this.checkBackendAvailability();
  }

  /**
   * Check if backend is available and has admin features enabled
   */
  private checkBackendAvailability(): void {
    if (this.backendChecked) return;

    this.http.get<any>(`${this.apiUrl.replace('/api', '')}/health`).subscribe({
      next: (response) => {
        this.backendChecked = true;
        // Check if admin feature is available in unified API
        if (response.admin === 'available') {
          this.demoMode = false;
          console.log('Admin backend connected (unified API)');
        } else {
          this.demoMode = true;
          console.warn('Admin features not available in backend - using demo mode');
        }
      },
      error: () => {
        this.backendChecked = true;
        this.demoMode = true;
        console.warn('Admin backend not available - using demo mode with mock data');
      }
    });
  }

  /**
   * Check if running in demo mode
   */
  isDemoMode(): boolean {
    return this.demoMode;
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('admin_jwt') || localStorage.getItem('jwt');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // Dashboard
  getDashboardStats(period: string = 'month'): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(
      `${this.apiUrl}/admin/dashboard/stats?period=${period}`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(err => {
        console.error('Error fetching dashboard stats:', err);
        // Return mock data for demo
        return of(this.getMockDashboardStats());
      })
    );
  }

  getRecentOrders(limit: number = 10): Observable<AdminOrder[]> {
    return this.http.get<AdminOrder[]>(
      `${this.apiUrl}/admin/dashboard/recent-orders?limit=${limit}`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(() => of([]))
    );
  }

  getLowStockAlerts(limit: number = 20): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/admin/dashboard/low-stock-alerts?limit=${limit}`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(() => of([]))
    );
  }

  // Orders
  getOrders(params: any = {}): Observable<{ items: AdminOrder[]; total: number; pages: number }> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined) {
        httpParams = httpParams.set(key, params[key]);
      }
    });

    return this.http.get<any>(
      `${this.apiUrl}/admin/orders`,
      { headers: this.getHeaders(), params: httpParams }
    ).pipe(
      catchError(() => of({ items: [], total: 0, pages: 0 }))
    );
  }

  getOrder(id: number): Observable<AdminOrder | null> {
    return this.http.get<AdminOrder>(
      `${this.apiUrl}/admin/orders/${id}`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(() => of(null))
    );
  }

  updateOrderStatus(id: number, status: string, reason?: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/admin/orders/${id}/status`,
      { status, reason },
      { headers: this.getHeaders() }
    );
  }

  // Products
  getProducts(params: any = {}): Observable<{ items: AdminProduct[]; total: number; pages: number }> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined) {
        httpParams = httpParams.set(key, params[key]);
      }
    });

    return this.http.get<any>(
      `${this.apiUrl}/admin/products`,
      { headers: this.getHeaders(), params: httpParams }
    ).pipe(
      catchError(() => of({ items: [], total: 0, pages: 0 }))
    );
  }

  updateProduct(id: number, data: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/admin/products/${id}`,
      data,
      { headers: this.getHeaders() }
    );
  }

  createProduct(data: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/admin/products`,
      data,
      { headers: this.getHeaders() }
    );
  }

  deleteProduct(id: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/admin/products/${id}`,
      { headers: this.getHeaders() }
    );
  }

  getProduct(id: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/admin/products/${id}`,
      { headers: this.getHeaders() }
    );
  }

  // Customers
  getCustomers(params: any = {}): Observable<{ items: AdminCustomer[]; total: number; pages: number }> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined) {
        httpParams = httpParams.set(key, params[key]);
      }
    });

    return this.http.get<any>(
      `${this.apiUrl}/admin/customers`,
      { headers: this.getHeaders(), params: httpParams }
    ).pipe(
      catchError(() => of({ items: [], total: 0, pages: 0 }))
    );
  }

  getCustomer(id: number): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/admin/customers/${id}`,
      { headers: this.getHeaders() }
    );
  }

  toggleCustomerActive(id: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/admin/customers/${id}/toggle-active`,
      {},
      { headers: this.getHeaders() }
    );
  }

  addCustomerNotes(id: number, notes: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/admin/customers/${id}/notes`,
      { notes },
      { headers: this.getHeaders() }
    );
  }

  getCustomerOrders(id: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/admin/customers/${id}/orders`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(() => of([]))
    );
  }

  // Coupons
  getCoupons(params: any = {}): Observable<{ items: any[]; total: number; pages: number }> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined) {
        httpParams = httpParams.set(key, params[key]);
      }
    });

    return this.http.get<any>(
      `${this.apiUrl}/admin/coupons`,
      { headers: this.getHeaders(), params: httpParams }
    ).pipe(
      catchError(() => of({ items: [], total: 0, pages: 0 }))
    );
  }

  createCoupon(data: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/admin/coupons`,
      data,
      { headers: this.getHeaders() }
    );
  }

  updateCoupon(id: number, data: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/admin/coupons/${id}`,
      data,
      { headers: this.getHeaders() }
    );
  }

  deleteCoupon(id: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/admin/coupons/${id}`,
      { headers: this.getHeaders() }
    );
  }

  // Returns
  getReturns(params: any = {}): Observable<{ items: any[]; total: number; pages: number }> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined) {
        httpParams = httpParams.set(key, params[key]);
      }
    });

    return this.http.get<any>(
      `${this.apiUrl}/admin/returns`,
      { headers: this.getHeaders(), params: httpParams }
    ).pipe(
      catchError(() => of({ items: [], total: 0, pages: 0 }))
    );
  }

  updateReturnStatus(id: number, status: string, notes?: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/admin/returns/${id}/status`,
      { status, notes },
      { headers: this.getHeaders() }
    );
  }

  processRefund(returnId: number, amount: number, method: string = 'original'): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/admin/returns/${returnId}/refund`,
      { amount, refund_method: method },
      { headers: this.getHeaders() }
    );
  }

  assignReturn(returnId: number, agentId: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/admin/returns/${returnId}/assign`,
      { agent_id: agentId },
      { headers: this.getHeaders() }
    );
  }

  // Content
  getBanners(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/admin/content/banners`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(() => of([]))
    );
  }

  updateBanner(id: number, data: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/admin/content/banners/${id}`,
      data,
      { headers: this.getHeaders() }
    );
  }

  // Gift Cards
  getGiftCards(params: any = {}): Observable<{ items: any[]; total: number; pages: number }> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined) {
        httpParams = httpParams.set(key, params[key]);
      }
    });

    return this.http.get<any>(
      `${this.apiUrl}/admin/gift-cards`,
      { headers: this.getHeaders(), params: httpParams }
    ).pipe(
      catchError(() => of({ items: [], total: 0, pages: 0 }))
    );
  }

  getGiftCardStats(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/admin/gift-cards/stats`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(() => of({
        totalCards: 0,
        totalValueOutstanding: 0,
        byStatus: { active: 0, redeemed: 0, expired: 0, cancelled: 0 }
      }))
    );
  }

  getGiftCard(id: number): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/admin/gift-cards/${id}`,
      { headers: this.getHeaders() }
    );
  }

  createGiftCard(data: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/admin/gift-cards`,
      data,
      { headers: this.getHeaders() }
    );
  }

  updateGiftCard(id: number, data: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/admin/gift-cards/${id}`,
      data,
      { headers: this.getHeaders() }
    );
  }

  getGiftCardTransactions(cardId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/admin/gift-cards/${cardId}/transactions`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(() => of([]))
    );
  }

  adjustGiftCardBalance(cardId: number, data: { amount: number; reason: string }): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/admin/gift-cards/${cardId}/adjust`,
      data,
      { headers: this.getHeaders() }
    );
  }

  // Mock data for demo when backend is not available
  private getMockDashboardStats(): DashboardStats {
    return {
      orders: {
        total: 1247,
        pending: 23,
        processing: 45,
        shipped: 67,
        delivered: 1089,
        cancelled: 23
      },
      revenue: {
        total: 187450.500,
        averageOrderValue: 89.750,
        currency: 'TND'
      },
      customers: {
        total: 3456,
        new: 127
      },
      products: {
        total: 892,
        lowStock: 34,
        outOfStock: 12
      },
      returns: {
        pending: 8
      }
    };
  }
}
