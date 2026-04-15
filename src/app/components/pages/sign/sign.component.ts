import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CheckoutService } from '../../../services/checkout.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AddressListModalComponent } from '../sign/components/address-list-modal/address-list-modal.component';
import { CreateAddressComponent } from '../sign/components/create-address/create-address.component';
import { CartService } from '../../../services/cart.service';
import { OrderService } from '../../../services/order.service';
import { AuthService } from '../../../services/auth.service';
import { FooterService } from '../../../services/footer.service';
import { MarkdownModule, provideMarkdown } from 'ngx-markdown';
import { ProfileService } from './profile';
import { GiftCardService } from '../gift-card/gift-card.service';
import { firstValueFrom } from 'rxjs';
import { environementDev } from '../../../../environements/environementDev';
import { AnalyticsService } from '../../../services/analytics.service';
@Component({
  selector: 'app-sign',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule, ToastModule, DialogModule, MarkdownModule],
  templateUrl: './sign.component.html',
  styleUrl: './sign.component.scss',
  providers: [MessageService, provideMarkdown()],
})
export class SignComponent {
  // Checkout steps
  currentStep: number = 1;
  cartItemCount: number = 0;
  // Login/Registration fields
  showCreateAccount: boolean = false;
  showOtpForm: boolean = false;
  showForgotPassword: boolean = false;
  loginData = { identifier: '', password: '' };
  registrationForm: FormGroup;
  privacyAccepted: boolean = false; // Variable pour la case à cocher de la politique de confidentialité
  isLoading: boolean = false;
  phoneNumber: string = '';
  otpCode: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  otpSent: boolean = false;
  otpVerified: boolean = false;
  countdown: number = 50;
  countdownInterval: any;
  hashedToken: string = '';
  showPassword: boolean = false;

  // Checkout fields
  appliedCoupon: any = null;
  confirmingOrder = false;
  orderError: string | null = null;
  paymentStatus: 'idle' | 'processing' | 'success' | 'error' = 'idle';
  paymentMethods: any[] = [];
  shippingMethods: any[] = [];
  selectedPaymentMethod: string = '';
  selectedShippingMethod: string = '';
  deliveryMethod: string = '';
  selectedAddress: any;
  stores: any[] = [];
  selectedStore: any;
  filteredStores: any[] = [];
  cartItems: any[] = [];
  deliveryCost: number = 0;
  subtotal: number = 0;
  total: number = 0;
  availablePaymentMethods: any[] = [];
  // Propriétés pour les prix promotionnels
  cartItemsWithPromo: any[] = [];
  hasActivePromotion: boolean = false;
  // Propriétés pour le code promo
  promoCode: string = '';
  promoCodeApplied: boolean = false;
  availableCoupons: any[] = [];
  loadingCoupons: boolean = false;
  showCouponDropdown: boolean = false;
  selectedCouponText: string = '';
  selectedCouponDiscount: string = '';
  discountAmount: number = 0;

  showPrivacyDialog = false;
  privacyData: any;
  isPrivacyLoading = false;
  coupons: any[] = [];
  publicUserPromoCode: string = '';
  publicUserPromoApplied: boolean = false;


  constructor(
    private checkoutService: CheckoutService,
    private messageService: MessageService,
    private modalService: NgbModal,
    private cartService: CartService,
    private router: Router,
    private orderService: OrderService,
    private authService: AuthService,
    private fb: FormBuilder,
    private footerService: FooterService,
    private profileService: ProfileService,
    private giftCardService: GiftCardService,
    private analyticsService: AnalyticsService,
    private route: ActivatedRoute
  ) {
    this.registrationForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      birthday: ['', [Validators.required, this.birthdayValidator]],
      gender: ['', Validators.required],

    });
  }

  ngOnInit() {


    this.loadPaymentMethods();
    this.loadShippingMethods();
    this.loadStores();
    this.loadCartItems();
    this.loadCoupons();
    this.getPromo();
    this.loadPrivacyData();
    const savedState = sessionStorage.getItem('guestCheckoutState');
    if (savedState) {
      const state = JSON.parse(savedState);
      this.currentStep = state.currentStep || 1;
      this.deliveryMethod = state.deliveryMethod || 'home'; // Set default to home delivery
      this.selectedPaymentMethod = state.selectedPaymentMethod || '';
      this.selectedAddress = state.selectedAddress || null;
      this.selectedStore = state.selectedStore || null;

      // Recalculer les totaux après avoir restauré l'état
      setTimeout(() => {
        this.calculateTotals();
      }, 500);
    } else {
      // Set default delivery method to home delivery for new sessions
      this.deliveryMethod = 'home';
    }

    // Load user addresses and set default address if user is authenticated
    const token = localStorage.getItem('jwt');
    if (token && !this.selectedAddress) {
      this.loadUserAddresses();
    }

    this.cartService.cartItems$.subscribe(items => {
      this.cartItemCount = items.reduce((total, item) => total + item.quantity, 0);
      // Recalculer les totaux chaque fois que les articles du panier changent
      this.calculateTotals();
    });
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
          // Sort coupons according to the new logic:
          // 1. If user has "Auto" coupons: show ONLY "Auto" coupons sorted by priority
          // 2. If user has NO "Auto" coupons: show ONLY "Manually" coupons without sorting
          this.availableCoupons = response.data;
        } else {
          this.availableCoupons = [];
        }
        this.loadingCoupons = false;
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
  loadPrivacyData(): void {
    this.isPrivacyLoading = true;
    this.footerService.getPrivacyData().subscribe({
      next: (data) => {
        this.privacyData = data.hits[0];
        this.isPrivacyLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement de la politique de confidentialité:', error);
        this.isPrivacyLoading = false;
      }
    });
  }

  openPrivacyDialog(): void {
    this.showPrivacyDialog = true;
  }

  closePrivacyDialog(): void {
    this.showPrivacyDialog = false;
  }
  ngOnDestroy() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }
  resendOtp() {
    this.isLoading = true;

    // Vérifier d'abord si le numéro de téléphone est déjà utilisé
    this.authService.countPhone(this.registrationForm.value.phone).subscribe({
      next: (response) => {
        // Vérifier si le téléphone est déjà utilisé (count > 0)
        if (response && response.count > 0) {
          this.isLoading = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Téléphone déjà utilisé',
            detail: 'Ce numéro de téléphone est déjà associé à un compte',
            life: 3000,
          });
          return;
        }

        // Si le téléphone n'est pas utilisé, continuer avec l'envoi de l'OTP
        this.authService.generateOtp(this.registrationForm.value.phone).subscribe({
          next: (_) => {
            this.isLoading = false;
            this.startCountdown();
            this.messageService.add({
              severity: 'success',
              summary: 'Code OTP renvoyé',
              detail: 'Veuillez vérifier votre téléphone',
              life: 3000,
            });
          },
          error: (_) => {
            this.isLoading = false;
            this.messageService.add({
              severity: 'error',
              summary: 'Échec envoi OTP',
              detail: 'Veuillez réessayer',
              life: 3000,
            });
          },
        });
      },
      error: (error) => {
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur de vérification',
          detail: 'Impossible de vérifier la disponibilité du numéro de téléphone',
          life: 3000,
        });
        console.error('Erreur vérification téléphone:', error);
      }
    });
  }
  navigateToLogin() {
    this.currentStep = 1;
    this.showCreateAccount = false;
    this.privacyAccepted = false; // Réinitialiser la case à cocher de la politique de confidentialité
  }
  // Save state to sessionStorage
  private saveState() {
    const state = {
      currentStep: this.currentStep,
      deliveryMethod: this.deliveryMethod,
      selectedPaymentMethod: this.selectedPaymentMethod,
      selectedAddress: this.selectedAddress,
      selectedStore: this.selectedStore
    };
    sessionStorage.setItem('guestCheckoutState', JSON.stringify(state));
  }

  // Authentication methods
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  login() {
    if (!this.loginData.identifier || !this.loginData.password) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur de connexion',
        detail: 'Veuillez remplir tous les champs',
        life: 5000
      });
      return;
    }

    this.isLoading = true;
    this.authService.login(this.loginData.identifier, this.loginData.password).subscribe({
      next: (response) => {
        this.isLoading = false;

        // Capturer une copie du panier invité avant tout changement
        const guestCartKey = 'cartItems_guest';
        const guestCart = localStorage.getItem(guestCartKey);
        console.log('État du panier invité avant connexion:', guestCart);

        if (guestCart) {
          // Sauvegarder temporairement le panier invité avec une clé spéciale
          localStorage.setItem('temp_guest_cart', guestCart);
        }

        // Stocker les informations d'authentification
        const token = response.jwt || response.tokens?.access_token || '';
        localStorage.setItem('jwt', token);
        localStorage.setItem('user', JSON.stringify(response.user));

        // Récupérer l'ID utilisateur du token
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const userId = payload.id;

          if (guestCart) {
            // Transférer directement le panier invité vers le panier utilisateur
            localStorage.setItem(`cartItems_${userId}`, guestCart);
            // Nettoyer les données temporaires et le panier invité
            localStorage.removeItem(guestCartKey);
            localStorage.removeItem('temp_guest_cart');
          }
        } catch (e) {
          console.error('Erreur lors du traitement du token:', e);
        }

        // Forcer le rechargement du panier
        this.cartService.loadCurrentUserCart();

        // Afficher un message de succès
        this.messageService.add({
          severity: 'success',
          summary: 'Connexion réussie',
          detail: 'Vous êtes maintenant connecté',
          life: 5000
        });

        // If navigation came with a returnUrl (e.g., from attempting checkout), go back there
        const returnUrl = this.route.snapshot.queryParams['returnUrl'];
        if (returnUrl) {
          this.router.navigate([returnUrl]).then(() => { window.location.reload(); });
        } else {
          this.nextStep();
        }
      },
      error: (_) => {
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur de connexion',
          detail: 'Identifiants incorrects',
          life: 5000
        });
      }
    });
  }

  register() {
    if (this.registrationForm.invalid) {
      this.messageService.add({
        severity: 'error',
        summary: 'Formulaire invalide',
        detail: 'Veuillez remplir tous les champs correctement',
        life: 5000
      });
      return;
    }

    if (!this.privacyAccepted) {
      this.messageService.add({
        severity: 'error',
        summary: 'Politique de confidentialité',
        detail: 'Veuillez accepter la politique de confidentialité pour continuer',
        life: 5000
      });
      return;
    }

    this.sendOtp();
  }

  sendOtp() {
    this.isLoading = true;

    // Vérifier d'abord si le numéro de téléphone est déjà utilisé
    this.authService.countPhone(this.registrationForm.value.phone).subscribe({
      next: (response) => {
        // Vérifier si le téléphone est déjà utilisé (count > 0)
        if (response && response.count > 0) {
          this.isLoading = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Téléphone déjà utilisé',
            detail: 'Ce numéro de téléphone est déjà associé à un compte',
            life: 5000
          });
          return;
        }

        // Si le téléphone n'est pas utilisé, continuer avec l'envoi de l'OTP
        this.authService.generateOtp(this.registrationForm.value.phone).subscribe({
          next: (_) => {
            this.isLoading = false;
            this.showOtpForm = true;
            this.otpSent = true;
            this.startCountdown();
            this.messageService.add({
              severity: 'success',
              summary: 'Code OTP envoyé',
              detail: 'Veuillez vérifier votre téléphone',
              life: 5000
            });
          },
          error: (_) => {
            this.isLoading = false;
            this.messageService.add({
              severity: 'error',
              summary: 'Erreur',
              detail: 'Échec de l\'envoi du code OTP',
              life: 5000
            });
          }
        });
      },
      error: (error) => {
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur de vérification',
          detail: 'Impossible de vérifier la disponibilité du numéro de téléphone',
          life: 5000
        });
        console.error('Erreur vérification téléphone:', error);
      }
    });
  }

  verifyOtp() {
    if (!this.otpCode) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Veuillez entrer le code OTP',
        life: 5000
      });
      return;
    }

    this.isLoading = true;
    this.authService.validateOtp(this.registrationForm.value.phone, this.otpCode).subscribe({
      next: (_) => {
        // Procéder à l'inscription après validation de l'OTP
        this.submitRegistration();
      },
      error: (_) => {
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Code OTP invalide ou expiré',
          life: 5000
        });
      }
    });
  }

  private submitRegistration() {
    // Créer une copie des données du formulaire sans inclure privacyAccepted
    const { firstName, lastName, phone, email, password, birthday, gender } = this.registrationForm.value;

    // Créer l'objet de données d'inscription avec seulement les champs nécessaires
    const registrationData = {
      firstName,
      lastName,
      phone,
      email,
      password,
      birthday,
      gender,
      codeOtp: this.otpCode
    };

    this.authService.register(registrationData).subscribe({
      next: (response) => {
        // Stocker les informations d'authentification
        const token = response.jwt || response.tokens?.access_token || '';
        localStorage.setItem('jwt', token);
        localStorage.setItem('user', JSON.stringify(response.user));

        // Synchroniser le panier invité avec le compte utilisateur
        this.cartService.syncGuestCart(token);

        this.messageService.add({
          severity: 'success',
          summary: 'Inscription réussie',
          detail: 'Votre compte a été créé avec succès et vous êtes maintenant connecté',
          life: 5000
        });

        // Passer à l'étape suivante du processus de commande
        this.nextStep();
      },
      error: (error) => {
        let errorMessage = 'Le numéro de téléphone est déjà utilisé';

        if (error.error && error.error.message) {
          errorMessage = error.error.message;
        }

        this.messageService.add({
          severity: 'error',
          summary: 'Erreur d\'inscription',
          detail: errorMessage,
          life: 5000
        });

        console.error('Erreur d\'inscription:', error);
      }
    });
  }

  showForgotPasswordForm() {
    this.showForgotPassword = true;
    this.showCreateAccount = false;
    this.showOtpForm = false;
  }

  sendOtp2() {
    if (!this.phoneNumber) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Veuillez entrer votre numéro de téléphone',
        life: 5000
      });
      return;
    }

    this.isLoading = true;

    // Pour la réinitialisation du mot de passe, nous devons vérifier que le téléphone existe
    this.authService.countPhone(this.phoneNumber).subscribe({
      next: (response) => {
        // Vérifier si le téléphone existe (count > 0)
        if (response && response.count === 0) {
          this.isLoading = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Téléphone non trouvé',
            detail: 'Ce numéro de téléphone n\'est associé à aucun compte',
            life: 5000
          });
          return;
        }

        // Si le téléphone existe, continuer avec l'envoi de l'OTP
        this.authService.generateOtp(this.phoneNumber).subscribe({
          next: (_) => {
            this.isLoading = false;
            this.otpSent = true;
            this.startCountdown();
            this.messageService.add({
              severity: 'success',
              summary: 'Code OTP envoyé',
              detail: 'Veuillez vérifier votre téléphone',
              life: 5000
            });
          },
          error: (_) => {
            this.isLoading = false;
            this.messageService.add({
              severity: 'error',
              summary: 'Erreur',
              detail: 'Échec de l\'envoi du code OTP',
              life: 5000
            });
          }
        });
      },
      error: (error) => {
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur de vérification',
          detail: 'Impossible de vérifier le numéro de téléphone',
          life: 5000
        });
        console.error('Erreur vérification téléphone:', error);
      }
    });
  }

  forgotPassword() {
    if (!this.otpCode) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Veuillez entrer le code OTP',
        life: 5000
      });
      return;
    }

    this.isLoading = true;
    this.authService.forgotPassword(this.phoneNumber, this.otpCode).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.otpVerified = true;
        this.hashedToken = response.token;
      },
      error: (_) => {
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Code OTP invalide ou expiré',
          life: 5000
        });
      }
    });
  }

  resetPassword() {
    if (!this.newPassword || !this.confirmPassword) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Veuillez remplir tous les champs',
        life: 5000
      });
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Les mots de passe ne correspondent pas',
        life: 5000
      });
      return;
    }

    const resetData = {
      code: this.hashedToken,
      password: this.newPassword,
      passwordConfirmation: this.confirmPassword
    };

    this.isLoading = true;
    this.authService.resetPassword(resetData).subscribe({
      next: (_) => {
        this.isLoading = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Mot de passe réinitialisé',
          detail: 'Vous pouvez maintenant vous connecter',
          life: 5000
        });
        this.showForgotPassword = false;
        this.otpSent = false;
        this.otpVerified = false;
      },
      error: (_) => {
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Échec de la réinitialisation du mot de passe',
          life: 5000
        });
      }
    });
  }

  startCountdown() {
    this.countdown = 50;
    this.countdownInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(this.countdownInterval);
      }
    }, 1000);
  }

  toggleCreateAccount() {
    this.showCreateAccount = !this.showCreateAccount;
    if (this.showCreateAccount) {
      // Réinitialiser la case à cocher de la politique de confidentialité lorsqu'on affiche le formulaire d'inscription
      this.privacyAccepted = false;
    }
  }

  setGender(gender: string) {
    this.registrationForm.get('gender')?.setValue(gender);
  }

  birthdayValidator(control: any) {
    const selectedDate = new Date(control.value);
    const today = new Date();
    return selectedDate < today ? null : { invalidBirthday: true };
  }

  // Checkout methods
  loadPaymentMethods() {
    this.checkoutService.getPaymentMethods().subscribe({
      next: (response) => {
        this.paymentMethods = response.hits;
        this.filterPaymentMethods();
      },
      error: (error) => {
        console.error('Error fetching payment methods:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Une erreur est survenue lors de la récupération des méthodes de paiement'
        });
      }
    });
  }

  loadShippingMethods() {
    this.checkoutService.getShippingMethods().subscribe({
      next: (response) => {
        this.shippingMethods = response.hits;
      },
      error: (error) => {
        console.error('Error fetching shipping methods:', error);
      }
    });
  }

  loadStores() {
    this.checkoutService.getStores().subscribe({
      next: (response) => {
        this.stores = response.hits;
      }
    });
  }

  loadCartItems() {
    this.cartService.cartItems$.subscribe((items: any) => {
      this.cartItems = items;

      // Vérifier les offres si des articles sont présents
      if (items.length > 0) {
        this.checkForPromotions(items);
      } else {
        this.hasActivePromotion = false;
        this.cartItemsWithPromo = [];
        this.calculateTotals();
      }
    });
  }

  /**
   * Formate les articles du panier pour l'API checkCartOffers
   */
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
      return;
    }

    const formattedItems = this.formatCartItemsForOfferApi(items);

    this.orderService.checkCartOffers(formattedItems).subscribe({
      next: (response: any) => {
        if (response && response.data && response.data.cartProducts) {
          // Créer une map pour associer les offres (plusieurs) par ean13
          const offersMap = new Map<string, any[]>();
          response.data.cartProducts.forEach((offer: any) => {
            const arr = offersMap.get(offer.ean13) || [];
            arr.push(offer);
            offersMap.set(offer.ean13, arr);
          });

          // Enrichir les articles du panier avec les données d'offres & construire des lignes d'affichage
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
          this.hasActivePromotion = this.cartItemsWithPromo.some((line: any) => line.hasDiscount);
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

  // Getter for the template to render display lines. Fallback to gen from cartItems
  get displayItems() {
    if (this.cartItemsWithPromo && this.cartItemsWithPromo.length) return this.cartItemsWithPromo;
    return this.cartItems.map((item: any) => ({
      ...item,
      ean13: item.ean13,
      quantity: item.quantity,
      originalUnitPrice: item.product.currentPrice,
      unitPrice: item.product.currentPrice,
      discountPercent: 0,
      hasDiscount: false,
      sourceCartItem: item
    }));
  }

  // Update underlying quantity from a display line - used on checkout if we ever allow changes from the display
  updateQuantityFromDisplay(line: any, delta: number) {
    const src = line.sourceCartItem;
    if (!src) return;
    const newQuantity = src.quantity + delta;
    if (newQuantity <= 0) {
      this.cartService.removeFromCart(src.product.id, src.selectedColor, src.selectedSize);
    } else {
      this.cartService.updateQuantity(src.product.id, src.selectedColor, src.selectedSize, newQuantity);
    }
  }

  // Load user addresses and automatically select the default address
  loadUserAddresses() {
    const token = localStorage.getItem('jwt');
    if (!token) {
      return; // Don't try to load addresses if user is not logged in
    }

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
      error: (error: any) => {
        console.error('Error loading addresses:', error);
      }
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
        this.selectedAddress = result;
      },
      (reason: any) => {
        // console.log('Modal dismissed:', reason);
      }
    );
  }

  openModal() {
    const modalRef = this.modalService.open(CreateAddressComponent, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false
    });

    modalRef.result.then(
      (result: any) => {
        this.selectedAddress = result;
      },
      (reason) => {
        // console.log('Modal dismissed:', reason);
      }
    );
  }

  nextStep() {
    if (this.currentStep < 4) {
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
    // Recalculate totals when payment method changes
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
      // If no address is selected, try to load user addresses
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

  calculateTotals() {
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

    // If user is on coupon (reduction) step, do not calculate shipping here
    if (this.publicUserPromoApplied || this.promoCodeApplied) {
      // If a promo input is present and applied, we'll let calculateTotalsWithCoupon handle totals
    }

    if (this.currentStep === 1 && this.availableCoupons && this.availableCoupons.length > 0) {
      // In the coupon/reduction step we don't calculate shipping — show subtotal for now
      this.deliveryCost = 0;
      this.total = this.subtotal;
      return;
    }

    // Déterminer le coût de livraison de base
    const selectedShippingMethod = this.shippingMethods.find(method =>
      (this.deliveryMethod === 'home' && method.id === 1) ||
      (this.deliveryMethod === 'store' && method.id === 2)
    );

    // Coût de livraison standard
    let standardDeliveryCost = 0;
    if (selectedShippingMethod) {
      // Vérifier si la livraison est gratuite en fonction du montant du panier
      const isDeliveryFree = this.deliveryMethod === 'home' &&
        selectedShippingMethod.freeCondition > 0 &&
        this.subtotal >= selectedShippingMethod.freeCondition;

      // Si la livraison est gratuite ou si c'est un retrait en magasin, le coût est 0
      if (isDeliveryFree || this.deliveryMethod === 'store') {
        standardDeliveryCost = 0;
      } else {
        // Sinon, appliquer le coût standard de livraison
        standardDeliveryCost = selectedShippingMethod.cost;
      }
    }

    // Réinitialiser le coût de livraison
    this.deliveryCost = standardDeliveryCost;

    // Calculer le total
    this.total = this.subtotal + this.deliveryCost;
  }

  async confirmOrder() {
    const token = localStorage.getItem('jwt');
    if (!token) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur d\'authentification',
        detail: 'Veuillez vous reconnecter pour continuer',
        life: 5000
      });
      this.currentStep = 1;
      return;
    }

    if (!this.validateBeforeSubmit()) {
      return;
    }

    this.confirmingOrder = true;
    this.orderError = null;

    try {
      const payload = this.buildOrderPayload();
      // console.log('Order payload:', payload);

      // Utiliser firstValueFrom au lieu de toPromise()
      const orderResponse: any = await firstValueFrom(this.orderService.placeOrder(payload));

      if (orderResponse.status === 200) {
        this.messageService.add({
          severity: 'success',
          summary: 'Commande confirmée',
          detail: 'Votre commande a été passée avec succès',
          life: 5000
        });

        this.cartService.clearCart();
        localStorage.removeItem('guestCheckoutState');

        // Tracking validation finale commande
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

        if (this.selectedPaymentMethod === 'CBE') {
          // Include orderId in redirect URL for payment verification
          const orderId = orderResponse.data.id;
          const redirectUrl = `${environementDev.redirectUrlLocal}/${orderId}`;

          // Generate Click to Pay transaction
          const ctpResponse = await firstValueFrom(this.orderService.getCTPTransaction(orderId, redirectUrl));

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

    // Recalculer les totaux pour s'assurer que les frais de livraison sont corrects
    if (this.appliedCoupon) {
      this.calculateTotalsWithCoupon();
    } else {
      this.calculateTotals();
    }

    // Utiliser le coût de livraison calculé par la méthode calculateTotals
    let finalShippingCost = this.deliveryCost;

    const payload: any = {
      orderData: {
        subTotal: parseFloat(this.subtotal.toFixed(3)),
        shippingMethod: shippingMethodId,
        paymentMethod: paymentMethodId,
        shippingCost: parseFloat(finalShippingCost.toFixed(3)),
        total: parseFloat(this.total.toFixed(3))
      },
      products: this.cartItems.map(item => ({
        ean13: item.ean13,
        quantity: item.quantity,
        unitPrice: parseFloat(item.product.currentPrice.toFixed(3)),
        discount: 0,
        discountDesc: ""
      }))
    };

    if (!isStorePickup) {
      payload.orderData.shippingAddress = this.selectedAddress.id;
    } else {
      payload.orderData.shippingStore = this.selectedStore.id;
    }

    // Add coupon ID to the order payload if a coupon is applied
    if (this.appliedCoupon) {
      payload.orderData.coupon = this.appliedCoupon.id;
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
    if (this.isPublicPromoDisabled() || this.isManualPromoDisabled()) {
      this.showCouponDropdown = false;
      return;
    }
    this.showCouponDropdown = !this.showCouponDropdown;
  }

  // Select a coupon from the dropdown
  selectCoupon(coupon: any): void {
    if (this.publicUserPromoApplied) return; // désactive si coupon public appliqué
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
  }

  // Méthode pour appliquer un code promo
  applyPromoCode(): void {
    if (this.publicUserPromoApplied) return; // désactive si coupon public appliqué
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

    // Recalculer les totaux avec la réduction
    this.calculateTotalsWithCoupon();

    this.messageService.add({
      severity: 'success',
      summary: 'Code promo appliqué',
      detail: `Le code promo ${selectedCoupon.code} a été appliqué avec succès`,
      life: 3000
    });
    // Tracking Analytics
    this.analyticsService.applyCoupon({
      code_copon: selectedCoupon.code,
      id_codecopon: String(selectedCoupon.id),
      montant_avant: this.subtotal,
      montant_apres: this.total
    });
  }

  // Méthode pour calculer les totaux avec le coupon appliqué
  calculateTotalsWithCoupon(): void {
    // Calculer d'abord les totaux normaux sans appliquer le coupon (but skip shipping if needed)
    this.calculateTotals();

    // Calculer la réduction basée sur le coupon
    if (this.appliedCoupon) {
      this.discountAmount = 0;
      if (this.appliedCoupon.discount_amount > 0) {
        // Réduction en montant fixe
        this.discountAmount = this.appliedCoupon.discount_amount;
      } else if (this.appliedCoupon.discount_percent > 0) {
        // Réduction en pourcentage
        this.discountAmount = (this.subtotal * this.appliedCoupon.discount_percent) / 100;
      }
    } else {
      this.discountAmount = 0;
    }

    // Calculer le sous-total après réduction
    const subtotalAfterDiscount = Math.max(0, this.subtotal - this.discountAmount);

    // If we are on the coupon/reduction step, do not compute shipping — show subtotalAfterDiscount
    if (this.currentStep === 1 && this.availableCoupons && this.availableCoupons.length > 0) {
      this.total = subtotalAfterDiscount;
      return;
    }

    // Vérifier si le sous-total après réduction est éligible pour la livraison gratuite
    if (this.deliveryMethod === 'home') {
      const selectedShippingMethod = this.shippingMethods.find(method => method.id === 1);
      if (selectedShippingMethod && selectedShippingMethod.freeCondition > 0) {
        // Si le sous-total après réduction est supérieur ou égal à la condition de livraison gratuite
        if (subtotalAfterDiscount >= selectedShippingMethod.freeCondition) {
          this.deliveryCost = 0;
        } else {
          // Sinon, appliquer le coût standard de livraison
          this.deliveryCost = selectedShippingMethod.cost;
        }
      }
    }

    // Calculer le total final (sous-total - réduction + frais de livraison)
    this.total = subtotalAfterDiscount + this.deliveryCost;
  }

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/images/no-image.png';
  }



  // Méthode pour n'accepter que les chiffres
  onlyNumbers(event: KeyboardEvent): boolean {
    // Utiliser code au lieu de which/keyCode (qui sont dépréciés)
    const key = event.key;
    // Autoriser uniquement les chiffres et certaines touches de contrôle
    if (!/^\d$/.test(key) &&
      !['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) {
      event.preventDefault();
      return false;
    }
    return true;
  }
  clearCouponCode() {
    this.selectedCouponText = '';
    this.selectedCouponDiscount = '';
    this.showCouponDropdown = false;
    this.promoCode = '';
    this.promoCodeApplied = false;
    this.appliedCoupon = null;
    this.discountAmount = 0;
    this.publicUserPromoApplied = false;
    this.publicUserPromoCode = '';
    // Recalculate totals without coupon
    this.calculateTotals();
  }
  getPromo() {

    this.giftCardService.getCouponsUserPublic().subscribe({
      next: (response) => {
        this.coupons = response['data'] as any[];
        // Si aucun coupon public, on s'assure que le champ est réinitialisé
        if (!this.coupons || this.coupons.length === 0) {
          this.publicUserPromoCode = '';
          this.publicUserPromoApplied = false;
        }
      },
      error: (error) => {
        console.error('Erreur lors du chargement des coupons', error);
      }
    });
  }
  applyPublicUserPromo() {
    if (!this.publicUserPromoCode) {
      this.showError('Code promo vide', 'Veuillez saisir un code promo');
      return;
    }
    const foundCoupon = this.coupons.find(c => c.code === this.publicUserPromoCode);
    if (!foundCoupon) {
      this.messageService.add({
        severity: 'error',
        summary: 'Code promo invalide',
        detail: 'Le code promo saisi est invalide',
        life: 3000
      });
      return;
    }
    this.appliedCoupon = foundCoupon;
    this.publicUserPromoApplied = true;
    this.promoCodeApplied = false; // désactive l'autre champ
    this.calculateTotalsWithCoupon();
    this.messageService.add({
      severity: 'success',
      summary: 'Code promo appliqué',
      detail: `Le code promo ${foundCoupon.code} a été appliqué avec succès`,
      life: 3000
    });
  }
  // Ajout d'une méthode pour désactiver le champ public si un coupon manuel est appliqué
  isPublicPromoDisabled(): boolean {
    return this.promoCodeApplied;
  }
  // Ajout d'une méthode pour désactiver le champ manuel si un coupon public est appliqué
  isManualPromoDisabled(): boolean {
    return this.publicUserPromoApplied;
  }
}