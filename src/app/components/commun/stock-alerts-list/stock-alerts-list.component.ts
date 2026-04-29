/**
 * BARSHA STOCK ALERTS LIST COMPONENT
 * ====================================
 * Displays user's active back-in-stock alerts.
 * Used in the account page for managing alerts.
 */

import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { StockAlertService, StockAlert, MyAlertsResponse } from '../../../services/stock-alert.service';

@Component({
  selector: 'app-stock-alerts-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="stock-alerts-list">
      <!-- Header -->
      <div class="alerts-header">
        <div class="header-content">
          <div class="header-icon">
            <i class="fa fa-bell"></i>
          </div>
          <div class="header-text">
            <h2>Mes Alertes Stock</h2>
            <p>Soyez notifie quand vos produits favoris sont de nouveau disponibles</p>
          </div>
        </div>
        <div class="header-stats" *ngIf="!isLoading && alerts.length > 0">
          <div class="stat-item">
            <span class="stat-value">{{ stats.active }}</span>
            <span class="stat-label">Actives</span>
          </div>
          <div class="stat-item notified">
            <span class="stat-value">{{ stats.notified }}</span>
            <span class="stat-label">Notifiees</span>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div class="loading-state" *ngIf="isLoading">
        <div class="spinner-container">
          <div class="spinner"></div>
        </div>
        <p>Chargement de vos alertes...</p>
      </div>

      <!-- Error State -->
      <div class="error-state" *ngIf="error && !isLoading">
        <i class="fa fa-exclamation-circle"></i>
        <p>{{ error }}</p>
        <button class="btn-retry" (click)="loadAlerts()">
          <i class="fa fa-redo"></i>
          Reessayer
        </button>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="!isLoading && !error && alerts.length === 0">
        <div class="empty-icon">
          <i class="fa fa-bell-slash"></i>
        </div>
        <h3>Aucune alerte active</h3>
        <p>Vous n'avez pas encore d'alertes de retour en stock.</p>
        <p class="hint">Visitez les pages produits en rupture de stock pour vous inscrire aux alertes.</p>
        <a routerLink="/" class="btn-explore">
          <i class="fa fa-shopping-bag"></i>
          Decouvrir nos produits
        </a>
      </div>

      <!-- Alerts List -->
      <div class="alerts-grid" *ngIf="!isLoading && !error && alerts.length > 0">
        <div class="alert-card" *ngFor="let alert of alerts">
          <!-- Product Image -->
          <div class="alert-image" (click)="navigateToProduct(alert.product_id)">
            <img
              [src]="alert.product_image || 'assets/images/placeholder.jpg'"
              [alt]="alert.product_name || 'Produit'"
              onerror="this.src='assets/images/placeholder.jpg'">
            <div class="image-overlay">
              <i class="fa fa-eye"></i>
            </div>
          </div>

          <!-- Alert Content -->
          <div class="alert-content">
            <h4 class="product-name" (click)="navigateToProduct(alert.product_id)">
              {{ alert.product_name || 'Produit #' + alert.product_id }}
            </h4>

            <!-- Variant Info -->
            <div class="variant-info" *ngIf="alert.size || alert.color">
              <span class="variant-tag" *ngIf="alert.size">
                <i class="fa fa-ruler"></i>
                Taille: {{ alert.size }}
              </span>
              <span class="variant-tag" *ngIf="alert.color">
                <i class="fa fa-palette"></i>
                Couleur: {{ alert.color }}
              </span>
            </div>

            <!-- Price -->
            <div class="price-info" *ngIf="alert.product_price">
              <span class="price">{{ alert.product_price }}</span>
            </div>

            <!-- Alert Status -->
            <div class="alert-status">
              <span class="status-badge" [class.notified]="alert.is_notified">
                <i class="fa" [class.fa-clock]="!alert.is_notified" [class.fa-check]="alert.is_notified"></i>
                {{ alert.is_notified ? 'Notifie' : 'En attente' }}
              </span>
              <span class="created-date">
                <i class="fa fa-calendar-alt"></i>
                {{ formatDate(alert.created_at) }}
              </span>
            </div>
          </div>

          <!-- Actions -->
          <div class="alert-actions">
            <button
              class="btn-view"
              (click)="navigateToProduct(alert.product_id)"
              title="Voir le produit">
              <i class="fa fa-external-link-alt"></i>
            </button>
            <button
              class="btn-delete"
              (click)="confirmDelete(alert)"
              [disabled]="deletingId === alert.id"
              title="Supprimer l'alerte">
              <i class="fa fa-trash" *ngIf="deletingId !== alert.id"></i>
              <span class="spinner-small" *ngIf="deletingId === alert.id"></span>
            </button>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div class="pagination" *ngIf="pagination.pages > 1">
        <button
          class="btn-page"
          [disabled]="pagination.page === 1"
          (click)="loadAlerts(pagination.page - 1)">
          <i class="fa fa-chevron-left"></i>
        </button>
        <span class="page-info">
          Page {{ pagination.page }} sur {{ pagination.pages }}
        </span>
        <button
          class="btn-page"
          [disabled]="pagination.page === pagination.pages"
          (click)="loadAlerts(pagination.page + 1)">
          <i class="fa fa-chevron-right"></i>
        </button>
      </div>

      <!-- Delete Confirmation Modal -->
      <div class="delete-modal-overlay" *ngIf="showDeleteModal" (click)="cancelDelete()">
        <div class="delete-modal" (click)="$event.stopPropagation()">
          <div class="delete-modal-header">
            <div class="warning-icon">
              <i class="fa fa-exclamation-triangle"></i>
            </div>
            <h3>Supprimer l'alerte</h3>
          </div>
          <div class="delete-modal-body">
            <p>Voulez-vous vraiment supprimer cette alerte ?</p>
            <div class="alert-preview" *ngIf="alertToDelete">
              <strong>{{ alertToDelete.product_name || 'Produit' }}</strong>
              <span *ngIf="alertToDelete.size || alertToDelete.color">
                ({{ alertToDelete.size ? 'Taille: ' + alertToDelete.size : '' }}
                {{ alertToDelete.size && alertToDelete.color ? ', ' : '' }}
                {{ alertToDelete.color ? 'Couleur: ' + alertToDelete.color : '' }})
              </span>
            </div>
            <p class="warning-text">Vous ne serez plus notifie quand ce produit sera disponible.</p>
          </div>
          <div class="delete-modal-footer">
            <button class="btn-cancel" (click)="cancelDelete()">Annuler</button>
            <button class="btn-confirm-delete" (click)="deleteAlert()" [disabled]="isDeleting">
              <span *ngIf="!isDeleting">Supprimer</span>
              <span class="spinner-small" *ngIf="isDeleting"></span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .stock-alerts-list {
      max-width: 900px;
      margin: 0 auto;
    }

    /* Header */
    .alerts-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 32px;
      padding-bottom: 20px;
      border-bottom: 1px solid #eee;
      flex-wrap: wrap;
      gap: 20px;
    }

    .header-content {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }

    .header-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .header-icon i {
      color: white;
      font-size: 20px;
    }

    .header-text h2 {
      margin: 0 0 4px;
      font-size: 22px;
      font-weight: 600;
      color: #222;
    }

    .header-text p {
      margin: 0;
      color: #666;
      font-size: 14px;
    }

    .header-stats {
      display: flex;
      gap: 16px;
    }

    .stat-item {
      text-align: center;
      padding: 12px 20px;
      background: #f8f9fa;
      border-radius: 10px;
    }

    .stat-item.notified {
      background: #e8f5e9;
    }

    .stat-value {
      display: block;
      font-size: 24px;
      font-weight: 700;
      color: #222;
    }

    .stat-item.notified .stat-value {
      color: #4caf50;
    }

    .stat-label {
      font-size: 12px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Loading State */
    .loading-state {
      text-align: center;
      padding: 60px 20px;
    }

    .spinner-container {
      display: flex;
      justify-content: center;
      margin-bottom: 16px;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e0e0e0;
      border-top-color: #667eea;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading-state p {
      color: #888;
      font-size: 14px;
    }

    /* Error State */
    .error-state {
      text-align: center;
      padding: 60px 20px;
      background: #fff5f5;
      border-radius: 12px;
    }

    .error-state i {
      font-size: 48px;
      color: #e53935;
      margin-bottom: 16px;
    }

    .error-state p {
      color: #c62828;
      margin: 0 0 20px;
    }

    .btn-retry {
      background: #e53935;
      color: white;
      border: none;
      padding: 10px 24px;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .btn-retry:hover {
      background: #c62828;
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      background: #fafbfc;
      border-radius: 16px;
      border: 2px dashed #e0e0e0;
    }

    .empty-icon {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, #f5f7fa 0%, #e4e7eb 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }

    .empty-icon i {
      font-size: 32px;
      color: #aaa;
    }

    .empty-state h3 {
      margin: 0 0 8px;
      font-size: 20px;
      color: #333;
    }

    .empty-state p {
      margin: 0;
      color: #666;
      font-size: 14px;
    }

    .empty-state .hint {
      margin-top: 8px;
      color: #888;
      font-size: 13px;
    }

    .btn-explore {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-top: 24px;
      padding: 14px 28px;
      background: #222;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.2s ease;
    }

    .btn-explore:hover {
      background: #444;
      transform: translateY(-2px);
    }

    /* Alerts Grid */
    .alerts-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .alert-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: white;
      border: 1px solid #eee;
      border-radius: 12px;
      transition: all 0.2s ease;
    }

    .alert-card:hover {
      border-color: #ddd;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }

    .alert-image {
      width: 80px;
      height: 80px;
      border-radius: 8px;
      overflow: hidden;
      position: relative;
      cursor: pointer;
      flex-shrink: 0;
    }

    .alert-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .image-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .image-overlay i {
      color: white;
      font-size: 20px;
    }

    .alert-image:hover .image-overlay {
      opacity: 1;
    }

    .alert-content {
      flex: 1;
      min-width: 0;
    }

    .product-name {
      margin: 0 0 8px;
      font-size: 16px;
      font-weight: 600;
      color: #222;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .product-name:hover {
      color: #667eea;
    }

    .variant-info {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
    }

    .variant-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      background: #f5f5f5;
      border-radius: 4px;
      font-size: 12px;
      color: #666;
    }

    .variant-tag i {
      font-size: 10px;
    }

    .price-info {
      margin-bottom: 8px;
    }

    .price {
      font-weight: 600;
      color: #222;
    }

    .alert-status {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      background: #fff3e0;
      color: #e65100;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-badge.notified {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .created-date {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #888;
    }

    .alert-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .btn-view, .btn-delete {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .btn-view {
      background: #f0f4f8;
      color: #666;
    }

    .btn-view:hover {
      background: #667eea;
      color: white;
    }

    .btn-delete {
      background: #ffebee;
      color: #c62828;
    }

    .btn-delete:hover:not(:disabled) {
      background: #e53935;
      color: white;
    }

    .btn-delete:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    /* Spinner Small */
    .spinner-small {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(0, 0, 0, 0.1);
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    /* Pagination */
    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #eee;
    }

    .btn-page {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: 1px solid #ddd;
      background: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .btn-page:hover:not(:disabled) {
      background: #667eea;
      border-color: #667eea;
      color: white;
    }

    .btn-page:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .page-info {
      font-size: 14px;
      color: #666;
    }

    /* Delete Modal */
    .delete-modal-overlay {
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
    }

    .delete-modal {
      background: white;
      border-radius: 16px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
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

    .delete-modal-header {
      text-align: center;
      padding: 24px 24px 16px;
    }

    .warning-icon {
      width: 60px;
      height: 60px;
      background: #fff3e0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }

    .warning-icon i {
      color: #e65100;
      font-size: 28px;
    }

    .delete-modal-header h3 {
      margin: 0;
      font-size: 20px;
      color: #222;
    }

    .delete-modal-body {
      padding: 0 24px 24px;
      text-align: center;
    }

    .delete-modal-body p {
      color: #666;
      margin: 0 0 16px;
    }

    .alert-preview {
      padding: 12px 16px;
      background: #f8f9fa;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 14px;
    }

    .alert-preview strong {
      color: #222;
    }

    .alert-preview span {
      color: #666;
      font-size: 12px;
    }

    .warning-text {
      color: #e65100 !important;
      font-size: 13px !important;
    }

    .delete-modal-footer {
      display: flex;
      gap: 12px;
      padding: 0 24px 24px;
    }

    .btn-cancel, .btn-confirm-delete {
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

    .btn-confirm-delete {
      background: #e53935;
      border: none;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-confirm-delete:hover:not(:disabled) {
      background: #c62828;
    }

    .btn-confirm-delete:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    /* Responsive */
    @media (max-width: 600px) {
      .alerts-header {
        flex-direction: column;
        align-items: stretch;
      }

      .header-stats {
        justify-content: center;
      }

      .alert-card {
        flex-direction: column;
        text-align: center;
      }

      .alert-image {
        width: 100px;
        height: 100px;
      }

      .variant-info {
        justify-content: center;
      }

      .alert-status {
        justify-content: center;
      }

      .alert-actions {
        flex-direction: row;
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class StockAlertsListComponent implements OnInit {
  @Output() alertDeleted = new EventEmitter<number>();

  alerts: StockAlert[] = [];
  stats = { active: 0, notified: 0, total: 0 };
  pagination = { page: 1, limit: 20, total: 0, pages: 0 };

  isLoading = true;
  error: string | null = null;

  // Delete modal
  showDeleteModal = false;
  alertToDelete: StockAlert | null = null;
  isDeleting = false;
  deletingId: number | null = null;

  constructor(
    private stockAlertService: StockAlertService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadAlerts();
  }

  loadAlerts(page: number = 1): void {
    this.isLoading = true;
    this.error = null;

    this.stockAlertService.getMyAlerts(page, 20, false).subscribe({
      next: (response) => {
        this.alerts = response?.alerts || [];
        this.stats = response?.stats || { active: 0, notified: 0, total: 0 };
        this.pagination = response?.pagination || { page: 1, limit: 20, total: 0, pages: 0 };
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading alerts:', err);
        this.error = 'Impossible de charger vos alertes. Veuillez reessayer.';
        this.isLoading = false;
      }
    });
  }

  navigateToProduct(productId: string): void {
    this.router.navigate(['/produit', productId]);
  }

  confirmDelete(alert: StockAlert): void {
    this.alertToDelete = alert;
    this.showDeleteModal = true;
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.alertToDelete = null;
  }

  deleteAlert(): void {
    if (!this.alertToDelete) return;

    this.isDeleting = true;
    this.deletingId = this.alertToDelete.id;

    this.stockAlertService.deleteAlert(this.alertToDelete.id).subscribe({
      next: (response) => {
        if (response.success) {
          // Remove from local list
          this.alerts = this.alerts.filter(a => a.id !== this.alertToDelete?.id);
          this.stats.active--;
          this.stats.total--;
          this.alertDeleted.emit(this.alertToDelete?.id);
        }
        this.isDeleting = false;
        this.deletingId = null;
        this.cancelDelete();
      },
      error: (err) => {
        console.error('Error deleting alert:', err);
        this.isDeleting = false;
        this.deletingId = null;
      }
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }
}
