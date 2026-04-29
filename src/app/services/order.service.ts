import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CartItem } from './cart.service';
import { environementDev } from '../../environements/environementDev';

@Injectable({
  providedIn: 'root'
})
export class OrderService {

  private apiUrl2 = environementDev.api;
  private localBackendUrl = environementDev.api;  // Local professional backend
  private useLocalBackend = (environementDev as any).useLocalAuth || false;  // Use local backend when in local auth mode

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwt');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getOrders(): Observable<any> {
    return this.http.get(`${environementDev.api}/api/getOrders`, { headers: this.getHeaders() });
  }

  private normalizePaymentMethod(paymentMethod: any): string {
    if (paymentMethod === 'CBE' || paymentMethod === 2 || paymentMethod === '2') {
      return 'CBE';
    }
    return 'COD';
  }

  private normalizeShippingMethod(shippingMethod: any): string {
    if (shippingMethod === 2 || shippingMethod === '2' || shippingMethod === 'store') {
      return 'store';
    }
    return 'home';
  }

  private normalizeShippingAddress(address: any): any {
    if (!address || typeof address !== 'object') {
      return {
        street: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'Tunisia',
        phone: '',
      };
    }

    return {
      street: address.address || address.street || address.line1 || '',
      city: address.city || '',
      state: address.state || address.governorate || '',
      postal_code: address.postalCode || address.postal_code || address.zipCode || '',
      country: address.country || 'Tunisia',
      phone: address.phone || '',
    };
  }

  private normalizeStorePickupAddress(store: any): any {
    if (!store || typeof store !== 'object') {
      return this.normalizeShippingAddress(null);
    }

    return {
      street: store.address || store.name || '',
      city: store.city || '',
      state: store.state || '',
      postal_code: store.postalCode || store.postal_code || '',
      country: store.country || 'Tunisia',
      phone: store.phone || '',
    };
  }

  private normalizeLegacyOrderPayload(orderRequest: any): any {
    if (!orderRequest?.orderData || !Array.isArray(orderRequest?.products)) {
      return orderRequest;
    }

    const shippingMethod = this.normalizeShippingMethod(orderRequest.orderData.shippingMethod);
    const paymentMethod = this.normalizePaymentMethod(orderRequest.orderData.paymentMethod);

    return {
      items: orderRequest.products.map((product: any) => ({
        sku: product.sku || product.reference || '',
        title: product.title || product.name || product.ean13 || 'Produit',
        ean13: product.ean13 || '',
        unit_price: Number(product.unitPrice ?? product.unit_price ?? 0),
        quantity: Number(product.quantity ?? 1),
        variant_info: product.variant_info || null,
        image_url: product.image || product.image_url || null,
      })),
      shipping_address: shippingMethod === 'store'
        ? this.normalizeStorePickupAddress(orderRequest.orderData.shippingStore)
        : this.normalizeShippingAddress(orderRequest.orderData.shippingAddress),
      shipping_method: shippingMethod,
      payment_method: paymentMethod,
      coupon_code: orderRequest.orderData.coupon || orderRequest.orderData.couponCode || null,
      notes: orderRequest.orderData.notes || null,
    };
  }

  private normalizeOrderResponse(response: any): any {
    if (response?.status === 200 && response?.data?.id) {
      return response;
    }

    if (response?.order?.id) {
      return {
        status: 200,
        message: response.message || 'Order created successfully',
        data: response.order,
      };
    }

    return response;
  }

  placeOrder(orderRequest: { orderData: any, products: any[] } | any): Observable<any> {
    const payload = this.normalizeLegacyOrderPayload(orderRequest);
    return this.http.post(`${environementDev.api}/api/orders/create`, payload, { headers: this.getHeaders() }).pipe(
      map((response) => this.normalizeOrderResponse(response))
    );
  }

  private calculateSubtotal(products: any[]): number {
    return products.reduce((sum, item) => sum + (item.product.currentPrice * item.quantity), 0);
  }

  getOrderById(id: number): Observable<any> {
    return this.http.get(`${environementDev.api}/api/getOrderById/${id}`, { headers: this.getHeaders() });
  }

  getCTPTransaction(orderId: number, redirectUrl: string): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('jwt')}`,
      'Content-Type': 'application/json',
    
    });
    const body = {
      orderId: orderId,
      redirectTo: redirectUrl
    };
    return this.http.post(`${environementDev.api}/api/generateCTPTransaction`, body, { headers: headers }).pipe(
      map((response: any) => {
        if (response?.status === 200 && response?.data?.url) {
          return response;
        }

        if (response?.paymentUrl) {
          return {
            status: 200,
            data: {
              url: response.paymentUrl,
              transactionId: response.transactionId || null
            }
          };
        }

        return response;
      })
    );
  }

  checkCTPTransaction(orderId: number): Observable<any> {
    const body = {
      orderId: orderId
    };
    return this.http.post(`${environementDev.api}/api/checkCTPTransaction`, body, { headers: this.getHeaders() });
  }
  
  checkCartProducts(items: any[]): Observable<any> {
    const token = localStorage.getItem('jwt');
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
     
    });

    return this.http.post(`${environementDev.api}/api/checkCartProducts`, items, { headers });
  }

  /**
   * Vérifier les offres disponibles pour les produits du panier
   * @param cartItems - Tableau des articles du panier avec ean13, quantity, unitPrice
   * Cette API n'utilise pas de token (disponible pour les utilisateurs non authentifiés)
   */
  checkCartOffers(cartItems: any[]): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.post(
      `${environementDev.api}/api/checkCartOffers`,
      cartItems,
      { headers }
    );
  }

  // ==================== LOCAL BACKEND INTEGRATION ====================

  /**
   * Create order via local professional backend
   * Uses our own order service with proper lifecycle management
   */
  createOrderLocal(orderData: {
    items: any[];
    shippingAddress: any;
    shippingMethod: string;
    paymentMethod: string;
    couponCode?: string;
  }): Observable<any> {
    const payload = {
      items: orderData.items.map(item => ({
        sku: item.product?.sku || item.sku,
        title: item.product?.title || item.title,
        ean13: item.product?.ean13 || '',
        unit_price: item.product?.currentPrice || item.unitPrice,
        quantity: item.quantity,
        variant_info: item.selectedVariant || null
      })),
      shipping_address: {
        street: orderData.shippingAddress.address || orderData.shippingAddress.street,
        city: orderData.shippingAddress.city,
        state: orderData.shippingAddress.state || '',
        postal_code: orderData.shippingAddress.postalCode || '',
        country: 'Tunisia',
        phone: orderData.shippingAddress.phone
      },
      shipping_method: orderData.shippingMethod,
      payment_method: orderData.paymentMethod,
      coupon_code: orderData.couponCode || null
    };

    return this.http.post(
      `${this.localBackendUrl}/api/orders/create`,
      payload,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Initiate CTP payment via local backend
   * Returns secure payment URL with proper idempotency
   */
  initiateCTPPayment(orderId: number, redirectUrl: string): Observable<any> {
    return this.http.post(
      `${this.localBackendUrl}/api/payment/ctp/initiate`,
      {
        order_id: orderId,
        redirect_url: redirectUrl,
        cancel_url: `${window.location.origin}/checkout/payment-cancelled`
      },
      { headers: this.getHeaders() }
    );
  }

  /**
   * Verify CTP payment status via local backend
   * Double-checks with CTP gateway for accuracy
   */
  verifyCTPPayment(orderId: number): Observable<any> {
    return this.http.get(
      `${this.localBackendUrl}/api/payment/ctp/verify/${orderId}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Retry failed CTP payment
   */
  retryCTPPayment(orderId: number, redirectUrl: string): Observable<any> {
    return this.http.post(
      `${this.localBackendUrl}/api/payment/ctp/retry/${orderId}?redirect_url=${encodeURIComponent(redirectUrl)}`,
      {},
      { headers: this.getHeaders() }
    );
  }

  /**
   * Get order details from local backend
   */
  getOrderLocal(orderId: number): Observable<any> {
    return this.http.get(
      `${this.localBackendUrl}/api/orders/${orderId}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Get user's order history from local backend
   */
  getMyOrdersLocal(page: number = 1, status?: string): Observable<any> {
    let url = `${this.localBackendUrl}/api/orders/my-orders?page=${page}`;
    if (status) {
      url += `&status=${status}`;
    }
    return this.http.get(url, { headers: this.getHeaders() });
  }

  /**
   * Cancel order via local backend
   */
  cancelOrderLocal(orderId: number, reason: string = 'Customer requested'): Observable<any> {
    return this.http.post(
      `${this.localBackendUrl}/api/orders/${orderId}/cancel?reason=${encodeURIComponent(reason)}`,
      {},
      { headers: this.getHeaders() }
    );
  }

  /**
   * Track order via local backend
   */
  trackOrderLocal(orderId: number): Observable<any> {
    return this.http.get(
      `${this.localBackendUrl}/api/orders/${orderId}/track`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Get available payment methods based on delivery type
   */
  getPaymentMethods(deliveryType: string = 'home'): Observable<any> {
    return this.http.get(
      `${this.localBackendUrl}/api/payment/methods?delivery_type=${deliveryType}`
    ).pipe(
      catchError(() => {
        // Fallback to hardcoded methods if backend not available
        return of({
          methods: [
            { id: 'CBE', name: 'Carte bancaire', available: true },
            { id: 'COD', name: 'Paiement à la livraison', available: deliveryType === 'home' }
          ]
        });
      })
    );
  }
}
