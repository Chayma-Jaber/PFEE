import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CheckoutService } from '../../../services/checkout.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { CouponToastComponent } from '../../shared/coupon-toast.component';
import { ProfileService } from '../sign/profile';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AddressListModalComponent } from '../sign/components/address-list-modal/address-list-modal.component';
import { CreateAddressComponent } from '../sign/components/create-address/create-address.component';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../../services/cart.service';
import { OrderService } from '../../../services/order.service';
import { Router } from '@angular/router';
import { TitleService } from '../../../services/title.service';
import { FunnelService } from '../../../services/funnel.service';
import { GiftCardService } from '../gift-card/gift-card.service';
import { environementDev } from '../../../../environements/environementDev';
import { AnalyticsService } from '../../../services/analytics.service';
import { CartRecommendationsNextGenComponent } from '../../commun/next-gen-recommendations';
import { CheckoutRewardsComponent, RewardsDiscount } from '../../commun/checkout-rewards/checkout-rewards.component';
import { PremiumCheckoutOptionsComponent, PremiumOptions } from '../../commun/premium-checkout-options/premium-checkout-options.component';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-checkout',
  imports: [RouterModule, CommonModule, ToastModule, FormsModule, CouponToastComponent, CartRecommendationsNextGenComponent, CheckoutRewardsComponent, PremiumCheckoutOptionsComponent],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss'],
  providers: [MessageService],
})
export class CheckoutComponent implements OnInit {
  appliedCoupon: any = null;
  confirmingOrder = false;
  orderError: string | null = null;
  paymentStatus: 'idle' | 'processing' | 'success' | 'error' = 'idle';
  paymentMethods: any[] = [];
  shippingMethods: any[] = [];
  selectedPaymentMethod: string = '';
  selectedShippingMethod: string = '';
  deliveryMethod: string = '';
  currentStep: number = 1;
  selectedAddress: any;
  stores: any[] = [];
  selectedStore: any;
  filteredStores: any[] = [];
  cartItems: any[] = [];
  deliveryCost: number = 0;
  subtotal: number = 0;
  total: number = 0;
  availablePaymentMethods: any[] = [];
  currentUser: any = null;
  promoCode: string = '';
  promoCodeApplied: boolean = false;
  availableCoupons: any[] = [];
  loadingCoupons: boolean = false;
  showCouponDropdown: boolean = false;
  selectedCouponText: string = '';
  selectedCouponDiscount: string = '';
  discountAmount: number = 0;
  coupons: any[] = [];
  // --- Ajout pour coupons privés ---
  privateCoupons: any[] = [];
  privateCouponCode: string = '';
  privateCouponApplied: boolean = false;
  // Flag to determine if coupon step should be shown (initialized early to prevent stepper from changing)
  showCouponStep: boolean = false;
  showCouponToast: boolean = false;
  onClose = () => {
    this.showCouponToast = false;
  };

  // Loyalty & Gift Card rewards
  rewardsDiscount: RewardsDiscount = {
    loyaltyPoints: 0,
    loyaltyDiscount: 0,
    giftCardCode: '',
    giftCardDiscount: 0,
    totalDiscount: 0
  };

  onRewardsDiscountChanged(discount: RewardsDiscount): void {
    this.rewardsDiscount = discount;
    this.calculateTotals();
  }

  // Wave 4 premium options (gift wrap, delivery slot, click & collect)
  premiumOpts: PremiumOptions = {
    giftWrap: false,
    giftMessage: '',
    deliverySlotId: null,
    pickupLocationId: null,
    deliveryMode: 'HOME'
  };

  onPremiumOptionsChanged(opts: PremiumOptions): void {
    this.premiumOpts = opts;
    // Keep the legacy deliveryMethod in sync with the premium mode
    if (opts.deliveryMode === 'PICKUP' && this.deliveryMethod !== 'store') {
      this.deliveryMethod = 'store';
      this.onDeliveryMethodChange();
    }
  }

  get premiumCity(): string {
    return (this.selectedAddress?.city || this.selectedStore?.city || 'Tunis') as string;
  }



  constructor(
    private checkoutService: CheckoutService,
    private messageService: MessageService,
    private profileService: ProfileService,
    private modalService: NgbModal,
    private cartService: CartService,
    private router: Router,
    private orderService: OrderService,
    private titleService: TitleService,
    private giftCardService: GiftCardService,
    private analyticsService: AnalyticsService,
    private funnel: FunnelService,
    private http: HttpClient
  ) { }

  // Wave 4: persist gift wrap, delivery slot, pickup on the NestJS side after order creation.
  // Fire-and-forget — the legacy order has already been committed so this must not block.
  private persistPremiumOptions(orderId: number) {
    const hasAnyOpt =
      this.premiumOpts.giftWrap ||
      !!this.premiumOpts.giftMessage ||
      this.premiumOpts.deliverySlotId != null ||
      this.premiumOpts.pickupLocationId != null;
    if (!hasAnyOpt) return;
    const token = localStorage.getItem('jwt');
    if (!token) return;
    this.http.post(
      `${environementDev.api}/api/storefront/w4/orders/${orderId}/premium-options`,
      {
        giftWrap: this.premiumOpts.giftWrap,
        giftMessage: this.premiumOpts.giftMessage,
        deliverySlotId: this.premiumOpts.deliverySlotId,
        pickupLocationId: this.premiumOpts.pickupLocationId,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    ).subscribe({ next: () => {}, error: (e) => console.warn('premium-options attach failed', e) });
  }


  ngOnInit() {
    this.titleService.setSpecificTitle('Finaliser ma commande');
    this.funnel.track('START_CHECKOUT');
    this.loadPaymentMethods();
    this.loadShippingMethods();
    this.loadStores();
    this.loadCartItems();
    this.loadUserData();
    this.loadCoupons();
    //this.getPromo();
    this.loadPrivateCoupons(); // Ajout pour coupons privés
    // Load saved state from sessionStorage
    const savedState = sessionStorage.getItem('checkoutState');
    if (savedState) {
      const state = JSON.parse(savedState);
      this.currentStep = state.currentStep || 1;
      this.deliveryMethod = state.deliveryMethod || 'home'; // Set default to home delivery
      this.selectedPaymentMethod = state.selectedPaymentMethod || '';
      this.selectedAddress = state.selectedAddress || null;
      this.selectedStore = state.selectedStore || null;
      // Restore coupon state
      this.appliedCoupon = state.appliedCoupon || null;
      this.promoCodeApplied = state.promoCodeApplied || false;
      this.privateCouponApplied = state.privateCouponApplied || false;
      this.privateCouponCode = state.privateCouponCode || '';
      this.discountAmount = state.discountAmount || 0;
      this.promoCode = state.promoCode || '';
      this.selectedCouponText = state.selectedCouponText || '';
      this.selectedCouponDiscount = state.selectedCouponDiscount || '';
      // Recalculate totals with restored coupon if applicable
      if (this.appliedCoupon) {
        this.calculateTotalsWithCoupon();
      }
    } else {
      // Set default delivery method to home delivery for new sessions
      this.deliveryMethod = 'home';
    }

    // If no address is selected from saved state, load and set default address
    if (!this.selectedAddress) {
      this.loadUserAddresses();
    }

    // Démarrage du process de commande (checkout)
    this.analyticsService.trackEvent('start_checkout', {
      panier: this.cartItems.map(item => ({
        id: item.product?.id,
        sku: item.product?.sku,
        nom: item.product?.title,
        quantite: item.quantity,
        prix: item.product?.currentPrice
      }))
    });
  }

  // Affiche le toast lors de l'application d'un coupon
  showCouponToastMessage() {
    this.showCouponToast = true;
    setTimeout(() => {
      this.showCouponToast = false;
    }, 4000);
  }

  // Load available coupons from API
  loadCoupons() {
    // Only load coupons if user is authenticated
    if (!localStorage.getItem('jwt')) {
      return;
    }

    this.loadingCoupons = true;
    this.giftCardService.getCoupons().subscribe({
      next: (response) => {
        if (response && response.data) {
          // Utiliser la liste brute sans tri ni transformation
          this.availableCoupons = response.data;
        } else {
          this.availableCoupons = [];
        }
        this.loadingCoupons = false;
        // Update showCouponStep based on availability of coupons
        this.updateCouponStepVisibility();
      },
      error: (error) => {
        console.error('Error loading coupons:', error);
        this.availableCoupons = [];
        this.loadingCoupons = false;
      }
    });
  }

  // Sort coupons by application method and priority
  // private sortCouponsByApplicationMethod(coupons: any[]): any[] {

  //   const autoCoupons = coupons.filter((coupon: any) => coupon.appliq_method === "Auto");
  //   const manuallyCoupons = coupons.filter((coupon: any) => coupon.appliq_method === "Manually");


  //   if (autoCoupons.length > 0) {
  //     return autoCoupons.sort((a: any, b: any) => a.priority - b.priority);
  //   }


  //   return manuallyCoupons;
  // }

  private saveState() {
    const state = {
      currentStep: this.currentStep,
      deliveryMethod: this.deliveryMethod,
      selectedPaymentMethod: this.selectedPaymentMethod,
      selectedAddress: this.selectedAddress,
      selectedStore: this.selectedStore,
      appliedCoupon: this.appliedCoupon,
      promoCodeApplied: this.promoCodeApplied,
      privateCouponApplied: this.privateCouponApplied,
      privateCouponCode: this.privateCouponCode,
      discountAmount: this.discountAmount,
      promoCode: this.promoCode,
      selectedCouponText: this.selectedCouponText,
      selectedCouponDiscount: this.selectedCouponDiscount
    };
    sessionStorage.setItem('checkoutState', JSON.stringify(state));
  }
  loadUserData() {
    const userData = localStorage.getItem('user');
    if (userData) {
      this.currentUser = JSON.parse(userData);
    }
  }
  get hasCoupons(): boolean {
    // Dynamically check if user has any available coupons
    return this.availableCoupons.length > 0 || this.privateCoupons.length > 0;
  }

  // Update the visibility of the coupon step based on available coupons
  private updateCouponStepVisibility(): void {
    const hasAnyCoupons = this.availableCoupons.length > 0 || this.privateCoupons.length > 0;
    // Only update if the value has changed to avoid stepper flickering
    if (this.showCouponStep !== hasAnyCoupons) {
      this.showCouponStep = hasAnyCoupons;
    }
  }

  get totalSteps(): number {
    return this.hasCoupons ? 4 : 3;
  }
  loadStores() {
    this.checkoutService.getStores().subscribe({
      next: (response) => {
        this.stores = response.hits;
      },
    });
  }

  loadPaymentMethods() {
    this.checkoutService.getPaymentMethods().subscribe({
      next: (response) => {
        this.paymentMethods = response.hits;
        this.filterPaymentMethods();
      },
      error: (error) => {
        console.error('Error fetching payment methods:', error);
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Une erreur est survenue lors de la récupération des méthodes de paiement' });
      },
    });
  }
  openAddressList() {
    const modalRef = this.modalService.open(AddressListModalComponent, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false
    });

    modalRef.result.then(
      (result) => {
        // console.log('Modal closed:', result);
        this.selectedAddress = result;
      },
      (reason: any) => {
        // console.log('Modal dismissed:', reason);
      }
    );
  }

  // Load user addresses and automatically select the default address
  loadUserAddresses() {
    this.profileService.getAddresses().subscribe({
      next: (response: any) => {
        if (response && response.data && response.data.length > 0) {
          // Find the default address
          const defaultAddress = response.data.find((address: any) => address.defaultAddress === true);

          // If a default address exists and no address is currently selected, select it
          if (defaultAddress && !this.selectedAddress) {
            this.selectedAddress = defaultAddress;
            this.calculateTotals(); // Recalculate totals with the selected address
            this.saveState(); // Save the state with the selected address
          }
        }
      },
      error: (error) => {
        console.error('Error loading addresses:', error);
      }
    });
  }
  openModal() {
    const modalRef = this.modalService.open(CreateAddressComponent, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false
    });

    modalRef.result.then(
      (result: any) => {
        // console.log('Modal closed:', result);
        this.selectedAddress = result;
      },
      (reason) => {
        // console.log('Modal dismissed:', reason);
      }
    );
  }
  loadShippingMethods() {
    this.checkoutService.getShippingMethods().subscribe({
      next: (response) => {
        this.shippingMethods = response.hits;
      },
      error: (error) => {
        console.error('Error fetching shipping methods:', error);
      },
    });
  }

  nextStep() {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.saveState();
    }
  }



  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.saveState();
    }
  }

  selectPaymentMethod(method: string) {
    this.selectedPaymentMethod = method;
    // Recalculer les totaux lorsque la méthode de paiement change
    this.calculateTotals();
    this.saveState();
  }


  onStoreSelect(event: any) {
    const storeId = event.target.value;
    this.selectedStore = this.stores.find(store => store.id == storeId);
    this.calculateTotals();
    this.saveState();
  }
  clearStoreSelection() {
    this.selectedStore = null;
  }
  onDeliveryMethodChange() {
    if (this.deliveryMethod === 'home') {
      this.selectedStore = null;
      // If no address is selected, try to load the default address
      if (!this.selectedAddress) {
        this.loadUserAddresses();
      }
    } else {
      this.selectedAddress = null;
      this.deliveryCost = 0;
      this.selectedPaymentMethod = '';
    }
    this.calculateTotals();
    this.filterPaymentMethods();
    this.saveState();
  }

  filterPaymentMethods() {
    if (this.deliveryMethod === 'store') {
      this.availablePaymentMethods = this.paymentMethods.filter(
        method => method.codeErp === 'CBE'
      );
      if (this.availablePaymentMethods.length > 0) {
        this.selectedPaymentMethod = 'CBE';
      }
    } else {
      this.availablePaymentMethods = this.paymentMethods.filter(
        method => method.codeErp === 'CBE' || method.codeErp === 'RDE'
      );
    }

    if (this.selectedPaymentMethod &&
      !this.availablePaymentMethods.some(m => m.codeErp === this.selectedPaymentMethod)) {
      this.selectedPaymentMethod = '';
    }
  }
  getSelectedPaymentMethodName(): string {
    if (!this.selectedPaymentMethod) return 'Méthode de paiement non sélectionnée';

    const method = this.paymentMethods.find(m => m.codeErp === this.selectedPaymentMethod);
    if (method) {
      return this.selectedPaymentMethod === 'CBE' ? 'Paiement par carte bancaire' : method.name;
    }
    return 'Méthode de paiement inconnue';
  }
  isDeliveryMethodValid(): boolean {
    if (this.deliveryMethod === 'home') {
      return !!this.selectedAddress;
    } else if (this.deliveryMethod === 'store') {
      return !!this.selectedStore;
    }
    return false;
  }
  // Propriétés pour les prix promotionnels
  cartItemsWithPromo: any[] = [];
  hasActivePromotion: boolean = false;

  loadCartItems() {
    this.cartService.cartItems$.subscribe((items: any) => {
      this.cartItems = items;

      // Vérifier les promotions si des articles sont présents
      if (items.length > 0) {
        this.checkForPromotions(items);
      } else {
        this.calculateTotals();
      }
    });
  }

  // Get cart product IDs for recommendations
  get cartProductIds(): number[] {
    return this.cartItems
      .map((item: any) => item.product?.id)
      .filter((id: number) => id != null);
  }

  // Format cart items for the checkCartOffers API
  private formatCartItemsForOfferApi(items: any[]): any[] {
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
  private checkForPromotions(items: any[]): void {
    if (items.length === 0) {
      this.hasActivePromotion = false;
      this.cartItemsWithPromo = [];
      this.calculateTotals();
      return;
    }

    const formattedItems = this.formatCartItemsForOfferApi(items);

    this.orderService.checkCartOffers(formattedItems).subscribe({
      next: (response: any) => {
        if (response && response.data && response.data.cartProducts) {
          // Créer une map pour associer les offres (peut contenir plusieurs) par ean13
          const offersMap = new Map<string, any[]>();
          response.data.cartProducts.forEach((offer: any) => {
            const arr = offersMap.get(offer.ean13) || [];
            arr.push(offer);
            offersMap.set(offer.ean13, arr);
          });

          // Enrichir les articles du panier avec les données d'offres
          const displayLines: any[] = [];
          items.forEach((item: any) => {
            const offers = offersMap.get(item.ean13) || [];
            let remaining = item.quantity;
            offers.forEach((offer: any) => {
              displayLines.push({
                ...item,
                ean13: offer.ean13,
                quantity: offer.quantity,
                originalUnitPrice: offer.originalUnitPrice ?? item.product.currentPrice,
                unitPrice: offer.unitPrice ?? item.product.currentPrice,
                discountPercent: offer.discountPercent ?? 0,
                hasDiscount: offer.hasDiscount ?? false,
                sourceCartItem: item
              });
              remaining -= offer.quantity;
            });
            if (remaining > 0) {
              displayLines.push({
                ...item,
                ean13: item.ean13,
                quantity: remaining,
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
          this.hasActivePromotion = this.cartItemsWithPromo.some((item: any) => item.hasDiscount);
          this.calculateTotals();
        } else {
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
    // Fallback: convert cartItems to display lines
    this.cartItemsWithPromo = this.cartItems.map((item: any) => ({
      ...item,
      ean13: item.ean13,
      quantity: item.quantity,
      originalUnitPrice: item.product.currentPrice,
      unitPrice: item.product.currentPrice,
      discountPercent: 0,
      hasDiscount: false,
      sourceCartItem: item
    }));
    this.hasActivePromotion = false;
    this.calculateTotals();
  }


  calculateTotals(skipCouponCalculation = false) {
    // Calculer le sous-total en tenant compte des promotions
    if (this.hasActivePromotion && this.cartItemsWithPromo.length > 0) {
      // Utiliser les prix promotionnels
      this.subtotal = 0;

      // Calculer le sous-total directement depuis les lignes display (elles représentent des segments d'un même produit)
      this.subtotal = this.cartItemsWithPromo.reduce((sum: number, line: any) => sum + (line.unitPrice * line.quantity), 0);
    } else {
      // Calculer normalement sans promotions
      this.subtotal = this.cartItems.reduce((sum, item) =>
        sum + (item.product.currentPrice * item.quantity), 0);
    }

    // If we're only calculating subtotal for coupon logic, stop here
    if (skipCouponCalculation) {
      return;
    }

    // If user is currently on the coupon (reduction) step, do not compute shipping here
    if (this.hasCoupons && this.currentStep === 1) {
      // If a coupon is applied, defer to coupon calculation which may recompute delivery
      if (this.appliedCoupon) {
        this.calculateTotalsWithCoupon();
      } else {
        this.deliveryCost = 0;
        this.total = this.subtotal;
      }
      return;
    }

    // Déterminer le coût de livraison (normal flow)
    const selectedShippingMethod = this.shippingMethods.find(method =>
      (this.deliveryMethod === 'home' && method.id === 1) ||
      (this.deliveryMethod === 'store' && method.id === 2)
    );

    if (selectedShippingMethod) {
      // Vérifier si la livraison est gratuite en fonction du montant du panier
      const isDeliveryFree = this.deliveryMethod === 'home' &&
        selectedShippingMethod.freeCondition > 0 &&
        this.subtotal >= selectedShippingMethod.freeCondition;

      // Si la livraison est gratuite ou si c'est un retrait en magasin, le coût est 0
      if (isDeliveryFree || this.deliveryMethod === 'store') {
        this.deliveryCost = 0;
      } else {
        // Sinon, appliquer le coût standard de livraison
        this.deliveryCost = selectedShippingMethod.cost;
      }
    } else {
      this.deliveryCost = 0;
    }

    // Calculer le total
    this.total = this.subtotal + this.deliveryCost;

    // Si un coupon est appliqué et qu'on n'est pas déjà en train de calculer avec le coupon,
    // recalculer avec la réduction
    if (this.appliedCoupon && !skipCouponCalculation) {
      this.calculateTotalsWithCoupon();
    }
  }
  async confirmOrder() {
    if (!this.validateBeforeSubmit()) {
      return;
    }

    this.confirmingOrder = true;
    this.orderError = null;

    try {
      const payload = this.buildOrderPayload();
      // console.log('Order payload:', payload);

      const orderResponse: any = await this.orderService.placeOrder(payload).toPromise();

      if (orderResponse.status === 200) {
        this.messageService.add({
          severity: 'success',
          summary: 'Commande confirmée',
          detail: 'Votre commande a été passée avec succès',
          life: 5000
        });

        this.cartService.clearCart();
        sessionStorage.removeItem('checkoutState');

        // Wave 4: persist premium options on the NestJS order row (fire-and-forget)
        if (orderResponse?.data?.id) {
          this.persistPremiumOptions(orderResponse.data.id);
        }

        if (this.selectedPaymentMethod === 'CBE') {
          // Include orderId in redirect URL for payment verification
          const orderId = orderResponse.data.id;
          const redirectUrl = `${environementDev.redirectUrlLocal}/${orderId}`;
          const ctpResponse = await this.orderService.getCTPTransaction(orderId, redirectUrl).toPromise();

          if (ctpResponse.status === 200) {
            window.location.href = ctpResponse.data.url;
            return;
          } else {
            throw new Error('Échec création transaction CBE');
          }
        } else {
          // Cash on delivery - redirect to order confirmation
          this.router.navigate(['/checkout/order-confirmation', orderResponse.data.id]);
        }

        // Ajout événement GA4 validation finale commande
        this.analyticsService.validateOrder({
          montant_total: this.total,
          nombre_articles: this.cartItems.reduce((sum, item) => sum + item.quantity, 0),
          liste_produits: this.cartItems.map(item => ({
            id: String(item.product?.id),
            reference: item.product?.sku,
            nom: item.product?.title,
            quantite: item.quantity,
            prix_avant_remise: item.product?.originalPrice || item.product?.currentPrice,
            prix_apres_remise: item.product?.currentPrice,
            id_panier: localStorage.getItem('jwt') || 'guest'
          })),
          methode_livraison: this.selectedShippingMethod || this.deliveryMethod,
          methode_paiement: this.selectedPaymentMethod,
          sous_total: this.subtotal,
          total: this.total,
          frais_livraison: this.deliveryCost
        });
      } else {
        throw new Error(orderResponse.message || "Erreur serveur inconnue");
      }
    } catch (error) {
      this.handleOrderError(error);
    } finally {
      this.confirmingOrder = false;
    }
  }
  private handleOrderError(error: any): void {
    console.error('Full error:', error);

    let errorDetail = 'Erreur lors de la confirmation de la commande';
    if (error?.error?.message) {
      errorDetail = error.error.message;
    } else if (error?.message) {
      errorDetail = error.message;
    }

    this.orderError = errorDetail;

    this.messageService.add({
      severity: 'error',
      summary: 'Erreur de commande',
      detail: errorDetail,
      life: 5000
    });
  }

  private validateBeforeSubmit(): boolean {
    if (!this.deliveryMethod) {
      this.showError('Méthode requise', 'Veuillez sélectionner un mode de livraison');
      return false;
    }

    if (this.deliveryMethod === 'home') {
      if (!this.selectedAddress?.id) {
        this.showError('Adresse requise', 'Veuillez sélectionner une adresse de livraison');
        return false;
      }
      if (!this.selectedPaymentMethod) {
        this.showError('Paiement requis', 'Veuillez sélectionner un mode de paiement');
        return false;
      }
    }

    if (this.deliveryMethod === 'store') {
      if (!this.selectedStore?.id) {
        this.showError('Magasin requis', 'Veuillez sélectionner un magasin pour retrait');
        return false;
      }
      if (this.selectedPaymentMethod !== 'CBE') {
        this.showError('Paiement invalide', 'Le retrait en magasin nécessite le paiement par carte');
        return false;
      }
    }

    return true;
  }

  private buildOrderPayload(): any {
    const isStorePickup = this.deliveryMethod === 'store';

    const shippingMethodId = isStorePickup ? 2 : 1;

    let paymentMethodId;
    if (this.selectedPaymentMethod === 'CBE') {
      paymentMethodId = 2;
    } else {
      paymentMethodId = 3;
    }

    // Ajouter l'ID du coupon dans le payload si un coupon est appliqué

    const payload: any = {
      orderData: {
        subTotal: parseFloat(this.subtotal.toFixed(3)),
        shippingMethod: shippingMethodId,
        paymentMethod: paymentMethodId,
        shippingCost: parseFloat(this.deliveryCost.toFixed(3)),
        total: parseFloat(this.total.toFixed(3))
      },
      products: (this.hasActivePromotion && this.cartItemsWithPromo.length > 0)
        ? this.cartItemsWithPromo.map((line: any) => ({
          ean13: line.ean13,
          quantity: line.quantity,
          unitPrice: parseFloat(line.unitPrice.toFixed(3)),
          discount: line.hasDiscount ? line.discountPercent || 0 : 0,
          discountDesc: ''
        }))
        : this.cartItems.map(item => ({
          ean13: item.ean13,
          quantity: item.quantity,
          unitPrice: parseFloat(item.product.currentPrice.toFixed(3)),
          discount: 0,
          discountDesc: ''
        }))
    };

    if (!isStorePickup) {
      payload.orderData.shippingAddress = this.selectedAddress.id;
    } else {
      payload.orderData.shippingStore = this.selectedStore.id;
    }

    // Ajouter l'ID du coupon si un coupon est appliqué
    if (this.appliedCoupon) {
      payload.orderData.coupon = this.appliedCoupon.id;
    }

    // Wave 4: premium checkout options
    if (this.premiumOpts.giftWrap) {
      payload.orderData.giftWrap = true;
      if (this.premiumOpts.giftMessage) {
        payload.orderData.giftMessage = this.premiumOpts.giftMessage.slice(0, 240);
      }
    }
    if (this.premiumOpts.deliverySlotId) {
      payload.orderData.deliverySlotId = this.premiumOpts.deliverySlotId;
    }
    if (this.premiumOpts.pickupLocationId) {
      payload.orderData.pickupLocationId = this.premiumOpts.pickupLocationId;
    }

    return payload;
  }


  private showError(summary: string, detail: string): void {
    this.messageService.add({
      severity: 'error',
      summary,
      detail,
      life: 5000
    });
  }

  // Toggle coupon dropdown visibility
  toggleCouponDropdown(): void {
    if (this.privateCouponApplied) {
      return;
    }
    this.showCouponDropdown = !this.showCouponDropdown;
  }

  // Select a coupon from the dropdown
  selectCoupon(coupon: any): void {
    this.promoCode = coupon.id.toString();
    this.selectedCouponText = coupon.code;

    // Set the discount text based on discount amount or percentage
    if (coupon.discount_amount > 0) {
      this.selectedCouponDiscount = coupon.discount_amount + 'TND';
    } else if (coupon.discount_percent > 0) {
      this.selectedCouponDiscount = coupon.discount_percent + '%';
    } else {
      this.selectedCouponDiscount = '';
    }

    this.showCouponDropdown = false;

    // Apply the selected coupon immediately without requiring the user
    // to click the validate/apply button again.
    this.applyPromoCode();
  }

  // Méthode pour appliquer un code promo
  applyPromoCode(): void {
    if (!this.promoCode || this.promoCode === '') {
      this.showError('Code promo vide', 'Veuillez sélectionner un code promo');
      return;
    }
    // Find the selected coupon from the available coupons
    const selectedCoupon = this.availableCoupons.find(coupon => coupon.id.toString() === this.promoCode);
    if (!selectedCoupon) {
      this.showError('Code promo invalide', 'Le code promo sélectionné est invalide');
      return;
    }
    this.appliedCoupon = selectedCoupon;
    this.promoCodeApplied = true;
    this.privateCouponApplied = false; // désactive le champ privé si un coupon général est appliqué
    this.privateCouponCode = '';
    // Recalculer les totaux avec la réduction
    this.calculateTotalsWithCoupon();
    this.showCouponToastMessage();
    // Save the coupon state to sessionStorage
    this.saveState();
    // Ajout événement GA4
    this.analyticsService.applyCoupon({
      code_copon: selectedCoupon.code,
      id_codecopon: String(selectedCoupon.id),
      montant_avant: this.subtotal,
      montant_apres: this.total
    });
  }

  // Méthode pour calculer les totaux avec le coupon appliqué
  calculateTotalsWithCoupon(): void {
    // Calculer d'abord les totaux sans la réduction du coupon
    // Passer true pour éviter la récursion infinie
    this.calculateTotals(true);

    // Appliquer la réduction du coupon si un coupon est appliqué
    if (this.appliedCoupon) {
      this.discountAmount = 0;

      if (this.appliedCoupon.discount_amount > 0) {
        // Réduction en montant fixe
        this.discountAmount = this.appliedCoupon.discount_amount;
      } else if (this.appliedCoupon.discount_percent > 0) {
        // Réduction en pourcentage
        this.discountAmount = (this.subtotal * this.appliedCoupon.discount_percent) / 100;
      }

      // Calculer le sous-total après réduction
      const subtotalAfterDiscount = Math.max(0, this.subtotal - this.discountAmount);

      // If we are on the coupon (reduction) step, avoid calculating shipping here
      if (this.hasCoupons && this.currentStep === 1) {
        this.total = subtotalAfterDiscount;
        return;
      }

      // Vérifier si la livraison est gratuite en fonction du sous-total après réduction
      const selectedShippingMethod = this.shippingMethods.find(method =>
        (this.deliveryMethod === 'home' && method.id === 1) ||
        (this.deliveryMethod === 'store' && method.id === 2)
      );

      if (selectedShippingMethod && this.deliveryMethod === 'home') {
        // Vérifier si le sous-total après réduction est toujours supérieur à la condition de livraison gratuite
        const isDeliveryFree = selectedShippingMethod.freeCondition > 0 &&
          subtotalAfterDiscount >= selectedShippingMethod.freeCondition;

        if (isDeliveryFree) {
          this.deliveryCost = 0;
        } else {
          // Si le sous-total après réduction ne remplit plus la condition, appliquer le coût standard
          this.deliveryCost = selectedShippingMethod.cost;
        }
      }

      // Calculer le total final (sous-total - réduction + frais de livraison)
      this.total = subtotalAfterDiscount + this.deliveryCost;
    } else {
      this.discountAmount = 0;
    }
  }
  clearCouponCode() {
    this.selectedCouponText = '';
    this.selectedCouponDiscount = '';
    this.showCouponDropdown = false;
    this.promoCode = '';
    this.promoCodeApplied = false;
    this.appliedCoupon = null;
    this.discountAmount = 0;
    this.privateCouponApplied = false;
    // Recalculate totals without coupon
    this.calculateTotals();
    // Save the state when coupon is cleared
    this.saveState();
  }


  getPromo() {

    this.giftCardService.getCouponsUserPrivate().subscribe({
      next: (response) => {
        this.coupons = response['data'] as any[];

      },
      error: (error) => {
        console.error('Erreur lors du chargement des coupons', error);

      }
    });
  }

  // --- Coupons privés ---
  loadPrivateCoupons() {
    this.giftCardService.getCouponsUserPublic().subscribe({
      next: (response) => {
        this.privateCoupons = response?.data || [];
        // Update showCouponStep based on availability of coupons
        this.updateCouponStepVisibility();
      },
      error: (error) => {
        this.privateCoupons = [];
        console.error('Erreur lors du chargement des coupons privés', error);
        // Update showCouponStep even on error
        this.updateCouponStepVisibility();
      }
    });
  }

  applyPrivateCoupon(): void {
    if (!this.privateCouponCode) {
      this.showError('Code promo vide', 'Veuillez saisir un code promo privé');
      return;
    }
    const selectedCoupon = this.privateCoupons.find(coupon => coupon.code === this.privateCouponCode);
    if (!selectedCoupon) {
      this.showError('Code promo invalide', 'Le code promo privé saisi est invalide');
      return;
    }
    this.appliedCoupon = selectedCoupon;
    this.privateCouponApplied = true;
    this.promoCodeApplied = false; // désactive l'autre champ
    this.promoCode = '';
    this.selectedCouponText = '';
    this.selectedCouponDiscount = '';
    this.calculateTotalsWithCoupon();
    // Save the coupon state to sessionStorage
    this.saveState();
    this.showCouponToastMessage();
    this.analyticsService.trackEvent('apply_private_coupon', {
      id_coupon: selectedCoupon.id,
      code_coupon: selectedCoupon.code
    });
  }

  clearPrivateCoupon() {
    this.privateCouponCode = '';
    this.privateCouponApplied = false;
    this.appliedCoupon = null;
    this.discountAmount = 0;
    this.calculateTotals();
    this.saveState();
  }
}
