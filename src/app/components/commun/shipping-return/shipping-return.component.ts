import { Component, OnInit } from '@angular/core';
import { FooterService } from '../../../services/footer.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MarkdownModule, provideMarkdown } from 'ngx-markdown';
import { CheckoutService } from '../../../services/checkout.service';

@Component({
  selector: 'app-shipping-return',
  standalone: true,
  imports: [CommonModule, MarkdownModule],
  providers: [provideMarkdown()],
  templateUrl: './shipping-return.component.html',
  styleUrl: './shipping-return.component.scss'
})
export class ShippingReturnComponent implements OnInit {
  shippingMethods: any[] = [];
  homeDeliveryMethod: any;
  storeDeliveryMethod: any;

  constructor(
    private footerService: FooterService,
    private checkoutService: CheckoutService
  ) {}

  ngOnInit() {
    this.loadShippingMethods();
  }

  loadShippingMethods() {
    this.checkoutService.getShippingMethods().subscribe({
      next: (response) => {
        this.shippingMethods = response.hits;

        // Trouver les méthodes de livraison spécifiques
        this.homeDeliveryMethod = this.shippingMethods.find(method => method.id === 1);
        this.storeDeliveryMethod = this.shippingMethods.find(method => method.id === 2);
      },
      error: (error) => {
        console.error('Error fetching shipping methods:', error);
      }
    });
  }
}
