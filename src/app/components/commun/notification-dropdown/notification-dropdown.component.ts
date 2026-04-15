import { Component, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { NotificationService, Notification, NotificationType } from '../../../services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notification-dropdown',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './notification-dropdown.component.html',
  styleUrls: ['./notification-dropdown.component.scss']
})
export class NotificationDropdownComponent implements OnInit, OnDestroy {
  isOpen = false;
  notifications: Notification[] = [];
  unreadCount = 0;
  isLoading = false;
  hasMore = false;
  page = 1;

  private subscriptions: Subscription[] = [];

  constructor(
    private notificationService: NotificationService,
    private router: Router,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    // Subscribe to unread count
    const countSub = this.notificationService.unreadCount$.subscribe(count => {
      this.unreadCount = count;
    });
    this.subscriptions.push(countSub);

    // Initial count refresh
    this.notificationService.refreshUnreadCount();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // Close dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }

  toggleDropdown(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen && this.notifications.length === 0) {
      this.loadNotifications();
    }
  }

  loadNotifications(): void {
    if (this.isLoading) return;

    this.isLoading = true;
    this.notificationService.getNotifications(this.page).subscribe({
      next: (response) => {
        this.notifications = response.notifications || [];
        this.hasMore = this.page < response.pagination?.pages;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  loadMore(): void {
    if (this.isLoading || !this.hasMore) return;

    this.page++;
    this.isLoading = true;
    this.notificationService.getNotifications(this.page).subscribe({
      next: (response) => {
        this.notifications = [...this.notifications, ...(response.notifications || [])];
        this.hasMore = this.page < response.pagination?.pages;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  markAsRead(notification: Notification, event: Event): void {
    event.stopPropagation();

    if (notification.isRead) return;

    this.notificationService.markAsRead(notification.id).subscribe({
      next: () => {
        notification.isRead = true;
      }
    });
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.notifications.forEach(n => n.isRead = true);
      }
    });
  }

  handleNotificationClick(notification: Notification): void {
    // Mark as read
    if (!notification.isRead) {
      this.notificationService.markAsRead(notification.id).subscribe();
      notification.isRead = true;
    }

    // Navigate if action URL exists
    if (notification.actionUrl) {
      this.isOpen = false;
      this.router.navigateByUrl(notification.actionUrl);
    }
  }

  deleteNotification(notification: Notification, event: Event): void {
    event.stopPropagation();

    this.notificationService.deleteNotification(notification.id).subscribe({
      next: () => {
        this.notifications = this.notifications.filter(n => n.id !== notification.id);
        if (!notification.isRead) {
          this.notificationService.refreshUnreadCount();
        }
      }
    });
  }

  getIcon(type: NotificationType): string {
    return this.notificationService.getNotificationIcon(type);
  }

  getColor(type: NotificationType): string {
    return this.notificationService.getNotificationColor(type);
  }

  formatTime(dateString: string): string {
    return this.notificationService.formatTimeAgo(dateString);
  }

  viewAllNotifications(): void {
    this.isOpen = false;
    this.router.navigate(['/profile'], { queryParams: { tab: 'notifications' } });
  }
}
