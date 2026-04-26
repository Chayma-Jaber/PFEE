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

  // Categories
  getCategories(): Observable<{ categories: any[] }> {
    return this.http.get<{ categories: any[] }>(
      `${this.apiUrl}/admin/categories`,
      { headers: this.getHeaders() }
    ).pipe(catchError(() => of({ categories: [] })));
  }

  getCategory(id: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/admin/categories/${id}`,
      { headers: this.getHeaders() }
    );
  }

  createCategory(data: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/admin/categories`,
      data,
      { headers: this.getHeaders() }
    );
  }

  updateCategory(id: number, data: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/admin/categories/${id}`,
      data,
      { headers: this.getHeaders() }
    );
  }

  toggleCategory(id: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/admin/categories/${id}/toggle`,
      {},
      { headers: this.getHeaders() }
    );
  }

  deleteCategory(id: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/admin/categories/${id}`,
      { headers: this.getHeaders() }
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // ADVANCED MODULES (10 new modules)
  // ═══════════════════════════════════════════════════════════════

  // 1. Customer 360°
  getCustomer360(userId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/customers/${userId}/360`, { headers: this.getHeaders() })
      .pipe(catchError(() => of(null)));
  }

  // 2. Activity Log
  getActivityLog(params: any = {}): Observable<any> {
    let p = new HttpParams();
    Object.keys(params).forEach(k => { if (params[k] != null && params[k] !== '') p = p.set(k, params[k]); });
    return this.http.get(`${this.apiUrl}/admin/activity-log`, { headers: this.getHeaders(), params: p })
      .pipe(catchError(() => of({ items: [], total: 0, pages: 0 })));
  }

  // 3. Search Analytics
  getSearchAnalytics(days: number = 30): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/search-analytics?days=${days}`, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ totalQueries: 0, topQueries: [], noResultQueries: [] })));
  }

  trackSearchQuery(query: string, resultCount: number, indexName?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/search-analytics/track`,
      { query, resultCount, indexName },
      { headers: this.getHeaders() }
    ).pipe(catchError(() => of({ recorded: false })));
  }

  // 4. Abandoned Carts
  getAbandonedCarts(hours: number = 24, limit: number = 50): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/abandoned-carts?hours=${hours}&limit=${limit}`, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ items: [], totalValue: 0 })));
  }

  sendAbandonedCartRecovery(userId: number, discountPercent: number = 10, message?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/abandoned-carts/recover`,
      { userId, discountPercent, message },
      { headers: this.getHeaders() });
  }

  // 5. Stock Movements
  getStockMovements(params: any = {}): Observable<any> {
    let p = new HttpParams();
    Object.keys(params).forEach(k => { if (params[k] != null && params[k] !== '') p = p.set(k, params[k]); });
    return this.http.get(`${this.apiUrl}/admin/stock-movements`, { headers: this.getHeaders(), params: p })
      .pipe(catchError(() => of({ items: [], total: 0, pages: 0 })));
  }

  addStockMovement(productId: number, newStock: number, reason?: string, notes?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/stock-movements`,
      { productId, newStock, reason, notes },
      { headers: this.getHeaders() });
  }

  // 6. Products CSV
  exportProductsCsvUrl(): string {
    return `${this.apiUrl}/admin/products/export/csv`;
  }

  importProductsCsv(csv: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/products/import/csv`, { csv }, { headers: this.getHeaders() });
  }

  // 7. Newsletter Campaigns
  getCampaigns(): Observable<{ items: any[] }> {
    return this.http.get<{ items: any[] }>(`${this.apiUrl}/admin/campaigns`, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ items: [] })));
  }

  createCampaign(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/campaigns`, data, { headers: this.getHeaders() });
  }

  updateCampaign(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/admin/campaigns/${id}`, data, { headers: this.getHeaders() });
  }

  sendCampaign(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/campaigns/${id}/send`, {}, { headers: this.getHeaders() });
  }

  deleteCampaignById(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/admin/campaigns/${id}`, { headers: this.getHeaders() });
  }

  // 8. Segments
  getSegments(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/segments`, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ totalCustomers: 0, segments: {}, definitions: {} })));
  }

  // 9. SEO
  getSeoProducts(page: number = 1, limit: number = 20, missing?: boolean): Observable<any> {
    let url = `${this.apiUrl}/admin/seo/products?page=${page}&limit=${limit}`;
    if (missing) url += '&missing=true';
    return this.http.get(url, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ items: [], total: 0 })));
  }

  updateSeoProduct(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/admin/seo/products/${id}`, data, { headers: this.getHeaders() });
  }

  getSeoCategories(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/seo/categories`, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ items: [] })));
  }

  updateSeoCategory(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/admin/seo/categories/${id}`, data, { headers: this.getHeaders() });
  }

  // 10. Pricing Rules
  getPricingRules(): Observable<{ items: any[] }> {
    return this.http.get<{ items: any[] }>(`${this.apiUrl}/admin/pricing-rules`, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ items: [] })));
  }

  createPricingRule(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/pricing-rules`, data, { headers: this.getHeaders() });
  }

  updatePricingRule(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/admin/pricing-rules/${id}`, data, { headers: this.getHeaders() });
  }

  togglePricingRule(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/pricing-rules/${id}/toggle`, {}, { headers: this.getHeaders() });
  }

  deletePricingRule(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/admin/pricing-rules/${id}`, { headers: this.getHeaders() });
  }

  // ═══════════════════════════════════════════════════════════════
  // WAVE 2 — Advanced real-work modules (20)
  // ═══════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════
  // WAVE 4 — CRM + Ops + BI
  // ═══════════════════════════════════════════════════════════════
  w4_customerTags(userId: number): Observable<any> { return this.http.get(`${this.apiUrl}/admin/wave4/customers/${userId}/tags`, { headers: this.getHeaders() }).pipe(catchError(() => of({ items: [] }))); }
  w4_addCustomerTag(userId: number, tag: string, color?: string): Observable<any> { return this.http.post(`${this.apiUrl}/admin/wave4/customers/${userId}/tags`, { tag, color }, { headers: this.getHeaders() }); }
  w4_customerNotes(userId: number): Observable<any> { return this.http.get(`${this.apiUrl}/admin/wave4/customers/${userId}/notes`, { headers: this.getHeaders() }).pipe(catchError(() => of({ items: [] }))); }
  w4_addCustomerNote(userId: number, note: string): Observable<any> { return this.http.post(`${this.apiUrl}/admin/wave4/customers/${userId}/notes`, { note }, { headers: this.getHeaders() }); }
  w4_slaReport(): Observable<any> { return this.http.get(`${this.apiUrl}/admin/wave4/support/sla-report`, { headers: this.getHeaders() }).pipe(catchError(() => of({ breaches: [] }))); }
  w4_listTasks(status?: string): Observable<any> { const u = status ? `?status=${status}` : ''; return this.http.get(`${this.apiUrl}/admin/wave4/tasks${u}`, { headers: this.getHeaders() }).pipe(catchError(() => of({ items: [] }))); }
  w4_createTask(data: any): Observable<any> { return this.http.post(`${this.apiUrl}/admin/wave4/tasks`, data, { headers: this.getHeaders() }); }
  w4_updateTask(id: number, data: any): Observable<any> { return this.http.put(`${this.apiUrl}/admin/wave4/tasks/${id}`, data, { headers: this.getHeaders() }); }
  w4_deleteTask(id: number): Observable<any> { return this.http.delete(`${this.apiUrl}/admin/wave4/tasks/${id}`, { headers: this.getHeaders() }); }
  w4_slots(): Observable<any> { return this.http.get(`${this.apiUrl}/admin/wave4/delivery-slots`, { headers: this.getHeaders() }).pipe(catchError(() => of({ items: [] }))); }
  w4_createSlot(data: any): Observable<any> { return this.http.post(`${this.apiUrl}/admin/wave4/delivery-slots`, data, { headers: this.getHeaders() }); }
  w4_pickups(): Observable<any> { return this.http.get(`${this.apiUrl}/admin/wave4/pickup-locations`, { headers: this.getHeaders() }).pipe(catchError(() => of({ items: [] }))); }
  w4_createPickup(data: any): Observable<any> { return this.http.post(`${this.apiUrl}/admin/wave4/pickup-locations`, data, { headers: this.getHeaders() }); }
  w4_computeSignals(): Observable<any> { return this.http.post(`${this.apiUrl}/admin/wave4/signals/compute`, {}, { headers: this.getHeaders() }); }
  w4_topClv(limit = 10): Observable<any> { return this.http.get(`${this.apiUrl}/admin/wave4/signals/top-clv?limit=${limit}`, { headers: this.getHeaders() }).pipe(catchError(() => of({ items: [] }))); }
  w4_atRisk(limit = 20): Observable<any> { return this.http.get(`${this.apiUrl}/admin/wave4/signals/at-risk?limit=${limit}`, { headers: this.getHeaders() }).pipe(catchError(() => of({ items: [] }))); }
  w4_deals(): Observable<any> { return this.http.get(`${this.apiUrl}/admin/wave4/daily-deals`, { headers: this.getHeaders() }).pipe(catchError(() => of({ items: [] }))); }
  w4_createDeal(data: any): Observable<any> { return this.http.post(`${this.apiUrl}/admin/wave4/daily-deals`, data, { headers: this.getHeaders() }); }
  w4_deleteDeal(id: number): Observable<any> { return this.http.delete(`${this.apiUrl}/admin/wave4/daily-deals/${id}`, { headers: this.getHeaders() }); }
  w4_ugcList(status = 'PENDING'): Observable<any> { return this.http.get(`${this.apiUrl}/admin/wave4/ugc?status=${status}`, { headers: this.getHeaders() }).pipe(catchError(() => of({ items: [] }))); }
  w4_approveUgc(id: number): Observable<any> { return this.http.post(`${this.apiUrl}/admin/wave4/ugc/${id}/approve`, {}, { headers: this.getHeaders() }); }
  w4_rejectUgc(id: number): Observable<any> { return this.http.post(`${this.apiUrl}/admin/wave4/ugc/${id}/reject`, {}, { headers: this.getHeaders() }); }
  w4_lookalikes(seg = 'VIP'): Observable<any> { return this.http.get(`${this.apiUrl}/admin/wave4/lookalikes?fromSegment=${seg}`, { headers: this.getHeaders() }).pipe(catchError(() => of({ items: [] }))); }
  w4_stockoutForecast(leadDays = 7): Observable<any> { return this.http.get(`${this.apiUrl}/admin/wave4/stockout-forecast?leadDays=${leadDays}`, { headers: this.getHeaders() }).pipe(catchError(() => of({ items: [] }))); }
  w4_exportCsvUrl(resource: string): string { return `${this.apiUrl}/admin/wave4/export/${resource}`; }
  w4_auditDiff(params: any = {}): Observable<any> { let p = new HttpParams(); Object.keys(params).forEach(k => { if (params[k] != null && params[k] !== '') p = p.set(k, params[k]); }); return this.http.get(`${this.apiUrl}/admin/wave4/audit-diff`, { headers: this.getHeaders(), params: p }).pipe(catchError(() => of({ items: [], total: 0 }))); }
  w4_referrals(): Observable<any> { return this.http.get(`${this.apiUrl}/admin/wave4/referrals`, { headers: this.getHeaders() }).pipe(catchError(() => of({ items: [] }))); }

  // ═══════════════════════════════════════════════════════════════
  // SHIPPING (Wave 3 productization)
  // ═══════════════════════════════════════════════════════════════
  sh_providers(): Observable<any> {
    return this.http.get(`${this.apiUrl}/shipping/providers`).pipe(catchError(() => of({ providers: [] })));
  }
  sh_estimate(city: string, weight = 1): Observable<any> {
    return this.http.get(`${this.apiUrl}/shipping/estimate?city=${encodeURIComponent(city)}&weight=${weight}`)
      .pipe(catchError(() => of({ estimates: [] })));
  }
  sh_list(params: any = {}): Observable<any> {
    let p = new HttpParams();
    Object.keys(params).forEach(k => { if (params[k] != null && params[k] !== '') p = p.set(k, params[k]); });
    return this.http.get(`${this.apiUrl}/admin/shipments`, { headers: this.getHeaders(), params: p })
      .pipe(catchError(() => of({ items: [], total: 0, pages: 0 })));
  }
  sh_getByOrder(orderId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/shipments/by-order/${orderId}`, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ shipment: null })));
  }
  sh_create(orderId: number, provider: string, weightKg = 1, note?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/shipments`, { orderId, provider, weightKg, note }, { headers: this.getHeaders() });
  }
  sh_pushStatus(id: number, status: string, note?: string, location?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/shipments/${id}/status`, { status, note, location }, { headers: this.getHeaders() });
  }
  sh_sync(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/shipments/${id}/sync`, {}, { headers: this.getHeaders() });
  }
  sh_cancel(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/shipments/${id}/cancel`, {}, { headers: this.getHeaders() });
  }

  // ═══════════════════════════════════════════════════════════════
  // Wave 3 admin methods
  // ═══════════════════════════════════════════════════════════════
  w3_listBlocks(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/wave3/homepage-blocks`, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ items: [] })));
  }
  w3_createBlock(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/wave3/homepage-blocks`, data, { headers: this.getHeaders() });
  }
  w3_updateBlock(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/admin/wave3/homepage-blocks/${id}`, data, { headers: this.getHeaders() });
  }
  w3_deleteBlock(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/admin/wave3/homepage-blocks/${id}`, { headers: this.getHeaders() });
  }
  w3_listTests(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/wave3/ab-tests`, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ items: [] })));
  }
  w3_createTest(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/wave3/ab-tests`, data, { headers: this.getHeaders() });
  }
  w3_testResults(key: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/wave3/ab-tests/${key}/results`, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ variants: [] })));
  }
  w3_sendToSegment(campaignId: number, segment: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/wave3/campaigns/${campaignId}/send-to-segment`, { segment }, { headers: this.getHeaders() });
  }
  w3_getMerchandising(categoryId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/wave3/merchandising/${categoryId}`, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ positions: [] })));
  }
  w3_reorderCategory(categoryId: number, productIds: number[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/wave3/merchandising/${categoryId}/reorder`, { productIds }, { headers: this.getHeaders() });
  }

  w2_trending(days = 7, limit = 12): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/wave2/trending?days=${days}&limit=${limit}`, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ items: [] })));
  }

  w2_reorderSuggestions(threshold = 10): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/wave2/reorder-suggestions?threshold=${threshold}`, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ items: [] })));
  }

  w2_imageHealth(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/wave2/image-health`, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ totalProducts: 0, missing: [], placeholder: [] })));
  }

  w2_funnel(days = 30): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/wave2/funnel?days=${days}`, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ steps: {}, rates: {} })));
  }

  w2_listCanned(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/wave2/canned-responses`, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ items: [] })));
  }
  w2_createCanned(data: any): Observable<any> { return this.http.post(`${this.apiUrl}/admin/wave2/canned-responses`, data, { headers: this.getHeaders() }); }
  w2_deleteCanned(id: number): Observable<any> { return this.http.delete(`${this.apiUrl}/admin/wave2/canned-responses/${id}`, { headers: this.getHeaders() }); }

  w2_listSynonyms(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/wave2/synonyms`, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ items: [] })));
  }
  w2_createSynonym(data: any): Observable<any> { return this.http.post(`${this.apiUrl}/admin/wave2/synonyms`, data, { headers: this.getHeaders() }); }
  w2_deleteSynonym(id: number): Observable<any> { return this.http.delete(`${this.apiUrl}/admin/wave2/synonyms/${id}`, { headers: this.getHeaders() }); }

  w2_rotateFeatured(count = 6): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/wave2/featured/rotate`, { count }, { headers: this.getHeaders() });
  }

  w2_cancelStale(olderThanHours = 24): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/wave2/orders/cancel-stale`, { olderThanHours }, { headers: this.getHeaders() });
  }

  w2_generateDescription(productId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/wave2/products/${productId}/generate-description`, {}, { headers: this.getHeaders() });
  }

  w2_bulkTag(productIds: number[], addTags: string[] = [], removeTags: string[] = []): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/wave2/products/bulk-tag`,
      { productIds, addTags, removeTags }, { headers: this.getHeaders() });
  }

  w2_scheduleCampaign(campaignId: number, sendAt: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/wave2/campaigns/${campaignId}/schedule`,
      { sendAt }, { headers: this.getHeaders() });
  }

  w2_listScheduled(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/wave2/campaigns/scheduled`, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ items: [] })));
  }

  // Notifications (admin broadcast)
  getNotificationStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/notifications/stats`, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ total: 0, unread: 0, totalCustomers: 0 })));
  }

  getRecentNotifications(limit = 20): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/notifications/recent?limit=${limit}`, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ items: [] })));
  }

  broadcastNotification(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/notifications/broadcast`, data, { headers: this.getHeaders() });
  }

  // Bundles
  getBundles(): Observable<{ items: any[] }> {
    return this.http.get<{ items: any[] }>(`${this.apiUrl}/admin/bundles`, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ items: [] })));
  }

  createBundle(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/bundles`, data, { headers: this.getHeaders() });
  }

  updateBundle(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/admin/bundles/${id}`, data, { headers: this.getHeaders() });
  }

  toggleBundle(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/bundles/${id}/toggle`, {}, { headers: this.getHeaders() });
  }

  deleteBundle(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/admin/bundles/${id}`, { headers: this.getHeaders() });
  }

  // Reviews
  getReviews(params: any = {}): Observable<any> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get<any>(`${this.apiUrl}/admin/reviews`, { headers: this.getHeaders(), params: httpParams })
      .pipe(catchError(() => of({ items: [], total: 0, pages: 0, page: 1, limit: 20 })));
  }

  getReviewStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/admin/reviews/stats`, { headers: this.getHeaders() })
      .pipe(catchError(() => of({ total: 0, approved: 0, pending: 0, averageRating: 0, fiveStars: 0, oneStars: 0 })));
  }

  approveReview(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/reviews/${id}/approve`, {}, { headers: this.getHeaders() });
  }

  rejectReview(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/reviews/${id}/reject`, {}, { headers: this.getHeaders() });
  }

  deleteReview(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/admin/reviews/${id}`, { headers: this.getHeaders() });
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
    return this.http.patch(
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
    // Map generic status to the real backend endpoints
    const s = (status || '').toLowerCase();
    if (s === 'approved' || s === 'approve') {
      return this.http.patch(
        `${this.apiUrl}/admin/returns/${id}/approve`,
        { admin_notes: notes || '' },
        { headers: this.getHeaders() }
      );
    }
    if (s === 'rejected' || s === 'reject') {
      return this.http.patch(
        `${this.apiUrl}/admin/returns/${id}/reject`,
        { admin_notes: notes || '' },
        { headers: this.getHeaders() }
      );
    }
    // Fallback
    return this.http.post(
      `${this.apiUrl}/admin/returns/${id}/status`,
      { status, notes },
      { headers: this.getHeaders() }
    );
  }

  approveReturn(id: number, notes?: string): Observable<any> {
    return this.http.patch(
      `${this.apiUrl}/admin/returns/${id}/approve`,
      { admin_notes: notes || '' },
      { headers: this.getHeaders() }
    );
  }

  rejectReturn(id: number, notes?: string): Observable<any> {
    return this.http.patch(
      `${this.apiUrl}/admin/returns/${id}/reject`,
      { admin_notes: notes || '' },
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
