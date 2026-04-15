/**
 * BARSHA PRODUCT ALERT COMPONENT
 * ================================
 * Inline component for subscribing to price drop and back-in-stock alerts.
 * Shows on product detail page.
 */

import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductAlertService, AlertType } from '../../../services/product-alert.service';

@Component({
  selector: 'app-product-alert',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="product-alerts" *ngIf="showComponent">
      <!-- Price Drop Alert -->
      <div class="alert-option" *ngIf="showPriceDropAlert">
        <button
          class="alert-btn"
          [class.active]="hasPriceDropAlert"
          [class.loading]="isLoadingPriceDrop"
          (click)="togglePriceDropAlert()"
          [disabled]="isLoadingPriceDrop"
        >
          <i class="fas" [class.fa-bell]="!hasPriceDropAlert" [class.fa-bell-slash]="hasPriceDropAlert"></i>
          <span *ngIf="!hasPriceDropAlert">Alertez-moi si le prix baisse</span>
          <span *ngIf="hasPriceDropAlert">Alerte prix activée</span>
          <span class="spinner" *ngIf="isLoadingPriceDrop"></span>
        </button>

        <!-- Target price input (optional) -->
        <div class="target-price-input" *ngIf="showTargetPriceInput && !hasPriceDropAlert">
          <label>M'alerter si le prix passe sous:</label>
          <div class="input-group">
            <input
              type="number"
              [(ngModel)]="targetPrice"
              [max]="currentPrice - 1"
              [min]="1"
              step="0.001"
              placeholder="{{ currentPrice * 0.9 | number:'1.3-3' }}"
            >
            <span class="currency">TND</span>
          </div>
        </div>
      </div>

      <!-- Back in Stock Alert -->
      <div class="alert-option" *ngIf="showBackInStockAlert">
        <button
          class="alert-btn stock-alert"
          [class.active]="hasStockAlert"
          [class.loading]="isLoadingStock"
          (click)="toggleStockAlert()"
          [disabled]="isLoadingStock"
        >
          <i class="fas" [class.fa-box]="!hasStockAlert" [class.fa-check]="hasStockAlert"></i>
          <span *ngIf="!hasStockAlert">M'alerter quand disponible</span>
          <span *ngIf="hasStockAlert">Alerte stock activée</span>
          <span class="spinner" *ngIf="isLoadingStock"></span>
        </button>
      </div>

      <!-- Success message -->
      <div class="alert-success" *ngIf="successMessage">
        <i class="fas fa-check-circle"></i>
        {{ successMessage }}
      </div>

      <!-- Error message -->
      <div class="alert-error" *ngIf="errorMessage">
        <i class="fas fa-exclamation-circle"></i>
        {{ errorMessage }}
      </div>

      <!-- Guest email input -->
      <div class="guest-email" *ngIf="showGuestEmailInput">
        <input
          type="email"
          [(ngModel)]="guestEmail"
          placeholder="Votre email pour recevoir l'alerte"
          (keydown.enter)="confirmGuestAlert()"
        >
        <button class="confirm-btn" (click)="confirmGuestAlert()" [disabled]="!isValidEmail(guestEmail)">
          Confirmer
        </button>
      </div>
    </div>
  `,
  styles: [`
    .product-alerts {
      margin: 15px 0;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 8px;
    }

    .alert-option {
      margin-bottom: 10px;
    }

    .alert-option:last-child {
      margin-bottom: 0;
    }

    .alert-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 12px 16px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      color: #333;
      transition: all 0.2s ease;
    }

    .alert-btn:hover:not(:disabled) {
      border-color: #1a1a2e;
      background: #fafafa;
    }

    .alert-btn.active {
      background: #1a1a2e;
      color: white;
      border-color: #1a1a2e;
    }

    .alert-btn.stock-alert:not(.active) {
      border-color: #e74c3c;
      color: #e74c3c;
    }

    .alert-btn.stock-alert.active {
      background: #27ae60;
      border-color: #27ae60;
    }

    .alert-btn i {
      font-size: 16px;
    }

    .alert-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid transparent;
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-left: auto;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .target-price-input {
      margin-top: 10px;
      padding: 10px;
      background: white;
      border-radius: 6px;
    }

    .target-price-input label {
      display: block;
      font-size: 12px;
      color: #666;
      margin-bottom: 5px;
    }

    .input-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .input-group input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }

    .input-group input:focus {
      outline: none;
      border-color: #1a1a2e;
    }

    .currency {
      color: #666;
      font-size: 14px;
    }

    .alert-success {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 15px;
      background: #d4edda;
      color: #155724;
      border-radius: 6px;
      font-size: 13px;
      margin-top: 10px;
    }

    .alert-error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 15px;
      background: #f8d7da;
      color: #721c24;
      border-radius: 6px;
      font-size: 13px;
      margin-top: 10px;
    }

    .guest-email {
      display: flex;
      gap: 10px;
      margin-top: 10px;
      padding: 10px;
      background: white;
      border-radius: 6px;
    }

    .guest-email input {
      flex: 1;
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }

    .guest-email input:focus {
      outline: none;
      border-color: #1a1a2e;
    }

    .confirm-btn {
      padding: 10px 20px;
      background: #1a1a2e;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: opacity 0.2s;
    }

    .confirm-btn:hover:not(:disabled) {
      opacity: 0.9;
    }

    .confirm-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `]
})
export class ProductAlertComponent implements OnInit, OnChanges {
  @Input() productId!: number;
  @Input() productName: string = '';
  @Input() currentPrice: number = 0;
  @Input() isOutOfStock: boolean = false;

  showComponent = true;
  showPriceDropAlert = true;
  showBackInStockAlert = false;
  showTargetPriceInput = false;
  showGuestEmailInput = false;

  hasPriceDropAlert = false;
  hasStockAlert = false;

  isLoadingPriceDrop = false;
  isLoadingStock = false;

  targetPrice: number | null = null;
  guestEmail: string = '';
  pendingAlertType: AlertType | null = null;

  successMessage: string = '';
  errorMessage: string = '';

  constructor(private alertService: ProductAlertService) {}

  ngOnInit(): void {
    this.checkExistingAlerts();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOutOfStock']) {
      this.showBackInStockAlert = this.isOutOfStock;
      this.showPriceDropAlert = !this.isOutOfStock;
    }

    if (changes['productId']) {
      this.checkExistingAlerts();
    }
  }

  private checkExistingAlerts(): void {
    if (this.productId) {
      const alertTypes = this.alertService.getActiveAlertTypes(this.productId);
      this.hasPriceDropAlert = alertTypes.includes('price_drop');
      this.hasStockAlert = alertTypes.includes('back_in_stock');
    }
  }

  togglePriceDropAlert(): void {
    if (this.hasPriceDropAlert) {
      this.unsubscribeAlert('price_drop');
    } else {
      this.subscribePriceDropAlert();
    }
  }

  toggleStockAlert(): void {
    if (this.hasStockAlert) {
      this.unsubscribeAlert('back_in_stock');
    } else {
      this.subscribeStockAlert();
    }
  }

  private subscribePriceDropAlert(): void {
    if (!this.isLoggedIn()) {
      this.pendingAlertType = 'price_drop';
      this.showGuestEmailInput = true;
      return;
    }

    this.isLoadingPriceDrop = true;
    this.clearMessages();

    this.alertService.subscribePriceDropAlert(
      this.productId,
      this.targetPrice || undefined
    ).subscribe({
      next: () => {
        this.hasPriceDropAlert = true;
        this.isLoadingPriceDrop = false;
        this.showSuccessMessage('Vous serez alerté si le prix baisse');
        this.showTargetPriceInput = false;
      },
      error: (err) => {
        this.isLoadingPriceDrop = false;
        this.showErrorMessage('Impossible de créer l\'alerte. Réessayez.');
      }
    });
  }

  private subscribeStockAlert(): void {
    if (!this.isLoggedIn()) {
      this.pendingAlertType = 'back_in_stock';
      this.showGuestEmailInput = true;
      return;
    }

    this.isLoadingStock = true;
    this.clearMessages();

    this.alertService.subscribeBackInStockAlert(this.productId).subscribe({
      next: () => {
        this.hasStockAlert = true;
        this.isLoadingStock = false;
        this.showSuccessMessage('Vous serez alerté quand le produit sera disponible');
      },
      error: (err) => {
        this.isLoadingStock = false;
        this.showErrorMessage('Impossible de créer l\'alerte. Réessayez.');
      }
    });
  }

  private unsubscribeAlert(type: AlertType): void {
    const isLoading = type === 'price_drop';
    if (isLoading) {
      this.isLoadingPriceDrop = true;
    } else {
      this.isLoadingStock = true;
    }

    this.alertService.unsubscribeProductAlerts(this.productId).subscribe({
      next: () => {
        if (type === 'price_drop') {
          this.hasPriceDropAlert = false;
          this.isLoadingPriceDrop = false;
        } else {
          this.hasStockAlert = false;
          this.isLoadingStock = false;
        }
        this.showSuccessMessage('Alerte désactivée');
      },
      error: () => {
        this.isLoadingPriceDrop = false;
        this.isLoadingStock = false;
        this.showErrorMessage('Erreur lors de la désactivation');
      }
    });
  }

  confirmGuestAlert(): void {
    if (!this.isValidEmail(this.guestEmail) || !this.pendingAlertType) return;

    if (this.pendingAlertType === 'price_drop') {
      this.isLoadingPriceDrop = true;
    } else {
      this.isLoadingStock = true;
    }

    this.alertService.subscribeBackInStockAlert(
      this.productId,
      this.guestEmail
    ).subscribe({
      next: () => {
        if (this.pendingAlertType === 'price_drop') {
          this.hasPriceDropAlert = true;
          this.isLoadingPriceDrop = false;
        } else {
          this.hasStockAlert = true;
          this.isLoadingStock = false;
        }
        this.showGuestEmailInput = false;
        this.showSuccessMessage('Alerte créée! Vérifiez votre email.');
        this.pendingAlertType = null;
        this.guestEmail = '';
      },
      error: () => {
        this.isLoadingPriceDrop = false;
        this.isLoadingStock = false;
        this.showErrorMessage('Erreur lors de la création de l\'alerte');
      }
    });
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isLoggedIn(): boolean {
    return !!localStorage.getItem('jwt');
  }

  private showSuccessMessage(message: string): void {
    this.successMessage = message;
    setTimeout(() => this.successMessage = '', 3000);
  }

  private showErrorMessage(message: string): void {
    this.errorMessage = message;
    setTimeout(() => this.errorMessage = '', 3000);
  }

  private clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }
}
