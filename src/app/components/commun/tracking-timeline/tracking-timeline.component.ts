import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TrackingStep {
  id: number;
  label: string;
  description?: string;
  timestamp?: Date | string;
  icon: string;
}

@Component({
  selector: 'app-tracking-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tracking-timeline">
      <div
        *ngFor="let step of steps; let i = index; let last = last"
        class="timeline-item"
        [class.completed]="i < currentStep"
        [class.current]="i === currentStep"
        [class.pending]="i > currentStep"
      >
        <!-- Connector Line (before step) -->
        <div class="timeline-connector">
          <div
            class="connector-line"
            [class.completed]="i < currentStep"
            [class.current]="i === currentStep"
            *ngIf="i > 0"
          ></div>
        </div>

        <!-- Step Circle with Icon -->
        <div class="timeline-step">
          <div
            class="step-circle"
            [class.completed]="i < currentStep"
            [class.current]="i === currentStep"
            [class.pending]="i > currentStep"
          >
            <i *ngIf="i < currentStep" class="fa fa-check"></i>
            <i *ngIf="i >= currentStep" [class]="'fa ' + step.icon"></i>
          </div>

          <!-- Pulse animation for current step -->
          <div *ngIf="i === currentStep" class="pulse-ring"></div>
        </div>

        <!-- Step Content -->
        <div class="timeline-content">
          <h4 class="step-label">{{ step.label }}</h4>
          <p *ngIf="step.description" class="step-description">{{ step.description }}</p>
          <span *ngIf="step.timestamp && i <= currentStep" class="step-timestamp">
            <i class="fa fa-clock"></i>
            {{ formatTimestamp(step.timestamp) }}
          </span>
          <span *ngIf="i > currentStep" class="step-pending-text">En attente</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tracking-timeline {
      display: flex;
      flex-direction: column;
      gap: 0;
      padding: 16px 0;
    }

    .timeline-item {
      display: flex;
      align-items: flex-start;
      position: relative;
      padding-left: 60px;
      min-height: 80px;
    }

    .timeline-connector {
      position: absolute;
      left: 23px;
      top: -40px;
      height: 40px;
      width: 2px;
    }

    .connector-line {
      width: 2px;
      height: 100%;
      background-color: #e5e5e5;
      transition: background-color 0.3s ease;
    }

    .connector-line.completed {
      background-color: #22c55e;
    }

    .connector-line.current {
      background: linear-gradient(to bottom, #22c55e, #e5e5e5);
    }

    .timeline-step {
      position: absolute;
      left: 0;
      top: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .step-circle {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      transition: all 0.3s ease;
      position: relative;
      z-index: 2;
    }

    .step-circle.completed {
      background-color: #22c55e;
      color: #fff;
      border: 2px solid #22c55e;
    }

    .step-circle.current {
      background-color: #000;
      color: #fff;
      border: 2px solid #000;
      animation: bounce 2s infinite;
    }

    .step-circle.pending {
      background-color: #f5f5f5;
      color: #999;
      border: 2px solid #e5e5e5;
    }

    .pulse-ring {
      position: absolute;
      left: 0;
      top: 0;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 2px solid #000;
      animation: pulse 2s infinite;
      z-index: 1;
    }

    @keyframes pulse {
      0% {
        transform: scale(1);
        opacity: 1;
      }
      50% {
        transform: scale(1.3);
        opacity: 0;
      }
      100% {
        transform: scale(1);
        opacity: 0;
      }
    }

    @keyframes bounce {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-3px);
      }
    }

    .timeline-content {
      flex: 1;
      padding-top: 4px;
    }

    .step-label {
      font-family: 'std95', 'Avenir LT Std', Helvetica, Arial, sans-serif;
      font-size: 16px;
      font-weight: 600;
      color: #000;
      margin: 0 0 4px 0;
    }

    .timeline-item.pending .step-label {
      color: #999;
    }

    .step-description {
      font-size: 13px;
      color: #666;
      margin: 0 0 6px 0;
      line-height: 1.4;
    }

    .step-timestamp {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #22c55e;
      font-weight: 500;
    }

    .step-timestamp i {
      font-size: 11px;
    }

    .step-pending-text {
      font-size: 12px;
      color: #999;
      font-style: italic;
    }

    /* Responsive */
    @media (max-width: 640px) {
      .timeline-item {
        padding-left: 50px;
        min-height: 70px;
      }

      .step-circle {
        width: 40px;
        height: 40px;
        font-size: 16px;
      }

      .pulse-ring {
        width: 40px;
        height: 40px;
      }

      .timeline-connector {
        left: 19px;
      }

      .step-label {
        font-size: 14px;
      }

      .step-description {
        font-size: 12px;
      }
    }
  `]
})
export class TrackingTimelineComponent {
  @Input() steps: TrackingStep[] = [];
  @Input() currentStep: number = 0;

  formatTimestamp(timestamp: Date | string): string {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
