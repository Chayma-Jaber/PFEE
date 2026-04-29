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
  isLoading = true;
  error: string | null = null;

  canCancel = false;
  minutesLeftToCancel = 0;
  cancellingOrder = false;
  cancelError: string | null = null;
  cancelSuccess = false;

  constructor(
    private route: ActivatedRoute,
    private orderService: OrderService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('id');
    if (!orderId) {
      this.error = 'Commande introuvable';
      this.isLoading = false;
      return;
    }

    const numericOrderId = Number(orderId);
    if (!Number.isFinite(numericOrderId) || numericOrderId <= 0) {
      this.error = 'Commande introuvable';
      this.isLoading = false;
      return;
    }

    this.orderService.getOrderById(numericOrderId).subscribe({
      next: (response) => {
        const rawOrder = response?.data || response?.order || response;
        this.order = rawOrder?.id ? this.normalizeOrder(rawOrder) : null;
        if (!this.order) {
          this.error = 'Erreur lors du chargement des details de la commande';
        } else {
          this.checkCancelEligibility(numericOrderId);
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

  private authHeaders(): Record<string, string> {
    const token = localStorage.getItem('jwt');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private checkCancelEligibility(orderId: number): void {
    const token = localStorage.getItem('jwt');
    if (!token) return;

    this.http.get<any>(
      `${environementDev.api}/api/storefront/w4/orders/${orderId}/can-edit`,
      { headers: this.authHeaders() }
    ).subscribe({
      next: (response) => {
        this.canCancel = !!response?.canEdit;
        this.minutesLeftToCancel = Number(response?.minutesLeft || 0);
      },
      error: () => {
        this.canCancel = false;
      }
    });
  }

  selfCancelOrder(): void {
    if (!this.order?.id || !this.canCancel || this.cancellingOrder) return;
    if (!confirm('Confirmer l\'annulation de cette commande ? Cette action est irreversible.')) return;

    this.cancellingOrder = true;
    this.cancelError = null;

    this.http.post<any>(
      `${environementDev.api}/api/storefront/w4/orders/${this.order.id}/self-cancel`,
      {},
      { headers: this.authHeaders() }
    ).subscribe({
      next: (response) => {
        this.cancellingOrder = false;
        if (response?.success) {
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

  private normalizeOrder(order: any): any {
    const products = Array.isArray(order?.products)
      ? order.products
      : Array.isArray(order?.items)
        ? order.items.map((item: any) => ({
            ...item,
            image: item?.image || item?.image_url || 'assets/images/placeholder.png',
            title: item?.title || 'Produit',
            color: item?.variant_info?.color || item?.variant_info?.couleur || '-',
            size: item?.variant_info?.size || item?.variant_info?.taille || '-',
            unitPrice: Number(item?.unitPrice ?? item?.unit_price ?? 0),
            quantity: Number(item?.quantity ?? 1)
          }))
        : [];

    return {
      ...order,
      slug: order?.slug || order?.reference || `CMD-${order?.id ?? ''}`,
      createdAt: new Date(order?.createdAt || order?.created_at || new Date()),
      status: String(order?.status || 'pending').toLowerCase(),
      products,
      shippingMethod: order?.shippingMethod || order?.shipping_method || 'Livraison a domicile',
      paymentMethod: order?.paymentMethod || order?.payment_method || 'Paiement',
      shippingAddress: order?.shippingAddress || order?.shipping_address || null,
      subTotal: Number(order?.subTotal ?? order?.subtotal ?? 0),
      shippingCost: Number(order?.shippingCost ?? order?.shipping_amount ?? 0),
      total: Number(order?.total ?? order?.total_amount ?? 0),
      coupon: order?.coupon || (order?.coupon_code ? { code: order.coupon_code } : null)
    };
  }
}
