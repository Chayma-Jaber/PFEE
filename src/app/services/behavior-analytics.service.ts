import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../environements/environementDev';

/**
 * Barsha Behavior Analytics Service
 * ==================================
 * Tracks user behavior events for personalization and analytics.
 *
 * Events tracked:
 * - Product views
 * - Category views
 * - Search queries
 * - Recommendation interactions
 * - Cart events
 * - AI module interactions
 */

export interface TrackEvent {
  session_id: string;
  event_type: string;
  user_id?: number;
  product_id?: number;
  category_id?: number;
  search_query?: string;
  recommendation_type?: string;
  recommendation_position?: number;
  recommendation_source?: string;
  metadata?: Record<string, any>;
  page_url?: string;
  device_type?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BehaviorAnalyticsService {
  private apiUrl = `${environementDev.api}/api/analytics`;
  private readonly analyticsEnabled = (environementDev as any).enableAnalytics !== false;
  private sessionId: string;
  private eventQueue: TrackEvent[] = [];
  private flushInterval: any;
  private readonly FLUSH_INTERVAL_MS = 5000; // Batch events every 5 seconds
  private readonly MAX_QUEUE_SIZE = 20;

  constructor(private http: HttpClient) {
    this.sessionId = this.getOrCreateSessionId();
    if (!this.analyticsEnabled) {
      return;
    }

    this.startFlushInterval();

    // Flush on page unload
    window.addEventListener('beforeunload', () => this.flush());
  }

  // ─────────────────────────────────────────────────────────────
  // SESSION MANAGEMENT
  // ─────────────────────────────────────────────────────────────

  private getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem('barsha_session_id');
    if (!sessionId) {
      sessionId = this.generateSessionId();
      sessionStorage.setItem('barsha_session_id', sessionId);
    }
    return sessionId;
  }

  private generateSessionId(): string {
    // Generate unique session ID using crypto API or fallback
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback to timestamp-based ID
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  private getUserId(): number | undefined {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        return user.id;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  private getDeviceType(): string {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  // ─────────────────────────────────────────────────────────────
  // EVENT TRACKING METHODS
  // ─────────────────────────────────────────────────────────────

  /**
   * Track a product page view
   */
  trackProductView(productId: number): void {
    this.queueEvent({
      session_id: this.sessionId,
      event_type: 'product_view',
      user_id: this.getUserId(),
      product_id: productId,
      page_url: window.location.href,
      device_type: this.getDeviceType()
    });
  }

  /**
   * Track a category page view
   */
  trackCategoryView(categoryId: number, categoryName?: string): void {
    this.queueEvent({
      session_id: this.sessionId,
      event_type: 'category_view',
      user_id: this.getUserId(),
      category_id: categoryId,
      metadata: { category_name: categoryName },
      page_url: window.location.href,
      device_type: this.getDeviceType()
    });
  }

  /**
   * Track a search query
   */
  trackSearch(query: string, resultsCount: number): void {
    this.queueEvent({
      session_id: this.sessionId,
      event_type: 'search_query',
      user_id: this.getUserId(),
      search_query: query,
      metadata: { results_count: resultsCount },
      device_type: this.getDeviceType()
    });
  }

  /**
   * Track recommendation impressions (when recommendations are shown)
   */
  trackRecommendationImpression(
    productIds: number[],
    recommendationType: string,
    source: string
  ): void {
    this.queueEvent({
      session_id: this.sessionId,
      event_type: 'recommendation_impression',
      user_id: this.getUserId(),
      recommendation_type: recommendationType,
      recommendation_source: source,
      metadata: { product_ids: productIds, count: productIds.length },
      device_type: this.getDeviceType()
    });
  }

  /**
   * Track recommendation click
   */
  trackRecommendationClick(
    productId: number,
    recommendationType: string,
    position: number,
    source: string
  ): void {
    this.queueEvent({
      session_id: this.sessionId,
      event_type: 'recommendation_click',
      user_id: this.getUserId(),
      product_id: productId,
      recommendation_type: recommendationType,
      recommendation_position: position,
      recommendation_source: source,
      device_type: this.getDeviceType()
    });
  }

  /**
   * Track add to cart from recommendation
   */
  trackRecommendationAddToCart(
    productId: number,
    recommendationType: string,
    source: string
  ): void {
    this.queueEvent({
      session_id: this.sessionId,
      event_type: 'recommendation_add_to_cart',
      user_id: this.getUserId(),
      product_id: productId,
      recommendation_type: recommendationType,
      recommendation_source: source,
      device_type: this.getDeviceType()
    });
  }

  /**
   * Track add to cart event
   */
  trackAddToCart(
    productId: number,
    quantity: number = 1,
    fromRecommendation?: string
  ): void {
    this.queueEvent({
      session_id: this.sessionId,
      event_type: 'add_to_cart',
      user_id: this.getUserId(),
      product_id: productId,
      recommendation_type: fromRecommendation,
      metadata: { quantity },
      device_type: this.getDeviceType()
    });
  }

  /**
   * Track wishlist add
   */
  trackWishlistAdd(productId: number): void {
    this.queueEvent({
      session_id: this.sessionId,
      event_type: 'wishlist_add',
      user_id: this.getUserId(),
      product_id: productId,
      device_type: this.getDeviceType()
    });
  }

  // ─────────────────────────────────────────────────────────────
  // AI MODULE TRACKING
  // ─────────────────────────────────────────────────────────────

  /**
   * Track AI assistant open
   */
  trackAssistantOpen(): void {
    this.queueEvent({
      session_id: this.sessionId,
      event_type: 'assistant_open',
      user_id: this.getUserId(),
      device_type: this.getDeviceType()
    });
  }

  /**
   * Track AI assistant message
   */
  trackAssistantMessage(messagePreview?: string): void {
    this.queueEvent({
      session_id: this.sessionId,
      event_type: 'assistant_message',
      user_id: this.getUserId(),
      metadata: { message_preview: messagePreview?.substring(0, 100) },
      device_type: this.getDeviceType()
    });
  }

  /**
   * Track product click from AI assistant
   */
  trackAssistantProductClick(productId: number): void {
    this.queueEvent({
      session_id: this.sessionId,
      event_type: 'assistant_product_click',
      user_id: this.getUserId(),
      product_id: productId,
      device_type: this.getDeviceType()
    });
  }

  /**
   * Track add to cart from AI assistant
   */
  trackAssistantAddToCart(productId: number): void {
    this.queueEvent({
      session_id: this.sessionId,
      event_type: 'assistant_add_to_cart',
      user_id: this.getUserId(),
      product_id: productId,
      device_type: this.getDeviceType()
    });
  }

  /**
   * Track visual search upload
   */
  trackVisualSearchUpload(resultsCount?: number, confidence?: number): void {
    this.queueEvent({
      session_id: this.sessionId,
      event_type: 'visual_search_upload',
      user_id: this.getUserId(),
      metadata: { results_count: resultsCount, confidence },
      device_type: this.getDeviceType()
    });
  }

  /**
   * Track visual search result click
   */
  trackVisualSearchResultClick(productId: number, position: number): void {
    this.queueEvent({
      session_id: this.sessionId,
      event_type: 'visual_search_result_click',
      user_id: this.getUserId(),
      product_id: productId,
      recommendation_position: position,
      device_type: this.getDeviceType()
    });
  }

  /**
   * Track add to cart from visual search
   */
  trackVisualSearchAddToCart(productId: number): void {
    this.queueEvent({
      session_id: this.sessionId,
      event_type: 'visual_search_add_to_cart',
      user_id: this.getUserId(),
      product_id: productId,
      device_type: this.getDeviceType()
    });
  }

  // ─────────────────────────────────────────────────────────────
  // EVENT QUEUE MANAGEMENT
  // ─────────────────────────────────────────────────────────────

  private queueEvent(event: TrackEvent): void {
    if (!this.analyticsEnabled) return;

    this.eventQueue.push(event);

    // Flush immediately if queue is full
    if (this.eventQueue.length >= this.MAX_QUEUE_SIZE) {
      this.flush();
    }
  }

  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flush();
      }
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Flush all queued events to the server
   */
  flush(): void {
    if (!this.analyticsEnabled) return;
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    // Send batch
    this.http.post(`${this.apiUrl}/track/batch`, { events }).subscribe({
      next: () => {
        console.debug(`[Analytics] Flushed ${events.length} events`);
      },
      error: (err) => {
        console.warn('[Analytics] Failed to flush events:', err);
        // Re-queue failed events (with limit to prevent infinite growth)
        if (this.eventQueue.length < this.MAX_QUEUE_SIZE * 2) {
          this.eventQueue = [...events, ...this.eventQueue];
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}
