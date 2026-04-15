// order-confirmation.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderService } from '../../../services/order.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PostPurchaseRecommendationsComponent } from '../../commun/next-gen-recommendations';

@Component({
  selector: 'app-order-confirmation',
  templateUrl: './order-confirmation.component.html',
  styleUrls: ['./order-confirmation.component.scss'],
  imports: [CommonModule, RouterModule, PostPurchaseRecommendationsComponent]
})
export class OrderConfirmationComponent implements OnInit {
  orderDetails: any;
  paymentStatus: 'loading' | 'success' | 'failed' | 'pending' | 'error' = 'loading';
  errorMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService
  ) {}

  ngOnInit() {
    // Get order ID from route params or query params
    const orderId = this.route.snapshot.paramMap.get('id') ||
                    this.route.snapshot.queryParamMap.get('orderId');

    if (orderId) {
      this.verifyPaymentAndLoadOrder(+orderId);
    } else {
      this.paymentStatus = 'error';
      this.errorMessage = 'Aucun identifiant de commande trouvé.';
    }
  }

  private verifyPaymentAndLoadOrder(orderId: number): void {
    // First verify the payment transaction status
    this.orderService.checkCTPTransaction(orderId).subscribe({
      next: (ctpResponse) => {
        // Check payment status from response
        if (ctpResponse.status === 200 && ctpResponse.data) {
          const transactionStatus = ctpResponse.data.status?.toLowerCase();

          if (transactionStatus === 'success' || transactionStatus === 'paid' || transactionStatus === 'completed') {
            this.paymentStatus = 'success';
          } else if (transactionStatus === 'pending' || transactionStatus === 'processing') {
            this.paymentStatus = 'pending';
          } else {
            this.paymentStatus = 'failed';
          }
        }

        // Load order details regardless of payment status
        this.loadOrderDetails(orderId);
      },
      error: (err) => {
        console.error('Error checking payment status:', err);
        // Still try to load order details even if payment check fails
        this.loadOrderDetails(orderId);
      }
    });
  }

  private loadOrderDetails(orderId: number): void {
    this.orderService.getOrderById(orderId).subscribe({
      next: (res) => {
        this.orderDetails = res.data;

        // If payment check failed, use order status as fallback
        if (this.paymentStatus === 'loading' || this.paymentStatus === 'error') {
          const orderStatus = this.orderDetails?.status?.toLowerCase();
          if (orderStatus === 'paid' || orderStatus === 'confirmed' || orderStatus === 'processing') {
            this.paymentStatus = 'success';
          } else if (orderStatus === 'pending' || orderStatus === 'awaiting_payment') {
            this.paymentStatus = 'pending';
          } else if (orderStatus === 'cancelled' || orderStatus === 'failed') {
            this.paymentStatus = 'failed';
          } else {
            // Default to success if order exists and status is unclear
            this.paymentStatus = 'success';
          }
        }
      },
      error: (err) => {
        console.error('Error loading order details:', err);
        this.paymentStatus = 'error';
        this.errorMessage = 'Impossible de charger les détails de la commande.';
      }
    });
  }

  retryPayment(): void {
    if (this.orderDetails?.id) {
      // Navigate back to checkout with order info to retry payment
      this.router.navigate(['/checkout/sign'], {
        queryParams: { retryOrderId: this.orderDetails.id }
      });
    }
  }

  goToProfile(): void {
    this.router.navigate(['/profile']);
  }

  goToTracking(): void {
    if (this.orderDetails?.id) {
      this.router.navigate(['/account/orders', this.orderDetails.id, 'tracking']);
    } else {
      this.router.navigate(['/account/profile']);
    }
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }

  continueShopping(): void {
    this.router.navigate(['/shop']);
  }

  // Get purchased product IDs for recommendations
  get purchasedProductIds(): number[] {
    if (!this.orderDetails?.orderItems) return [];
    return this.orderDetails.orderItems
      .map((item: any) => item.productId || item.product?.id)
      .filter((id: number) => id != null);
  }
}
