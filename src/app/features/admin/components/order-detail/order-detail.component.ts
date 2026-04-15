import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin-order-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="order-detail" *ngIf="order">
      <div class="page-header">
        <div class="header-left">
          <button class="btn-back" routerLink="/admin/orders">
            <i class="fas fa-arrow-left"></i>
          </button>
          <div>
            <h1>Commande {{ order.reference }}</h1>
            <span class="order-date">{{ formatDate(order.createdAt) }}</span>
          </div>
        </div>
        <div class="header-actions">
          <select [(ngModel)]="selectedStatus" (change)="updateStatus()">
            <option value="pending">En attente</option>
            <option value="confirmed">Confirmée</option>
            <option value="processing">En préparation</option>
            <option value="shipped">Expédiée</option>
            <option value="delivered">Livrée</option>
            <option value="cancelled">Annulée</option>
          </select>
        </div>
      </div>

      <div class="order-grid">
        <!-- Order Info -->
        <div class="order-card">
          <h2>Informations commande</h2>
          <div class="info-row">
            <span class="label">Statut</span>
            <span class="status-badge" [class]="getStatusClass(order.status)">
              {{ getStatusLabel(order.status) }}
            </span>
          </div>
          <div class="info-row">
            <span class="label">Paiement</span>
            <span class="payment-badge" [class]="getPaymentClass(order.paymentStatus)">
              {{ getPaymentLabel(order.paymentStatus) }}
            </span>
          </div>
          <div class="info-row">
            <span class="label">Méthode</span>
            <span>{{ order.paymentMethod === 'ctp' ? 'Click to Pay' : 'Paiement à la livraison' }}</span>
          </div>
        </div>

        <!-- Customer Info -->
        <div class="order-card">
          <h2>Client</h2>
          <div class="customer-info">
            <p class="name">{{ order.shippingAddress?.firstName }} {{ order.shippingAddress?.lastName }}</p>
            <p><i class="fas fa-phone"></i> {{ order.shippingAddress?.phone }}</p>
            <p><i class="fas fa-map-marker-alt"></i>
              {{ order.shippingAddress?.street }}<br>
              {{ order.shippingAddress?.city }}, {{ order.shippingAddress?.state }}
            </p>
          </div>
        </div>

        <!-- Order Items -->
        <div class="order-card full-width">
          <h2>Articles commandés</h2>
          <table class="items-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Couleur/Taille</th>
                <th>Prix unitaire</th>
                <th>Quantité</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of order.items">
                <td class="product-cell">
                  <img [src]="item.imageUrl || 'assets/images/placeholder.png'" [alt]="item.title">
                  <span>{{ item.title }}</span>
                </td>
                <td>{{ item.color }} / {{ item.size }}</td>
                <td>{{ item.unitPrice?.toFixed(3) }} TND</td>
                <td>{{ item.quantity }}</td>
                <td class="price">{{ item.totalPrice?.toFixed(3) }} TND</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Order Summary -->
        <div class="order-card">
          <h2>Récapitulatif</h2>
          <div class="summary">
            <div class="summary-row">
              <span>Sous-total</span>
              <span>{{ order.subtotal?.toFixed(3) }} TND</span>
            </div>
            <div class="summary-row" *ngIf="order.discountAmount > 0">
              <span>Réduction</span>
              <span class="discount">-{{ order.discountAmount?.toFixed(3) }} TND</span>
            </div>
            <div class="summary-row">
              <span>Livraison</span>
              <span>{{ order.shippingAmount?.toFixed(3) }} TND</span>
            </div>
            <div class="summary-row total">
              <span>Total</span>
              <span>{{ order.totalAmount?.toFixed(3) }} TND</span>
            </div>
          </div>
        </div>

        <!-- Tracking -->
        <div class="order-card">
          <h2>Suivi expédition</h2>
          <div class="tracking-form">
            <input type="text" [(ngModel)]="trackingNumber" placeholder="Numéro de suivi">
            <button (click)="saveTracking()">
              <i class="fas fa-save"></i> Enregistrer
            </button>
          </div>
        </div>
      </div>

      <!-- Timeline -->
      <div class="order-card full-width" *ngIf="order.statusHistory?.length > 0">
        <h2>Historique</h2>
        <div class="timeline">
          <div class="timeline-item" *ngFor="let event of order.statusHistory">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <span class="status">{{ getStatusLabel(event.toStatus) }}</span>
              <span class="date">{{ formatDate(event.createdAt) }}</span>
              <p class="notes" *ngIf="event.notes">{{ event.notes }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="loading" *ngIf="isLoading">
      <div class="spinner"></div>
    </div>
  `,
  styleUrl: './order-detail.component.scss'
})
export class AdminOrderDetailComponent implements OnInit {
  order: any = null;
  isLoading = true;
  selectedStatus = '';
  trackingNumber = '';

  constructor(
    private adminService: AdminService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.loadOrder(+id);
    }
  }

  loadOrder(id: number): void {
    this.isLoading = true;
    this.adminService.getOrder(id).subscribe(order => {
      this.order = order;
      this.selectedStatus = order?.status || 'pending';
      this.trackingNumber = order?.trackingNumber || '';
      this.isLoading = false;
    });
  }

  updateStatus(): void {
    if (this.order && this.selectedStatus !== this.order.status) {
      this.adminService.updateOrderStatus(this.order.id, this.selectedStatus).subscribe(() => {
        this.loadOrder(this.order.id);
      });
    }
  }

  saveTracking(): void {
    // Implementation for saving tracking number
    console.log('Saving tracking:', this.trackingNumber);
  }

  getStatusClass(status: string): string {
    const map: { [key: string]: string } = {
      'pending': 'warning', 'confirmed': 'info', 'processing': 'info',
      'shipped': 'primary', 'delivered': 'success', 'cancelled': 'danger'
    };
    return map[status] || 'secondary';
  }

  getStatusLabel(status: string): string {
    const map: { [key: string]: string } = {
      'pending': 'En attente', 'confirmed': 'Confirmée', 'processing': 'En préparation',
      'shipped': 'Expédiée', 'delivered': 'Livrée', 'cancelled': 'Annulée'
    };
    return map[status] || status;
  }

  getPaymentClass(status: string): string {
    return status === 'completed' ? 'success' : status === 'failed' ? 'danger' : 'warning';
  }

  getPaymentLabel(status: string): string {
    const map: { [key: string]: string } = {
      'pending': 'En attente', 'completed': 'Payé', 'failed': 'Échoué'
    };
    return map[status] || status;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-TN', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
}
