/**
 * Gift Card Service
 * =================
 * Handles gift card API interactions.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';

export type GiftCardStatus = 'active' | 'redeemed' | 'expired' | 'cancelled';

export interface GiftCard {
  id: number;
  code: string;
  initialValue: number;
  currentBalance: number;
  purchaserId?: number;
  recipientEmail?: string;
  recipientName?: string;
  personalMessage?: string;
  status: GiftCardStatus;
  purchasedAt: string;
  activatedAt?: string;
  expiresAt: string;
  createdAt: string;
}

export interface GiftCardTransaction {
  id: number;
  giftCardId: number;
  amount: number;
  transactionType: 'purchase' | 'redemption' | 'refund' | 'adjustment';
  orderId?: number;
  description: string;
  createdAt: string;
}

export interface GiftCardBalance {
  code: string;
  currentBalance: number;
  initialValue: number;
  status: GiftCardStatus;
  expiresAt: string;
  isExpired: boolean;
  isValid: boolean;
}

export interface PurchaseGiftCardRequest {
  amount: number;
  recipientEmail?: string;
  recipientName?: string;
  message?: string;
}

export interface PurchaseGiftCardResponse {
  success: boolean;
  giftCard?: GiftCard;
  message: string;
}

export interface RedeemGiftCardResponse {
  success: boolean;
  creditAdded: number;
  newBalance: number;
  message: string;
}

export interface ApplyGiftCardResponse {
  success: boolean;
  amountApplied: number;
  remainingBalance: number;
  message: string;
}

export interface UserStoreCredit {
  totalBalance: number;
  cards: GiftCard[];
}

export const GIFT_CARD_AMOUNTS = [25, 50, 100, 200, 500];

@Injectable({
  providedIn: 'root'
})
export class GiftCardService {
  private readonly apiUrl = `${environementDev.backendAiUrl}/api/gift-cards`;

  // Observable for store credit balance
  private storeCreditSubject = new BehaviorSubject<number>(0);
  public storeCredit$ = this.storeCreditSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwt');
    if (token) {
      return new HttpHeaders().set('Authorization', `Bearer ${token}`);
    }
    return new HttpHeaders();
  }

  /**
   * Check gift card balance (no auth required)
   */
  checkBalance(code: string): Observable<GiftCardBalance> {
    return this.http.get<GiftCardBalance>(
      `${this.apiUrl}/check/${code}`
    ).pipe(
      catchError(err => {
        console.error('Error checking gift card:', err);
        return of({
          code,
          currentBalance: 0,
          initialValue: 0,
          status: 'expired' as GiftCardStatus,
          expiresAt: new Date().toISOString(),
          isExpired: true,
          isValid: false
        });
      })
    );
  }

  /**
   * Purchase a gift card
   */
  purchaseGiftCard(request: PurchaseGiftCardRequest): Observable<PurchaseGiftCardResponse> {
    return this.http.post<PurchaseGiftCardResponse>(
      `${this.apiUrl}/purchase`,
      request,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(err => {
        console.error('Error purchasing gift card:', err);
        return of({
          success: false,
          message: err.error?.detail || 'Impossible d\'acheter la carte cadeau'
        });
      })
    );
  }

  /**
   * Get user's purchased gift cards
   */
  getMyCards(): Observable<GiftCard[]> {
    return this.http.get<{ cards: GiftCard[] }>(
      `${this.apiUrl}/my-cards`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.cards || []),
      catchError(err => {
        console.error('Error fetching gift cards:', err);
        return of([]);
      })
    );
  }

  /**
   * Redeem a gift card for store credit
   */
  redeemGiftCard(code: string): Observable<RedeemGiftCardResponse> {
    return this.http.post<RedeemGiftCardResponse>(
      `${this.apiUrl}/redeem`,
      { code },
      { headers: this.getHeaders() }
    ).pipe(
      tap(result => {
        if (result.success) {
          this.refreshStoreCredit();
        }
      }),
      catchError(err => {
        console.error('Error redeeming gift card:', err);
        return of({
          success: false,
          creditAdded: 0,
          newBalance: 0,
          message: err.error?.detail || 'Code invalide ou carte expiree'
        });
      })
    );
  }

  /**
   * Get user's total store credit balance
   */
  getMyBalance(): Observable<UserStoreCredit> {
    return this.http.get<UserStoreCredit>(
      `${this.apiUrl}/my-balance`,
      { headers: this.getHeaders() }
    ).pipe(
      tap(credit => this.storeCreditSubject.next(credit.totalBalance)),
      catchError(err => {
        console.error('Error fetching store credit:', err);
        return of({ totalBalance: 0, cards: [] });
      })
    );
  }

  /**
   * Apply gift card to order
   */
  applyToOrder(code: string, orderId: number, amount?: number): Observable<ApplyGiftCardResponse> {
    return this.http.post<ApplyGiftCardResponse>(
      `${this.apiUrl}/apply`,
      { code, orderId, amount },
      { headers: this.getHeaders() }
    ).pipe(
      tap(result => {
        if (result.success) {
          this.refreshStoreCredit();
        }
      }),
      catchError(err => {
        console.error('Error applying gift card:', err);
        return of({
          success: false,
          amountApplied: 0,
          remainingBalance: 0,
          message: err.error?.detail || 'Impossible d\'appliquer la carte cadeau'
        });
      })
    );
  }

  /**
   * Format gift card code for display (add dashes)
   */
  formatCode(code: string): string {
    // Format: BRSH-XXXX-XXXX-XXXX
    if (!code) return '';
    const clean = code.replace(/-/g, '');
    if (clean.length !== 16) return code;
    return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}`;
  }

  /**
   * Get status label
   */
  getStatusLabel(status: GiftCardStatus): string {
    const labels: Record<GiftCardStatus, string> = {
      'active': 'Active',
      'redeemed': 'Utilisee',
      'expired': 'Expiree',
      'cancelled': 'Annulee'
    };
    return labels[status] || status;
  }

  /**
   * Get status color class
   */
  getStatusClass(status: GiftCardStatus): string {
    const classes: Record<GiftCardStatus, string> = {
      'active': 'status-active',
      'redeemed': 'status-redeemed',
      'expired': 'status-expired',
      'cancelled': 'status-cancelled'
    };
    return classes[status] || '';
  }

  /**
   * Check if gift card is valid for use
   */
  isValid(card: GiftCard): boolean {
    if (card.status !== 'active') return false;
    if (card.currentBalance <= 0) return false;
    const now = new Date();
    const expiry = new Date(card.expiresAt);
    return now < expiry;
  }

  /**
   * Get available gift card amounts
   */
  getAvailableAmounts(): number[] {
    return GIFT_CARD_AMOUNTS;
  }

  /**
   * Refresh store credit
   */
  refreshStoreCredit(): void {
    this.getMyBalance().subscribe();
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number): string {
    return `${amount.toFixed(3)} TND`;
  }
}
