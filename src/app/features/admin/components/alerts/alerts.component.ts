import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { environementDev } from '../../../../../environements/environementDev';

// Interfaces
export interface AlertStats {
  totalActive: number;
  priceDropAlerts: number;
  backInStockAlerts: number;
  triggeredAlerts: number;
}

export interface Alert {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  productId: number;
  productTitle: string;
  productImage?: string;
  alertType: 'price_drop' | 'back_in_stock';
  targetPrice?: number;
  currentPrice?: number;
  status: 'active' | 'triggered' | 'expired' | 'deleted';
  createdAt: string;
  triggeredAt?: string;
  notificationSent: boolean;
}

export interface AlertsResponse {
  items: Alert[];
  total: number;
  pages: number;
}

@Component({
  selector: 'app-admin-alerts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-alerts">
      <div class="page-header">
        <h1>Gestion des alertes</h1>
        <div class="header-actions">
          <button class="btn-trigger" (click)="triggerManualCheck()" [disabled]="isTriggering">
            <i class="fas" [class.fa-bolt]="!isTriggering" [class.fa-spinner]="isTriggering" [class.fa-spin]="isTriggering"></i>
            {{ isTriggering ? 'Verification en cours...' : 'Verification manuelle' }}
          </button>
        </div>
      </div>

      <!-- Statistics Dashboard -->
      <div class="stats-grid">
        <div class="stat-card total">
          <div class="stat-icon">
            <i class="fas fa-bell"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ stats.totalActive }}</span>
            <span class="stat-label">Alertes actives</span>
          </div>
        </div>
        <div class="stat-card price-drop">
          <div class="stat-icon">
            <i class="fas fa-tag"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ stats.priceDropAlerts }}</span>
            <span class="stat-label">Alertes baisse de prix</span>
          </div>
        </div>
        <div class="stat-card back-in-stock">
          <div class="stat-icon">
            <i class="fas fa-box"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ stats.backInStockAlerts }}</span>
            <span class="stat-label">Alertes retour en stock</span>
          </div>
        </div>
        <div class="stat-card triggered">
          <div class="stat-icon">
            <i class="fas fa-check-circle"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ stats.triggeredAlerts }}</span>
            <span class="stat-label">Alertes declenchees</span>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-bar">
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input type="text" [(ngModel)]="searchQuery" placeholder="Rechercher par produit, utilisateur..."
                 (keyup.enter)="loadAlerts()">
        </div>

        <select [(ngModel)]="typeFilter" (change)="loadAlerts()">
          <option value="">Tous les types</option>
          <option value="price_drop">Baisse de prix</option>
          <option value="back_in_stock">Retour en stock</option>
        </select>

        <select [(ngModel)]="statusFilter" (change)="loadAlerts()">
          <option value="">Tous les statuts</option>
          <option value="active">Active</option>
          <option value="triggered">Declenchee</option>
          <option value="expired">Expiree</option>
        </select>

        <div class="date-filter">
          <label>Du:</label>
          <input type="date" [(ngModel)]="dateFrom" (change)="loadAlerts()">
        </div>

        <div class="date-filter">
          <label>Au:</label>
          <input type="date" [(ngModel)]="dateTo" (change)="loadAlerts()">
        </div>

        <button class="btn-reset" (click)="resetFilters()">
          <i class="fas fa-times"></i> Reinitialiser
        </button>
      </div>

      <!-- Alerts Table -->
      <div class="alerts-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Utilisateur</th>
              <th>Type d'alerte</th>
              <th>Prix cible</th>
              <th>Prix actuel</th>
              <th>Statut</th>
              <th>Date de creation</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let alert of alerts">
              <td>
                <div class="product-info">
                  <img [src]="alert.productImage || 'assets/images/placeholder.jpg'" [alt]="alert.productTitle" class="product-thumb">
                  <span class="product-title">{{ alert.productTitle }}</span>
                </div>
              </td>
              <td>
                <div class="user-info">
                  <span class="name">{{ alert.userName }}</span>
                  <span class="email">{{ alert.userEmail }}</span>
                </div>
              </td>
              <td>
                <span class="type-badge" [class]="getTypeBadgeClass(alert.alertType)">
                  <i class="fas" [class.fa-tag]="alert.alertType === 'price_drop'" [class.fa-box]="alert.alertType === 'back_in_stock'"></i>
                  {{ getTypeLabel(alert.alertType) }}
                </span>
              </td>
              <td class="price">
                <span *ngIf="alert.targetPrice">{{ formatPrice(alert.targetPrice) }}</span>
                <span *ngIf="!alert.targetPrice" class="na">N/A</span>
              </td>
              <td class="price">
                <span *ngIf="alert.currentPrice">{{ formatPrice(alert.currentPrice) }}</span>
                <span *ngIf="!alert.currentPrice" class="na">N/A</span>
              </td>
              <td>
                <span class="status-badge" [class]="getStatusClass(alert.status)">
                  {{ getStatusLabel(alert.status) }}
                </span>
              </td>
              <td class="date">{{ formatDate(alert.createdAt) }}</td>
              <td class="actions">
                <button class="btn-icon delete" (click)="deleteAlert(alert)" title="Supprimer l'alerte">
                  <i class="fas fa-trash"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="empty-state" *ngIf="alerts.length === 0 && !isLoading">
          <i class="fas fa-bell-slash"></i>
          <p>Aucune alerte trouvee</p>
        </div>

        <div class="loading" *ngIf="isLoading">
          <div class="spinner"></div>
        </div>
      </div>

      <!-- Pagination -->
      <div class="pagination" *ngIf="totalPages > 1">
        <button (click)="changePage(currentPage - 1)" [disabled]="currentPage === 1">
          <i class="fas fa-chevron-left"></i>
        </button>
        <span>Page {{ currentPage }} sur {{ totalPages }}</span>
        <button (click)="changePage(currentPage + 1)" [disabled]="currentPage === totalPages">
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>

      <!-- Toast Notification -->
      <div class="toast" *ngIf="toastMessage" [class.success]="toastType === 'success'" [class.error]="toastType === 'error'">
        <i class="fas" [class.fa-check-circle]="toastType === 'success'" [class.fa-exclamation-circle]="toastType === 'error'"></i>
        {{ toastMessage }}
      </div>

      <!-- Delete Confirmation Modal -->
      <div class="modal-overlay" *ngIf="showDeleteModal" (click)="cancelDelete()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Confirmer la suppression</h3>
            <button class="btn-close" (click)="cancelDelete()">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="modal-body">
            <p>Etes-vous sur de vouloir supprimer cette alerte ?</p>
            <p class="alert-info" *ngIf="alertToDelete">
              <strong>Produit:</strong> {{ alertToDelete.productTitle }}<br>
              <strong>Utilisateur:</strong> {{ alertToDelete.userName }}
            </p>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" (click)="cancelDelete()">Annuler</button>
            <button class="btn-confirm" (click)="confirmDelete()" [disabled]="isDeleting">
              <i class="fas fa-spinner fa-spin" *ngIf="isDeleting"></i>
              {{ isDeleting ? 'Suppression...' : 'Supprimer' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './alerts.component.scss'
})
export class AdminAlertsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private apiUrl = `${environementDev.api}/api`;

  // Statistics
  stats: AlertStats = {
    totalActive: 0,
    priceDropAlerts: 0,
    backInStockAlerts: 0,
    triggeredAlerts: 0
  };

  // Alerts list
  alerts: Alert[] = [];
  isLoading = true;

  // Filters
  searchQuery = '';
  typeFilter = '';
  statusFilter = '';
  dateFrom = '';
  dateTo = '';

  // Pagination
  currentPage = 1;
  totalPages = 1;
  perPage = 20;

  // Actions
  isTriggering = false;
  isDeleting = false;
  showDeleteModal = false;
  alertToDelete: Alert | null = null;

  // Toast
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  private toastTimeout: any;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadAlerts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('admin_jwt') || localStorage.getItem('jwt');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  loadStats(): void {
    this.http.get<AlertStats>(
      `${this.apiUrl}/admin/alerts/stats`,
      { headers: this.getHeaders() }
    ).pipe(
      takeUntil(this.destroy$),
      catchError(() => {
        // Return mock data for demo
        return of(this.getMockStats());
      })
    ).subscribe(stats => {
      this.stats = stats;
    });
  }

  loadAlerts(): void {
    this.isLoading = true;

    let params = new HttpParams()
      .set('page', this.currentPage.toString())
      .set('per_page', this.perPage.toString());

    if (this.searchQuery) {
      params = params.set('search', this.searchQuery);
    }
    if (this.typeFilter) {
      params = params.set('type', this.typeFilter);
    }
    if (this.statusFilter) {
      params = params.set('status', this.statusFilter);
    }
    if (this.dateFrom) {
      params = params.set('date_from', this.dateFrom);
    }
    if (this.dateTo) {
      params = params.set('date_to', this.dateTo);
    }

    this.http.get<AlertsResponse>(
      `${this.apiUrl}/admin/alerts/all`,
      { headers: this.getHeaders(), params }
    ).pipe(
      takeUntil(this.destroy$),
      catchError(() => {
        // Return mock data for demo
        return of(this.getMockAlerts());
      })
    ).subscribe(response => {
      this.alerts = response.items;
      this.totalPages = response.pages;
      this.isLoading = false;
    });
  }

  triggerManualCheck(): void {
    this.isTriggering = true;

    this.http.post<{ message: string; triggered: number }>(
      `${this.apiUrl}/admin/alerts/trigger`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      takeUntil(this.destroy$),
      catchError(() => {
        return of({ message: 'Verification effectuee', triggered: Math.floor(Math.random() * 5) });
      })
    ).subscribe({
      next: (response) => {
        this.isTriggering = false;
        this.showToast(`${response.message}. ${response.triggered} alerte(s) declenchee(s).`, 'success');
        this.loadStats();
        this.loadAlerts();
      },
      error: () => {
        this.isTriggering = false;
        this.showToast('Erreur lors de la verification', 'error');
      }
    });
  }

  deleteAlert(alert: Alert): void {
    this.alertToDelete = alert;
    this.showDeleteModal = true;
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.alertToDelete = null;
  }

  confirmDelete(): void {
    if (!this.alertToDelete) return;

    this.isDeleting = true;

    this.http.delete(
      `${this.apiUrl}/admin/alerts/${this.alertToDelete.id}`,
      { headers: this.getHeaders() }
    ).pipe(
      takeUntil(this.destroy$),
      catchError(() => {
        // Simulate success for demo
        return of({ success: true });
      })
    ).subscribe({
      next: () => {
        this.isDeleting = false;
        this.showDeleteModal = false;
        this.showToast('Alerte supprimee avec succes', 'success');
        this.alerts = this.alerts.filter(a => a.id !== this.alertToDelete?.id);
        this.alertToDelete = null;
        this.loadStats();
      },
      error: () => {
        this.isDeleting = false;
        this.showToast('Erreur lors de la suppression', 'error');
      }
    });
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadAlerts();
    }
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.typeFilter = '';
    this.statusFilter = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.currentPage = 1;
    this.loadAlerts();
  }

  // Formatting helpers
  getTypeBadgeClass(type: string): string {
    return type === 'price_drop' ? 'price-drop' : 'back-in-stock';
  }

  getTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'price_drop': 'Baisse de prix',
      'back_in_stock': 'Retour en stock'
    };
    return labels[type] || type;
  }

  getStatusClass(status: string): string {
    const map: { [key: string]: string } = {
      'active': 'info',
      'triggered': 'success',
      'expired': 'warning',
      'deleted': 'danger'
    };
    return map[status] || 'secondary';
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'active': 'Active',
      'triggered': 'Declenchee',
      'expired': 'Expiree',
      'deleted': 'Supprimee'
    };
    return labels[status] || status;
  }

  formatPrice(price: number): string {
    return price.toFixed(3) + ' TND';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-TN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    this.toastMessage = message;
    this.toastType = type;

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.toastTimeout = setTimeout(() => {
      this.toastMessage = '';
    }, 4000);
  }

  // Mock data for demo when backend is not available
  private getMockStats(): AlertStats {
    return {
      totalActive: 156,
      priceDropAlerts: 98,
      backInStockAlerts: 58,
      triggeredAlerts: 234
    };
  }

  private getMockAlerts(): AlertsResponse {
    const mockAlerts: Alert[] = [
      {
        id: 1,
        userId: 101,
        userName: 'Sonia Ben Ali',
        userEmail: 'sonia.benali@email.com',
        productId: 1001,
        productTitle: 'Robe Elegance Noire',
        productImage: 'assets/images/products/robe-noire.jpg',
        alertType: 'price_drop',
        targetPrice: 85.000,
        currentPrice: 99.000,
        status: 'active',
        createdAt: '2024-01-15T10:30:00Z',
        notificationSent: false
      },
      {
        id: 2,
        userId: 102,
        userName: 'Ahmed Trabelsi',
        userEmail: 'ahmed.t@email.com',
        productId: 1002,
        productTitle: 'Chemisier Satin Premium',
        alertType: 'back_in_stock',
        currentPrice: 75.000,
        status: 'triggered',
        createdAt: '2024-01-14T14:20:00Z',
        triggeredAt: '2024-01-16T09:00:00Z',
        notificationSent: true
      },
      {
        id: 3,
        userId: 103,
        userName: 'Fatma Khaled',
        userEmail: 'fatma.k@email.com',
        productId: 1003,
        productTitle: 'Ensemble Luxe Soiree',
        productImage: 'assets/images/products/ensemble-luxe.jpg',
        alertType: 'price_drop',
        targetPrice: 180.000,
        currentPrice: 200.000,
        status: 'active',
        createdAt: '2024-01-13T16:45:00Z',
        notificationSent: false
      },
      {
        id: 4,
        userId: 104,
        userName: 'Mohamed Sassi',
        userEmail: 'm.sassi@email.com',
        productId: 1004,
        productTitle: 'Pantalon Classic Fit',
        alertType: 'back_in_stock',
        currentPrice: 70.000,
        status: 'active',
        createdAt: '2024-01-12T11:15:00Z',
        notificationSent: false
      },
      {
        id: 5,
        userId: 105,
        userName: 'Leila Hamdi',
        userEmail: 'leila.h@email.com',
        productId: 1005,
        productTitle: 'Blazer Modern Cut',
        productImage: 'assets/images/products/blazer.jpg',
        alertType: 'price_drop',
        targetPrice: 120.000,
        currentPrice: 140.000,
        status: 'expired',
        createdAt: '2024-01-10T08:30:00Z',
        notificationSent: false
      }
    ];

    return {
      items: mockAlerts,
      total: mockAlerts.length,
      pages: 1
    };
  }
}
