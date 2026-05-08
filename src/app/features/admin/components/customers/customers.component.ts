import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminCustomer } from '../../services/admin.service';
import { environementDev } from '../../../../../environements/environementDev';

@Component({
  selector: 'app-admin-customers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-customers">
      <div class="page-header">
        <h1>Gestion des clients</h1>
        <button class="btn-export" (click)="exportCustomers()">
          <i class="fas fa-download"></i> Exporter CSV
        </button>
      </div>

      <div class="filters-bar">
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input type="text" [(ngModel)]="searchQuery" placeholder="Rechercher par email, téléphone, nom..."
                 (keyup.enter)="loadCustomers()">
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Contact</th>
              <th>Commandes</th>
              <th>Total dépensé</th>
              <th>Statut</th>
              <th>Inscrit le</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let customer of customers">
              <td>
                <div class="customer-name">{{ customer.firstName }} {{ customer.lastName }}</div>
              </td>
              <td>
                <div class="contact-info">
                  <span *ngIf="customer.email"><i class="fas fa-envelope"></i> {{ customer.email }}</span>
                  <span *ngIf="customer.phone"><i class="fas fa-phone"></i> {{ customer.phone }}</span>
                </div>
              </td>
              <td>{{ customer.orderCount }} commandes</td>
              <td class="price">{{ customer.totalSpent.toFixed(3) }} TND</td>
              <td>
                <span class="status-badge" [class.active]="customer.isActive" [class.inactive]="!customer.isActive">
                  {{ customer.isActive ? 'Actif' : 'Inactif' }}
                </span>
              </td>
              <td>{{ formatDate(customer.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="empty-state" *ngIf="customers.length === 0 && !isLoading">
        <i class="fas fa-users"></i>
        <p>Aucun client trouvé</p>
      </div>
    </div>
  `,
  styles: [`
    .admin-customers { max-width: 1400px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 600; color: #1a1a2e; margin: 0; }
    .btn-export { padding: 10px 20px; background: #1a1a2e; color: #fff; border: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; }
    .filters-bar { margin-bottom: 24px; }
    .search-box { position: relative; max-width: 400px; }
    .search-box i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #888; }
    .search-box input { width: 100%; padding: 10px 12px 10px 38px; border: 1px solid #e0e0e0; border-radius: 8px; }
    .table-container { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th, .data-table td { padding: 14px 16px; text-align: left; font-size: 13px; }
    .data-table th { background: #f8f9fa; font-weight: 600; color: #666; }
    .data-table td { border-bottom: 1px solid #f0f0f0; }
    .customer-name { font-weight: 500; }
    .contact-info span { display: block; font-size: 12px; color: #666; }
    .contact-info i { width: 16px; }
    .price { font-weight: 600; color: #1a1a2e; }
    .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .status-badge.active { background: #d4edda; color: #155724; }
    .status-badge.inactive { background: #f8d7da; color: #721c24; }
    .empty-state { text-align: center; padding: 60px; color: #888; }
    .empty-state i { font-size: 40px; margin-bottom: 16px; opacity: 0.5; }
  `]
})
export class AdminCustomersComponent implements OnInit {
  customers: AdminCustomer[] = [];
  isLoading = false;
  searchQuery = '';

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadCustomers();
  }

  loadCustomers(): void {
    this.isLoading = true;
    this.adminService.getCustomers({ search: this.searchQuery || undefined }).subscribe(response => {
      this.customers = response.items;
      this.isLoading = false;
    });
  }

  exportCustomers(): void {
    window.open(`${environementDev.api}/api/admin/customers/export/csv`, '_blank');
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-TN');
  }
}
