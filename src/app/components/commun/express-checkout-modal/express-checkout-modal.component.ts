import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  ExpressCheckoutService,
  SavedAddress,
  SavedPaymentMethod,
  ExpressCheckoutInfo
} from '../../../services/express-checkout.service';
import { CartService, CartItem } from '../../../services/cart.service';

@Component({
  selector: 'app-express-checkout-modal',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="modal-overlay" *ngIf="isOpen" (click)="onOverlayClick($event)">
      <div class="modal-container" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="modal-header">
          <div class="header-content">
            <svg class="lightning-icon" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="currentColor"/>
            </svg>
            <h2>Achat Express</h2>
          </div>
          <button class="close-btn" (click)="close()" [disabled]="isProcessing">
            <span>&times;</span>
          </button>
        </div>

        <!-- Content -->
        <div class="modal-body" *ngIf="!isProcessing && !orderSuccess">
          <!-- Order Summary -->
          <div class="section">
            <h3 class="section-title">Recapitulatif de la commande</h3>
            <div class="items-list">
              <div class="item" *ngFor="let item of cartItems">
                <img [src]="item.image" [alt]="item.product.title" class="item-image">
                <div class="item-details">
                  <p class="item-name">{{ item.product.title }}</p>
                  <p class="item-variant">{{ item.selectedColor }} - {{ item.selectedSize }}</p>
                  <p class="item-qty">Qte: {{ item.quantity }}</p>
                </div>
                <p class="item-price">{{ (item.product.currentPrice * item.quantity).toFixed(3) }} TND</p>
              </div>
            </div>
          </div>

          <!-- Shipping Address -->
          <div class="section">
            <div class="section-header">
              <h3 class="section-title">Adresse de livraison</h3>
              <a routerLink="/compte" (click)="close()" class="modify-link">Modifier</a>
            </div>
            <div class="info-card" *ngIf="defaultAddress">
              <div class="info-icon">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" stroke-width="2"/>
                  <circle cx="12" cy="9" r="2.5" stroke="currentColor" stroke-width="2"/>
                </svg>
              </div>
              <div class="info-content">
                <p class="info-main">{{ defaultAddress.firstName }} {{ defaultAddress.lastName }}</p>
                <p class="info-secondary">{{ defaultAddress.address }}</p>
                <p class="info-secondary">{{ defaultAddress.city }}, {{ defaultAddress.country }}</p>
                <p class="info-secondary">{{ defaultAddress.phone }}</p>
              </div>
            </div>
            <div class="info-card warning" *ngIf="!defaultAddress">
              <p>Aucune adresse enregistree</p>
              <a routerLink="/compte" (click)="close()" class="add-link">Ajouter une adresse</a>
            </div>
          </div>

          <!-- Payment Method -->
          <div class="section">
            <div class="section-header">
              <h3 class="section-title">Moyen de paiement</h3>
              <a routerLink="/compte" (click)="close()" class="modify-link">Modifier</a>
            </div>
            <div class="info-card" *ngIf="defaultPaymentMethod">
              <div class="info-icon card-icon">
                <svg viewBox="0 0 24 24" fill="none" *ngIf="defaultPaymentMethod.type === 'visa'">
                  <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2"/>
                  <path d="M2 10h20" stroke="currentColor" stroke-width="2"/>
                </svg>
                <svg viewBox="0 0 24 24" fill="none" *ngIf="defaultPaymentMethod.type === 'mastercard'">
                  <circle cx="9" cy="12" r="5" stroke="currentColor" stroke-width="2"/>
                  <circle cx="15" cy="12" r="5" stroke="currentColor" stroke-width="2"/>
                </svg>
                <svg viewBox="0 0 24 24" fill="none" *ngIf="defaultPaymentMethod.type !== 'visa' && defaultPaymentMethod.type !== 'mastercard'">
                  <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2"/>
                  <path d="M2 10h20" stroke="currentColor" stroke-width="2"/>
                </svg>
              </div>
              <div class="info-content">
                <p class="info-main">{{ getCardTypeLabel(defaultPaymentMethod.type) }} **** {{ defaultPaymentMethod.lastFourDigits }}</p>
                <p class="info-secondary">Expire {{ defaultPaymentMethod.expiryMonth }}/{{ defaultPaymentMethod.expiryYear }}</p>
              </div>
            </div>
            <div class="info-card warning" *ngIf="!defaultPaymentMethod">
              <p>Aucun moyen de paiement enregistre</p>
              <a routerLink="/compte" (click)="close()" class="add-link">Ajouter une carte</a>
            </div>
          </div>

          <!-- Order Total -->
          <div class="section total-section">
            <div class="total-row">
              <span>Sous-total</span>
              <span>{{ subtotal.toFixed(3) }} TND</span>
            </div>
            <div class="total-row">
              <span>Frais de livraison</span>
              <span [class.free]="shippingCost === 0">
                {{ shippingCost === 0 ? 'Gratuit' : shippingCost.toFixed(3) + ' TND' }}
              </span>
            </div>
            <div class="total-row grand-total">
              <span>Total</span>
              <span>{{ total.toFixed(3) }} TND</span>
            </div>
          </div>

          <!-- Error Message -->
          <div class="error-message" *ngIf="errorMessage">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span>{{ errorMessage }}</span>
          </div>
        </div>

        <!-- Processing State -->
        <div class="modal-body processing" *ngIf="isProcessing">
          <div class="spinner"></div>
          <p class="processing-text">Traitement de votre commande...</p>
          <p class="processing-subtext">Veuillez patienter</p>
        </div>

        <!-- Success State -->
        <div class="modal-body success" *ngIf="orderSuccess">
          <div class="success-icon">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M8 12l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <p class="success-text">Commande confirmee !</p>
          <p class="success-subtext">Redirection vers le paiement...</p>
        </div>

        <!-- Footer -->
        <div class="modal-footer" *ngIf="!isProcessing && !orderSuccess">
          <button class="cancel-btn" (click)="close()">Annuler</button>
          <button
            class="confirm-btn"
            (click)="confirmOrder()"
            [disabled]="!canConfirm"
          >
            <svg class="lightning-icon-small" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="currentColor"/>
            </svg>
            Confirmer la commande
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 20px;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal-container {
      background: #fff;
      border-radius: 16px;
      width: 100%;
      max-width: 500px;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid #eee;
      background: linear-gradient(135deg, #1a1a1a 0%, #333 100%);
      color: #fff;
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-content h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .lightning-icon {
      width: 24px;
      height: 24px;
      color: #ffd700;
    }

    .close-btn {
      background: none;
      border: none;
      color: #fff;
      font-size: 28px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      opacity: 0.8;
      transition: opacity 0.2s;
    }

    .close-btn:hover:not(:disabled) {
      opacity: 1;
    }

    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px;
    }

    .section {
      margin-bottom: 24px;
    }

    .section:last-child {
      margin-bottom: 0;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .section-title {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 600;
      color: #333;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .section-header .section-title {
      margin-bottom: 0;
    }

    .modify-link, .add-link {
      font-size: 13px;
      color: #1a1a1a;
      text-decoration: underline;
      cursor: pointer;
    }

    .modify-link:hover, .add-link:hover {
      color: #555;
    }

    .items-list {
      max-height: 150px;
      overflow-y: auto;
    }

    .item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid #f0f0f0;
    }

    .item:last-child {
      border-bottom: none;
    }

    .item-image {
      width: 50px;
      height: 50px;
      object-fit: cover;
      border-radius: 6px;
      background: #f5f5f5;
    }

    .item-details {
      flex: 1;
      min-width: 0;
    }

    .item-name {
      margin: 0;
      font-size: 13px;
      font-weight: 500;
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-variant, .item-qty {
      margin: 2px 0 0 0;
      font-size: 12px;
      color: #888;
    }

    .item-price {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      color: #333;
      white-space: nowrap;
    }

    .info-card {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px;
      background: #f8f9fa;
      border-radius: 10px;
      border: 1px solid #e9ecef;
    }

    .info-card.warning {
      background: #fff8e6;
      border-color: #ffd700;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .info-card.warning p {
      margin: 0;
      font-size: 13px;
      color: #856404;
    }

    .info-icon {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      border-radius: 8px;
      color: #333;
      flex-shrink: 0;
    }

    .info-icon svg {
      width: 20px;
      height: 20px;
    }

    .info-content {
      flex: 1;
      min-width: 0;
    }

    .info-main {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: #333;
    }

    .info-secondary {
      margin: 3px 0 0 0;
      font-size: 12px;
      color: #666;
    }

    .total-section {
      background: #f8f9fa;
      border-radius: 10px;
      padding: 16px;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      font-size: 14px;
      color: #555;
    }

    .total-row.grand-total {
      border-top: 1px solid #ddd;
      margin-top: 8px;
      padding-top: 16px;
      font-size: 16px;
      font-weight: 700;
      color: #1a1a1a;
    }

    .total-row .free {
      color: #28a745;
      font-weight: 500;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: #fff5f5;
      border: 1px solid #ffcdd2;
      border-radius: 8px;
      margin-top: 16px;
    }

    .error-message svg {
      width: 20px;
      height: 20px;
      color: #d32f2f;
      flex-shrink: 0;
    }

    .error-message span {
      font-size: 13px;
      color: #c62828;
    }

    .modal-body.processing,
    .modal-body.success {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 24px;
      text-align: center;
    }

    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid #f0f0f0;
      border-top-color: #1a1a1a;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .processing-text {
      margin: 24px 0 8px 0;
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }

    .processing-subtext {
      margin: 0;
      font-size: 14px;
      color: #888;
    }

    .success-icon {
      width: 64px;
      height: 64px;
      background: #e8f5e9;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .success-icon svg {
      width: 36px;
      height: 36px;
      color: #4caf50;
    }

    .success-text {
      margin: 24px 0 8px 0;
      font-size: 18px;
      font-weight: 600;
      color: #2e7d32;
    }

    .success-subtext {
      margin: 0;
      font-size: 14px;
      color: #888;
    }

    .modal-footer {
      display: flex;
      gap: 12px;
      padding: 20px 24px;
      border-top: 1px solid #eee;
      background: #fafafa;
    }

    .cancel-btn {
      flex: 1;
      padding: 14px 20px;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #333;
      cursor: pointer;
      transition: all 0.2s;
    }

    .cancel-btn:hover {
      background: #f5f5f5;
      border-color: #ccc;
    }

    .confirm-btn {
      flex: 2;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px 20px;
      background: linear-gradient(135deg, #1a1a1a 0%, #333 100%);
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      color: #fff;
      cursor: pointer;
      transition: all 0.2s;
    }

    .confirm-btn:hover:not(:disabled) {
      background: linear-gradient(135deg, #333 0%, #555 100%);
    }

    .confirm-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .lightning-icon-small {
      width: 16px;
      height: 16px;
      color: #ffd700;
    }

    @media (max-width: 576px) {
      .modal-container {
        max-height: 100vh;
        border-radius: 16px 16px 0 0;
        margin-top: auto;
      }

      .modal-overlay {
        align-items: flex-end;
        padding: 0;
      }

      .modal-footer {
        flex-direction: column;
      }

      .cancel-btn, .confirm-btn {
        flex: none;
        width: 100%;
      }
    }
  `]
})
export class ExpressCheckoutModalComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();

  cartItems: CartItem[] = [];
  defaultAddress: SavedAddress | null = null;
  defaultPaymentMethod: SavedPaymentMethod | null = null;

  subtotal = 0;
  shippingCost = 0;
  total = 0;

  isProcessing = false;
  orderSuccess = false;
  errorMessage = '';

  private subscriptions: Subscription[] = [];

  constructor(
    private expressCheckoutService: ExpressCheckoutService,
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private loadData(): void {
    // Load cart items
    const cartSub = this.cartService.cartItems$.subscribe(items => {
      this.cartItems = items;
      this.calculateTotals();
    });
    this.subscriptions.push(cartSub);

    // Load checkout info
    this.expressCheckoutService.getDefaultCheckoutInfo().subscribe(info => {
      this.defaultAddress = info.defaultAddress;
      this.defaultPaymentMethod = info.defaultPaymentMethod;
    });
  }

  private calculateTotals(): void {
    this.subtotal = this.cartItems.reduce((sum, item) =>
      sum + (item.product.currentPrice * item.quantity), 0);
    this.shippingCost = this.subtotal >= 200 ? 0 : 8;
    this.total = this.subtotal + this.shippingCost;
  }

  get canConfirm(): boolean {
    return !!(
      this.cartItems.length > 0 &&
      this.defaultAddress &&
      this.defaultPaymentMethod
    );
  }

  getCardTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'visa': 'Visa',
      'mastercard': 'Mastercard',
      'amex': 'American Express',
      'other': 'Carte'
    };
    return labels[type] || 'Carte';
  }

  onOverlayClick(event: MouseEvent): void {
    if (!this.isProcessing) {
      this.close();
    }
  }

  close(): void {
    if (!this.isProcessing) {
      this.isOpen = false;
      this.errorMessage = '';
      this.closeModal.emit();
    }
  }

  confirmOrder(): void {
    if (!this.canConfirm || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.errorMessage = '';

    this.expressCheckoutService.processExpressCheckout(this.cartItems).subscribe({
      next: (result) => {
        if (result.success && result.paymentUrl) {
          this.orderSuccess = true;
          // Redirect to payment after short delay
          setTimeout(() => {
            window.location.href = result.paymentUrl!;
          }, 1500);
        } else {
          this.isProcessing = false;
          this.errorMessage = result.message || 'Une erreur est survenue';
        }
      },
      error: (err) => {
        this.isProcessing = false;
        this.errorMessage = 'Une erreur est survenue lors de la commande';
        console.error('Express checkout error:', err);
      }
    });
  }
}
