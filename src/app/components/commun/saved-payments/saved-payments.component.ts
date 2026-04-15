import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ExpressCheckoutService, SavedPaymentMethod } from '../../../services/express-checkout.service';

@Component({
  selector: 'app-saved-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="saved-payments">
      <div class="section-header">
        <h3 class="section-title">Mes moyens de paiement</h3>
        <button class="add-btn" (click)="openAddModal()">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Ajouter une carte
        </button>
      </div>

      <!-- Info Banner -->
      <div class="info-banner">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <p>Vos informations de carte sont securisees et chiffrees. Les numeros complets ne sont jamais stockes.</p>
      </div>

      <!-- Loading State -->
      <div class="loading" *ngIf="isLoading">
        <div class="spinner"></div>
        <p>Chargement des cartes...</p>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="!isLoading && paymentMethods.length === 0">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2"/>
            <path d="M2 10h20" stroke="currentColor" stroke-width="2"/>
          </svg>
        </div>
        <p class="empty-text">Aucune carte enregistree</p>
        <p class="empty-subtext">Ajoutez une carte pour accelerer vos achats</p>
      </div>

      <!-- Payment Methods List -->
      <div class="payments-list" *ngIf="!isLoading && paymentMethods.length > 0">
        <div
          class="payment-card"
          *ngFor="let method of paymentMethods"
          [class.default]="method.isDefault"
        >
          <div class="card-visual" [class]="method.type">
            <div class="card-icon">
              <svg viewBox="0 0 24 24" fill="none" *ngIf="method.type === 'visa'">
                <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2"/>
                <text x="12" y="15" text-anchor="middle" font-size="7" fill="currentColor" font-weight="bold">VISA</text>
              </svg>
              <svg viewBox="0 0 24 24" fill="none" *ngIf="method.type === 'mastercard'">
                <circle cx="9" cy="12" r="5" stroke="currentColor" stroke-width="2"/>
                <circle cx="15" cy="12" r="5" stroke="currentColor" stroke-width="2"/>
              </svg>
              <svg viewBox="0 0 24 24" fill="none" *ngIf="method.type === 'amex'">
                <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2"/>
                <text x="12" y="15" text-anchor="middle" font-size="5" fill="currentColor" font-weight="bold">AMEX</text>
              </svg>
              <svg viewBox="0 0 24 24" fill="none" *ngIf="method.type === 'other'">
                <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2"/>
                <path d="M2 10h20" stroke="currentColor" stroke-width="2"/>
              </svg>
            </div>
          </div>

          <div class="card-info">
            <div class="card-header">
              <span class="card-type">{{ getCardTypeLabel(method.type) }}</span>
              <span class="default-badge" *ngIf="method.isDefault">Par defaut</span>
            </div>
            <p class="card-number">**** **** **** {{ method.lastFourDigits }}</p>
            <p class="card-expiry">Expire {{ method.expiryMonth }}/{{ method.expiryYear }}</p>
            <p class="card-holder">{{ method.cardholderName }}</p>
          </div>

          <div class="card-actions">
            <button
              class="action-btn default-btn"
              *ngIf="!method.isDefault"
              (click)="setDefault(method)"
              [disabled]="isProcessing"
            >
              Definir par defaut
            </button>
            <button
              class="action-btn delete-btn"
              (click)="confirmDelete(method)"
              [disabled]="isProcessing"
            >
              Supprimer
            </button>
          </div>
        </div>
      </div>

      <!-- Add Card Modal (Mock) -->
      <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div class="modal-container" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h4>Ajouter une carte</h4>
            <button class="close-btn" (click)="closeModal()">
              <span>&times;</span>
            </button>
          </div>
          <div class="modal-body">
            <form (ngSubmit)="saveCard()">
              <div class="form-group">
                <label for="cardNumber">Numero de carte *</label>
                <input
                  type="text"
                  id="cardNumber"
                  [(ngModel)]="formData.cardNumber"
                  name="cardNumber"
                  placeholder="1234 5678 9012 3456"
                  maxlength="19"
                  (input)="formatCardNumber($event)"
                  required
                >
              </div>

              <div class="form-group">
                <label for="cardholderName">Nom sur la carte *</label>
                <input
                  type="text"
                  id="cardholderName"
                  [(ngModel)]="formData.cardholderName"
                  name="cardholderName"
                  placeholder="JEAN DUPONT"
                  required
                >
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="expiry">Date d'expiration *</label>
                  <input
                    type="text"
                    id="expiry"
                    [(ngModel)]="formData.expiry"
                    name="expiry"
                    placeholder="MM/AA"
                    maxlength="5"
                    (input)="formatExpiry($event)"
                    required
                  >
                </div>
                <div class="form-group">
                  <label for="cvv">CVV *</label>
                  <input
                    type="text"
                    id="cvv"
                    [(ngModel)]="formData.cvv"
                    name="cvv"
                    placeholder="123"
                    maxlength="4"
                    required
                  >
                </div>
              </div>

              <div class="form-group checkbox-group">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    [(ngModel)]="formData.isDefault"
                    name="isDefault"
                  >
                  <span>Definir comme moyen de paiement par defaut</span>
                </label>
              </div>

              <div class="security-notice">
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="2"/>
                </svg>
                <span>Paiement securise avec chiffrement SSL</span>
              </div>

              <div class="form-actions">
                <button type="button" class="cancel-btn" (click)="closeModal()">
                  Annuler
                </button>
                <button type="submit" class="save-btn" [disabled]="!isFormValid || isProcessing">
                  <span *ngIf="isProcessing" class="spinner-small"></span>
                  Ajouter la carte
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div class="modal-overlay" *ngIf="showDeleteConfirm" (click)="cancelDelete()">
        <div class="modal-container small" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h4>Confirmer la suppression</h4>
            <button class="close-btn" (click)="cancelDelete()">
              <span>&times;</span>
            </button>
          </div>
          <div class="modal-body">
            <p class="confirm-text">
              Etes-vous sur de vouloir supprimer cette carte ?
            </p>
            <p class="confirm-card" *ngIf="methodToDelete">
              {{ getCardTypeLabel(methodToDelete.type) }} **** {{ methodToDelete.lastFourDigits }}
            </p>
            <div class="form-actions">
              <button type="button" class="cancel-btn" (click)="cancelDelete()">
                Annuler
              </button>
              <button type="button" class="delete-confirm-btn" (click)="deleteMethod()" [disabled]="isProcessing">
                <span *ngIf="isProcessing" class="spinner-small"></span>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .saved-payments {
      padding: 0;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .section-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1a1a1a;
    }

    .add-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: #1a1a1a;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .add-btn:hover {
      background: #333;
    }

    .add-btn svg {
      width: 16px;
      height: 16px;
    }

    .info-banner {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      background: #e8f4fd;
      border-radius: 10px;
      margin-bottom: 24px;
    }

    .info-banner svg {
      width: 20px;
      height: 20px;
      color: #1976d2;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .info-banner p {
      margin: 0;
      font-size: 13px;
      color: #1565c0;
      line-height: 1.5;
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
      color: #888;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #f0f0f0;
      border-top-color: #1a1a1a;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading p {
      margin: 16px 0 0 0;
      font-size: 14px;
    }

    .empty-state {
      text-align: center;
      padding: 40px 20px;
      background: #f8f9fa;
      border-radius: 12px;
    }

    .empty-icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 16px;
      background: #e9ecef;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .empty-icon svg {
      width: 32px;
      height: 32px;
      color: #888;
    }

    .empty-text {
      margin: 0;
      font-size: 16px;
      font-weight: 500;
      color: #333;
    }

    .empty-subtext {
      margin: 8px 0 0 0;
      font-size: 14px;
      color: #888;
    }

    .payments-list {
      display: grid;
      gap: 16px;
    }

    .payment-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      transition: border-color 0.2s;
    }

    .payment-card:hover {
      border-color: #ccc;
    }

    .payment-card.default {
      border-color: #1a1a1a;
      border-width: 2px;
    }

    .card-visual {
      width: 60px;
      height: 40px;
      background: linear-gradient(135deg, #2c3e50 0%, #1a1a1a 100%);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .card-visual.visa {
      background: linear-gradient(135deg, #1a237e 0%, #0d47a1 100%);
    }

    .card-visual.mastercard {
      background: linear-gradient(135deg, #ff6b00 0%, #cc0000 100%);
    }

    .card-visual.amex {
      background: linear-gradient(135deg, #006fcf 0%, #0040a1 100%);
    }

    .card-icon svg {
      width: 40px;
      height: 28px;
      color: #fff;
    }

    .card-info {
      flex: 1;
      min-width: 0;
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }

    .card-type {
      font-size: 14px;
      font-weight: 600;
      color: #333;
    }

    .default-badge {
      padding: 3px 8px;
      background: #1a1a1a;
      color: #fff;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .card-number {
      margin: 0;
      font-size: 14px;
      font-family: 'Courier New', monospace;
      color: #333;
    }

    .card-expiry {
      margin: 4px 0 0 0;
      font-size: 12px;
      color: #888;
    }

    .card-holder {
      margin: 4px 0 0 0;
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
    }

    .card-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .action-btn {
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .default-btn {
      background: #f8f9fa;
      border: 1px solid #ddd;
      color: #333;
    }

    .default-btn:hover:not(:disabled) {
      background: #e9ecef;
    }

    .delete-btn {
      background: #fff;
      border: 1px solid #dc3545;
      color: #dc3545;
    }

    .delete-btn:hover:not(:disabled) {
      background: #dc3545;
      color: #fff;
    }

    .action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 20px;
    }

    .modal-container {
      background: #fff;
      border-radius: 12px;
      width: 100%;
      max-width: 450px;
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal-container.small {
      max-width: 400px;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid #eee;
    }

    .modal-header h4 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      color: #888;
      cursor: pointer;
    }

    .close-btn:hover {
      color: #333;
    }

    .modal-body {
      padding: 24px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      margin-bottom: 6px;
      font-size: 13px;
      font-weight: 500;
      color: #333;
    }

    .form-group input {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    .form-group input:focus {
      outline: none;
      border-color: #1a1a1a;
    }

    .checkbox-group {
      margin-top: 20px;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
    }

    .checkbox-label input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }

    .checkbox-label span {
      font-size: 14px;
      color: #333;
    }

    .security-notice {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      background: #f0f9f0;
      border-radius: 8px;
      margin: 20px 0;
    }

    .security-notice svg {
      width: 20px;
      height: 20px;
      color: #28a745;
      flex-shrink: 0;
    }

    .security-notice span {
      font-size: 12px;
      color: #155724;
    }

    .form-actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
    }

    .cancel-btn {
      flex: 1;
      padding: 12px;
      background: #f5f5f5;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #333;
      cursor: pointer;
    }

    .cancel-btn:hover {
      background: #e9ecef;
    }

    .save-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px;
      background: #1a1a1a;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #fff;
      cursor: pointer;
    }

    .save-btn:hover:not(:disabled) {
      background: #333;
    }

    .save-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .delete-confirm-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px;
      background: #dc3545;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #fff;
      cursor: pointer;
    }

    .delete-confirm-btn:hover:not(:disabled) {
      background: #c82333;
    }

    .delete-confirm-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .confirm-text {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: #333;
    }

    .confirm-card {
      margin: 0 0 20px 0;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 8px;
      font-size: 13px;
      color: #666;
      font-family: 'Courier New', monospace;
    }

    .spinner-small {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @media (max-width: 576px) {
      .section-header {
        flex-direction: column;
        align-items: stretch;
      }

      .add-btn {
        justify-content: center;
      }

      .payment-card {
        flex-direction: column;
        text-align: center;
      }

      .card-actions {
        width: 100%;
        flex-direction: row;
      }

      .action-btn {
        flex: 1;
        text-align: center;
      }

      .form-row {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class SavedPaymentsComponent implements OnInit, OnDestroy {
  paymentMethods: SavedPaymentMethod[] = [];
  isLoading = true;
  isProcessing = false;
  showModal = false;
  showDeleteConfirm = false;
  methodToDelete: SavedPaymentMethod | null = null;

  formData = {
    cardNumber: '',
    cardholderName: '',
    expiry: '',
    cvv: '',
    isDefault: false
  };

  private subscriptions: Subscription[] = [];

  constructor(private expressCheckoutService: ExpressCheckoutService) {}

  ngOnInit(): void {
    this.loadPaymentMethods();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private loadPaymentMethods(): void {
    this.isLoading = true;
    this.expressCheckoutService.loadSavedData();

    const sub = this.expressCheckoutService.savedPaymentMethods$.subscribe(methods => {
      this.paymentMethods = methods;
      this.isLoading = false;
    });
    this.subscriptions.push(sub);
  }

  get isFormValid(): boolean {
    return !!(
      this.formData.cardNumber.replace(/\s/g, '').length >= 15 &&
      this.formData.cardholderName.trim() &&
      this.formData.expiry.length === 5 &&
      this.formData.cvv.length >= 3
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

  detectCardType(cardNumber: string): 'visa' | 'mastercard' | 'amex' | 'other' {
    const number = cardNumber.replace(/\s/g, '');
    if (/^4/.test(number)) return 'visa';
    if (/^5[1-5]/.test(number) || /^2[2-7]/.test(number)) return 'mastercard';
    if (/^3[47]/.test(number)) return 'amex';
    return 'other';
  }

  formatCardNumber(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    value = value.substring(0, 16);
    value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
    this.formData.cardNumber = value;
  }

  formatExpiry(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    value = value.substring(0, 4);
    if (value.length >= 2) {
      value = value.substring(0, 2) + '/' + value.substring(2);
    }
    this.formData.expiry = value;
  }

  openAddModal(): void {
    this.formData = {
      cardNumber: '',
      cardholderName: '',
      expiry: '',
      cvv: '',
      isDefault: this.paymentMethods.length === 0
    };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  saveCard(): void {
    if (!this.isFormValid || this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    const cardNumber = this.formData.cardNumber.replace(/\s/g, '');
    const expiryParts = this.formData.expiry.split('/');

    const newMethod: Omit<SavedPaymentMethod, 'id'> = {
      type: this.detectCardType(cardNumber),
      lastFourDigits: cardNumber.slice(-4),
      expiryMonth: expiryParts[0] || '',
      expiryYear: '20' + (expiryParts[1] || ''),
      cardholderName: this.formData.cardholderName.toUpperCase(),
      isDefault: this.formData.isDefault
    };

    this.expressCheckoutService.addPaymentMethod(newMethod).subscribe({
      next: () => {
        this.isProcessing = false;
        this.closeModal();
      },
      error: () => {
        this.isProcessing = false;
      }
    });
  }

  setDefault(method: SavedPaymentMethod): void {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.expressCheckoutService.setDefaultPaymentMethod(method.id).subscribe({
      next: () => {
        this.isProcessing = false;
      },
      error: () => {
        this.isProcessing = false;
      }
    });
  }

  confirmDelete(method: SavedPaymentMethod): void {
    this.methodToDelete = method;
    this.showDeleteConfirm = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirm = false;
    this.methodToDelete = null;
  }

  deleteMethod(): void {
    if (!this.methodToDelete || this.isProcessing) return;

    this.isProcessing = true;
    this.expressCheckoutService.deletePaymentMethod(this.methodToDelete.id).subscribe({
      next: () => {
        this.isProcessing = false;
        this.cancelDelete();
      },
      error: () => {
        this.isProcessing = false;
      }
    });
  }
}
