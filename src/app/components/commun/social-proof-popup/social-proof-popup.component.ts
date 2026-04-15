import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { SocialProofService, SocialProofActivity } from '../../../services/social-proof.service';

@Component({
  selector: 'app-social-proof-popup',
  standalone: true,
  imports: [CommonModule, RouterModule],
  animations: [
    trigger('slideIn', [
      state('void', style({
        transform: 'translateX(-100%)',
        opacity: 0
      })),
      state('visible', style({
        transform: 'translateX(0)',
        opacity: 1
      })),
      state('hidden', style({
        transform: 'translateX(-100%)',
        opacity: 0
      })),
      transition('void => visible', animate('300ms ease-out')),
      transition('visible => hidden', animate('200ms ease-in'))
    ])
  ],
  template: `
    <div
      *ngIf="isVisible && currentActivity"
      class="social-proof-popup"
      [@slideIn]="animationState"
      (@slideIn.done)="onAnimationDone($event)">

      <button class="close-btn" (click)="dismiss()" aria-label="Fermer">
        <i class="bi bi-x"></i>
      </button>

      <a [routerLink]="['/produit', currentActivity.productId]" class="popup-content">
        <div class="product-image">
          <img
            [src]="currentActivity.productImage"
            [alt]="currentActivity.productName"
            (error)="onImageError($event)">
          <div class="activity-icon" [style.background-color]="getActivityColor()">
            <i [class]="'bi ' + getActivityIcon()"></i>
          </div>
        </div>

        <div class="popup-info">
          <div class="activity-text">
            <span class="user-name">{{ currentActivity.userName }}</span>
            <span class="user-city">de {{ currentActivity.userCity }}</span>
            <span class="action-text">{{ getActionText() }}</span>
          </div>
          <div class="product-name">{{ currentActivity.productName }}</div>
          <div class="time-ago">
            <i class="bi bi-clock"></i>
            {{ formatTimeAgo(currentActivity.timestamp) }}
          </div>
          <div *ngIf="currentActivity.type === 'review' && currentActivity.rating" class="rating">
            <i *ngFor="let star of [1,2,3,4,5]"
               class="bi"
               [class.bi-star-fill]="star <= currentActivity.rating!"
               [class.bi-star]="star > currentActivity.rating!">
            </i>
          </div>
        </div>
      </a>

      <button class="dont-show-btn" (click)="disablePermanently()">
        Ne plus afficher
      </button>
    </div>
  `,
  styles: [`
    .social-proof-popup {
      position: fixed;
      bottom: 20px;
      left: 20px;
      z-index: 1050;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
      max-width: 320px;
      overflow: hidden;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .close-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 24px;
      height: 24px;
      border: none;
      background: rgba(0, 0, 0, 0.05);
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #666;
      transition: all 0.2s ease;
      z-index: 2;
    }

    .close-btn:hover {
      background: rgba(0, 0, 0, 0.1);
      color: #333;
    }

    .popup-content {
      display: flex;
      padding: 16px;
      text-decoration: none;
      color: inherit;
      gap: 12px;
    }

    .popup-content:hover {
      background: #fafafa;
    }

    .product-image {
      position: relative;
      flex-shrink: 0;
      width: 70px;
      height: 70px;
      border-radius: 8px;
      overflow: hidden;
      background: #f5f5f5;
    }

    .product-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .activity-icon {
      position: absolute;
      bottom: -4px;
      right: -4px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 12px;
      border: 2px solid white;
    }

    .popup-info {
      flex: 1;
      min-width: 0;
    }

    .activity-text {
      font-size: 13px;
      color: #444;
      line-height: 1.4;
      margin-bottom: 4px;
    }

    .user-name {
      font-weight: 600;
      color: #222;
    }

    .user-city {
      color: #666;
    }

    .action-text {
      display: block;
      color: #555;
    }

    .product-name {
      font-size: 14px;
      font-weight: 600;
      color: #111;
      margin-bottom: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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
      margin-top: 4px;
      display: flex;
      gap: 2px;
    }

    .rating i {
      font-size: 11px;
      color: #f59e0b;
    }

    .dont-show-btn {
      width: 100%;
      padding: 10px;
      border: none;
      background: #f8f8f8;
      color: #888;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s ease;
      border-top: 1px solid #eee;
    }

    .dont-show-btn:hover {
      background: #f0f0f0;
      color: #666;
    }

    @media (max-width: 480px) {
      .social-proof-popup {
        left: 10px;
        right: 10px;
        bottom: 10px;
        max-width: none;
      }
    }
  `]
})
export class SocialProofPopupComponent implements OnInit, OnDestroy {
  currentActivity: SocialProofActivity | null = null;
  isVisible = false;
  animationState: 'void' | 'visible' | 'hidden' = 'void';

  private subscription: Subscription | null = null;
  private dismissTimeout: any;
  private autoDismissDelay = 5000; // 5 seconds

  constructor(private socialProofService: SocialProofService) {}

  ngOnInit(): void {
    // Start the live feed
    this.socialProofService.startLiveFeed();

    // Subscribe to latest activities
    this.subscription = this.socialProofService.latestActivity$.subscribe(activity => {
      if (activity && this.socialProofService.isPopupEnabled()) {
        this.showActivity(activity);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    if (this.dismissTimeout) {
      clearTimeout(this.dismissTimeout);
    }
    this.socialProofService.stopLiveFeed();
  }

  private showActivity(activity: SocialProofActivity): void {
    // Clear any existing timeout
    if (this.dismissTimeout) {
      clearTimeout(this.dismissTimeout);
    }

    this.currentActivity = activity;
    this.isVisible = true;
    this.animationState = 'visible';

    // Auto-dismiss after delay
    this.dismissTimeout = setTimeout(() => {
      this.dismiss();
    }, this.autoDismissDelay);
  }

  dismiss(): void {
    this.animationState = 'hidden';
  }

  disablePermanently(): void {
    this.socialProofService.disablePopup();
    this.dismiss();
  }

  onAnimationDone(event: any): void {
    if (event.toState === 'hidden') {
      this.isVisible = false;
      this.currentActivity = null;
    }
  }

  getActivityIcon(): string {
    if (!this.currentActivity) return 'bi-bag';
    return this.socialProofService.getActivityIcon(this.currentActivity.type);
  }

  getActivityColor(): string {
    if (!this.currentActivity) return '#10b981';
    return this.socialProofService.getActivityColor(this.currentActivity.type);
  }

  getActionText(): string {
    if (!this.currentActivity) return '';
    return this.socialProofService.getActivityMessage(this.currentActivity.type);
  }

  formatTimeAgo(date: Date): string {
    return this.socialProofService.formatTimeAgo(date);
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = '/assets/images/placeholder-product.jpg';
  }
}
