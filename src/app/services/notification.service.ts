import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, interval } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';

export interface Notification {
  id: number;
  userId: number;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  icon?: string;
  orderId?: number;
  ticketId?: number;
  productId?: number;
  actionUrl?: string;
  actionLabel?: string;
  isRead: boolean;
  readAt?: string;
  isArchived: boolean;
  createdAt: string;
  expiresAt?: string;
}

export type NotificationType =
  | 'order_status'
  | 'order_shipped'
  | 'order_delivered'
  | 'payment_success'
  | 'payment_failed'
  | 'return_update'
  | 'support_reply'
  | 'support_resolved'
  | 'promotion'
  | 'coupon'
  | 'price_drop'
  | 'back_in_stock'
  | 'account'
  | 'system';

export type NotificationPriority = 'low' | 'normal' | 'high';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private apiUrl = environementDev.api;

  // Observable for unread count (used in navbar badge)
  private unreadCountSubject = new BehaviorSubject<number>(0);
  unreadCount$ = this.unreadCountSubject.asObservable();

  // Observable for new notifications (for toast display)
  private newNotificationSubject = new BehaviorSubject<Notification | null>(null);
  newNotification$ = this.newNotificationSubject.asObservable();

  // Polling interval reference
  private pollingSubscription: any;

  constructor(private http: HttpClient) {
    // Start polling when service is created (if user is logged in)
    this.initPolling();
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwt');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Initialize polling for notifications
   */
  initPolling(): void {
    // Only poll if user is logged in
    if (!localStorage.getItem('jwt')) return;

    // Initial fetch
    this.refreshUnreadCount();

    // Poll every 30 seconds
    this.pollingSubscription = interval(30000).subscribe(() => {
      if (localStorage.getItem('jwt')) {
        this.refreshUnreadCount();
      }
    });
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
  }

  /**
   * Refresh unread count
   */
  refreshUnreadCount(): void {
    this.getUnreadCount().subscribe({
      next: (response) => {
        this.unreadCountSubject.next(response.unreadCount || 0);
      },
      error: () => {
        // Silently fail
      }
    });
  }

  /**
   * Get notifications
   */
  getNotifications(
    page: number = 1,
    unreadOnly: boolean = false,
    typeFilter?: string
  ): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('unread_only', unreadOnly.toString());

    if (typeFilter) {
      params = params.set('type_filter', typeFilter);
    }

    return this.http.get(`${this.apiUrl}/api/notifications`, {
      headers: this.getHeaders(),
      params
    });
  }

  /**
   * Get unread count
   */
  getUnreadCount(): Observable<{ unreadCount: number }> {
    return this.http.get<{ unreadCount: number }>(
      `${this.apiUrl}/api/notifications/count`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Mark a notification as read
   */
  markAsRead(notificationId: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/notifications/${notificationId}/read`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      tap(() => {
        // Decrement unread count
        const currentCount = this.unreadCountSubject.value;
        if (currentCount > 0) {
          this.unreadCountSubject.next(currentCount - 1);
        }
      })
    );
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/notifications/read-all`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      tap(() => {
        this.unreadCountSubject.next(0);
      })
    );
  }

  /**
   * Archive a notification
   */
  archiveNotification(notificationId: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/notifications/${notificationId}/archive`,
      {},
      { headers: this.getHeaders() }
    );
  }

  /**
   * Delete a notification
   */
  deleteNotification(notificationId: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/api/notifications/${notificationId}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Get icon for notification type
   */
  getNotificationIcon(type: NotificationType): string {
    const icons: Record<NotificationType, string> = {
      'order_status': 'bi-box-seam',
      'order_shipped': 'bi-truck',
      'order_delivered': 'bi-check-circle',
      'payment_success': 'bi-credit-card',
      'payment_failed': 'bi-exclamation-triangle',
      'return_update': 'bi-arrow-return-left',
      'support_reply': 'bi-headset',
      'support_resolved': 'bi-check2-circle',
      'promotion': 'bi-megaphone',
      'coupon': 'bi-ticket-perforated',
      'price_drop': 'bi-graph-down-arrow',
      'back_in_stock': 'bi-box2-heart',
      'account': 'bi-person',
      'system': 'bi-bell'
    };
    return icons[type] || 'bi-bell';
  }

  /**
   * Get color for notification type
   */
  getNotificationColor(type: NotificationType): string {
    const colors: Record<NotificationType, string> = {
      'order_status': '#3b82f6',
      'order_shipped': '#8b5cf6',
      'order_delivered': '#10b981',
      'payment_success': '#10b981',
      'payment_failed': '#ef4444',
      'return_update': '#f59e0b',
      'support_reply': '#6366f1',
      'support_resolved': '#10b981',
      'promotion': '#ec4899',
      'coupon': '#f97316',
      'price_drop': '#10b981',
      'back_in_stock': '#3b82f6',
      'account': '#6b7280',
      'system': '#6b7280'
    };
    return colors[type] || '#6b7280';
  }

  /**
   * Format relative time
   */
  formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '\u00c0 l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;

    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short'
    });
  }
}
