/**
 * Product Review Service
 * ======================
 * Handles product reviews and ratings API interactions.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';

export interface ReviewUser {
  id: number;
  firstName: string;
  lastInitial: string;
}

export interface ProductReview {
  id: number;
  productId: number;
  rating: number;
  title?: string;
  comment?: string;
  images: string[];
  isVerifiedPurchase: boolean;
  isRecommended: boolean;
  fitRating?: 'small' | 'true_to_size' | 'large';
  helpfulCount: number;
  notHelpfulCount: number;
  isFeatured: boolean;
  createdAt: string;
  adminResponse?: string;
  adminResponseAt?: string;
  user?: ReviewUser;
  userVote?: boolean | null;
}

export interface RatingDistribution {
  '1': number;
  '2': number;
  '3': number;
  '4': number;
  '5': number;
}

export interface FitDistribution {
  small: number;
  trueToSize: number;
  large: number;
}

export interface ProductRatingStats {
  productId: number;
  averageRating: number;
  totalReviews: number;
  ratingDistribution: RatingDistribution;
  verifiedReviews: number;
  recommendationRate: number;
  fitDistribution: FitDistribution;
}

export interface ReviewsResponse {
  reviews: ProductReview[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CreateReviewRequest {
  productId: number;
  rating: number;
  title?: string;
  comment?: string;
  isRecommended?: boolean;
  fitRating?: string;
  images?: string[];
}

export interface CanReviewResponse {
  canReview: boolean;
  existingReviewId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProductReviewService {
  private readonly apiUrl = `${environementDev.backendAiUrl}/api/reviews`;

  // Cache for rating stats
  private statsCache = new Map<number, ProductRatingStats>();
  private statsCacheTime = new Map<number, number>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwt');
    if (token) {
      return new HttpHeaders().set('Authorization', `Bearer ${token}`);
    }
    return new HttpHeaders();
  }

  /**
   * Get reviews for a product
   */
  getProductReviews(
    productId: number,
    options: {
      page?: number;
      limit?: number;
      sort?: 'recent' | 'helpful' | 'highest' | 'lowest';
      rating?: number;
      verifiedOnly?: boolean;
    } = {}
  ): Observable<ReviewsResponse> {
    let params = new HttpParams();

    if (options.page) params = params.set('page', options.page.toString());
    if (options.limit) params = params.set('limit', options.limit.toString());
    if (options.sort) params = params.set('sort', options.sort);
    if (options.rating) params = params.set('rating', options.rating.toString());
    if (options.verifiedOnly) params = params.set('verifiedOnly', 'true');

    return this.http.get<ReviewsResponse>(
      `${this.apiUrl}/product/${productId}`,
      { params, headers: this.getHeaders() }
    ).pipe(
      catchError(err => {
        console.error('Error fetching reviews:', err);
        return of({ reviews: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } });
      })
    );
  }

  /**
   * Get rating statistics for a product
   */
  getProductStats(productId: number, forceRefresh = false): Observable<ProductRatingStats> {
    // Check cache
    if (!forceRefresh) {
      const cached = this.statsCache.get(productId);
      const cacheTime = this.statsCacheTime.get(productId);
      if (cached && cacheTime && Date.now() - cacheTime < this.CACHE_TTL) {
        return of(cached);
      }
    }

    return this.http.get<ProductRatingStats>(
      `${this.apiUrl}/product/${productId}/stats`
    ).pipe(
      tap(stats => {
        this.statsCache.set(productId, stats);
        this.statsCacheTime.set(productId, Date.now());
      }),
      catchError(err => {
        console.error('Error fetching stats:', err);
        return of({
          productId,
          averageRating: 0,
          totalReviews: 0,
          ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
          verifiedReviews: 0,
          recommendationRate: 0,
          fitDistribution: { small: 0, trueToSize: 0, large: 0 }
        });
      })
    );
  }

  /**
   * Check if user can review a product
   */
  canReviewProduct(productId: number): Observable<CanReviewResponse> {
    const token = localStorage.getItem('jwt');
    if (!token) {
      return of({ canReview: false });
    }

    return this.http.get<CanReviewResponse>(
      `${this.apiUrl}/user/can-review/${productId}`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(err => {
        console.error('Error checking review eligibility:', err);
        return of({ canReview: false });
      })
    );
  }

  /**
   * Submit a new review
   */
  createReview(review: CreateReviewRequest): Observable<{ success: boolean; review?: ProductReview; message: string }> {
    return this.http.post<{ success: boolean; review?: ProductReview; message: string }>(
      this.apiUrl,
      review,
      { headers: this.getHeaders() }
    ).pipe(
      tap(() => {
        // Invalidate cache
        this.statsCache.delete(review.productId);
        this.statsCacheTime.delete(review.productId);
      }),
      catchError(err => {
        console.error('Error creating review:', err);
        const message = err.error?.detail || 'Impossible de soumettre votre avis';
        return of({ success: false, message });
      })
    );
  }

  /**
   * Vote on a review (helpful/not helpful)
   */
  voteOnReview(reviewId: number, isHelpful: boolean): Observable<{ success: boolean; helpfulCount: number; notHelpfulCount: number }> {
    return this.http.post<{ success: boolean; helpfulCount: number; notHelpfulCount: number }>(
      `${this.apiUrl}/${reviewId}/vote`,
      { isHelpful },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(err => {
        console.error('Error voting on review:', err);
        return of({ success: false, helpfulCount: 0, notHelpfulCount: 0 });
      })
    );
  }

  /**
   * Get current user's reviews
   */
  getMyReviews(page = 1, limit = 10): Observable<ReviewsResponse> {
    return this.http.get<ReviewsResponse>(
      `${this.apiUrl}/user/my-reviews`,
      {
        params: new HttpParams().set('page', page.toString()).set('limit', limit.toString()),
        headers: this.getHeaders()
      }
    ).pipe(
      catchError(err => {
        console.error('Error fetching user reviews:', err);
        return of({ reviews: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } });
      })
    );
  }

  /**
   * Delete user's own review
   */
  deleteReview(reviewId: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.apiUrl}/${reviewId}`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(err => {
        console.error('Error deleting review:', err);
        return of({ success: false, message: 'Impossible de supprimer l\'avis' });
      })
    );
  }

  /**
   * Format rating for display
   */
  formatRating(rating: number): string {
    return (rating || 0).toFixed(1);
  }

  /**
   * Get rating label
   */
  getRatingLabel(rating: number): string {
    const r = rating || 0;
    if (r >= 4.5) return 'Excellent';
    if (r >= 4) return 'Tres bien';
    if (r >= 3) return 'Bien';
    if (r >= 2) return 'Moyen';
    return 'A ameliorer';
  }

  /**
   * Get fit rating label
   */
  getFitRatingLabel(fitRating: string): string {
    switch (fitRating) {
      case 'small': return 'Taille petit';
      case 'true_to_size': return 'Taille normalement';
      case 'large': return 'Taille grand';
      default: return '';
    }
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-TN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
}
