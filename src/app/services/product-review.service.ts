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

  private getDefaultStats(productId: number): ProductRatingStats {
    return {
      productId,
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      verifiedReviews: 0,
      recommendationRate: 0,
      fitDistribution: { small: 0, trueToSize: 0, large: 0 }
    };
  }

  private getDefaultReviewsResponse(): ReviewsResponse {
    return {
      reviews: [],
      pagination: { page: 1, limit: 10, total: 0, pages: 0 }
    };
  }

  private normalizeReview(raw: any): ProductReview {
    const firstName = raw?.user?.firstName || raw?.user?.first_name || '';
    const lastName = raw?.user?.lastName || raw?.user?.last_name || '';

    return {
      id: raw?.id || 0,
      productId: raw?.productId || raw?.product_id || 0,
      rating: raw?.rating || 0,
      title: raw?.title || '',
      comment: raw?.comment || '',
      images: Array.isArray(raw?.images) ? raw.images : [],
      isVerifiedPurchase: !!(raw?.isVerifiedPurchase ?? raw?.is_verified_purchase),
      isRecommended: !!(raw?.isRecommended ?? raw?.is_recommended),
      fitRating: raw?.fitRating || raw?.fit_rating,
      helpfulCount: raw?.helpfulCount ?? raw?.helpful_count ?? 0,
      notHelpfulCount: raw?.notHelpfulCount ?? raw?.not_helpful_count ?? 0,
      isFeatured: !!raw?.isFeatured,
      createdAt: raw?.createdAt || raw?.created_at || new Date().toISOString(),
      adminResponse: raw?.adminResponse || raw?.admin_response,
      adminResponseAt: raw?.adminResponseAt || raw?.admin_response_at,
      user: raw?.user ? {
        id: raw.user.id || 0,
        firstName,
        lastInitial: lastName ? lastName.charAt(0).toUpperCase() : ''
      } : undefined,
      userVote: raw?.userVote ?? raw?.user_vote ?? null
    };
  }

  private normalizeReviewsResponse(raw: any): ReviewsResponse {
    const reviews = Array.isArray(raw?.reviews)
      ? raw.reviews.map((review: any) => this.normalizeReview(review))
      : [];

    return {
      reviews,
      pagination: {
        page: raw?.pagination?.page ?? raw?.page ?? 1,
        limit: raw?.pagination?.limit ?? raw?.limit ?? 10,
        total: raw?.pagination?.total ?? raw?.total ?? reviews.length,
        pages: raw?.pagination?.pages ?? raw?.totalPages ?? 0
      }
    };
  }

  private normalizeStats(productId: number, raw: any): ProductRatingStats {
    const base = this.getDefaultStats(productId);
    const distribution = raw?.ratingDistribution || raw?.distribution || {};
    const fitDistribution = raw?.fitDistribution || raw?.fit_distribution || {};

    return {
      productId: raw?.productId || raw?.product_id || productId,
      averageRating: Number(raw?.averageRating ?? raw?.average_rating ?? 0),
      totalReviews: Number(raw?.totalReviews ?? raw?.total_reviews ?? 0),
      ratingDistribution: {
        '1': Number(distribution?.['1'] ?? distribution?.[1] ?? 0),
        '2': Number(distribution?.['2'] ?? distribution?.[2] ?? 0),
        '3': Number(distribution?.['3'] ?? distribution?.[3] ?? 0),
        '4': Number(distribution?.['4'] ?? distribution?.[4] ?? 0),
        '5': Number(distribution?.['5'] ?? distribution?.[5] ?? 0),
      },
      verifiedReviews: Number(raw?.verifiedReviews ?? raw?.verified_reviews ?? 0),
      recommendationRate: Number(raw?.recommendationRate ?? raw?.recommendation_rate ?? 0),
      fitDistribution: {
        small: Number(fitDistribution?.small ?? 0),
        trueToSize: Number(fitDistribution?.trueToSize ?? fitDistribution?.true_to_size ?? 0),
        large: Number(fitDistribution?.large ?? 0)
      }
    };
  }

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

    return this.http.get<any>(
      `${this.apiUrl}/product/${productId}`,
      { params, headers: this.getHeaders() }
    ).pipe(
      map(response => this.normalizeReviewsResponse(response)),
      catchError(err => {
        console.error('Error fetching reviews:', err);
        return of(this.getDefaultReviewsResponse());
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

    return this.http.get<any>(
      `${this.apiUrl}/product/${productId}/stats`
    ).pipe(
      map(stats => this.normalizeStats(productId, stats)),
      tap(stats => {
        this.statsCache.set(productId, stats);
        this.statsCacheTime.set(productId, Date.now());
      }),
      catchError(err => {
        console.error('Error fetching stats:', err);
        return of(this.getDefaultStats(productId));
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
    return this.http.post<any>(
      this.apiUrl,
      review,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => ({
        success: true,
        review: this.normalizeReview(response),
        message: 'Votre avis a ete publie avec succes'
      })),
      tap(() => {
        // Invalidate cache
        this.statsCache.delete(review.productId);
        this.statsCacheTime.delete(review.productId);
      }),
      catchError(err => {
        console.error('Error creating review:', err);
        const message = err.error?.detail || err.error?.message || 'Impossible de soumettre votre avis';
        return of({ success: false, message });
      })
    );
  }

  /**
   * Vote on a review (helpful/not helpful)
   */
  voteOnReview(reviewId: number, isHelpful: boolean): Observable<{ success: boolean; helpfulCount: number; notHelpfulCount: number }> {
    return this.http.post<any>(
      `${this.apiUrl}/${reviewId}/vote`,
      { isHelpful },
      { headers: this.getHeaders() }
    ).pipe(
      map(response => ({
        success: true,
        helpfulCount: response?.helpfulCount ?? response?.helpful_count ?? 0,
        notHelpfulCount: response?.notHelpfulCount ?? response?.not_helpful_count ?? 0
      })),
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
    return this.http.get<any>(
      `${this.apiUrl}/user/my-reviews`,
      {
        params: new HttpParams().set('page', page.toString()).set('limit', limit.toString()),
        headers: this.getHeaders()
      }
    ).pipe(
      map(response => this.normalizeReviewsResponse(response)),
      catchError(err => {
        console.error('Error fetching user reviews:', err);
        return of(this.getDefaultReviewsResponse());
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
