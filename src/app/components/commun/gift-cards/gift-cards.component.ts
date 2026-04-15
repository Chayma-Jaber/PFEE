/**
 * Gift Cards Component
 * ====================
 * Allows users to purchase, check balance, and manage gift cards.
 */
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  GiftCardService,
  GiftCard,
  GIFT_CARD_AMOUNTS
} from '../../../services/gift-card.service';

type ViewMode = 'browse' | 'purchase' | 'check' | 'my-cards';

@Component({
  selector: 'app-gift-cards',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="gift-cards-container">
      <!-- Header -->
      <div class="gc-header">
        <h2>Cartes Cadeaux Barsha</h2>
        <p>Offrez le plaisir de choisir avec une carte cadeau Barsha</p>
      </div>

      <!-- Navigation Tabs -->
      <div class="gc-tabs">
        <button
          class="tab-btn"
          [class.active]="viewMode === 'browse'"
          (click)="viewMode = 'browse'">
          <i class="fas fa-gift"></i>
          Acheter
        </button>
        <button
          class="tab-btn"
          [class.active]="viewMode === 'check'"
          (click)="viewMode = 'check'">
          <i class="fas fa-search"></i>
          Verifier le solde
        </button>
        <button
          class="tab-btn"
          *ngIf="isLoggedIn"
          [class.active]="viewMode === 'my-cards'"
          (click)="viewMode = 'my-cards'; loadMyCards()">
          <i class="fas fa-wallet"></i>
          Mes cartes
        </button>
      </div>

      <!-- Browse / Purchase View -->
      <div class="gc-view" *ngIf="viewMode === 'browse' || viewMode === 'purchase'">
        <!-- Amount Selection -->
        <div class="amount-selection" *ngIf="viewMode === 'browse'">
          <h3>Choisissez un montant</h3>
          <div class="amount-grid">
            <button
              *ngFor="let amount of availableAmounts"
              class="amount-btn"
              [class.selected]="selectedAmount === amount"
              (click)="selectAmount(amount)">
              {{ amount }} TND
            </button>
          </div>
        </div>

        <!-- Purchase Form -->
        <div class="purchase-form" *ngIf="viewMode === 'purchase'">
          <div class="selected-amount-display">
            <span class="amount-label">Carte cadeau</span>
            <span class="amount-value">{{ selectedAmount }} TND</span>
            <button class="change-btn" (click)="viewMode = 'browse'">Modifier</button>
          </div>

          <div class="form-section">
            <h4>Destinataire (optionnel)</h4>
            <div class="form-group">
              <label>Nom du destinataire</label>
              <input
                type="text"
                [(ngModel)]="recipientName"
                placeholder="Ex: Marie Dupont">
            </div>
            <div class="form-group">
              <label>Email du destinataire</label>
              <input
                type="email"
                [(ngModel)]="recipientEmail"
                placeholder="Ex: marie@email.com">
            </div>
            <div class="form-group">
              <label>Message personnel</label>
              <textarea
                [(ngModel)]="personalMessage"
                rows="3"
                placeholder="Ecrivez un message pour le destinataire..."
                maxlength="200"></textarea>
              <span class="char-count">{{ personalMessage.length }}/200</span>
            </div>
          </div>

          <!-- Preview Card -->
          <div class="card-preview">
            <div class="preview-card">
              <div class="card-brand">BARSHA</div>
              <div class="card-amount">{{ selectedAmount }} TND</div>
              <div class="card-message" *ngIf="personalMessage">
                "{{ personalMessage }}"
              </div>
              <div class="card-recipient" *ngIf="recipientName">
                Pour: {{ recipientName }}
              </div>
            </div>
          </div>

          <button
            class="purchase-btn"
            [disabled]="isPurchasing"
            (click)="purchaseGiftCard()">
            <span *ngIf="!isPurchasing">Acheter la carte cadeau - {{ selectedAmount }} TND</span>
            <span *ngIf="isPurchasing"><i class="fas fa-spinner fa-spin"></i> Traitement...</span>
          </button>

          <div class="message" *ngIf="purchaseMessage" [class.success]="purchaseSuccess" [class.error]="!purchaseSuccess">
            {{ purchaseMessage }}
          </div>
        </div>

        <button
          *ngIf="viewMode === 'browse' && selectedAmount"
          class="continue-btn"
          (click)="viewMode = 'purchase'">
          Continuer
        </button>
      </div>

      <!-- Check Balance View -->
      <div class="gc-view" *ngIf="viewMode === 'check'">
        <div class="balance-check">
          <h3>Verifier le solde d'une carte cadeau</h3>

          <div class="code-input-group">
            <input
              type="text"
              [(ngModel)]="checkCode"
              placeholder="BRSH-XXXX-XXXX-XXXX"
              (input)="formatCodeInput($event)"
              maxlength="19">
            <button
              class="check-btn"
              [disabled]="checkCode.length < 16 || isChecking"
              (click)="checkBalance()">
              <span *ngIf="!isChecking">Verifier</span>
              <span *ngIf="isChecking"><i class="fas fa-spinner fa-spin"></i></span>
            </button>
          </div>

          <!-- Balance Result -->
          <div class="balance-result" *ngIf="balanceResult">
            <div class="result-card" [class.valid]="balanceResult.isValid" [class.invalid]="!balanceResult.isValid">
              <div class="result-icon">
                <i [class]="balanceResult.isValid ? 'fas fa-check-circle' : 'fas fa-times-circle'"></i>
              </div>
              <div class="result-details" *ngIf="balanceResult.isValid">
                <span class="result-balance">{{ balanceResult.currentBalance }} TND</span>
                <span class="result-label">Solde disponible</span>
                <span class="result-info">
                  Valeur initiale: {{ balanceResult.initialValue }} TND
                </span>
                <span class="result-expiry">
                  Expire le: {{ balanceResult.expiresAt | date:'dd/MM/yyyy' }}
                </span>
              </div>
              <div class="result-details" *ngIf="!balanceResult.isValid">
                <span class="result-label">Carte invalide ou expiree</span>
                <span class="result-info">
                  Veuillez verifier le code et reessayer
                </span>
              </div>
            </div>

            <!-- Redeem Option -->
            <div class="redeem-option" *ngIf="balanceResult.isValid && isLoggedIn && balanceResult.currentBalance > 0">
              <button
                class="redeem-btn"
                [disabled]="isRedeeming"
                (click)="redeemCard()">
                <span *ngIf="!isRedeeming">Ajouter a mon compte</span>
                <span *ngIf="isRedeeming"><i class="fas fa-spinner fa-spin"></i></span>
              </button>
            </div>
          </div>

          <div class="message" *ngIf="checkMessage" [class.success]="checkSuccess" [class.error]="!checkSuccess">
            {{ checkMessage }}
          </div>
        </div>
      </div>

      <!-- My Cards View -->
      <div class="gc-view" *ngIf="viewMode === 'my-cards'">
        <div class="my-cards">
          <h3>Mes cartes cadeaux</h3>

          <!-- Store Credit Balance -->
          <div class="store-credit" *ngIf="storeCredit > 0">
            <div class="credit-icon">
              <i class="fas fa-wallet"></i>
            </div>
            <div class="credit-details">
              <span class="credit-label">Credit boutique disponible</span>
              <span class="credit-value">{{ storeCredit }} TND</span>
            </div>
          </div>

          <!-- Loading -->
          <div class="loading" *ngIf="isLoadingCards">
            <div class="spinner"></div>
            <p>Chargement de vos cartes...</p>
          </div>

          <!-- Empty State -->
          <div class="empty-state" *ngIf="!isLoadingCards && myCards.length === 0">
            <i class="fas fa-gift"></i>
            <p>Vous n'avez pas encore de cartes cadeaux</p>
            <button class="buy-btn" (click)="viewMode = 'browse'">Acheter une carte</button>
          </div>

          <!-- Cards List -->
          <div class="cards-list" *ngIf="!isLoadingCards && myCards.length > 0">
            <div class="card-item" *ngFor="let card of myCards">
              <div class="card-visual" [class]="giftCardService.getStatusClass(card.status)">
                <div class="card-logo">BARSHA</div>
                <div class="card-code">{{ giftCardService.formatCode(card.code) }}</div>
                <div class="card-balance">{{ card.currentBalance }} TND</div>
              </div>
              <div class="card-info">
                <div class="info-row">
                  <span class="info-label">Statut</span>
                  <span class="info-value status" [class]="giftCardService.getStatusClass(card.status)">
                    {{ giftCardService.getStatusLabel(card.status) }}
                  </span>
                </div>
                <div class="info-row">
                  <span class="info-label">Valeur initiale</span>
                  <span class="info-value">{{ card.initialValue }} TND</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Achetee le</span>
                  <span class="info-value">{{ card.purchasedAt | date:'dd/MM/yyyy' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Expire le</span>
                  <span class="info-value">{{ card.expiresAt | date:'dd/MM/yyyy' }}</span>
                </div>
                <div class="info-row" *ngIf="card.recipientName">
                  <span class="info-label">Pour</span>
                  <span class="info-value">{{ card.recipientName }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Info Section -->
      <div class="gc-info">
        <h4>Comment ca marche?</h4>
        <div class="info-steps">
          <div class="step">
            <div class="step-icon">1</div>
            <div class="step-text">
              <strong>Choisissez un montant</strong>
              <span>De 25 a 500 TND</span>
            </div>
          </div>
          <div class="step">
            <div class="step-icon">2</div>
            <div class="step-text">
              <strong>Personnalisez</strong>
              <span>Ajoutez un message</span>
            </div>
          </div>
          <div class="step">
            <div class="step-icon">3</div>
            <div class="step-text">
              <strong>Offrez</strong>
              <span>Par email ou en personne</span>
            </div>
          </div>
        </div>

        <div class="info-details">
          <p><i class="fas fa-check"></i> Valable 1 an a compter de l'achat</p>
          <p><i class="fas fa-check"></i> Utilisable sur tout le site Barsha</p>
          <p><i class="fas fa-check"></i> Utilisations multiples jusqu'a epuisement</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .gift-cards-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 1.5rem;
    }

    /* Header */
    .gc-header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .gc-header h2 {
      font-size: 1.75rem;
      margin: 0 0 0.5rem 0;
    }

    .gc-header p {
      color: #666;
      margin: 0;
    }

    /* Tabs */
    .gc-tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 2rem;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 1rem;
    }

    .tab-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 1rem;
      background: #f8f8f8;
      border: 2px solid transparent;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-weight: 500;
    }

    .tab-btn i {
      font-size: 1.25rem;
    }

    .tab-btn:hover {
      background: #f0f0f0;
    }

    .tab-btn.active {
      background: #fff;
      border-color: #000;
    }

    /* Views */
    .gc-view {
      background: #fff;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 15px rgba(0, 0, 0, 0.08);
    }

    /* Amount Selection */
    .amount-selection h3 {
      margin: 0 0 1rem 0;
      text-align: center;
    }

    .amount-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      gap: 1rem;
    }

    .amount-btn {
      padding: 1.5rem 1rem;
      background: #f8f8f8;
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      font-size: 1.25rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .amount-btn:hover {
      border-color: #000;
    }

    .amount-btn.selected {
      background: #000;
      color: #fff;
      border-color: #000;
    }

    .continue-btn {
      width: 100%;
      padding: 1rem;
      background: #000;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      margin-top: 1.5rem;
    }

    .continue-btn:hover {
      background: #333;
    }

    /* Purchase Form */
    .selected-amount-display {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 1rem;
      background: #f8f8f8;
      border-radius: 8px;
      margin-bottom: 2rem;
    }

    .amount-label {
      color: #666;
    }

    .amount-value {
      font-size: 1.5rem;
      font-weight: 700;
    }

    .change-btn {
      padding: 0.5rem 1rem;
      background: transparent;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
    }

    .form-section {
      margin-bottom: 2rem;
    }

    .form-section h4 {
      margin: 0 0 1rem 0;
      color: #333;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
      color: #666;
    }

    .form-group input,
    .form-group textarea {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 1rem;
    }

    .form-group textarea {
      resize: vertical;
    }

    .char-count {
      display: block;
      text-align: right;
      font-size: 0.8rem;
      color: #999;
      margin-top: 0.25rem;
    }

    /* Card Preview */
    .card-preview {
      margin: 2rem 0;
      display: flex;
      justify-content: center;
    }

    .preview-card {
      width: 300px;
      height: 180px;
      background: linear-gradient(135deg, #1a1a1a 0%, #333 100%);
      border-radius: 16px;
      padding: 1.5rem;
      color: #fff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }

    .card-brand {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: 4px;
    }

    .card-amount {
      font-size: 2rem;
      font-weight: 700;
    }

    .card-message {
      font-size: 0.85rem;
      font-style: italic;
      opacity: 0.9;
    }

    .card-recipient {
      font-size: 0.9rem;
      opacity: 0.8;
    }

    .purchase-btn {
      width: 100%;
      padding: 1rem;
      background: #000;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
    }

    .purchase-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    /* Balance Check */
    .balance-check {
      text-align: center;
    }

    .balance-check h3 {
      margin: 0 0 1.5rem 0;
    }

    .code-input-group {
      display: flex;
      gap: 0.5rem;
      max-width: 400px;
      margin: 0 auto;
    }

    .code-input-group input {
      flex: 1;
      padding: 0.75rem 1rem;
      border: 2px solid #ddd;
      border-radius: 8px;
      font-size: 1rem;
      font-family: monospace;
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    .check-btn {
      padding: 0.75rem 1.5rem;
      background: #000;
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
    }

    .check-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Balance Result */
    .balance-result {
      margin-top: 2rem;
    }

    .result-card {
      max-width: 350px;
      margin: 0 auto;
      padding: 2rem;
      border-radius: 12px;
      text-align: center;
    }

    .result-card.valid {
      background: #d4edda;
    }

    .result-card.invalid {
      background: #f8d7da;
    }

    .result-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .result-card.valid .result-icon {
      color: #28a745;
    }

    .result-card.invalid .result-icon {
      color: #dc3545;
    }

    .result-balance {
      display: block;
      font-size: 2.5rem;
      font-weight: 700;
      color: #28a745;
    }

    .result-label {
      display: block;
      color: #666;
      margin-top: 0.5rem;
    }

    .result-info,
    .result-expiry {
      display: block;
      font-size: 0.85rem;
      color: #666;
      margin-top: 0.5rem;
    }

    .redeem-option {
      margin-top: 1.5rem;
    }

    .redeem-btn {
      padding: 0.75rem 2rem;
      background: #28a745;
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
    }

    .redeem-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    /* My Cards */
    .my-cards h3 {
      margin: 0 0 1.5rem 0;
    }

    .store-credit {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.5rem;
      background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
      border-radius: 12px;
      color: #fff;
      margin-bottom: 2rem;
    }

    .credit-icon {
      font-size: 2rem;
    }

    .credit-details {
      display: flex;
      flex-direction: column;
    }

    .credit-label {
      font-size: 0.9rem;
      opacity: 0.9;
    }

    .credit-value {
      font-size: 1.75rem;
      font-weight: 700;
    }

    .loading {
      text-align: center;
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
      margin: 0 auto 1rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .empty-state {
      text-align: center;
      padding: 3rem;
      color: #666;
    }

    .empty-state i {
      font-size: 3rem;
      margin-bottom: 1rem;
      color: #ccc;
    }

    .buy-btn {
      margin-top: 1rem;
      padding: 0.75rem 1.5rem;
      background: #000;
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
    }

    .cards-list {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .card-item {
      display: flex;
      gap: 1.5rem;
      padding: 1rem;
      background: #f8f8f8;
      border-radius: 12px;
    }

    .card-visual {
      width: 200px;
      height: 120px;
      background: linear-gradient(135deg, #1a1a1a 0%, #333 100%);
      border-radius: 12px;
      padding: 1rem;
      color: #fff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      flex-shrink: 0;
    }

    .card-visual.status-redeemed,
    .card-visual.status-expired,
    .card-visual.status-cancelled {
      opacity: 0.6;
    }

    .card-logo {
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: 3px;
    }

    .card-code {
      font-size: 0.7rem;
      font-family: monospace;
      letter-spacing: 1px;
    }

    .card-balance {
      font-size: 1.25rem;
      font-weight: 700;
    }

    .card-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
    }

    .info-label {
      color: #666;
      font-size: 0.85rem;
    }

    .info-value {
      font-weight: 500;
      font-size: 0.85rem;
    }

    .info-value.status.status-active {
      color: #28a745;
    }

    .info-value.status.status-redeemed {
      color: #6c757d;
    }

    .info-value.status.status-expired {
      color: #dc3545;
    }

    /* Messages */
    .message {
      margin-top: 1rem;
      padding: 0.75rem;
      border-radius: 8px;
      text-align: center;
    }

    .message.success {
      background: #d4edda;
      color: #155724;
    }

    .message.error {
      background: #f8d7da;
      color: #721c24;
    }

    /* Info Section */
    .gc-info {
      background: #f8f8f8;
      border-radius: 12px;
      padding: 2rem;
    }

    .gc-info h4 {
      margin: 0 0 1.5rem 0;
      text-align: center;
    }

    .info-steps {
      display: flex;
      justify-content: space-around;
      margin-bottom: 2rem;
    }

    .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      flex: 1;
    }

    .step-icon {
      width: 40px;
      height: 40px;
      background: #000;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      margin-bottom: 0.75rem;
    }

    .step-text {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .step-text strong {
      font-size: 0.9rem;
    }

    .step-text span {
      font-size: 0.8rem;
      color: #666;
    }

    .info-details {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding-top: 1rem;
      border-top: 1px solid #e0e0e0;
    }

    .info-details p {
      margin: 0;
      color: #666;
      font-size: 0.9rem;
    }

    .info-details i {
      color: #28a745;
      margin-right: 0.5rem;
    }

    /* Responsive */
    @media (max-width: 576px) {
      .gift-cards-container {
        padding: 1rem;
      }

      .gc-tabs {
        flex-direction: column;
      }

      .tab-btn {
        flex-direction: row;
        justify-content: center;
      }

      .card-item {
        flex-direction: column;
      }

      .card-visual {
        width: 100%;
      }

      .code-input-group {
        flex-direction: column;
      }

      .info-steps {
        flex-direction: column;
        gap: 1.5rem;
      }
    }
  `]
})
export class GiftCardsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  viewMode: ViewMode = 'browse';
  isLoggedIn = false;

  // Amount Selection
  availableAmounts = GIFT_CARD_AMOUNTS;
  selectedAmount: number | null = null;

  // Purchase Form
  recipientName = '';
  recipientEmail = '';
  personalMessage = '';
  isPurchasing = false;
  purchaseMessage = '';
  purchaseSuccess = false;

  // Balance Check
  checkCode = '';
  isChecking = false;
  balanceResult: any = null;
  isRedeeming = false;
  checkMessage = '';
  checkSuccess = false;

  // My Cards
  myCards: GiftCard[] = [];
  storeCredit = 0;
  isLoadingCards = false;

  constructor(public giftCardService: GiftCardService) {}

  ngOnInit(): void {
    this.isLoggedIn = !!localStorage.getItem('jwt');

    if (this.isLoggedIn) {
      this.giftCardService.storeCredit$
        .pipe(takeUntil(this.destroy$))
        .subscribe(credit => this.storeCredit = credit);

      this.giftCardService.refreshStoreCredit();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectAmount(amount: number): void {
    this.selectedAmount = amount;
  }

  purchaseGiftCard(): void {
    if (!this.selectedAmount) return;

    this.isPurchasing = true;
    this.purchaseMessage = '';

    this.giftCardService.purchaseGiftCard({
      amount: this.selectedAmount,
      recipientEmail: this.recipientEmail || undefined,
      recipientName: this.recipientName || undefined,
      message: this.personalMessage || undefined
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe(result => {
      this.isPurchasing = false;
      this.purchaseSuccess = result.success;
      this.purchaseMessage = result.message;

      if (result.success) {
        // Reset form
        this.recipientName = '';
        this.recipientEmail = '';
        this.personalMessage = '';
        this.selectedAmount = null;
        this.viewMode = 'browse';

        // Reload my cards
        this.loadMyCards();
      }
    });
  }

  formatCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Add dashes every 4 characters
    const parts = [];
    for (let i = 0; i < value.length && i < 16; i += 4) {
      parts.push(value.substring(i, i + 4));
    }

    this.checkCode = parts.join('-');
  }

  checkBalance(): void {
    if (this.checkCode.length < 16) return;

    this.isChecking = true;
    this.balanceResult = null;
    this.checkMessage = '';

    const cleanCode = this.checkCode.replace(/-/g, '');

    this.giftCardService.checkBalance(cleanCode)
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.isChecking = false;
        this.balanceResult = result;
      });
  }

  redeemCard(): void {
    if (!this.balanceResult?.isValid) return;

    this.isRedeeming = true;
    this.checkMessage = '';

    const cleanCode = this.checkCode.replace(/-/g, '');

    this.giftCardService.redeemGiftCard(cleanCode)
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.isRedeeming = false;
        this.checkSuccess = result.success;
        this.checkMessage = result.message;

        if (result.success) {
          this.balanceResult = null;
          this.checkCode = '';
        }
      });
  }

  loadMyCards(): void {
    if (!this.isLoggedIn) return;

    this.isLoadingCards = true;

    this.giftCardService.getMyCards()
      .pipe(takeUntil(this.destroy$))
      .subscribe(cards => {
        this.myCards = cards;
        this.isLoadingCards = false;
      });

    this.giftCardService.refreshStoreCredit();
  }
}
