import { Component, Input, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-flash-sale-countdown',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="countdown-container" [class.urgent]="isUrgent" [class.compact]="compact">
      <div class="countdown-label" *ngIf="showLabel">{{ label }}</div>
      <div class="countdown-timer">
        <div class="time-block" *ngIf="showDays && timeRemaining.days > 0">
          <div class="time-value" [class.animate]="animateDigits">
            <span class="digit">{{ formatNumber(timeRemaining.days) }}</span>
          </div>
          <div class="time-label">{{ compact ? 'J' : 'Jours' }}</div>
        </div>
        <div class="separator" *ngIf="showDays && timeRemaining.days > 0">:</div>

        <div class="time-block">
          <div class="time-value" [class.animate]="animateDigits">
            <span class="digit">{{ formatNumber(timeRemaining.hours) }}</span>
          </div>
          <div class="time-label">{{ compact ? 'H' : 'Heures' }}</div>
        </div>
        <div class="separator">:</div>

        <div class="time-block">
          <div class="time-value" [class.animate]="animateDigits">
            <span class="digit">{{ formatNumber(timeRemaining.minutes) }}</span>
          </div>
          <div class="time-label">{{ compact ? 'M' : 'Minutes' }}</div>
        </div>
        <div class="separator">:</div>

        <div class="time-block">
          <div class="time-value" [class.animate]="animateDigits && isUrgent">
            <span class="digit pulse">{{ formatNumber(timeRemaining.seconds) }}</span>
          </div>
          <div class="time-label">{{ compact ? 'S' : 'Secondes' }}</div>
        </div>
      </div>

      <div class="urgent-badge" *ngIf="isUrgent && showUrgentBadge">
        <i class="fas fa-fire"></i> Derniere chance !
      </div>
    </div>
  `,
  styles: [`
    .countdown-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .countdown-label {
      font-size: 14px;
      font-weight: 500;
      color: inherit;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .countdown-timer {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .time-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 60px;
    }

    .compact .time-block {
      min-width: 40px;
    }

    .time-value {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      padding: 8px 12px;
      min-width: 50px;
      text-align: center;
    }

    .compact .time-value {
      padding: 4px 8px;
      min-width: 36px;
      border-radius: 4px;
    }

    .digit {
      font-size: 28px;
      font-weight: 700;
      font-family: 'Roboto Mono', monospace;
      color: inherit;
      display: inline-block;
      transition: transform 0.3s ease;
    }

    .compact .digit {
      font-size: 18px;
    }

    .time-value.animate .digit {
      animation: flipIn 0.3s ease;
    }

    .digit.pulse {
      animation: pulse 1s infinite;
    }

    .time-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
      opacity: 0.8;
    }

    .compact .time-label {
      font-size: 8px;
      margin-top: 2px;
    }

    .separator {
      font-size: 24px;
      font-weight: 700;
      opacity: 0.7;
      margin: 0 2px;
      padding-bottom: 20px;
    }

    .compact .separator {
      font-size: 16px;
      padding-bottom: 14px;
    }

    /* Urgent styling */
    .urgent .time-value {
      background: rgba(255, 0, 0, 0.3);
      animation: urgentPulse 2s infinite;
    }

    .urgent .digit {
      color: #FFD700;
    }

    .urgent-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #FF4444, #FF6B35);
      color: white;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      animation: urgentBadge 1.5s infinite;
    }

    .urgent-badge i {
      animation: flame 0.5s infinite alternate;
    }

    @keyframes flipIn {
      0% {
        transform: rotateX(90deg);
        opacity: 0;
      }
      100% {
        transform: rotateX(0);
        opacity: 1;
      }
    }

    @keyframes pulse {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.05);
      }
    }

    @keyframes urgentPulse {
      0%, 100% {
        background: rgba(255, 0, 0, 0.3);
        box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.4);
      }
      50% {
        background: rgba(255, 0, 0, 0.5);
        box-shadow: 0 0 20px 5px rgba(255, 0, 0, 0.3);
      }
    }

    @keyframes urgentBadge {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.05);
      }
    }

    @keyframes flame {
      0% {
        transform: rotate(-5deg) scale(1);
      }
      100% {
        transform: rotate(5deg) scale(1.1);
      }
    }

    /* Responsive */
    @media (max-width: 576px) {
      .time-block {
        min-width: 50px;
      }

      .digit {
        font-size: 22px;
      }

      .time-value {
        padding: 6px 10px;
        min-width: 42px;
      }

      .separator {
        font-size: 20px;
      }

      .compact .time-block {
        min-width: 32px;
      }

      .compact .digit {
        font-size: 14px;
      }
    }
  `]
})
export class FlashSaleCountdownComponent implements OnInit, OnDestroy {
  @Input() endTime!: Date | string;
  @Input() label: string = 'Se termine dans';
  @Input() showLabel: boolean = true;
  @Input() showDays: boolean = true;
  @Input() showUrgentBadge: boolean = true;
  @Input() compact: boolean = false;
  @Input() animateDigits: boolean = true;

  @Output() expired = new EventEmitter<void>();

  timeRemaining = { days: 0, hours: 0, minutes: 0, seconds: 0 };
  isUrgent = false;
  private intervalId: any;
  private lastSecond = -1;

  ngOnInit(): void {
    this.updateCountdown();
    this.intervalId = setInterval(() => this.updateCountdown(), 1000);
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private updateCountdown(): void {
    const now = new Date().getTime();
    const end = new Date(this.endTime).getTime();
    const diff = end - now;

    if (diff <= 0) {
      this.timeRemaining = { days: 0, hours: 0, minutes: 0, seconds: 0 };
      this.isUrgent = false;
      this.expired.emit();
      if (this.intervalId) {
        clearInterval(this.intervalId);
      }
      return;
    }

    const oneHour = 60 * 60 * 1000;
    this.isUrgent = diff < oneHour;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    // Trigger animation when second changes
    if (seconds !== this.lastSecond) {
      this.lastSecond = seconds;
    }

    this.timeRemaining = { days, hours, minutes, seconds };
  }

  formatNumber(num: number): string {
    return num.toString().padStart(2, '0');
  }
}
