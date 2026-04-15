import { Component, OnInit, OnDestroy, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';
import { SocialProofService } from '../../../services/social-proof.service';

@Component({
  selector: 'app-viewers-badge',
  standalone: true,
  imports: [CommonModule],
  animations: [
    trigger('countChange', [
      transition(':increment', [
        style({ transform: 'translateY(-10px)', opacity: 0 }),
        animate('200ms ease-out', style({ transform: 'translateY(0)', opacity: 1 }))
      ]),
      transition(':decrement', [
        style({ transform: 'translateY(10px)', opacity: 0 }),
        animate('200ms ease-out', style({ transform: 'translateY(0)', opacity: 1 }))
      ])
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.9)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ])
    ])
  ],
  template: `
    <div class="viewers-badge" *ngIf="viewerCount > 0" [@fadeIn] [class.compact]="compact" [class.inline]="inline">
      <div class="badge-content">
        <div class="eye-icon" [class.pulsing]="isActive">
          <i class="bi bi-eye"></i>
        </div>
        <div class="viewer-info">
          <span class="count" [@countChange]="viewerCount">{{ viewerCount }}</span>
          <span class="text">{{ getText() }}</span>
        </div>
      </div>
      <div class="activity-indicator" *ngIf="showActivityIndicator && isActive">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    </div>
  `,
  styles: [`
    .viewers-badge {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
      border: 1px solid #e9ecef;
      border-radius: 10px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    }

    .viewers-badge.compact {
      padding: 6px 12px;
      border-radius: 20px;
    }

    .viewers-badge.inline {
      flex-direction: row;
      padding: 8px 14px;
    }

    .badge-content {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .eye-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
      transition: transform 0.3s ease;
    }

    .viewers-badge.compact .eye-icon {
      width: 26px;
      height: 26px;
      font-size: 12px;
    }

    .eye-icon.pulsing {
      animation: pulse-scale 2s ease-in-out infinite;
    }

    @keyframes pulse-scale {
      0%, 100% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4);
      }
      50% {
        transform: scale(1.05);
        box-shadow: 0 0 0 8px rgba(99, 102, 241, 0);
      }
    }

    .viewer-info {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }

    .viewers-badge.inline .viewer-info {
      flex-direction: row;
      align-items: baseline;
      gap: 4px;
    }

    .viewers-badge.compact .viewer-info {
      flex-direction: row;
      align-items: baseline;
      gap: 4px;
    }

    .count {
      font-size: 18px;
      font-weight: 700;
      color: #111;
      display: inline-block;
    }

    .viewers-badge.compact .count {
      font-size: 14px;
    }

    .text {
      font-size: 12px;
      color: #666;
    }

    .viewers-badge.compact .text {
      font-size: 11px;
    }

    .activity-indicator {
      display: flex;
      gap: 4px;
    }

    .activity-indicator .dot {
      width: 4px;
      height: 4px;
      background: #6366f1;
      border-radius: 50%;
      animation: bounce 1.4s ease-in-out infinite;
    }

    .activity-indicator .dot:nth-child(1) {
      animation-delay: 0s;
    }

    .activity-indicator .dot:nth-child(2) {
      animation-delay: 0.2s;
    }

    .activity-indicator .dot:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes bounce {
      0%, 80%, 100% {
        transform: translateY(0);
        opacity: 0.5;
      }
      40% {
        transform: translateY(-4px);
        opacity: 1;
      }
    }

    /* Responsive */
    @media (max-width: 576px) {
      .viewers-badge {
        padding: 8px 12px;
      }

      .eye-icon {
        width: 28px;
        height: 28px;
        font-size: 12px;
      }

      .count {
        font-size: 16px;
      }

      .text {
        font-size: 11px;
      }
    }
  `]
})
export class ViewersBadgeComponent implements OnInit, OnDestroy, OnChanges {
  @Input() productId!: number;
  @Input() compact = false;
  @Input() inline = false;
  @Input() showActivityIndicator = true;

  viewerCount = 0;
  isActive = true;

  private subscription: Subscription | null = null;

  constructor(private socialProofService: SocialProofService) {}

  ngOnInit(): void {
    if (this.productId) {
      this.startTracking();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productId'] && !changes['productId'].firstChange) {
      // Product ID changed, restart tracking
      this.stopTracking();
      this.startTracking();
    }
  }

  ngOnDestroy(): void {
    this.stopTracking();
  }

  private startTracking(): void {
    // Start viewer count updates
    this.socialProofService.startViewerUpdates(this.productId);

    // Subscribe to viewer count changes
    this.subscription = this.socialProofService.viewerCount$.subscribe(data => {
      if (data && data.productId === this.productId) {
        this.viewerCount = data.viewerCount;
      }
    });
  }

  private stopTracking(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    this.socialProofService.stopViewerUpdates();
  }

  getText(): string {
    if (this.viewerCount === 1) {
      return 'personne regarde ce produit';
    }
    return 'personnes regardent ce produit';
  }
}
