/**
 * Loyalty Service
 * ===============
 * Handles loyalty points program API interactions.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface TierInfo {
  name: string;
  displayName: string;
  minimumPoints: number;
  pointsMultiplier: number;
  freeShippingThreshold: number;
  benefits: string[];
  color: string;
  icon: string;
}

export interface LoyaltyAccount {
  userId: number;
  totalPointsEarned: number;
  availablePoints: number;
  currentTier: LoyaltyTier;
  tierUpdatedAt: string;
  pointsToNextTier: number;
  nextTier: LoyaltyTier | null;
  tierProgress: number; // 0-100 percentage
  createdAt: string;
}

export interface PointsTransaction {
  id: number;
  points: number;
  transactionType: 'purchase_earn' | 'review_bonus' | 'referral_bonus' | 'birthday_bonus' | 'redemption' | 'expiry' | 'adjustment';
  description: string;
  orderId?: number;
  createdAt: string;
  expiresAt?: string;
}

export interface PointsHistoryResponse {
  transactions: PointsTransaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface RedemptionResult {
  success: boolean;
  pointsRedeemed: number;
  discountValue: number;
  remainingPoints: number;
  message: string;
}

export const TIER_INFO: Record<LoyaltyTier, TierInfo> = {
  bronze: {
    name: 'bronze',
    displayName: 'Bronze',
    minimumPoints: 0,
    pointsMultiplier: 1,
    freeShippingThreshold: 200,
    benefits: [
      'Gagnez 1 point par TND depense',
      'Livraison gratuite des 200 TND',
      'Acces aux ventes privees'
    ],
    color: '#CD7F32',
    icon: 'fas fa-medal'
  },
  silver: {
    name: 'silver',
    displayName: 'Argent',
    minimumPoints: 500,
    pointsMultiplier: 1.25,
    freeShippingThreshold: 150,
    benefits: [
      'Gagnez 1.25 points par TND depense',
      'Livraison gratuite des 150 TND',
      'Acces aux ventes privees',
      'Retours gratuits etendus a 30 jours'
    ],
    color: '#C0C0C0',
    icon: 'fas fa-medal'
  },
  gold: {
    name: 'gold',
    displayName: 'Or',
    minimumPoints: 2000,
    pointsMultiplier: 1.5,
    freeShippingThreshold: 100,
    benefits: [
      'Gagnez 1.5 points par TND depense',
      'Livraison gratuite des 100 TND',
      'Acces prioritaire aux nouveautes',
      'Retours gratuits etendus a 30 jours',
      'Service client prioritaire'
    ],
    color: '#FFD700',
    icon: 'fas fa-crown'
  },
  platinum: {
    name: 'platinum',
    displayName: 'Platine',
    minimumPoints: 5000,
    pointsMultiplier: 2,
    freeShippingThreshold: 0,
    benefits: [
      'Gagnez 2 points par TND depense',
      'Livraison gratuite sur toutes les commandes',
      'Acces prioritaire aux nouveautes',
      'Retours gratuits etendus a 60 jours',
      'Service client VIP',
      'Invitations aux evenements exclusifs',
      'Cadeau d\'anniversaire special'
    ],
    color: '#E5E4E2',
    icon: 'fas fa-gem'
  }
};

@Injectable({
  providedIn: 'root'
})
export class LoyaltyService {
  private readonly apiUrl = `${environementDev.backendAiUrl}/api/loyalty`;

  // Observable for account updates
  private accountSubject = new BehaviorSubject<LoyaltyAccount | null>(null);
  public account$ = this.accountSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwt');
    if (token) {
      return new HttpHeaders().set('Authorization', `Bearer ${token}`);
    }
    return new HttpHeaders();
  }

  /**
   * Get user's loyalty account information
   */
  getAccount(): Observable<LoyaltyAccount> {
    return this.http.get<LoyaltyAccount>(
      `${this.apiUrl}/account`,
      { headers: this.getHeaders() }
    ).pipe(
      tap(account => this.accountSubject.next(account)),
      catchError(err => {
        console.error('Error fetching loyalty account:', err);
        return of({
          userId: 0,
          totalPointsEarned: 0,
          availablePoints: 0,
          currentTier: 'bronze' as LoyaltyTier,
          tierUpdatedAt: new Date().toISOString(),
          pointsToNextTier: 500,
          nextTier: 'silver' as LoyaltyTier,
          tierProgress: 0,
          createdAt: new Date().toISOString()
        });
      })
    );
  }

  /**
   * Get points transaction history
   */
  getHistory(page = 1, limit = 20): Observable<PointsHistoryResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<PointsHistoryResponse>(
      `${this.apiUrl}/history`,
      { params, headers: this.getHeaders() }
    ).pipe(
      catchError(err => {
        console.error('Error fetching points history:', err);
        return of({
          transactions: [],
          pagination: { page: 1, limit: 20, total: 0, pages: 0 }
        });
      })
    );
  }

  /**
   * Redeem points for discount
   */
  redeemPoints(points: number): Observable<RedemptionResult> {
    return this.http.post<RedemptionResult>(
      `${this.apiUrl}/redeem`,
      { points },
      { headers: this.getHeaders() }
    ).pipe(
      tap(result => {
        if (result.success) {
          // Refresh account data
          this.getAccount().subscribe();
        }
      }),
      catchError(err => {
        console.error('Error redeeming points:', err);
        return of({
          success: false,
          pointsRedeemed: 0,
          discountValue: 0,
          remainingPoints: 0,
          message: err.error?.detail || 'Impossible d\'utiliser vos points'
        });
      })
    );
  }

  /**
   * Get all tier information
   */
  getTiers(): Observable<TierInfo[]> {
    return this.http.get<TierInfo[]>(`${this.apiUrl}/tiers`).pipe(
      catchError(() => of(Object.values(TIER_INFO)))
    );
  }

  /**
   * Calculate discount value from points
   * 100 points = 1 TND
   */
  calculateDiscountValue(points: number): number {
    return points / 100;
  }

  /**
   * Calculate points needed for a discount value
   */
  calculatePointsNeeded(discountValue: number): number {
    return discountValue * 100;
  }

  /**
   * Get tier info for a specific tier
   */
  getTierInfo(tier: LoyaltyTier): TierInfo {
    return TIER_INFO[tier];
  }

  /**
   * Format points for display
   */
  formatPoints(points: number): string {
    return points.toLocaleString('fr-TN');
  }

  /**
   * Get transaction type label
   */
  getTransactionTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'purchase_earn': 'Achat',
      'review_bonus': 'Bonus Avis',
      'referral_bonus': 'Bonus Parrainage',
      'birthday_bonus': 'Bonus Anniversaire',
      'redemption': 'Utilisation',
      'expiry': 'Expiration',
      'adjustment': 'Ajustement'
    };
    return labels[type] || type;
  }

  /**
   * Get transaction icon
   */
  getTransactionIcon(type: string): string {
    const icons: Record<string, string> = {
      'purchase_earn': 'fas fa-shopping-bag',
      'review_bonus': 'fas fa-star',
      'referral_bonus': 'fas fa-user-plus',
      'birthday_bonus': 'fas fa-birthday-cake',
      'redemption': 'fas fa-gift',
      'expiry': 'fas fa-clock',
      'adjustment': 'fas fa-edit'
    };
    return icons[type] || 'fas fa-circle';
  }

  /**
   * Refresh account data
   */
  refreshAccount(): void {
    this.getAccount().subscribe();
  }
}
