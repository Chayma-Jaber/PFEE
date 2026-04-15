import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ExpressCheckoutService } from '../../../services/express-checkout.service';
import { CartService, CartItem } from '../../../services/cart.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-express-checkout-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      *ngIf="isVisible"
      class="express-checkout-btn"
      [class.disabled]="!isEnabled"
      [disabled]="!isEnabled"
      (click)="onExpressCheckout()"
      [title]="buttonTooltip"
    >
      <svg class="lightning-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="btn-text">{{ buttonText }}</span>
    </button>
  `,
  styles: [`
    .express-checkout-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 24px;
      background: linear-gradient(135deg, #1a1a1a 0%, #333 100%);
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.5px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      width: 100%;
    }

    .express-checkout-btn:hover:not(.disabled) {
      background: linear-gradient(135deg, #333 0%, #555 100%);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
    }

    .express-checkout-btn:active:not(.disabled) {
      transform: translateY(0);
    }

    .express-checkout-btn.disabled {
      background: #ccc;
      color: #888;
      cursor: not-allowed;
      box-shadow: none;
    }

    .lightning-icon {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    .express-checkout-btn:not(.disabled) .lightning-icon {
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.6;
      }
    }

    .btn-text {
      white-space: nowrap;
    }

    @media (max-width: 576px) {
      .express-checkout-btn {
        padding: 10px 16px;
        font-size: 13px;
      }

      .lightning-icon {
        width: 16px;
        height: 16px;
      }
    }
  `]
})
export class ExpressCheckoutButtonComponent implements OnInit, OnDestroy {
  @Input() context: 'cart' | 'pdp' = 'cart';
  @Input() productId?: number;
  @Output() openModal = new EventEmitter<void>();

  isVisible = false;
  isEnabled = false;
  buttonText = 'Achat Express';
  buttonTooltip = '';

  private subscriptions: Subscription[] = [];
  private cartItems: CartItem[] = [];

  constructor(
    private expressCheckoutService: ExpressCheckoutService,
    private cartService: CartService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check authentication status
    this.checkVisibility();

    // Subscribe to cart changes
    const cartSub = this.cartService.cartItems$.subscribe(items => {
      this.cartItems = items;
      this.updateButtonState();
    });
    this.subscriptions.push(cartSub);

    // Subscribe to express checkout availability
    const availabilitySub = this.expressCheckoutService.expressCheckoutAvailable$.subscribe(
      available => {
        this.isEnabled = available && this.hasItemsForCheckout();
        this.updateTooltip();
      }
    );
    this.subscriptions.push(availabilitySub);

    // Load saved data
    this.expressCheckoutService.loadSavedData();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private checkVisibility(): void {
    // Only show for logged-in users
    this.isVisible = this.authService.isAuthenticated();
  }

  private hasItemsForCheckout(): boolean {
    if (this.context === 'cart') {
      return this.cartItems.length > 0;
    }
    // For PDP context, we assume the product can be added
    return true;
  }

  private updateButtonState(): void {
    this.expressCheckoutService.isExpressCheckoutAvailable().subscribe(available => {
      this.isEnabled = available && this.hasItemsForCheckout();
      this.updateTooltip();
    });
  }

  private updateTooltip(): void {
    if (!this.isEnabled) {
      if (this.context === 'cart' && this.cartItems.length === 0) {
        this.buttonTooltip = 'Votre panier est vide';
      } else {
        this.buttonTooltip = 'Ajoutez une adresse et un moyen de paiement pour utiliser l\'Achat Express';
      }
    } else {
      this.buttonTooltip = 'Commander rapidement avec vos informations enregistrees';
    }
  }

  onExpressCheckout(): void {
    if (!this.isEnabled) {
      return;
    }

    // Emit event to open the express checkout modal
    this.openModal.emit();
  }
}
