import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { OrderService } from '../../../services/order.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';

@Component({
  selector: 'app-order-details',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './order-details.component.html',
  styleUrls: ['./order-details.component.scss']
})
export class OrderDetailsComponent implements OnInit {
  order: any;
  isLoading: boolean = true;
  error: string | null = null;

  // Wave 4 self-cancel state
  canCancel: boolean = false;
  minutesLeftToCancel: number = 0;
  cancellingOrder: boolean = false;
  cancelError: string | null = null;
  cancelSuccess: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private orderService: OrderService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    const orderId = this.route.snapshot.paramMap.get('id');
    if (orderId) {
      this.orderService.getOrderById(+orderId).subscribe({
        next: (response) => {
          if (response.status === 200) {
            this.order = response.data;
            this.checkCancelEligibility(+orderId);
          } else {
            this.error = 'Erreur lors du chargement des détails de la commande';
          }
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading order details:', err);
          this.error = 'Erreur de connexion au serveur';
          this.isLoading = false;
        }
      });
    }
  }

  private authHeaders(): Record<string, string> {
    const token = localStorage.getItem('jwt');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private checkCancelEligibility(orderId: number) {
    const token = localStorage.getItem('jwt');
    if (!token) return;
    this.http.get<any>(
      `${environementDev.api}/api/storefront/w4/orders/${orderId}/can-edit`,
      { headers: this.authHeaders() }
    ).subscribe({
      next: (r) => {
        this.canCancel = !!r?.canEdit;
        this.minutesLeftToCancel = Number(r?.minutesLeft || 0);
      },
      error: () => { this.canCancel = false; }
    });
  }

  selfCancelOrder() {
    if (!this.order?.id || !this.canCancel || this.cancellingOrder) return;
    if (!confirm('Confirmer l\'annulation de cette commande ? Cette action est irréversible.')) return;
    this.cancellingOrder = true;
    this.cancelError = null;
    this.http.post<any>(
      `${environementDev.api}/api/storefront/w4/orders/${this.order.id}/self-cancel`,
      {},
      { headers: this.authHeaders() }
    ).subscribe({
      next: (r) => {
        this.cancellingOrder = false;
        if (r?.success) {
          this.cancelSuccess = true;
          this.canCancel = false;
          this.order.status = 'cancelled';
        }
      },
      error: (err) => {
        this.cancellingOrder = false;
        this.cancelError = err?.error?.message || 'Annulation impossible.';
      }
    });
  }
}
