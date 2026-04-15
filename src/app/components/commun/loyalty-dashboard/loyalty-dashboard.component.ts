/**
 * Loyalty Dashboard Component
 * ===========================
 * Displays user's loyalty points, tier status, and transaction history.
 */
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  LoyaltyService,
  LoyaltyAccount,
  PointsTransaction,
  TierInfo,
  LoyaltyTier,
  TIER_INFO
} from '../../../services/loyalty.service';

@Component({
  selector: 'app-loyalty-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="loyalty-dashboard">
      <!-- Loading State -->
      <div class="loading-state" *ngIf="isLoading">
        <div class="spinner"></div>
        <p>Chargement de votre programme fidelite...</p>
      </div>

      <!-- Main Content -->
      <div class="dashboard-content" *ngIf="!isLoading && account">
        <!-- Tier Card -->
        <div class="tier-card" [style.borderColor]="currentTierInfo.color">
          <div class="tier-badge" [style.backgroundColor]="currentTierInfo.color">
            <i [class]="currentTierInfo.icon"></i>
            <span class="tier-name">{{ currentTierInfo.displayName }}</span>
          </div>

          <div class="points-display">
            <div class="available-points">
              <span class="points-value">{{ loyaltyService.formatPoints(account.availablePoints) }}</span>
              <span class="points-label">Points disponibles</span>
            </div>
            <div class="points-value-tnd">
              = {{ loyaltyService.calculateDiscountValue(account.availablePoints) | number:'1.3-3' }} TND
            </div>
          </div>

          <!-- Tier Progress -->
          <div class="tier-progress" *ngIf="account.nextTier">
            <div class="progress-label">
              <span>Progression vers {{ getNextTierInfo()?.displayName }}</span>
              <span>{{ account.tierProgress }}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="account.tierProgress" [style.backgroundColor]="currentTierInfo.color"></div>
            </div>
            <div class="points-to-next">
              <i class="fas fa-info-circle"></i>
              {{ loyaltyService.formatPoints(account.pointsToNextTier) }} points pour atteindre {{ getNextTierInfo()?.displayName }}
            </div>
          </div>

          <div class="tier-maxed" *ngIf="!account.nextTier">
            <i class="fas fa-crown"></i>
            <span>Vous avez atteint le niveau maximum !</span>
          </div>
        </div>

        <!-- Points Redemption -->
        <div class="redemption-section" *ngIf="account.availablePoints >= 100">
          <h3>Utiliser vos points</h3>
          <p class="redemption-info">100 points = 1 TND de reduction</p>

          <div class="redemption-options">
            <button
              *ngFor="let option of redemptionOptions"
              class="redemption-btn"
              [disabled]="account.availablePoints < option.points"
              (click)="redeemPoints(option.points)">
              <span class="points">{{ option.points }} pts</span>
              <span class="value">{{ option.value }} TND</span>
            </button>
          </div>

          <div class="custom-redemption">
            <input
              type="number"
              [(ngModel)]="customPoints"
              [min]="100"
              [max]="account.availablePoints"
              [step]="100"
              placeholder="Points personnalises">
            <button
              class="redeem-custom-btn"
              [disabled]="!customPoints || customPoints < 100 || customPoints > account.availablePoints"
              (click)="redeemPoints(customPoints)">
              Utiliser
            </button>
          </div>

          <div class="redemption-message" *ngIf="redemptionMessage" [class.success]="redemptionSuccess" [class.error]="!redemptionSuccess">
            {{ redemptionMessage }}
          </div>
        </div>

        <!-- Tier Benefits -->
        <div class="benefits-section">
          <h3>Vos avantages {{ currentTierInfo.displayName }}</h3>
          <ul class="benefits-list">
            <li *ngFor="let benefit of currentTierInfo.benefits">
              <i class="fas fa-check"></i>
              {{ benefit }}
            </li>
          </ul>
        </div>

        <!-- All Tiers Overview -->
        <div class="tiers-overview">
          <h3>Niveaux du programme</h3>
          <div class="tiers-grid">
            <div
              *ngFor="let tier of allTiers"
              class="tier-item"
              [class.current]="tier.name === account.currentTier"
              [class.achieved]="isTierAchieved(tier.name)">
              <div class="tier-icon" [style.backgroundColor]="tier.color">
                <i [class]="tier.icon"></i>
              </div>
              <div class="tier-details">
                <span class="tier-title">{{ tier.displayName }}</span>
                <span class="tier-points">{{ tier.minimumPoints }}+ pts</span>
                <span class="tier-multiplier">x{{ tier.pointsMultiplier }} points</span>
              </div>
              <div class="tier-status" *ngIf="tier.name === account.currentTier">
                <i class="fas fa-check-circle"></i>
              </div>
            </div>
          </div>
        </div>

        <!-- Transaction History -->
        <div class="history-section">
          <h3>Historique des points</h3>

          <div class="history-empty" *ngIf="transactions.length === 0">
            <i class="fas fa-history"></i>
            <p>Aucune transaction pour le moment</p>
          </div>

          <div class="transactions-list" *ngIf="transactions.length > 0">
            <div class="transaction-item" *ngFor="let tx of transactions">
              <div class="tx-icon" [class.positive]="tx.points > 0" [class.negative]="tx.points < 0">
                <i [class]="loyaltyService.getTransactionIcon(tx.transactionType)"></i>
              </div>
              <div class="tx-details">
                <span class="tx-type">{{ loyaltyService.getTransactionTypeLabel(tx.transactionType) }}</span>
                <span class="tx-description">{{ tx.description }}</span>
                <span class="tx-date">{{ tx.createdAt | date:'dd MMM yyyy, HH:mm' }}</span>
              </div>
              <div class="tx-points" [class.positive]="tx.points > 0" [class.negative]="tx.points < 0">
                {{ tx.points > 0 ? '+' : '' }}{{ loyaltyService.formatPoints(tx.points) }} pts
              </div>
            </div>
          </div>

          <!-- Load More -->
          <button
            class="load-more-btn"
            *ngIf="hasMoreTransactions"
            (click)="loadMoreTransactions()">
            <span *ngIf="!loadingMore">Voir plus</span>
            <span *ngIf="loadingMore"><i class="fas fa-spinner fa-spin"></i></span>
          </button>
        </div>

        <!-- Stats Summary -->
        <div class="stats-summary">
          <div class="stat-item">
            <i class="fas fa-coins"></i>
            <span class="stat-value">{{ loyaltyService.formatPoints(account.totalPointsEarned) }}</span>
            <span class="stat-label">Points totaux gagnes</span>
          </div>
          <div class="stat-item">
            <i class="fas fa-calendar-alt"></i>
            <span class="stat-value">{{ account.createdAt | date:'MMM yyyy' }}</span>
            <span class="stat-label">Membre depuis</span>
          </div>
        </div>
      </div>

      <!-- Not Logged In -->
      <div class="not-logged-in" *ngIf="!isLoading && !account">
        <i class="fas fa-gift"></i>
        <h3>Rejoignez notre programme fidelite</h3>
        <p>Connectez-vous pour accumuler des points et beneficier d'avantages exclusifs</p>
        <a routerLink="/login" class="login-btn">Se connecter</a>
      </div>
    </div>
  `,
  styles: [`
    .loyalty-dashboard {
      padding: 1.5rem;
      max-width: 800px;
      margin: 0 auto;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      color: #666;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #f0f0f0;
      border-top-color: #000;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Tier Card */
    .tier-card {
      background: linear-gradient(135deg, #fff 0%, #f8f8f8 100%);
      border-radius: 16px;
      padding: 2rem;
      margin-bottom: 2rem;
      border: 2px solid;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }

    .tier-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      color: #fff;
      font-weight: 600;
      margin-bottom: 1.5rem;
    }

    .tier-badge i {
      font-size: 1.2rem;
    }

    .points-display {
      text-align: center;
      margin-bottom: 1.5rem;
    }

    .available-points {
      display: flex;
      flex-direction: column;
    }

    .points-value {
      font-size: 3rem;
      font-weight: 700;
      color: #000;
      line-height: 1;
    }

    .points-label {
      font-size: 0.9rem;
      color: #666;
      margin-top: 0.5rem;
    }

    .points-value-tnd {
      font-size: 1.2rem;
      color: #333;
      margin-top: 0.5rem;
    }

    .tier-progress {
      margin-top: 1.5rem;
    }

    .progress-label {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
      font-size: 0.85rem;
      color: #666;
    }

    .progress-bar {
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.5s ease;
    }

    .points-to-next {
      font-size: 0.8rem;
      color: #888;
      margin-top: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .tier-maxed {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 1rem;
      background: linear-gradient(135deg, #FFD700, #FFA500);
      border-radius: 8px;
      color: #fff;
      font-weight: 600;
      margin-top: 1rem;
    }

    /* Redemption Section */
    .redemption-section {
      background: #fff;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    }

    .redemption-section h3 {
      margin: 0 0 0.5rem 0;
      font-size: 1.1rem;
    }

    .redemption-info {
      color: #666;
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }

    .redemption-options {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .redemption-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1rem;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      background: #fff;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .redemption-btn:hover:not(:disabled) {
      border-color: #000;
      background: #f8f8f8;
    }

    .redemption-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .redemption-btn .points {
      font-weight: 600;
      color: #333;
    }

    .redemption-btn .value {
      font-size: 0.85rem;
      color: #666;
    }

    .custom-redemption {
      display: flex;
      gap: 0.5rem;
    }

    .custom-redemption input {
      flex: 1;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 1rem;
    }

    .redeem-custom-btn {
      padding: 0.75rem 1.5rem;
      background: #000;
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
    }

    .redeem-custom-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .redemption-message {
      margin-top: 1rem;
      padding: 0.75rem;
      border-radius: 8px;
      text-align: center;
    }

    .redemption-message.success {
      background: #d4edda;
      color: #155724;
    }

    .redemption-message.error {
      background: #f8d7da;
      color: #721c24;
    }

    /* Benefits Section */
    .benefits-section {
      background: #fff;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    }

    .benefits-section h3 {
      margin: 0 0 1rem 0;
      font-size: 1.1rem;
    }

    .benefits-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .benefits-list li {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0;
      color: #333;
    }

    .benefits-list li i {
      color: #28a745;
    }

    /* Tiers Overview */
    .tiers-overview {
      margin-bottom: 2rem;
    }

    .tiers-overview h3 {
      margin: 0 0 1rem 0;
      font-size: 1.1rem;
    }

    .tiers-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
    }

    .tier-item {
      background: #fff;
      border-radius: 12px;
      padding: 1rem;
      text-align: center;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      position: relative;
      opacity: 0.6;
      transition: all 0.2s ease;
    }

    .tier-item.achieved,
    .tier-item.current {
      opacity: 1;
    }

    .tier-item.current {
      border: 2px solid #000;
    }

    .tier-icon {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 0.75rem;
      color: #fff;
    }

    .tier-icon i {
      font-size: 1.5rem;
    }

    .tier-details {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .tier-title {
      font-weight: 600;
    }

    .tier-points,
    .tier-multiplier {
      font-size: 0.8rem;
      color: #666;
    }

    .tier-status {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      color: #28a745;
    }

    /* History Section */
    .history-section {
      background: #fff;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    }

    .history-section h3 {
      margin: 0 0 1rem 0;
      font-size: 1.1rem;
    }

    .history-empty {
      text-align: center;
      padding: 2rem;
      color: #999;
    }

    .history-empty i {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    .transactions-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .transaction-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem;
      background: #f8f8f8;
      border-radius: 8px;
    }

    .tx-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      flex-shrink: 0;
    }

    .tx-icon.positive {
      background: #28a745;
    }

    .tx-icon.negative {
      background: #dc3545;
    }

    .tx-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .tx-type {
      font-weight: 500;
      font-size: 0.9rem;
    }

    .tx-description {
      font-size: 0.8rem;
      color: #666;
    }

    .tx-date {
      font-size: 0.75rem;
      color: #999;
    }

    .tx-points {
      font-weight: 600;
      font-size: 0.95rem;
    }

    .tx-points.positive {
      color: #28a745;
    }

    .tx-points.negative {
      color: #dc3545;
    }

    .load-more-btn {
      width: 100%;
      padding: 0.75rem;
      background: #f0f0f0;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      margin-top: 1rem;
      font-weight: 500;
    }

    .load-more-btn:hover {
      background: #e0e0e0;
    }

    /* Stats Summary */
    .stats-summary {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }

    .stat-item {
      background: #fff;
      border-radius: 12px;
      padding: 1.5rem;
      text-align: center;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    }

    .stat-item i {
      font-size: 1.5rem;
      color: #666;
      margin-bottom: 0.5rem;
    }

    .stat-value {
      display: block;
      font-size: 1.5rem;
      font-weight: 700;
      color: #000;
    }

    .stat-label {
      font-size: 0.8rem;
      color: #666;
    }

    /* Not Logged In */
    .not-logged-in {
      text-align: center;
      padding: 3rem;
      background: #f8f8f8;
      border-radius: 16px;
    }

    .not-logged-in i {
      font-size: 3rem;
      color: #ccc;
      margin-bottom: 1rem;
    }

    .not-logged-in h3 {
      margin: 0 0 0.5rem 0;
    }

    .not-logged-in p {
      color: #666;
      margin-bottom: 1.5rem;
    }

    .login-btn {
      display: inline-block;
      padding: 0.75rem 2rem;
      background: #000;
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
    }

    /* Responsive */
    @media (max-width: 576px) {
      .loyalty-dashboard {
        padding: 1rem;
      }

      .tier-card {
        padding: 1.5rem;
      }

      .points-value {
        font-size: 2.5rem;
      }

      .tiers-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .stats-summary {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class LoyaltyDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  account: LoyaltyAccount | null = null;
  transactions: PointsTransaction[] = [];
  isLoading = true;
  loadingMore = false;
  hasMoreTransactions = false;
  currentPage = 1;

  // Redemption
  customPoints: number = 0;
  redemptionMessage = '';
  redemptionSuccess = false;

  redemptionOptions = [
    { points: 500, value: 5 },
    { points: 1000, value: 10 },
    { points: 2000, value: 20 },
    { points: 5000, value: 50 }
  ];

  allTiers: TierInfo[] = Object.values(TIER_INFO);

  constructor(public loyaltyService: LoyaltyService) {}

  ngOnInit(): void {
    if (localStorage.getItem('jwt')) {
      this.loadData();
    } else {
      this.isLoading = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadData(): void {
    this.loyaltyService.getAccount()
      .pipe(takeUntil(this.destroy$))
      .subscribe(account => {
        this.account = account;
        this.isLoading = false;
      });

    this.loadTransactions();
  }

  private loadTransactions(): void {
    this.loyaltyService.getHistory(this.currentPage, 10)
      .pipe(takeUntil(this.destroy$))
      .subscribe(response => {
        this.transactions = response.transactions;
        this.hasMoreTransactions = response.pagination.page < response.pagination.pages;
      });
  }

  loadMoreTransactions(): void {
    if (this.loadingMore) return;

    this.loadingMore = true;
    this.currentPage++;

    this.loyaltyService.getHistory(this.currentPage, 10)
      .pipe(takeUntil(this.destroy$))
      .subscribe(response => {
        this.transactions = [...this.transactions, ...response.transactions];
        this.hasMoreTransactions = response.pagination.page < response.pagination.pages;
        this.loadingMore = false;
      });
  }

  get currentTierInfo(): TierInfo {
    return this.account
      ? TIER_INFO[this.account.currentTier]
      : TIER_INFO['bronze'];
  }

  getNextTierInfo(): TierInfo | null {
    if (!this.account?.nextTier) return null;
    return TIER_INFO[this.account.nextTier];
  }

  isTierAchieved(tierName: string): boolean {
    if (!this.account) return false;
    const tierOrder: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum'];
    const currentIndex = tierOrder.indexOf(this.account.currentTier);
    const tierIndex = tierOrder.indexOf(tierName as LoyaltyTier);
    return tierIndex <= currentIndex;
  }

  redeemPoints(points: number): void {
    if (!points || points < 100) return;

    this.redemptionMessage = '';

    this.loyaltyService.redeemPoints(points)
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.redemptionSuccess = result.success;
        this.redemptionMessage = result.message;

        if (result.success) {
          // Refresh data
          this.loadData();
          this.customPoints = 0;
        }

        // Clear message after 5 seconds
        setTimeout(() => {
          this.redemptionMessage = '';
        }, 5000);
      });
  }
}
