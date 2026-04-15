import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminOrder } from '../../services/admin.service';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="admin-orders">
      <div class="page-header">
        <h1>Gestion des commandes</h1>
        <div class="header-actions">
          <button class="btn-export" (click)="exportOrders()">
            <i class="fas fa-download"></i> Exporter CSV
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-bar">
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input type="text" [(ngModel)]="searchQuery" placeholder="Rechercher par référence, client..."
                 (keyup.enter)="loadOrders()">
        </div>

        <select [(ngModel)]="statusFilter" (change)="loadOrders()">
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="confirmed">Confirmée</option>
          <option value="processing">En préparation</option>
          <option value="shipped">Expédiée</option>
          <option value="delivered">Livrée</option>
          <option value="cancelled">Annulée</option>
        </select>

        <select [(ngModel)]="paymentFilter" (change)="loadOrders()">
          <option value="">Tous les paiements</option>
          <option value="pending">En attente</option>
          <option value="completed">Payé</option>
          <option value="failed">Échoué</option>
        </select>
      </div>

      <!-- Orders Table -->
      <div class="orders-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Référence</th>
              <th>Client</th>
              <th>Articles</th>
              <th>Total</th>
              <th>Paiement</th>
              <th>Statut</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let order of orders" (click)="viewOrder(order.id)">
              <td class="ref">{{ order.reference }}</td>
              <td>
                <div class="customer-info">
                  <span class="name">{{ order.shippingAddress?.firstName }} {{ order.shippingAddress?.lastName }}</span>
                  <span class="phone">{{ order.shippingAddress?.phone }}</span>
                </div>
              </td>
              <td>{{ order.items.length || 0 }} articles</td>
              <td class="price">{{ order.totalAmount.toFixed(3) }} TND</td>
              <td>
                <span class="payment-badge" [class]="getPaymentClass(order.paymentStatus)">
                  {{ getPaymentLabel(order.paymentStatus) }}
                </span>
              </td>
              <td>
                <span class="status-badge" [class]="getStatusClass(order.status)">
                  {{ getStatusLabel(order.status) }}
                </span>
              </td>
              <td class="date">{{ formatDate(order.createdAt) }}</td>
              <td class="actions" (click)="$event.stopPropagation()">
                <button class="btn-icon" [routerLink]="['/admin/orders', order.id]" title="Voir détails">
                  <i class="fas fa-eye"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="empty-state" *ngIf="orders.length === 0 && !isLoading">
          <i class="fas fa-inbox"></i>
          <p>Aucune commande trouvée</p>
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
    </div>
  `,
  styleUrl: './orders.component.scss'
})
export class AdminOrdersComponent implements OnInit {
  orders: AdminOrder[] = [];
  isLoading = true;
  searchQuery = '';
  statusFilter = '';
  paymentFilter = '';
  currentPage = 1;
  totalPages = 1;
  perPage = 20;

  constructor(
    private adminService: AdminService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.statusFilter = params['status'] || '';
      this.loadOrders();
    });
  }

  loadOrders(): void {
    this.isLoading = true;
    this.adminService.getOrders({
      page: this.currentPage,
      per_page: this.perPage,
      search: this.searchQuery || undefined,
      status: this.statusFilter || undefined,
      payment_status: this.paymentFilter || undefined
    }).subscribe(response => {
      this.orders = response.items;
      this.totalPages = response.pages;
      this.isLoading = false;
    });
  }

  viewOrder(id: number): void {
    this.router.navigate(['/admin/orders', id]);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadOrders();
    }
  }

  exportOrders(): void {
    window.open('http://localhost:8001/api/admin/orders/export/csv', '_blank');
  }

  getStatusClass(status: string): string {
    const map: { [key: string]: string } = {
      'pending': 'warning', 'payment_pending': 'warning',
      'confirmed': 'info', 'processing': 'info',
      'shipped': 'primary', 'delivered': 'success', 'cancelled': 'danger'
    };
    return map[status] || 'secondary';
  }

  getStatusLabel(status: string): string {
    const map: { [key: string]: string } = {
      'pending': 'En attente', 'payment_pending': 'Paiement en attente',
      'confirmed': 'Confirmée', 'processing': 'En préparation',
      'shipped': 'Expédiée', 'delivered': 'Livrée', 'cancelled': 'Annulée'
    };
    return map[status] || status;
  }

  getPaymentClass(status: string): string {
    const map: { [key: string]: string } = {
      'pending': 'warning', 'processing': 'info',
      'completed': 'success', 'failed': 'danger'
    };
    return map[status] || 'secondary';
  }

  getPaymentLabel(status: string): string {
    const map: { [key: string]: string } = {
      'pending': 'En attente', 'processing': 'En cours',
      'completed': 'Payé', 'failed': 'Échoué'
    };
    return map[status] || status;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-TN', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  }
}
