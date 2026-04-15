/**
 * Referral Service
 * ================
 * Handles referral program API interactions.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';

export interface ReferralCode {
  id: number;
  code: string;
  isActive: boolean;
  shareUrl: string;
  createdAt: string;
}

export interface ReferralStats {
  totalReferred: number;
  pendingReferrals: number;
  completedReferrals: number;
  totalPointsEarned: number;
  totalRewardsEarned: number;
  pendingRewards: number;
}

export interface ReferralHistoryItem {
  id: number;
  refereeFirstName: string;
  refereeEmail: string;
  status: 'pending' | 'completed' | 'rewarded';
  rewardEarned: number | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ReferralHistoryResponse {
  items: ReferralHistoryItem[];
  total: number;
  page: number;
  pages: number;
  hasMore: boolean;
}

export interface ReferralReward {
  id: number;
  referralId: number;
  userId: number;
  rewardType: 'loyalty_points' | 'discount_code' | 'credit';
  rewardValue: number;
  rewardDescription: string | null;
  discountCode: string | null;
  isClaimed: boolean;
  claimedAt: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  createdAt: string;
}

export interface ApplyReferralResponse {
  success: boolean;
  message: string;
  discountCode: string | null;
  discountValue: number | null;
}

export interface ValidateCodeResponse {
  valid: boolean;
  message: string;
  benefit?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReferralService {
  private readonly apiUrl = `${environementDev.backendAiUrl}/api/referrals`;

  // Observable for referral code
  private referralCodeSubject = new BehaviorSubject<ReferralCode | null>(null);
  public referralCode$ = this.referralCodeSubject.asObservable();

  // Observable for stats
  private statsSubject = new BehaviorSubject<ReferralStats | null>(null);
  public stats$ = this.statsSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwt');
    if (token) {
      return new HttpHeaders().set('Authorization', `Bearer ${token}`);
    }
    return new HttpHeaders();
  }

  /**
   * Get user's referral code (creates one if doesn't exist)
   */
  getMyCode(): Observable<ReferralCode> {
    return this.http.get<ReferralCode>(
      `${this.apiUrl}/my-code`,
      { headers: this.getHeaders() }
    ).pipe(
      tap(code => this.referralCodeSubject.next(code)),
      catchError(err => {
        console.error('Error fetching referral code:', err);
        return of({
          id: 0,
          code: 'ERROR',
          isActive: false,
          shareUrl: '',
          createdAt: new Date().toISOString()
        });
      })
    );
  }

  /**
   * Get referral statistics
   */
  getStats(): Observable<ReferralStats> {
    return this.http.get<ReferralStats>(
      `${this.apiUrl}/stats`,
      { headers: this.getHeaders() }
    ).pipe(
      tap(stats => this.statsSubject.next(stats)),
      catchError(err => {
        console.error('Error fetching referral stats:', err);
        return of({
          totalReferred: 0,
          pendingReferrals: 0,
          completedReferrals: 0,
          totalPointsEarned: 0,
          totalRewardsEarned: 0,
          pendingRewards: 0
        });
      })
    );
  }

  /**
   * Get referral history
   */
  getHistory(page = 1, perPage = 20): Observable<ReferralHistoryResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    return this.http.get<ReferralHistoryResponse>(
      `${this.apiUrl}/history`,
      { params, headers: this.getHeaders() }
    ).pipe(
      catchError(err => {
        console.error('Error fetching referral history:', err);
        return of({
          items: [],
          total: 0,
          page: 1,
          pages: 0,
          hasMore: false
        });
      })
    );
  }

  /**
   * Get pending rewards
   */
  getRewards(includeClaimed = false): Observable<{ rewards: ReferralReward[]; total: number }> {
    const params = new HttpParams()
      .set('include_claimed', includeClaimed.toString());

    return this.http.get<{ rewards: ReferralReward[]; total: number }>(
      `${this.apiUrl}/rewards`,
      { params, headers: this.getHeaders() }
    ).pipe(
      catchError(err => {
        console.error('Error fetching rewards:', err);
        return of({ rewards: [], total: 0 });
      })
    );
  }

  /**
   * Claim a pending reward
   */
  claimReward(rewardId: number): Observable<{ success: boolean; message: string; reward?: ReferralReward }> {
    return this.http.post<{ success: boolean; message: string; reward?: ReferralReward }>(
      `${this.apiUrl}/claim-reward/${rewardId}`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      tap(result => {
        if (result.success) {
          // Refresh stats
          this.getStats().subscribe();
        }
      }),
      catchError(err => {
        console.error('Error claiming reward:', err);
        return of({
          success: false,
          message: err.error?.detail || 'Impossible de reclamer la recompense'
        });
      })
    );
  }

  /**
   * Apply a referral code (during signup)
   */
  applyReferralCode(code: string): Observable<ApplyReferralResponse> {
    return this.http.post<ApplyReferralResponse>(
      `${this.apiUrl}/apply/${code}`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      catchError(err => {
        console.error('Error applying referral code:', err);
        return of({
          success: false,
          message: err.error?.detail || 'Code de parrainage invalide',
          discountCode: null,
          discountValue: null
        });
      })
    );
  }

  /**
   * Validate a referral code without applying it
   */
  validateCode(code: string): Observable<ValidateCodeResponse> {
    return this.http.get<ValidateCodeResponse>(
      `${this.apiUrl}/validate/${code}`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(err => {
        console.error('Error validating referral code:', err);
        return of({
          valid: false,
          message: 'Code de parrainage invalide'
        });
      })
    );
  }

  /**
   * Get share URL for a code
   */
  getShareUrl(code: string): string {
    return `https://barsha.tn/signup?ref=${code}`;
  }

  /**
   * Get WhatsApp share link
   */
  getWhatsAppShareLink(code: string): string {
    const message = encodeURIComponent(
      `Rejoignez Barsha et beneficiez de 10% de reduction sur votre premiere commande avec mon code: ${code}\n\n` +
      `${this.getShareUrl(code)}`
    );
    return `https://wa.me/?text=${message}`;
  }

  /**
   * Get Facebook share link
   */
  getFacebookShareLink(code: string): string {
    const url = encodeURIComponent(this.getShareUrl(code));
    return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
  }

  /**
   * Get Twitter share link
   */
  getTwitterShareLink(code: string): string {
    const text = encodeURIComponent(
      `Rejoignez Barsha et beneficiez de 10% de reduction avec mon code: ${code}`
    );
    const url = encodeURIComponent(this.getShareUrl(code));
    return `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
  }

  /**
   * Get Email share link
   */
  getEmailShareLink(code: string): string {
    const subject = encodeURIComponent('Invitation Barsha - 10% de reduction');
    const body = encodeURIComponent(
      `Bonjour,\n\n` +
      `Je vous invite a decouvrir Barsha, ma boutique de mode preferee!\n\n` +
      `Utilisez mon code de parrainage ${code} pour beneficier de 10% de reduction sur votre premiere commande.\n\n` +
      `Inscrivez-vous ici: ${this.getShareUrl(code)}\n\n` +
      `A bientot!`
    );
    return `mailto:?subject=${subject}&body=${body}`;
  }

  /**
   * Copy code to clipboard
   */
  async copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        return true;
      } catch {
        return false;
      } finally {
        document.body.removeChild(textArea);
      }
    }
  }

  /**
   * Get status label in French
   */
  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'pending': 'En attente',
      'completed': 'Complete',
      'rewarded': 'Recompense'
    };
    return labels[status] || status;
  }

  /**
   * Get status badge class
   */
  getStatusBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      'pending': 'badge-warning',
      'completed': 'badge-success',
      'rewarded': 'badge-primary'
    };
    return classes[status] || 'badge-secondary';
  }

  /**
   * Get reward type label in French
   */
  getRewardTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'loyalty_points': 'Points de fidelite',
      'discount_code': 'Code de reduction',
      'credit': 'Avoir'
    };
    return labels[type] || type;
  }

  /**
   * Format points for display
   */
  formatPoints(points: number): string {
    return points.toLocaleString('fr-TN');
  }

  /**
   * Refresh data
   */
  refreshData(): void {
    this.getMyCode().subscribe();
    this.getStats().subscribe();
  }
}
