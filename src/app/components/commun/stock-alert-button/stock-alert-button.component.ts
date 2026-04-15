/**
 * BARSHA STOCK ALERT BUTTON COMPONENT
 * =====================================
 * Shows a "Notify when available" button for out-of-stock products.
 * - Logged-in users: One-click subscription
 * - Guest users: Email input modal
 */

import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockAlertService, StockAlert } from '../../../services/stock-alert.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-stock-alert-button',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Stock Alert Button - Only shown when out of stock -->
    <div class="stock-alert-container" *ngIf="isOutOfStock">

      <!-- Already subscribed state -->
      <div *ngIf="isSubscribed" class="alert-subscribed">
        <div class="subscribed-badge">
          <i class="fa fa-bell"></i>
          <span>Alerte active</span>
        </div>
        <p class="subscribed-text">
          Vous serez notifie quand ce produit sera disponible
          <span *ngIf="subscribedSize || subscribedColor">
            ({{ subscribedSize ? 'Taille: ' + subscribedSize : '' }}{{ subscribedSize && subscribedColor ? ', ' : '' }}{{ subscribedColor ? 'Couleur: ' + subscribedColor : '' }})
          </span>
        </p>
        <button class="btn-unsubscribe" (click)="unsubscribe()" [disabled]="isLoading">
          <i class="fa fa-times"></i>
          Annuler l'alerte
        </button>
      </div>

      <!-- Subscribe button -->
      <button
        *ngIf="!isSubscribed"
        class="btn-stock-alert"
        (click)="onAlertClick()"
        [disabled]="isLoading"
        [class.loading]="isLoading">
        <span class="btn-content">
          <i class="fa fa-bell" *ngIf="!isLoading"></i>
          <span class="spinner" *ngIf="isLoading"></span>
          <span class="btn-text">M'alerter quand disponible</span>
        </span>
      </button>

      <!-- Email Modal for Guest Users -->
      <div class="modal-overlay" *ngIf="showEmailModal" (click)="closeModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <button class="modal-close" (click)="closeModal()">
            <i class="fa fa-times"></i>
          </button>

          <div class="modal-header">
            <div class="modal-icon">
              <i class="fa fa-bell"></i>
            </div>
            <h3>Alerte de disponibilite</h3>
            <p>Entrez votre email pour etre notifie quand ce produit sera de nouveau disponible.</p>
          </div>

          <div class="modal-body">
            <div class="product-preview" *ngIf="productName">
              <img *ngIf="productImage" [src]="productImage" [alt]="productName" class="preview-image">
              <div class="preview-info">
                <span class="preview-name">{{ productName }}</span>
                <span class="preview-variant" *ngIf="size || color">
                  {{ size ? 'Taille: ' + size : '' }}{{ size && color ? ' - ' : '' }}{{ color ? 'Couleur: ' + color : '' }}
                </span>
              </div>
            </div>

            <div class="form-group">
              <label for="alertEmail">Adresse email</label>
              <input
                type="email"
                id="alertEmail"
                [(ngModel)]="guestEmail"
                placeholder="votre@email.com"
                class="form-input"
                [class.error]="emailError"
                (input)="emailError = ''">
              <span class="error-message" *ngIf="emailError">{{ emailError }}</span>
            </div>

            <div class="privacy-notice">
              <i class="fa fa-lock"></i>
              <span>Votre email sera uniquement utilise pour cette alerte.</span>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" (click)="closeModal()">Annuler</button>
            <button class="btn-confirm" (click)="submitGuestAlert()" [disabled]="isLoading">
              <span *ngIf="!isLoading">M'alerter</span>
              <span *ngIf="isLoading" class="spinner"></span>
            </button>
          </div>
        </div>
      </div>

      <!-- Success Message -->
      <div class="success-toast" *ngIf="showSuccess" [@fadeInOut]>
        <i class="fa fa-check-circle"></i>
        <span>{{ successMessage }}</span>
      </div>
    </div>
  `,
  styles: [`
    .stock-alert-container {
      margin-top: 16px;
      position: relative;
    }

    /* Subscribe Button */
    .btn-stock-alert {
      width: 100%;
      padding: 14px 24px;
      background: linear-gradient(135deg, #2c3e50 0%, #1a252f 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-stock-alert:hover:not(:disabled) {
      background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .btn-stock-alert:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .btn-stock-alert.loading {
      background: #6c757d;
    }

    .btn-content {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn-content i {
      font-size: 16px;
    }

    /* Subscribed State */
    .alert-subscribed {
      background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
      border: 1px solid #81c784;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }

    .subscribed-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #4caf50;
      color: white;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 10px;
    }

    .subscribed-badge i {
      animation: ring 1.5s ease-in-out infinite;
    }

    @keyframes ring {
      0%, 100% { transform: rotate(0); }
      25% { transform: rotate(15deg); }
      50% { transform: rotate(-15deg); }
      75% { transform: rotate(10deg); }
    }

    .subscribed-text {
      color: #2e7d32;
      font-size: 13px;
      margin: 0 0 12px 0;
    }

    .btn-unsubscribe {
      background: transparent;
      border: 1px solid #e57373;
      color: #c62828;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn-unsubscribe:hover:not(:disabled) {
      background: #ffebee;
    }

    /* Modal Overlay */
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
      z-index: 9999;
      padding: 20px;
      backdrop-filter: blur(4px);
    }

    .modal-content {
      background: white;
      border-radius: 16px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      position: relative;
      animation: modalSlideIn 0.3s ease;
    }

    @keyframes modalSlideIn {
      from {
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .modal-close {
      position: absolute;
      top: 12px;
      right: 12px;
      background: #f5f5f5;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      color: #666;
    }

    .modal-close:hover {
      background: #e0e0e0;
      color: #333;
    }

    .modal-header {
      text-align: center;
      padding: 24px 24px 16px;
      border-bottom: 1px solid #eee;
    }

    .modal-icon {
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }

    .modal-icon i {
      color: white;
      font-size: 24px;
    }

    .modal-header h3 {
      margin: 0 0 8px;
      font-size: 20px;
      font-weight: 600;
      color: #222;
    }

    .modal-header p {
      margin: 0;
      color: #666;
      font-size: 14px;
      line-height: 1.5;
    }

    .modal-body {
      padding: 20px 24px;
    }

    .product-preview {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .preview-image {
      width: 60px;
      height: 60px;
      object-fit: cover;
      border-radius: 6px;
    }

    .preview-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .preview-name {
      font-weight: 500;
      color: #333;
      font-size: 14px;
    }

    .preview-variant {
      color: #666;
      font-size: 12px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      color: #333;
      font-size: 14px;
    }

    .form-input {
      width: 100%;
      padding: 12px 14px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 15px;
      transition: all 0.2s ease;
      box-sizing: border-box;
    }

    .form-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-input.error {
      border-color: #e53935;
    }

    .error-message {
      color: #e53935;
      font-size: 12px;
      margin-top: 4px;
      display: block;
    }

    .privacy-notice {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: #f0f4f8;
      border-radius: 6px;
      font-size: 12px;
      color: #666;
    }

    .privacy-notice i {
      color: #4caf50;
    }

    .modal-footer {
      display: flex;
      gap: 12px;
      padding: 16px 24px 24px;
      border-top: 1px solid #eee;
    }

    .btn-cancel, .btn-confirm {
      flex: 1;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-cancel {
      background: #f5f5f5;
      border: 1px solid #ddd;
      color: #666;
    }

    .btn-cancel:hover {
      background: #eee;
    }

    .btn-confirm {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-confirm:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-confirm:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    /* Spinner */
    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Success Toast */
    .success-toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #4caf50;
      color: white;
      padding: 14px 24px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 20px rgba(76, 175, 80, 0.4);
      z-index: 10000;
    }

    .success-toast i {
      font-size: 18px;
    }

    /* Responsive */
    @media (max-width: 480px) {
      .modal-content {
        margin: 10px;
        border-radius: 12px;
      }

      .modal-header {
        padding: 20px 16px 12px;
      }

      .modal-body {
        padding: 16px;
      }

      .modal-footer {
        padding: 12px 16px 20px;
        flex-direction: column;
      }

      .btn-cancel, .btn-confirm {
        width: 100%;
      }
    }
  `]
})
export class StockAlertButtonComponent implements OnInit, OnDestroy {
  @Input() productId!: string;
  @Input() size?: string;
  @Input() color?: string;
  @Input() productName?: string;
  @Input() productImage?: string;
  @Input() productPrice?: string;
  @Input() isOutOfStock: boolean = false;

  isSubscribed: boolean = false;
  subscribedAlertId?: number;
  subscribedSize?: string;
  subscribedColor?: string;
  isLoading: boolean = false;
  showEmailModal: boolean = false;
  guestEmail: string = '';
  emailError: string = '';
  showSuccess: boolean = false;
  successMessage: string = '';

  private subscription?: Subscription;

  constructor(private stockAlertService: StockAlertService) {}

  ngOnInit(): void {
    this.checkExistingAlert();

    // Subscribe to local alerts map changes
    this.subscription = this.stockAlertService.alertsMap$.subscribe(() => {
      this.checkExistingAlertLocal();
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  private checkExistingAlert(): void {
    // First check local cache
    this.checkExistingAlertLocal();

    // Then verify with server if logged in
    if (localStorage.getItem('jwt')) {
      this.stockAlertService.hasAlert(this.productId, this.size, this.color).subscribe({
        next: (response) => {
          this.isSubscribed = response.has_alert;
          this.subscribedAlertId = response.alert_id;
          this.subscribedSize = response.size;
          this.subscribedColor = response.color;
        }
      });
    }
  }

  private checkExistingAlertLocal(): void {
    const alerts = this.stockAlertService.getAlertsForProduct(this.productId);
    if (alerts.length > 0) {
      // Check for matching size/color
      const matchingAlert = alerts.find(a =>
        (!this.size || a.size === this.size) &&
        (!this.color || a.color === this.color)
      );
      if (matchingAlert) {
        this.isSubscribed = true;
        this.subscribedAlertId = matchingAlert.id;
        this.subscribedSize = matchingAlert.size;
        this.subscribedColor = matchingAlert.color;
      }
    }
  }

  onAlertClick(): void {
    const isLoggedIn = !!localStorage.getItem('jwt');

    if (isLoggedIn) {
      // Direct subscription for logged-in users
      this.subscribeAlert();
    } else {
      // Show email modal for guests
      this.showEmailModal = true;
    }
  }

  private subscribeAlert(email?: string): void {
    this.isLoading = true;

    this.stockAlertService.createAlert(
      this.productId,
      email,
      this.size,
      this.color,
      this.productName,
      this.productImage,
      this.productPrice
    ).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.success) {
          this.isSubscribed = true;
          this.subscribedAlertId = response.alert.id;
          this.subscribedSize = response.alert.size;
          this.subscribedColor = response.alert.color;
          this.showEmailModal = false;
          this.showSuccessMessage(
            response.already_subscribed
              ? 'Vous etes deja inscrit pour cette alerte'
              : 'Alerte creee ! Vous serez notifie quand disponible.'
          );
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error creating alert:', error);
        if (error.error?.detail) {
          this.emailError = error.error.detail;
        }
      }
    });
  }

  submitGuestAlert(): void {
    // Validate email
    if (!this.guestEmail) {
      this.emailError = 'Veuillez entrer votre email';
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.guestEmail)) {
      this.emailError = 'Veuillez entrer un email valide';
      return;
    }

    this.emailError = '';
    this.subscribeAlert(this.guestEmail);
  }

  unsubscribe(): void {
    if (!this.subscribedAlertId) return;

    this.isLoading = true;

    this.stockAlertService.deleteAlert(this.subscribedAlertId).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.success) {
          this.isSubscribed = false;
          this.subscribedAlertId = undefined;
          this.subscribedSize = undefined;
          this.subscribedColor = undefined;
          this.showSuccessMessage('Alerte supprimee');
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error deleting alert:', error);
      }
    });
  }

  closeModal(): void {
    this.showEmailModal = false;
    this.guestEmail = '';
    this.emailError = '';
  }

  private showSuccessMessage(message: string): void {
    this.successMessage = message;
    this.showSuccess = true;
    setTimeout(() => {
      this.showSuccess = false;
    }, 3000);
  }
}
