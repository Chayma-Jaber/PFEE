import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of, forkJoin, throwError } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';
import { CartService, CartItem } from './cart.service';
import { OrderService } from './order.service';

export interface SavedAddress {
  id: number;
  label: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  isDefault: boolean;
}

export interface SavedPaymentMethod {
  id: string;
  type: 'visa' | 'mastercard' | 'amex' | 'other';
  lastFourDigits: string;
  expiryMonth: string;
  expiryYear: string;
  cardholderName: string;
  isDefault: boolean;
}

export interface ExpressCheckoutInfo {
  defaultAddress: SavedAddress | null;
  defaultPaymentMethod: SavedPaymentMethod | null;
  hasCompleteInfo: boolean;
}

export interface ExpressCheckoutResult {
  success: boolean;
  orderId?: number;
  paymentUrl?: string;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExpressCheckoutService {
  private apiUrl = environementDev.api;

  // BehaviorSubjects for reactive updates
  private savedAddressesSubject = new BehaviorSubject<SavedAddress[]>([]);
  private savedPaymentMethodsSubject = new BehaviorSubject<SavedPaymentMethod[]>([]);
  private expressCheckoutAvailableSubject = new BehaviorSubject<boolean>(false);

  public savedAddresses$ = this.savedAddressesSubject.asObservable();
  public savedPaymentMethods$ = this.savedPaymentMethodsSubject.asObservable();
  public expressCheckoutAvailable$ = this.expressCheckoutAvailableSubject.asObservable();

  constructor(
    private http: HttpClient,
    private cartService: CartService,
    private orderService: OrderService
  ) {
    // Initialize data if user is authenticated
    if (this.isAuthenticated()) {
      this.loadSavedData();
    }
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwt');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private isAuthenticated(): boolean {
    return !!localStorage.getItem('jwt');
  }

  /**
   * Load all saved data (addresses and payment methods)
   */
  loadSavedData(): void {
    if (!this.isAuthenticated()) {
      this.savedAddressesSubject.next([]);
      this.savedPaymentMethodsSubject.next([]);
      this.expressCheckoutAvailableSubject.next(false);
      return;
    }

    forkJoin({
      addresses: this.fetchSavedAddresses(),
      paymentMethods: this.fetchSavedPaymentMethods()
    }).subscribe({
      next: ({ addresses, paymentMethods }) => {
        this.savedAddressesSubject.next(addresses);
        this.savedPaymentMethodsSubject.next(paymentMethods);
        this.updateExpressCheckoutAvailability();
      },
      error: (err) => {
        console.error('Error loading saved data:', err);
        this.expressCheckoutAvailableSubject.next(false);
      }
    });
  }

  /**
   * Get saved payment methods
   */
  getSavedPaymentMethods(): Observable<SavedPaymentMethod[]> {
    return this.savedPaymentMethods$;
  }

  /**
   * Fetch saved payment methods from API/storage
   */
  private fetchSavedPaymentMethods(): Observable<SavedPaymentMethod[]> {
    // Check localStorage for mock saved payment methods
    const storedMethods = localStorage.getItem('savedPaymentMethods');
    if (storedMethods) {
      try {
        return of(JSON.parse(storedMethods));
      } catch {
        return of([]);
      }
    }
    return of([]);
  }

  /**
   * Get saved addresses
   */
  getSavedAddresses(): Observable<SavedAddress[]> {
    return this.savedAddresses$;
  }

  /**
   * Fetch saved addresses from API
   */
  private fetchSavedAddresses(): Observable<SavedAddress[]> {
    return this.http.get<any>(`${this.apiUrl}/api/getAddresses`, {
      headers: this.getHeaders()
    }).pipe(
      map(response => {
        const rawAddresses = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response)
            ? response
            : Array.isArray(response?.items)
              ? response.items
              : [];

        return rawAddresses.map((addr: any) => ({
          id: Number(addr.id ?? 0),
          label: addr.label || 'Adresse',
          firstName: addr.firstName || addr.first_name || '',
          lastName: addr.lastName || addr.last_name || '',
          phone: addr.phone || '',
          address: addr.address || addr.street || addr.line1 || '',
          city: addr.city || '',
          state: addr.state || '',
          postalCode: addr.postalCode || addr.postal_code || addr.codepost || '',
          country: addr.country || 'Tunisie',
          isDefault: Boolean(addr.isDefault ?? addr.defaultAddress ?? addr.is_default)
        }));
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Get default checkout info (default address and payment method)
   */
  getDefaultCheckoutInfo(): Observable<ExpressCheckoutInfo> {
    return forkJoin({
      addresses: this.fetchSavedAddresses(),
      paymentMethods: this.fetchSavedPaymentMethods()
    }).pipe(
      map(({ addresses, paymentMethods }) => {
        const defaultAddress = addresses.find(a => a.isDefault) || addresses[0] || null;
        const defaultPayment = paymentMethods.find(p => p.isDefault) || paymentMethods[0] || null;

        return {
          defaultAddress,
          defaultPaymentMethod: defaultPayment,
          hasCompleteInfo: !!(defaultAddress && defaultPayment)
        };
      })
    );
  }

  /**
   * Check if express checkout is available for the current user
   */
  isExpressCheckoutAvailable(): Observable<boolean> {
    if (!this.isAuthenticated()) {
      return of(false);
    }

    return this.getDefaultCheckoutInfo().pipe(
      map(info => info.hasCompleteInfo)
    );
  }

  /**
   * Update express checkout availability
   */
  private updateExpressCheckoutAvailability(): void {
    const addresses = this.savedAddressesSubject.value;
    const paymentMethods = this.savedPaymentMethodsSubject.value;

    const hasDefaultAddress = addresses.some(a => a.isDefault) || addresses.length > 0;
    const hasDefaultPayment = paymentMethods.some(p => p.isDefault) || paymentMethods.length > 0;

    this.expressCheckoutAvailableSubject.next(hasDefaultAddress && hasDefaultPayment);
  }

  /**
   * Process express checkout
   */
  processExpressCheckout(cartItems: CartItem[]): Observable<ExpressCheckoutResult> {
    if (!this.isAuthenticated()) {
      return of({ success: false, message: 'Veuillez vous connecter pour utiliser l\'Achat Express' });
    }

    if (cartItems.length === 0) {
      return of({ success: false, message: 'Votre panier est vide' });
    }

    return this.getDefaultCheckoutInfo().pipe(
      switchMap(info => {
        if (!info.defaultAddress) {
          return of({ success: false, message: 'Aucune adresse de livraison enregistree' });
        }
        if (!info.defaultPaymentMethod) {
          return of({ success: false, message: 'Aucun moyen de paiement enregistre' });
        }

        // Build order payload
        const subtotal = cartItems.reduce((sum, item) =>
          sum + (item.product.currentPrice * item.quantity), 0);

        // Default shipping cost for home delivery
        const shippingCost = subtotal >= 200 ? 0 : 8;
        const total = subtotal + shippingCost;

        const payload = {
          orderData: {
            subTotal: parseFloat(subtotal.toFixed(3)),
            shippingMethod: 1, // Home delivery
            paymentMethod: 2, // Card payment (CBE)
            shippingCost: parseFloat(shippingCost.toFixed(3)),
            total: parseFloat(total.toFixed(3)),
            shippingAddress: info.defaultAddress
          },
          products: cartItems.map(item => ({
            sku: item.product?.sku,
            title: item.product?.title,
            image: item.image,
            ean13: item.ean13,
            quantity: item.quantity,
            unitPrice: parseFloat(item.product.currentPrice.toFixed(3)),
            discount: 0,
            discountDesc: ''
          }))
        };

        return this.orderService.placeOrder(payload).pipe(
          switchMap((orderResponse: any) => {
            if (orderResponse.status === 200) {
              const orderId = orderResponse.data.id;
              const redirectUrl = `${environementDev.redirectUrlLocal}/${orderId}`;

              return this.orderService.getCTPTransaction(orderId, redirectUrl).pipe(
                map((ctpResponse: any) => {
                  if (ctpResponse.status === 200) {
                    // Clear cart on successful order
                    this.cartService.clearCart();

                    return {
                      success: true,
                      orderId: orderId,
                      paymentUrl: ctpResponse.data.url
                    };
                  }
                  return { success: false, message: 'Erreur lors de la creation du paiement' };
                }),
                catchError(() => of({ success: false, message: 'Erreur lors de la creation du paiement' }))
              );
            }
            return of({ success: false, message: orderResponse.message || 'Erreur lors de la commande' });
          }),
          catchError((err) => {
            console.error('Express checkout error:', err);
            return of({ success: false, message: 'Erreur lors de la commande express' });
          })
        );
      })
    );
  }

  // ==================== Address Management ====================

  /**
   * Add a new address
   */
  addAddress(address: Omit<SavedAddress, 'id'>): Observable<SavedAddress> {
    const payload = {
      label: address.label,
      firstName: address.firstName,
      lastName: address.lastName,
      phone: address.phone,
      address: address.address,
      city: address.city,
      state: address.state || '',
      postalCode: address.postalCode || '',
      country: address.country || 'Tunisie',
      defaultAddress: address.isDefault
    };

    return this.http.post<any>(`${this.apiUrl}/api/createAddress`, payload, {
      headers: this.getHeaders()
    }).pipe(
      map(response => {
        const newAddress: SavedAddress = {
          id: response.data?.id || Date.now(),
          ...address
        };

        // Update local state
        const currentAddresses = this.savedAddressesSubject.value;
        if (address.isDefault) {
          currentAddresses.forEach(a => a.isDefault = false);
        }
        this.savedAddressesSubject.next([...currentAddresses, newAddress]);
        this.updateExpressCheckoutAvailability();

        return newAddress;
      }),
      catchError(err => {
        console.error('Error adding address:', err);
        return throwError(() => new Error('Erreur lors de l\'ajout de l\'adresse'));
      })
    );
  }

  /**
   * Update an existing address
   */
  updateAddress(address: SavedAddress): Observable<SavedAddress> {
    const payload = {
      id: address.id,
      label: address.label,
      firstName: address.firstName,
      lastName: address.lastName,
      phone: address.phone,
      address: address.address,
      city: address.city,
      state: address.state || '',
      postalCode: address.postalCode || '',
      country: address.country || 'Tunisie',
      defaultAddress: address.isDefault
    };

    return this.http.put<any>(`${this.apiUrl}/api/updateAddress/${address.id}`, payload, {
      headers: this.getHeaders()
    }).pipe(
      map(() => {
        const currentAddresses = this.savedAddressesSubject.value;
        const index = currentAddresses.findIndex(a => a.id === address.id);

        if (index !== -1) {
          if (address.isDefault) {
            currentAddresses.forEach(a => a.isDefault = false);
          }
          currentAddresses[index] = address;
          this.savedAddressesSubject.next([...currentAddresses]);
        }

        return address;
      }),
      catchError(err => {
        console.error('Error updating address:', err);
        return throwError(() => new Error('Erreur lors de la mise a jour de l\'adresse'));
      })
    );
  }

  /**
   * Delete an address
   */
  deleteAddress(addressId: number): Observable<boolean> {
    return this.http.delete<any>(`${this.apiUrl}/api/deleteAddress/${addressId}`, {
      headers: this.getHeaders()
    }).pipe(
      map(() => {
        const currentAddresses = this.savedAddressesSubject.value;
        this.savedAddressesSubject.next(currentAddresses.filter(a => a.id !== addressId));
        this.updateExpressCheckoutAvailability();
        return true;
      }),
      catchError(err => {
        console.error('Error deleting address:', err);
        return of(false);
      })
    );
  }

  /**
   * Set an address as default
   */
  setDefaultAddress(addressId: number): Observable<boolean> {
    return this.http.put<any>(`${this.apiUrl}/api/setDefaultAddress/${addressId}`, {}, {
      headers: this.getHeaders()
    }).pipe(
      map(() => {
        const currentAddresses = this.savedAddressesSubject.value;
        currentAddresses.forEach(a => {
          a.isDefault = a.id === addressId;
        });
        this.savedAddressesSubject.next([...currentAddresses]);
        return true;
      }),
      catchError(() => {
        // Fallback: update locally even if API fails
        const currentAddresses = this.savedAddressesSubject.value;
        currentAddresses.forEach(a => {
          a.isDefault = a.id === addressId;
        });
        this.savedAddressesSubject.next([...currentAddresses]);
        return of(true);
      })
    );
  }

  // ==================== Payment Method Management ====================

  /**
   * Add a new payment method (mock - stored locally)
   */
  addPaymentMethod(paymentMethod: Omit<SavedPaymentMethod, 'id'>): Observable<SavedPaymentMethod> {
    const newMethod: SavedPaymentMethod = {
      id: `pm_${Date.now()}`,
      ...paymentMethod
    };

    const currentMethods = this.savedPaymentMethodsSubject.value;
    if (paymentMethod.isDefault) {
      currentMethods.forEach(m => m.isDefault = false);
    }

    const updatedMethods = [...currentMethods, newMethod];
    this.savedPaymentMethodsSubject.next(updatedMethods);
    this.savePaymentMethodsToStorage(updatedMethods);
    this.updateExpressCheckoutAvailability();

    return of(newMethod);
  }

  /**
   * Delete a payment method
   */
  deletePaymentMethod(methodId: string): Observable<boolean> {
    const currentMethods = this.savedPaymentMethodsSubject.value;
    const updatedMethods = currentMethods.filter(m => m.id !== methodId);

    this.savedPaymentMethodsSubject.next(updatedMethods);
    this.savePaymentMethodsToStorage(updatedMethods);
    this.updateExpressCheckoutAvailability();

    return of(true);
  }

  /**
   * Set a payment method as default
   */
  setDefaultPaymentMethod(methodId: string): Observable<boolean> {
    const currentMethods = this.savedPaymentMethodsSubject.value;
    currentMethods.forEach(m => {
      m.isDefault = m.id === methodId;
    });

    this.savedPaymentMethodsSubject.next([...currentMethods]);
    this.savePaymentMethodsToStorage(currentMethods);

    return of(true);
  }

  /**
   * Save payment methods to localStorage
   */
  private savePaymentMethodsToStorage(methods: SavedPaymentMethod[]): void {
    localStorage.setItem('savedPaymentMethods', JSON.stringify(methods));
  }

  /**
   * Get cart summary for express checkout modal
   */
  getCartSummary(): Observable<{
    items: CartItem[];
    subtotal: number;
    shippingCost: number;
    total: number;
  }> {
    return this.cartService.cartItems$.pipe(
      map(items => {
        const subtotal = items.reduce((sum, item) =>
          sum + (item.product.currentPrice * item.quantity), 0);
        const shippingCost = subtotal >= 200 ? 0 : 8;
        const total = subtotal + shippingCost;

        return {
          items,
          subtotal,
          shippingCost,
          total
        };
      })
    );
  }
}
