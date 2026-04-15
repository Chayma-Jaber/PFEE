/**
 * Checkout Rewards Component
 * ==========================
 * Allows users to apply loyalty points and gift cards at checkout.
 */
import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LoyaltyService, LoyaltyAccount, TIER_INFO } from '../../../services/loyalty.service';
import { GiftCardService, GiftCardBalance } from '../../../services/gift-card.service';

export interface RewardsDiscount {
  loyaltyPoints: number;
  loyaltyDiscount: number;
  giftCardCode: string;
  giftCardDiscount: number;
  totalDiscount: number;
}

@Component({
  selector: 'app-checkout-rewards',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="checkout-rewards">
      <h3 class="rewards-title">
        <i class="fas fa-gift"></i>
        Utiliser mes avantages
      </h3>

      <!-- Loyalty Points Section -->
      <div class="rewards-section loyalty-section" *ngIf="isLoggedIn && loyaltyAccount">
        <div class="section-header" (click)="toggleLoyaltySection()">
          <div class="section-title">
            <i class="fas fa-star"></i>
            <span>Points de fidelite</span>
            <span class="tier-badge" [style.backgroundColor]="getTierColor()">
              {{ getTierName() }}
            </span>
          </div>
          <div class="section-toggle">
            <span class="points-available">{{ loyaltyAccount.availablePoints }} pts disponibles</span>
            <i class="fas" [class.fa-chevron-down]="!loyaltyExpanded" [class.fa-chevron-up]="loyaltyExpanded"></i>
          </div>
        </div>

        <div class="section-content" *ngIf="loyaltyExpanded">
          <div class="points-info">
            <span class="conversion-rate">100 points = 1 TND</span>
            <span class="max-discount">Max {{ maxLoyaltyDiscount | number:'1.3-3' }} TND (50% du total)</span>
          </div>

          <div class="points-slider" *ngIf="loyaltyAccount.availablePoints >= 100 && maxLoyaltyDiscount > 0">
            <label>Points a utiliser:</label>
            <div class="slider-container">
              <input
                type="range"
                [(ngModel)]="selectedPoints"
                [min]="0"
                [max]="maxRedeemablePoints"
                [step]="100"
                (change)="onPointsChange()">
              <div class="slider-values">
                <span>0</span>
                <span>{{ maxRedeemablePoints }}</span>
              </div>
            </div>
            <div class="selected-value">
              <span class="points">{{ selectedPoints }} points</span>
              <span class="equals">=</span>
              <span class="discount">{{ selectedPoints / 100 | number:'1.3-3' }} TND</span>
            </div>
          </div>

          <div class="no-points-message" *ngIf="loyaltyAccount.availablePoints < 100">
            <i class="fas fa-info-circle"></i>
            <span>Il vous faut au moins 100 points pour utiliser vos points ({{ loyaltyAccount.availablePoints }} disponibles)</span>
          </div>

          <button
            class="apply-btn"
            *ngIf="selectedPoints > 0 && !loyaltyApplied"
            (click)="applyLoyaltyPoints()">
            Appliquer {{ selectedPoints }} points (-{{ selectedPoints / 100 | number:'1.3-3' }} TND)
          </button>

          <div class="applied-badge" *ngIf="loyaltyApplied">
            <i class="fas fa-check-circle"></i>
            <span>{{ appliedPoints }} points appliques (-{{ appliedPoints / 100 | number:'1.3-3' }} TND)</span>
            <button class="remove-btn" (click)="removeLoyaltyPoints()">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Gift Card Section -->
      <div class="rewards-section giftcard-section">
        <div class="section-header" (click)="toggleGiftCardSection()">
          <div class="section-title">
            <i class="fas fa-credit-card"></i>
            <span>Carte cadeau</span>
          </div>
          <div class="section-toggle">
            <i class="fas" [class.fa-chevron-down]="!giftCardExpanded" [class.fa-chevron-up]="giftCardExpanded"></i>
          </div>
        </div>

        <div class="section-content" *ngIf="giftCardExpanded">
          <div class="giftcard-input" *ngIf="!giftCardApplied">
            <input
              type="text"
              [(ngModel)]="giftCardCode"
              placeholder="BRSH-XXXX-XXXX-XXXX"
              (input)="formatGiftCardCode($event)"
              maxlength="19"
              class="code-input">
            <button
              class="check-btn"
              [disabled]="giftCardCode.length < 16 || isCheckingCard"
              (click)="checkGiftCard()">
              <span *ngIf="!isCheckingCard">Verifier</span>
              <i *ngIf="isCheckingCard" class="fas fa-spinner fa-spin"></i>
            </button>
          </div>

          <!-- Gift Card Balance Result -->
          <div class="giftcard-balance" *ngIf="giftCardBalance && !giftCardApplied">
            <div class="balance-info" [class.valid]="giftCardBalance.isValid" [class.invalid]="!giftCardBalance.isValid">
              <div *ngIf="giftCardBalance.isValid">
                <span class="balance-label">Solde disponible:</span>
                <span class="balance-value">{{ giftCardBalance.currentBalance | number:'1.3-3' }} TND</span>
              </div>
              <div *ngIf="!giftCardBalance.isValid">
                <span class="invalid-message">Carte invalide ou expiree</span>
              </div>
            </div>

            <div class="apply-amount" *ngIf="giftCardBalance.isValid && giftCardBalance.currentBalance > 0">
              <label>Montant a appliquer:</label>
              <input
                type="number"
                [(ngModel)]="giftCardAmount"
                [min]="0.001"
                [max]="maxGiftCardAmount"
                [step]="0.001"
                class="amount-input">
              <span class="max-hint">Max: {{ maxGiftCardAmount | number:'1.3-3' }} TND</span>
            </div>

            <button
              class="apply-btn"
              *ngIf="giftCardBalance.isValid && giftCardAmount > 0"
              (click)="applyGiftCard()">
              Appliquer {{ giftCardAmount | number:'1.3-3' }} TND
            </button>
          </div>

          <div class="applied-badge" *ngIf="giftCardApplied">
            <i class="fas fa-check-circle"></i>
            <span>Carte cadeau appliquee (-{{ appliedGiftCardAmount | number:'1.3-3' }} TND)</span>
            <button class="remove-btn" (click)="removeGiftCard()">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <div class="giftcard-error" *ngIf="giftCardError">
            <i class="fas fa-exclamation-circle"></i>
            <span>{{ giftCardError }}</span>
          </div>
        </div>
      </div>

      <!-- Total Discount Summary -->
      <div class="discount-summary" *ngIf="totalDiscount > 0">
        <div class="summary-row">
          <span>Reduction totale:</span>
          <span class="total-discount">-{{ totalDiscount | number:'1.3-3' }} TND</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .checkout-rewards {
      background: #fff;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    }

    .rewards-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.1rem;
      margin: 0 0 1rem 0;
      padding-bottom: 1rem;
      border-bottom: 1px solid #eee;
    }

    .rewards-title i {
      color: #FFD700;
    }

    .rewards-section {
      border: 1px solid #eee;
      border-radius: 8px;
      margin-bottom: 1rem;
      overflow: hidden;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      background: #f8f8f8;
      cursor: pointer;
      transition: background 0.2s ease;
    }

    .section-header:hover {
      background: #f0f0f0;
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 500;
    }

    .section-title i {
      color: #666;
    }

    .tier-badge {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      color: #fff;
      font-weight: 600;
    }

    .section-toggle {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: #666;
    }

    .points-available {
      font-size: 0.85rem;
      color: #28a745;
      font-weight: 500;
    }

    .section-content {
      padding: 1rem;
      border-top: 1px solid #eee;
    }

    .points-info {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      color: #666;
      margin-bottom: 1rem;
    }

    .points-slider {
      margin-bottom: 1rem;
    }

    .points-slider label {
      display: block;
      font-size: 0.9rem;
      margin-bottom: 0.5rem;
    }

    .slider-container {
      position: relative;
    }

    .slider-container input[type="range"] {
      width: 100%;
      height: 6px;
      -webkit-appearance: none;
      background: #e0e0e0;
      border-radius: 3px;
      outline: none;
    }

    .slider-container input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 20px;
      height: 20px;
      background: #000;
      border-radius: 50%;
      cursor: pointer;
    }

    .slider-values {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: #999;
      margin-top: 0.25rem;
    }

    .selected-value {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem;
      background: #f8f8f8;
      border-radius: 8px;
      margin-top: 0.75rem;
    }

    .selected-value .points {
      font-weight: 600;
    }

    .selected-value .equals {
      color: #999;
    }

    .selected-value .discount {
      color: #28a745;
      font-weight: 600;
    }

    .no-points-message {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem;
      background: #fff3cd;
      border-radius: 8px;
      color: #856404;
      font-size: 0.85rem;
    }

    .apply-btn {
      width: 100%;
      padding: 0.75rem;
      background: #000;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-weight: 500;
      cursor: pointer;
      margin-top: 1rem;
      transition: background 0.2s ease;
    }

    .apply-btn:hover {
      background: #333;
    }

    .applied-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem;
      background: #d4edda;
      border-radius: 8px;
      color: #155724;
    }

    .applied-badge i {
      color: #28a745;
    }

    .remove-btn {
      margin-left: auto;
      background: none;
      border: none;
      color: #dc3545;
      cursor: pointer;
      padding: 0.25rem;
    }

    /* Gift Card Styles */
    .giftcard-input {
      display: flex;
      gap: 0.5rem;
    }

    .code-input {
      flex: 1;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-family: monospace;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .check-btn {
      padding: 0.75rem 1rem;
      background: #000;
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
    }

    .check-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .giftcard-balance {
      margin-top: 1rem;
    }

    .balance-info {
      padding: 1rem;
      border-radius: 8px;
      text-align: center;
    }

    .balance-info.valid {
      background: #d4edda;
      color: #155724;
    }

    .balance-info.invalid {
      background: #f8d7da;
      color: #721c24;
    }

    .balance-label {
      display: block;
      font-size: 0.85rem;
      margin-bottom: 0.25rem;
    }

    .balance-value {
      font-size: 1.5rem;
      font-weight: 700;
    }

    .apply-amount {
      margin-top: 1rem;
    }

    .apply-amount label {
      display: block;
      font-size: 0.9rem;
      margin-bottom: 0.5rem;
    }

    .amount-input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 1rem;
    }

    .max-hint {
      display: block;
      font-size: 0.8rem;
      color: #666;
      margin-top: 0.25rem;
    }

    .giftcard-error {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem;
      background: #f8d7da;
      border-radius: 8px;
      color: #721c24;
      margin-top: 1rem;
      font-size: 0.9rem;
    }

    /* Discount Summary */
    .discount-summary {
      padding-top: 1rem;
      border-top: 2px solid #28a745;
      margin-top: 0.5rem;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
    }

    .total-discount {
      color: #28a745;
      font-size: 1.1rem;
    }

    /* Responsive */
    @media (max-width: 576px) {
      .checkout-rewards {
        padding: 1rem;
      }

      .section-header {
        flex-direction: column;
        gap: 0.5rem;
        align-items: flex-start;
      }

      .section-toggle {
        width: 100%;
        justify-content: space-between;
      }

      .giftcard-input {
        flex-direction: column;
      }
    }
  `]
})
export class CheckoutRewardsComponent implements OnInit, OnDestroy {
  @Input() orderTotal: number = 0;
  @Output() discountChanged = new EventEmitter<RewardsDiscount>();

  private destroy$ = new Subject<void>();

  isLoggedIn = false;
  loyaltyAccount: LoyaltyAccount | null = null;

  // Loyalty
  loyaltyExpanded = false;
  selectedPoints = 0;
  appliedPoints = 0;
  loyaltyApplied = false;

  // Gift Card
  giftCardExpanded = false;
  giftCardCode = '';
  giftCardBalance: GiftCardBalance | null = null;
  giftCardAmount = 0;
  appliedGiftCardAmount = 0;
  appliedGiftCardCode = '';
  giftCardApplied = false;
  isCheckingCard = false;
  giftCardError = '';

  constructor(
    private loyaltyService: LoyaltyService,
    private giftCardService: GiftCardService
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = !!localStorage.getItem('jwt');

    if (this.isLoggedIn) {
      this.loadLoyaltyAccount();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadLoyaltyAccount(): void {
    this.loyaltyService.getAccount()
      .pipe(takeUntil(this.destroy$))
      .subscribe(account => {
        this.loyaltyAccount = account;
      });
  }

  get maxLoyaltyDiscount(): number {
    // Max 50% of order total
    return Math.floor(this.orderTotal * 0.5 * 100) / 100;
  }

  get maxRedeemablePoints(): number {
    if (!this.loyaltyAccount) return 0;
    const maxFromBalance = Math.floor(this.loyaltyAccount.availablePoints / 100) * 100;
    const maxFromOrder = Math.floor(this.maxLoyaltyDiscount * 100);
    return Math.min(maxFromBalance, maxFromOrder);
  }

  get maxGiftCardAmount(): number {
    if (!this.giftCardBalance) return 0;
    const remainingAfterLoyalty = this.orderTotal - (this.appliedPoints / 100);
    return Math.min(this.giftCardBalance.currentBalance, remainingAfterLoyalty);
  }

  get totalDiscount(): number {
    return (this.appliedPoints / 100) + this.appliedGiftCardAmount;
  }

  getTierColor(): string {
    if (!this.loyaltyAccount) return '#CD7F32';
    return TIER_INFO[this.loyaltyAccount.currentTier]?.color || '#CD7F32';
  }

  getTierName(): string {
    if (!this.loyaltyAccount) return 'Bronze';
    return TIER_INFO[this.loyaltyAccount.currentTier]?.displayName || 'Bronze';
  }

  toggleLoyaltySection(): void {
    this.loyaltyExpanded = !this.loyaltyExpanded;
  }

  toggleGiftCardSection(): void {
    this.giftCardExpanded = !this.giftCardExpanded;
  }

  onPointsChange(): void {
    // Round to nearest 100
    this.selectedPoints = Math.round(this.selectedPoints / 100) * 100;
  }

  applyLoyaltyPoints(): void {
    if (this.selectedPoints <= 0) return;

    this.appliedPoints = this.selectedPoints;
    this.loyaltyApplied = true;
    this.emitDiscount();
  }

  removeLoyaltyPoints(): void {
    this.appliedPoints = 0;
    this.selectedPoints = 0;
    this.loyaltyApplied = false;
    this.emitDiscount();
  }

  formatGiftCardCode(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

    const parts = [];
    for (let i = 0; i < value.length && i < 16; i += 4) {
      parts.push(value.substring(i, i + 4));
    }

    this.giftCardCode = parts.join('-');
  }

  checkGiftCard(): void {
    if (this.giftCardCode.length < 16) return;

    this.isCheckingCard = true;
    this.giftCardBalance = null;
    this.giftCardError = '';

    const cleanCode = this.giftCardCode.replace(/-/g, '');

    this.giftCardService.checkBalance(cleanCode)
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.isCheckingCard = false;
        this.giftCardBalance = result;

        if (result.isValid && result.currentBalance > 0) {
          this.giftCardAmount = Math.min(result.currentBalance, this.maxGiftCardAmount);
        }
      });
  }

  applyGiftCard(): void {
    if (!this.giftCardBalance?.isValid || this.giftCardAmount <= 0) return;

    this.appliedGiftCardCode = this.giftCardCode;
    this.appliedGiftCardAmount = this.giftCardAmount;
    this.giftCardApplied = true;
    this.emitDiscount();
  }

  removeGiftCard(): void {
    this.appliedGiftCardCode = '';
    this.appliedGiftCardAmount = 0;
    this.giftCardApplied = false;
    this.giftCardBalance = null;
    this.giftCardCode = '';
    this.giftCardAmount = 0;
    this.emitDiscount();
  }

  private emitDiscount(): void {
    this.discountChanged.emit({
      loyaltyPoints: this.appliedPoints,
      loyaltyDiscount: this.appliedPoints / 100,
      giftCardCode: this.appliedGiftCardCode,
      giftCardDiscount: this.appliedGiftCardAmount,
      totalDiscount: this.totalDiscount
    });
  }
}
