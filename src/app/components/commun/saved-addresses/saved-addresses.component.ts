import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ExpressCheckoutService, SavedAddress } from '../../../services/express-checkout.service';

@Component({
  selector: 'app-saved-addresses',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="saved-addresses">
      <div class="section-header">
        <h3 class="section-title">Mes adresses de livraison</h3>
        <button class="add-btn" (click)="openAddModal()">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Ajouter une adresse
        </button>
      </div>

      <!-- Loading State -->
      <div class="loading" *ngIf="isLoading">
        <div class="spinner"></div>
        <p>Chargement des adresses...</p>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="!isLoading && addresses.length === 0">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" stroke-width="2"/>
            <circle cx="12" cy="9" r="2.5" stroke="currentColor" stroke-width="2"/>
          </svg>
        </div>
        <p class="empty-text">Aucune adresse enregistree</p>
        <p class="empty-subtext">Ajoutez une adresse pour faciliter vos achats</p>
      </div>

      <!-- Addresses List -->
      <div class="addresses-list" *ngIf="!isLoading && addresses.length > 0">
        <div
          class="address-card"
          *ngFor="let address of addresses"
          [class.default]="address.isDefault"
        >
          <div class="address-header">
            <span class="address-label">{{ address.label }}</span>
            <span class="default-badge" *ngIf="address.isDefault">Par defaut</span>
          </div>
          <div class="address-content">
            <p class="address-name">{{ address.firstName }} {{ address.lastName }}</p>
            <p class="address-line">{{ address.address }}</p>
            <p class="address-line">{{ address.city }}, {{ address.country }}</p>
            <p class="address-phone">{{ address.phone }}</p>
          </div>
          <div class="address-actions">
            <button
              class="action-btn default-btn"
              *ngIf="!address.isDefault"
              (click)="setDefault(address)"
              [disabled]="isProcessing"
            >
              Definir par defaut
            </button>
            <button
              class="action-btn edit-btn"
              (click)="openEditModal(address)"
              [disabled]="isProcessing"
            >
              Modifier
            </button>
            <button
              class="action-btn delete-btn"
              (click)="confirmDelete(address)"
              [disabled]="isProcessing"
            >
              Supprimer
            </button>
          </div>
        </div>
      </div>

      <!-- Add/Edit Modal -->
      <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div class="modal-container" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h4>{{ isEditing ? 'Modifier l\'adresse' : 'Nouvelle adresse' }}</h4>
            <button class="close-btn" (click)="closeModal()">
              <span>&times;</span>
            </button>
          </div>
          <div class="modal-body">
            <form (ngSubmit)="saveAddress()">
              <div class="form-row">
                <div class="form-group">
                  <label for="firstName">Prenom *</label>
                  <input
                    type="text"
                    id="firstName"
                    [(ngModel)]="formData.firstName"
                    name="firstName"
                    required
                  >
                </div>
                <div class="form-group">
                  <label for="lastName">Nom *</label>
                  <input
                    type="text"
                    id="lastName"
                    [(ngModel)]="formData.lastName"
                    name="lastName"
                    required
                  >
                </div>
              </div>

              <div class="form-group">
                <label for="label">Libelle de l'adresse</label>
                <input
                  type="text"
                  id="label"
                  [(ngModel)]="formData.label"
                  name="label"
                  placeholder="Ex: Maison, Bureau..."
                >
              </div>

              <div class="form-group">
                <label for="address">Adresse *</label>
                <input
                  type="text"
                  id="address"
                  [(ngModel)]="formData.address"
                  name="address"
                  required
                >
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="city">Ville *</label>
                  <input
                    type="text"
                    id="city"
                    [(ngModel)]="formData.city"
                    name="city"
                    required
                  >
                </div>
                <div class="form-group">
                  <label for="postalCode">Code postal</label>
                  <input
                    type="text"
                    id="postalCode"
                    [(ngModel)]="formData.postalCode"
                    name="postalCode"
                  >
                </div>
              </div>

              <div class="form-group">
                <label for="phone">Telephone *</label>
                <input
                  type="tel"
                  id="phone"
                  [(ngModel)]="formData.phone"
                  name="phone"
                  required
                >
              </div>

              <div class="form-group checkbox-group">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    [(ngModel)]="formData.isDefault"
                    name="isDefault"
                  >
                  <span>Definir comme adresse par defaut</span>
                </label>
              </div>

              <div class="form-actions">
                <button type="button" class="cancel-btn" (click)="closeModal()">
                  Annuler
                </button>
                <button type="submit" class="save-btn" [disabled]="!isFormValid || isProcessing">
                  <span *ngIf="isProcessing" class="spinner-small"></span>
                  {{ isEditing ? 'Enregistrer' : 'Ajouter' }}
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
              Etes-vous sur de vouloir supprimer cette adresse ?
            </p>
            <p class="confirm-address" *ngIf="addressToDelete">
              {{ addressToDelete.label || 'Adresse' }} - {{ addressToDelete.city }}
            </p>
            <div class="form-actions">
              <button type="button" class="cancel-btn" (click)="cancelDelete()">
                Annuler
              </button>
              <button type="button" class="delete-confirm-btn" (click)="deleteAddress()" [disabled]="isProcessing">
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
    .saved-addresses {
      padding: 0;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
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

    .addresses-list {
      display: grid;
      gap: 16px;
    }

    .address-card {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      padding: 16px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .address-card:hover {
      border-color: #ccc;
    }

    .address-card.default {
      border-color: #1a1a1a;
      border-width: 2px;
    }

    .address-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .address-label {
      font-size: 14px;
      font-weight: 600;
      color: #333;
    }

    .default-badge {
      padding: 4px 10px;
      background: #1a1a1a;
      color: #fff;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .address-content {
      margin-bottom: 16px;
    }

    .address-name {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
      color: #333;
    }

    .address-line {
      margin: 4px 0 0 0;
      font-size: 13px;
      color: #666;
    }

    .address-phone {
      margin: 8px 0 0 0;
      font-size: 13px;
      color: #888;
    }

    .address-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .action-btn {
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .default-btn {
      background: #f8f9fa;
      border: 1px solid #ddd;
      color: #333;
    }

    .default-btn:hover:not(:disabled) {
      background: #e9ecef;
    }

    .edit-btn {
      background: #fff;
      border: 1px solid #1a1a1a;
      color: #1a1a1a;
    }

    .edit-btn:hover:not(:disabled) {
      background: #1a1a1a;
      color: #fff;
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
      max-width: 500px;
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

    .form-group input[type="text"],
    .form-group input[type="tel"] {
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

    .confirm-address {
      margin: 0 0 20px 0;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 8px;
      font-size: 13px;
      color: #666;
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

      .form-row {
        grid-template-columns: 1fr;
      }

      .address-actions {
        flex-direction: column;
      }

      .action-btn {
        width: 100%;
        text-align: center;
      }
    }
  `]
})
export class SavedAddressesComponent implements OnInit, OnDestroy {
  addresses: SavedAddress[] = [];
  isLoading = true;
  isProcessing = false;
  showModal = false;
  showDeleteConfirm = false;
  isEditing = false;
  addressToDelete: SavedAddress | null = null;

  formData: Partial<SavedAddress> = {
    label: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: 'Tunisie',
    isDefault: false
  };

  private editingAddressId: number | null = null;
  private subscriptions: Subscription[] = [];

  constructor(private expressCheckoutService: ExpressCheckoutService) {}

  ngOnInit(): void {
    this.loadAddresses();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private loadAddresses(): void {
    this.isLoading = true;
    this.expressCheckoutService.loadSavedData();

    const sub = this.expressCheckoutService.savedAddresses$.subscribe(addresses => {
      this.addresses = addresses;
      this.isLoading = false;
    });
    this.subscriptions.push(sub);
  }

  get isFormValid(): boolean {
    return !!(
      this.formData.firstName?.trim() &&
      this.formData.lastName?.trim() &&
      this.formData.address?.trim() &&
      this.formData.city?.trim() &&
      this.formData.phone?.trim()
    );
  }

  openAddModal(): void {
    this.isEditing = false;
    this.editingAddressId = null;
    this.formData = {
      label: '',
      firstName: '',
      lastName: '',
      phone: '',
      address: '',
      city: '',
      postalCode: '',
      country: 'Tunisie',
      isDefault: this.addresses.length === 0
    };
    this.showModal = true;
  }

  openEditModal(address: SavedAddress): void {
    this.isEditing = true;
    this.editingAddressId = address.id;
    this.formData = { ...address };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.isEditing = false;
    this.editingAddressId = null;
  }

  saveAddress(): void {
    if (!this.isFormValid || this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    if (this.isEditing && this.editingAddressId) {
      const addressToUpdate: SavedAddress = {
        id: this.editingAddressId,
        label: this.formData.label || 'Adresse',
        firstName: this.formData.firstName || '',
        lastName: this.formData.lastName || '',
        phone: this.formData.phone || '',
        address: this.formData.address || '',
        city: this.formData.city || '',
        state: this.formData.state || '',
        postalCode: this.formData.postalCode || '',
        country: this.formData.country || 'Tunisie',
        isDefault: this.formData.isDefault || false
      };

      this.expressCheckoutService.updateAddress(addressToUpdate).subscribe({
        next: () => {
          this.isProcessing = false;
          this.closeModal();
        },
        error: () => {
          this.isProcessing = false;
        }
      });
    } else {
      const newAddress = {
        label: this.formData.label || 'Adresse',
        firstName: this.formData.firstName || '',
        lastName: this.formData.lastName || '',
        phone: this.formData.phone || '',
        address: this.formData.address || '',
        city: this.formData.city || '',
        state: this.formData.state || '',
        postalCode: this.formData.postalCode || '',
        country: this.formData.country || 'Tunisie',
        isDefault: this.formData.isDefault || false
      };

      this.expressCheckoutService.addAddress(newAddress).subscribe({
        next: () => {
          this.isProcessing = false;
          this.closeModal();
        },
        error: () => {
          this.isProcessing = false;
        }
      });
    }
  }

  setDefault(address: SavedAddress): void {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.expressCheckoutService.setDefaultAddress(address.id).subscribe({
      next: () => {
        this.isProcessing = false;
      },
      error: () => {
        this.isProcessing = false;
      }
    });
  }

  confirmDelete(address: SavedAddress): void {
    this.addressToDelete = address;
    this.showDeleteConfirm = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirm = false;
    this.addressToDelete = null;
  }

  deleteAddress(): void {
    if (!this.addressToDelete || this.isProcessing) return;

    this.isProcessing = true;
    this.expressCheckoutService.deleteAddress(this.addressToDelete.id).subscribe({
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
