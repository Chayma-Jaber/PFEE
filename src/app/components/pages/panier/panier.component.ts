import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../../services/cart.service';
import { CartItem } from '../../../services/cart.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ProductService } from '../../../services/product.service';
import { TitleService } from '../../../services/title.service';
import { GiftCardService } from '../../pages/gift-card/gift-card.service';
import { GiftCardComponent } from '../gift-card/gift-card.component';
import { OrderService } from '../../../services/order.service';
import { finalize } from 'rxjs/operators';
import { AnalyticsService } from '../../../services/analytics.service';
import { CouponsComponent } from '../../pages/compte/components/coupons/coupons.component';
import { FavorisComponent } from '../favoris/favoris.component';
import { ExpressCheckoutButtonComponent } from '../../commun/express-checkout-button';
import { ExpressCheckoutModalComponent } from '../../commun/express-checkout-modal';
import { FreeShippingBarComponent } from '../../commun/free-shipping-bar/free-shipping-bar.component';
import { CrossSellStripComponent } from '../../commun/cross-sell-strip/cross-sell-strip.component';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';
@Component({
  selector: 'app-panier',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ToastModule, GiftCardComponent, CouponsComponent, FavorisComponent, ExpressCheckoutButtonComponent, ExpressCheckoutModalComponent, FreeShippingBarComponent, CrossSellStripComponent],
  templateUrl: './panier.component.html',
  styleUrl: './panier.component.scss',
  providers: [MessageService]
})

export class PanierComponent implements OnInit {
  cartItems: CartItem[] = [];
  total = 0;
  activeTab: string = 'panier'; // Default active tab

  // Loading flag while checking offers and response time measurement
  isCheckingOffers: boolean = false;
  lastOfferResponseTimeMs: number | null = null;

  // Properties for promotional prices
  cartItemsWithPromo: any[] = [];
  hasActivePromotion: boolean = false;
  hasUserCoupons: boolean = false;

  // Express checkout modal
  showExpressCheckoutModal: boolean = false;

  ngOnInit(): void {
    this.titleService.setSpecificTitle('Mon Panier');

    // Check for conditional promotions when cart items change
    this.cartService.cartItems$.subscribe(items => {
      if (items.length > 0) {
        this.checkForPromotions(items);
      }
    });

    // Check whether the authenticated user has coupons
    this.checkUserCoupons();
  }

  /**
   * Groupe les articles du panier par clé unique (ean13 + size)
   * pour gérer correctement le cas où le même produit a des tailles différentes
   */
  private groupCartItemsByKey(items: CartItem[]): { [key: string]: CartItem } {
    const grouped: { [key: string]: CartItem } = {};

    items.forEach(item => {
      const key = `${item.ean13}_${item.selectedSize || 'default'}`;
      grouped[key] = item;
    });

    return grouped;
  }

  /**
   * Formate les articles du panier pour l'API checkCartOffers
   * Crée un tableau avec ean13, quantity et unitPrice
   */
  private formatCartItemsForOfferApi(items: CartItem[]): any[] {
    return items.map(item => ({
      ean13: item.ean13,
      quantity: item.quantity,
      unitPrice: item.product.currentPrice
    }));
  }

  /**
   * Vérifie les offres disponibles pour les produits du panier
   * Utilise l'endpoint /api/checkCartOffers qui ne nécessite pas d'authentification
   */
  private checkForPromotions(items: CartItem[]): void {
    if (items.length === 0) {
      this.hasActivePromotion = false;
      this.cartItemsWithPromo = [];
      return;
    }

    // Formater les articles pour l'API checkCartOffers
    const formattedItems = this.formatCartItemsForOfferApi(items);
    // Start measuring request time and set loading flag
    const start = Date.now();
    this.isCheckingOffers = true;

    this.orderService.checkCartOffers(formattedItems).pipe(
      finalize(() => {
        this.isCheckingOffers = false;
        // ensure we have a measured elapsed time even if error happened
        this.lastOfferResponseTimeMs = Date.now() - start;
      })
    ).subscribe({
      next: (response: any) => {
        // measure elapsed (will be overridden in finalize if needed)
        this.lastOfferResponseTimeMs = Date.now() - start;

        if (response && response.data && response.data.cartProducts) {
          // Créer une map pour associer les offres (peut contenir plusieurs entrées) par ean13
          const offersMap = new Map<string, any[]>();
          response.data.cartProducts.forEach((offer: any) => {
            const arr = offersMap.get(offer.ean13) || [];
            arr.push(offer);
            offersMap.set(offer.ean13, arr);
          });

          // Enrichir les articles du panier avec les données d'offres
          // On génère une ligne par entrée retournée par l'API (cas split promotions)
          const displayLines: any[] = [];
          items.forEach(item => {
            const offers = offersMap.get(item.ean13) || [];
            let remainingQuantity = item.quantity;

            // Pour chaque offre retournée, on crée une ligne séparée
            offers.forEach(offer => {
              displayLines.push({
                product: item.product,
                image: item.image,
                selectedColor: item.selectedColor,
                selectedSize: item.selectedSize,
                ean13: offer.ean13,
                quantity: offer.quantity,
                originalUnitPrice: offer.originalUnitPrice ?? item.product.currentPrice,
                unitPrice: offer.unitPrice ?? item.product.currentPrice,
                discountPercent: offer.discountPercent ?? 0,
                hasDiscount: offer.hasDiscount ?? false,
                // garden path to original cart item so quantity updates work on the real cart
                sourceCartItem: item
              });
              remainingQuantity -= offer.quantity;
            });

            // Si l'API n'a pas couvert toute la quantité, on ajoute une ligne fallback
            if (remainingQuantity > 0) {
              displayLines.push({
                product: item.product,
                image: item.image,
                selectedColor: item.selectedColor,
                selectedSize: item.selectedSize,
                ean13: item.ean13,
                quantity: remainingQuantity,
                originalUnitPrice: item.product.currentPrice,
                unitPrice: item.product.currentPrice,
                discountPercent: 0,
                hasDiscount: false,
                sourceCartItem: item
              });
            }
          });

          this.cartItemsWithPromo = displayLines;

          // Vérifier s'il y a au moins une remise active
          this.hasActivePromotion = this.cartItemsWithPromo.some(item => item.hasDiscount);
          this.calculateTotal();
        } else {
          // Fallback si la réponse n'a pas la structure attendue
          this.handleOfferCheckError();
        }
      },
      error: (err) => {
        console.error('Error checking for offers:', err);
        this.handleOfferCheckError();
      }
    });
  }

  /**
   * Gère les erreurs lors de la vérification des offres
   */
  private handleOfferCheckError(): void {
    // En cas d'erreur, on affiche simplement les prix réguliers
    this.cartItemsWithPromo = this.cartItems.map(item => ({
      product: item.product,
      image: item.image,
      selectedColor: item.selectedColor,
      selectedSize: item.selectedSize,
      ean13: item.ean13,
      quantity: item.quantity,
      originalUnitPrice: item.product.currentPrice,
      unitPrice: item.product.currentPrice,
      discountPercent: 0,
      hasDiscount: false,

      sourceCartItem: item
    }));
    this.hasActivePromotion = false;
    this.calculateTotal();
  }

  constructor(
    private cartService: CartService,
    private router: Router,
    private messageService: MessageService,
    private productService: ProductService,
    private titleService: TitleService,
    private orderService: OrderService,
    private analyticsService: AnalyticsService, // Ajout du service Analytics
    private giftCardService: GiftCardService,
    private http: HttpClient
  ) {
    this.cartService.cartItems$.subscribe(items => {
      this.cartItems = items;
      this.calculateTotal();
    });
  }

  // Method to change active tab
  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  calculateTotal() {
    if (this.hasActivePromotion && this.cartItemsWithPromo.length > 0) {
      // Calculate total with promotional prices
      // Le prix unitPrice est déjà le prix après réduction
      this.total = this.cartItemsWithPromo.reduce((sum, item) => {
        return sum + (item.unitPrice * item.quantity);
      }, 0);
    } else {
      // Calculate total with regular prices
      this.total = this.cartItems.reduce((sum, item) =>
        sum + (item.product.currentPrice * item.quantity), 0
      );
    }
    // Round to 2 decimal places to avoid floating point precision issues
    // this.total = parseFloat(this.total.toFixed(2));
  }

  removeItem(item: CartItem) {
    this.cartService.removeFromCart(item.product.id, item.selectedColor, item.selectedSize);
    // Tracking suppression produit du panier
    const cartId = localStorage.getItem('jwt') || 'guest';
    this.analyticsService.removeFromCart({
      productId: String(item.product.id),
      sku: item.product.sku,
      cartId: cartId,
      totalAmount: this.total
    });

    window.location.reload();

  }

  updateQuantity(item: CartItem, quantity: number) {
    this.cartService.updateQuantity(
      item.product.id,
      item.selectedColor,
      item.selectedSize,
      quantity
    );
  }
  increaseQuantity(item: CartItem): void {
    const nextQuantity = item.quantity + 1;


    if (nextQuantity <= 10) {
      // Vérifie d'abord si le stock est suffisant AVANT d'incrémenter
      this.productService.checkStock(item.ean13, nextQuantity).subscribe(
        (response: any) => {
          if (response.data.inStock) {
            this.updateQuantity(item, nextQuantity);
          } else {
            this.messageService.add({
              severity: 'warn',
              summary: 'Stock insuffisant',
              detail: 'La quantité demandée dépasse le stock disponible'
            });
          }
        },
        (error: any) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Impossible de vérifier le stock'
          });
        }
      );
    } else {
      this.messageService.add({
        severity: 'info',
        summary: 'Quantité maximale atteinte',
        detail: 'Vous ne pouvez pas commander plus de 10 unités.'
      });
    }
  }

  decreaseQuantity(item: CartItem): void {
    if (item.quantity > 1) {
      this.updateQuantity(item, item.quantity - 1);
    }
  }

  continueShopping(): void {
    this.router.navigate(['/shop']);
  }

  checkout(): void {
    // Implémentez la logique de paiement ici
    alert('Fonctionnalité de paiement à implémenter');
  }

  private async checkUserCoupons() {
    const jwt = localStorage.getItem('jwt');
    if (!jwt) {
      this.hasUserCoupons = false;
      return;
    }

    try {
      const [publicResp, privateResp] = await Promise.all([
        this.giftCardService.getCouponsUserPublic().toPromise().catch(() => ({ data: [] })),
        this.giftCardService.getCouponsUserPrivate().toPromise().catch(() => ({ data: [] })),
      ]);

      const publicCoupons = publicResp?.data || [];
      const privateCoupons = privateResp?.data || [];

      this.hasUserCoupons = (publicCoupons.length + privateCoupons.length) > 0;
    } catch (e) {
      this.hasUserCoupons = false;
    }
  }

  verif(openCoupon: boolean = false) {
    const jwt = localStorage.getItem('jwt');
    if (jwt) {
      // If user clicked "profiter" and we want to open coupon step in checkout,
      // set an initial checkout state so checkout shows coupon step first.
      if (openCoupon && this.hasUserCoupons) {
        sessionStorage.setItem('checkoutState', JSON.stringify({ currentStep: 1 }));
      }

      this.router.navigate(['/checkout']).then(() => {
       // window.location.reload();
      });
    } else {
      // pass returnUrl so after sign in user can be redirected back to checkout
      this.router.navigate(['/sign'], { queryParams: { returnUrl: '/checkout' } }).then(() => {
       // window.location.reload();
      });
    }
  }

  /**
   * Get product detail URL for navigation
   * @param item CartItem to get URL for
   * @returns Product detail URL string
   */
  getProductDetailUrl(item: CartItem): string {
    if (!item || !item.product || !item.product.id) {
      return '/produit/0-produit';
    }

    // Use the ProductService to generate the correct slug format (ID-name)
    const slug = this.productService.generateProductSlug(item.product);
    return `/produit/${slug}`;
  }

  /**
   * Navigate to product detail page when clicking on product image
   * @param item CartItem to navigate to
   */
  navigateToProductDetail(item: CartItem): void {
    if (!item || !item.product || !item.product.id) {
      console.error('Cannot navigate: Invalid product', item);
      return;
    }

    try {
      const productUrl = this.getProductDetailUrl(item);
      this.router.navigate([productUrl]);
    } catch (error) {
      console.error('Error navigating to product:', error);
      // Fallback navigation with just the product ID
      this.router.navigate(['/produit', item.product.id]);
    }
  }

  // Display helper to provide items to the template, either promo-split lines or fallback aggregated lines
  get displayItems() {
    if (this.cartItemsWithPromo && this.cartItemsWithPromo.length) return this.cartItemsWithPromo;

    // Fallback: convert cartItems to display-style lines
    return this.cartItems.map(item => ({
      product: item.product,
      image: item.image,
      selectedColor: item.selectedColor,
      selectedSize: item.selectedSize,
      ean13: item.ean13,
      quantity: item.quantity,
      originalUnitPrice: item.product.currentPrice,
      unitPrice: item.product.currentPrice,
      discountPercent: 0,
      hasDiscount: false,
      sourceCartItem: item
    }));
  }

  /**
   * Update underlying cart item quantity from a display line (delta can be +1 or -1)
   */
  updateQuantityFromDisplay(line: any, delta: number) {
    const src = line.sourceCartItem;
    if (!src) return;

    const newQuantity = src.quantity + delta;
    if (newQuantity <= 0) {
      // Remove item completely
      this.cartService.removeFromCart(src.product.id, src.selectedColor, src.selectedSize);
      setTimeout(() => { try { window.location.reload(); } catch (e) { } }, 60);
    } else {
      // Check stock before updating
      this.productService.checkStock(line.ean13, newQuantity).subscribe(
        (response: any) => {
          if (response.data.inStock) {
            this.cartService.updateQuantity(src.product.id, src.selectedColor, src.selectedSize, newQuantity);
          } else {
            this.messageService.add({
              severity: 'warn',
              summary: 'Stock insuffisant',
              detail: 'La quantité demandée dépasse le stock disponible'
            });
          }
        },
        (error: any) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Impossible de vérifier le stock'
          });
        }
      );
    }
  }

  // Increase / decrease / remove wrappers for display lines
  increaseQuantityDisplay(line: any): void {
    // Cap at 10 total per platform rules
    const src = line.sourceCartItem;
    if (!src) return;
    if (src.quantity + 1 <= 10) {
      this.updateQuantityFromDisplay(line, 1);
    } else {
      this.messageService.add({ severity: 'info', summary: 'Quantité maximale atteinte', detail: 'Vous ne pouvez pas commander plus de 10 unités.' });
    }
  }

  decreaseQuantityDisplay(line: any): void {
    const src = line.sourceCartItem;
    if (!src) return;
    if (src.quantity > 1) {
      this.updateQuantityFromDisplay(line, -1);
    }
  }

  removeDisplayLine(line: any): void {
    const src = line.sourceCartItem;
    if (!src) return;
    const remaining = src.quantity - line.quantity;
    if (remaining <= 0) {
      this.cartService.removeFromCart(src.product.id, src.selectedColor, src.selectedSize);
      setTimeout(() => { try { window.location.reload(); } catch (e) { } }, 60);
    } else {
      this.cartService.updateQuantity(src.product.id, src.selectedColor, src.selectedSize, remaining);
    }
  }

  /** Wave 3: product IDs currently in cart — used for cross-sell. */
  get cartProductIds(): number[] {
    return (this.cartItems || [])
      .map((i: any) => i?.product?.id)
      .filter((id: any) => typeof id === 'number');
  }

  /**
   * Wave 2: Save cart item for later.
   * Tries the backend endpoint when the user is logged in; otherwise hides the line
   * from the current session cart as a client-only save. Never crashes on 401/offline.
   */
  saveForLater(line: any): void {
    const token = localStorage.getItem('jwt') || localStorage.getItem('admin_jwt');
    const src = line?.sourceCartItem;
    if (!src) return;

    // Client-side remove (so UI reflects immediately)
    this.cartService.removeFromCart(src.product.id, src.selectedColor, src.selectedSize);
    this.messageService.add({
      severity: 'success',
      summary: 'Sauvegardé',
      detail: 'Article déplacé dans votre liste "pour plus tard".',
      life: 3000,
    });

    // Server-side persistence (best-effort, logged-in users)
    if (token && src?.cartItemId) {
      this.http.post(
        `${environementDev.api}/api/storefront/cart/${src.cartItemId}/save-for-later`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      ).subscribe({ next: () => {}, error: () => {} });
    }
  }

  // Express checkout methods
  openExpressCheckoutModal(): void {
    this.showExpressCheckoutModal = true;
  }

  closeExpressCheckoutModal(): void {
    this.showExpressCheckoutModal = false;
  }
}
