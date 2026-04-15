/**
 * BARSHA WISHLIST SHARING SERVICE
 * ================================
 * Enables users to share their wishlists with friends and family.
 * Supports public links, expiration, and view tracking.
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';

export interface SharedWishlist {
  id: number;
  userId: number;
  shareToken: string;
  title?: string;
  description?: string;
  isPublic: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  lastViewedAt?: string;
  isExpired: boolean;
  shareUrl: string;
}

export interface SharedWishlistProduct {
  id: number;
  title: string;
  price: number;
  currentPrice: number;
  discount: boolean;
  discountValue: number;
  image: string;
  isAvailable: boolean;
  famille: string;
}

export interface PublicSharedWishlist {
  id: number;
  title?: string;
  description?: string;
  createdAt: string;
  viewCount: number;
  products: SharedWishlistProduct[];
  ownerName?: string;
}

export interface CreateShareRequest {
  title?: string;
  description?: string;
  isPublic?: boolean;
  expiresInDays?: number;
}

export interface ShareListResponse {
  shares: SharedWishlist[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({
  providedIn: 'root'
})
export class WishlistSharingService {
  private readonly apiUrl = `${environementDev.backendAiUrl}/api/wishlist`;

  // Track user's active shares
  private mySharesSubject = new BehaviorSubject<SharedWishlist[]>([]);
  public myShares$ = this.mySharesSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwt');
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  /**
   * Create a shareable link for the current wishlist
   */
  createShareLink(options: CreateShareRequest = {}): Observable<SharedWishlist | null> {
    return this.http.post<{ share: SharedWishlist }>(
      `${this.apiUrl}/share`,
      {
        title: options.title || 'Ma wishlist Barsha',
        description: options.description,
        is_public: options.isPublic !== false,
        expires_in_days: options.expiresInDays || 30
      },
      { headers: this.getHeaders() }
    ).pipe(
      map(response => {
        const share = response.share;
        if (share) {
          share.shareUrl = this.getShareUrl(share.shareToken);
        }
        return share;
      }),
      tap(share => {
        if (share) {
          const current = this.mySharesSubject.value;
          this.mySharesSubject.next([share, ...current]);
        }
      }),
      catchError(error => {
        console.error('Error creating share link:', error);
        return of(null);
      })
    );
  }

  /**
   * Get a shared wishlist by token (public, no auth required)
   */
  getSharedWishlist(token: string): Observable<PublicSharedWishlist | null> {
    return this.http.get<PublicSharedWishlist>(`${this.apiUrl}/shared/${token}`).pipe(
      catchError(error => {
        console.error('Error fetching shared wishlist:', error);
        if (error.status === 404) {
          return of(null);
        }
        if (error.status === 410) {
          // Gone - expired link
          return of(null);
        }
        return of(null);
      })
    );
  }

  /**
   * Get all shares created by the current user
   */
  getMyShares(options: {
    page?: number;
    limit?: number;
    includeExpired?: boolean;
  } = {}): Observable<ShareListResponse> {
    let params = new HttpParams();
    if (options.page) params = params.set('page', options.page.toString());
    if (options.limit) params = params.set('limit', options.limit.toString());
    if (options.includeExpired !== undefined) {
      params = params.set('include_expired', options.includeExpired.toString());
    }

    return this.http.get<ShareListResponse>(
      `${this.apiUrl}/my-shares`,
      { headers: this.getHeaders(), params }
    ).pipe(
      tap(response => {
        const shares = response.shares.map(s => ({
          ...s,
          shareUrl: this.getShareUrl(s.shareToken)
        }));
        this.mySharesSubject.next(shares);
      }),
      catchError(error => {
        console.error('Error fetching my shares:', error);
        return of({ shares: [], total: 0, page: 1, limit: 10 });
      })
    );
  }

  /**
   * Update a share's settings
   */
  updateShare(shareId: number, updates: {
    title?: string;
    description?: string;
    isPublic?: boolean;
  }): Observable<SharedWishlist | null> {
    return this.http.put<{ share: SharedWishlist }>(
      `${this.apiUrl}/share/${shareId}`,
      {
        title: updates.title,
        description: updates.description,
        is_public: updates.isPublic
      },
      { headers: this.getHeaders() }
    ).pipe(
      map(response => {
        const share = response.share;
        if (share) {
          share.shareUrl = this.getShareUrl(share.shareToken);
        }
        return share;
      }),
      tap(share => {
        if (share) {
          const current = this.mySharesSubject.value;
          const updated = current.map(s => s.id === share.id ? share : s);
          this.mySharesSubject.next(updated);
        }
      }),
      catchError(error => {
        console.error('Error updating share:', error);
        return of(null);
      })
    );
  }

  /**
   * Revoke a share link
   */
  revokeShare(shareId: number): Observable<boolean> {
    return this.http.delete<{ success: boolean }>(
      `${this.apiUrl}/share/${shareId}`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.success),
      tap(success => {
        if (success) {
          const current = this.mySharesSubject.value;
          this.mySharesSubject.next(current.filter(s => s.id !== shareId));
        }
      }),
      catchError(error => {
        console.error('Error revoking share:', error);
        return of(false);
      })
    );
  }

  /**
   * Get statistics for a share
   */
  getShareStats(shareId: number): Observable<{
    viewCount: number;
    lastViewedAt?: string;
    createdAt: string;
  } | null> {
    return this.http.get<any>(
      `${this.apiUrl}/share/${shareId}/stats`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => {
        console.error('Error fetching share stats:', error);
        return of(null);
      })
    );
  }

  /**
   * Generate the public share URL
   */
  getShareUrl(token: string): string {
    return `${window.location.origin}/wishlist/shared/${token}`;
  }

  /**
   * Copy share URL to clipboard
   */
  async copyShareUrl(token: string): Promise<boolean> {
    const url = this.getShareUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
      } catch (e) {
        document.body.removeChild(textArea);
        return false;
      }
    }
  }

  /**
   * Check if Web Share API is available
   */
  canNativeShare(): boolean {
    return !!navigator.share;
  }

  /**
   * Share using native share API (mobile)
   */
  async nativeShare(share: SharedWishlist): Promise<boolean> {
    if (!this.canNativeShare()) {
      return false;
    }

    try {
      await navigator.share({
        title: share.title || 'Ma wishlist Barsha',
        text: share.description || 'Découvrez ma sélection de produits Barsha !',
        url: this.getShareUrl(share.shareToken)
      });
      return true;
    } catch (error) {
      console.error('Error sharing:', error);
      return false;
    }
  }
}
