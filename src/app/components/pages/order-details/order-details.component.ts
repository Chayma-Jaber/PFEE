import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { OrderService } from '../../../services/order.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

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

  constructor(
    private route: ActivatedRoute,
    private orderService: OrderService
  ) {}

  ngOnInit() {
    const orderId = this.route.snapshot.paramMap.get('id');
    if (orderId) {
      this.orderService.getOrderById(+orderId).subscribe({
        next: (response) => {
          if (response.status === 200) {
            this.order = response.data;
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
} 