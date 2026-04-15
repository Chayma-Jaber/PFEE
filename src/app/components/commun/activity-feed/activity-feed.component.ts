import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { SocialProofService, SocialProofActivity } from '../../../services/social-proof.service';

@Component({
  selector: 'app-activity-feed',
  standalone: true,
  imports: [CommonModule, RouterModule],
  animations: [
    trigger('listAnimation', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(-20px)' }),
          stagger(100, [
            animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ]),
    trigger('itemAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-20px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ])
    ])
  ],
  template: `
    <div class="activity-feed" [class.compact]="compact" [class.sidebar]="sidebar">
      <div class="feed-header" *ngIf="showHeader">
        <h3>
          <i class="bi bi-activity"></i>
          Activite en direct
        </h3>
        <span class="live-indicator">
          <span class="pulse"></span>
          En direct
        </span>
      </div>

      <div class="feed-list" [@listAnimation]="activities.length">
        <div
          *ngFor="let activity of activities; trackBy: trackByActivityId"
          class="feed-item"
          [@itemAnimation]>

          <a [routerLink]="['/produit', activity.productId]" class="item-content">
            <div class="activity-icon-wrapper" [style.background-color]="getActivityColor(activity)">
              <i [class]="'bi ' + getActivityIcon(activity)"></i>
            </div>

            <div class="item-image" *ngIf="!compact">
              <img
                [src]="activity.productImage"
                [alt]="activity.productName"
                (error)="onImageError($event)">
            </div>

            <div class="item-info">
              <div class="activity-description">
                <span class="user-name">{{ activity.userName }}</span>
                <span class="user-city">de {{ activity.userCity }}</span>
                <span class="action">{{ getActionText(activity) }}</span>
                <span class="product-name">{{ activity.productName }}</span>
              </div>

              <div class="item-meta">
                <span class="time-ago">
                  <i class="bi bi-clock"></i>
                  {{ formatTimeAgo(activity.timestamp) }}
                </span>
                <div *ngIf="activity.type === 'review' && activity.rating" class="rating">
                  <i *ngFor="let star of [1,2,3,4,5]"
                     class="bi"
                     [class.bi-star-fill]="star <= activity.rating!"
                     [class.bi-star]="star > activity.rating!">
                  </i>
                </div>
              </div>
            </div>
          </a>
        </div>
      </div>

      <div class="feed-footer" *ngIf="showViewAll">
        <a routerLink="/shop" class="view-all-link">
          Voir tous les produits
          <i class="bi bi-arrow-right"></i>
        </a>
      </div>
    </div>
  `,
  styles: [`
    .activity-feed {
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .activity-feed.sidebar {
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
      max-height: 500px;
      overflow-y: auto;
    }

    .feed-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #f0f0f0;
      background: #fafafa;
    }

    .feed-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #222;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .feed-header h3 i {
      color: #666;
    }

    .live-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #10b981;
      font-weight: 500;
    }

    .pulse {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.5;
        transform: scale(1.2);
      }
    }

    .feed-list {
      padding: 8px 0;
    }

    .feed-item {
      padding: 0 16px;
    }

    .item-content {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #f5f5f5;
      text-decoration: none;
      color: inherit;
      transition: background 0.2s ease;
    }

    .feed-item:last-child .item-content {
      border-bottom: none;
    }

    .item-content:hover {
      background: #fafafa;
      margin: 0 -16px;
      padding-left: 16px;
      padding-right: 16px;
    }

    .activity-icon-wrapper {
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
    }

    .item-image {
      flex-shrink: 0;
      width: 50px;
      height: 50px;
      border-radius: 8px;
      overflow: hidden;
      background: #f5f5f5;
    }

    .item-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .item-info {
      flex: 1;
      min-width: 0;
    }

    .activity-description {
      font-size: 13px;
      line-height: 1.5;
      color: #444;
    }

    .user-name {
      font-weight: 600;
      color: #222;
    }

    .user-city {
      color: #666;
    }

    .action {
      color: #555;
    }

    .product-name {
      font-weight: 500;
      color: #111;
    }

    .item-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 6px;
    }

    .time-ago {
      font-size: 11px;
      color: #888;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .time-ago i {
      font-size: 10px;
    }

    .rating {
      display: flex;
      gap: 2px;
    }

    .rating i {
      font-size: 10px;
      color: #f59e0b;
    }

    .feed-footer {
      padding: 12px 16px;
      border-top: 1px solid #f0f0f0;
      background: #fafafa;
    }

    .view-all-link {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 500;
      color: #666;
      text-decoration: none;
      transition: color 0.2s ease;
    }

    .view-all-link:hover {
      color: #222;
    }

    /* Compact mode */
    .activity-feed.compact .feed-header {
      padding: 12px 16px;
    }

    .activity-feed.compact .feed-header h3 {
      font-size: 14px;
    }

    .activity-feed.compact .activity-icon-wrapper {
      width: 28px;
      height: 28px;
      font-size: 12px;
    }

    .activity-feed.compact .activity-description {
      font-size: 12px;
    }

    .activity-feed.compact .item-meta {
      margin-top: 4px;
    }

    /* Scrollbar styling */
    .activity-feed.sidebar::-webkit-scrollbar {
      width: 6px;
    }

    .activity-feed.sidebar::-webkit-scrollbar-track {
      background: #f5f5f5;
    }

    .activity-feed.sidebar::-webkit-scrollbar-thumb {
      background: #ddd;
      border-radius: 3px;
    }

    .activity-feed.sidebar::-webkit-scrollbar-thumb:hover {
      background: #ccc;
    }

    @media (max-width: 576px) {
      .feed-header {
        padding: 12px 16px;
      }

      .feed-header h3 {
        font-size: 14px;
      }

      .activity-icon-wrapper {
        width: 32px;
        height: 32px;
        font-size: 13px;
      }

      .item-image {
        width: 45px;
        height: 45px;
      }

      .activity-description {
        font-size: 12px;
      }
    }
  `]
})
export class ActivityFeedComponent implements OnInit, OnDestroy {
  @Input() maxItems = 10;
  @Input() showHeader = true;
  @Input() showViewAll = true;
  @Input() compact = false;
  @Input() sidebar = false;
  @Input() autoRefresh = true;

  activities: SocialProofActivity[] = [];
  private subscription: Subscription | null = null;

  constructor(private socialProofService: SocialProofService) {}

  ngOnInit(): void {
    // Get initial activities
    this.subscription = this.socialProofService.getRecentActivity(this.maxItems)
      .subscribe(activities => {
        this.activities = activities;
      });

    // Start live feed if auto-refresh is enabled
    if (this.autoRefresh) {
      this.socialProofService.startLiveFeed();
    }
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  trackByActivityId(index: number, activity: SocialProofActivity): string {
    return activity.id;
  }

  getActivityIcon(activity: SocialProofActivity): string {
    return this.socialProofService.getActivityIcon(activity.type);
  }

  getActivityColor(activity: SocialProofActivity): string {
    return this.socialProofService.getActivityColor(activity.type);
  }

  getActionText(activity: SocialProofActivity): string {
    return this.socialProofService.getActivityMessage(activity.type);
  }

  formatTimeAgo(date: Date): string {
    return this.socialProofService.formatTimeAgo(date);
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = '/assets/images/placeholder-product.jpg';
  }
}
