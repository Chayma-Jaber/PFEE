// compte.component.ts
import { CommonModule } from '@angular/common';
import { Component, AfterViewInit, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { ProfileService } from '../sign/profile';
import { ProductService } from '../../../services/product.service';
import { AuthService } from '../../../services/auth.service';
import { Modal } from 'bootstrap';
import { OrderService } from '../../../services/order.service';
import { CouponsComponent } from './components/coupons/coupons.component';
import { CartService } from '../../../services/cart.service';
import { TitleService } from '../../../services/title.service';
import { FormsModule } from '@angular/forms';
import { RetourComponent } from './components/retour/retour.component';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { CancelService } from '../../../services/cancel.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AccountRecommendationsComponent } from '../../commun/next-gen-recommendations';
import { StyleProfileComponent } from '../../commun/style-profile';
import { ProductAlertService, ProductAlert } from '../../../services/product-alert.service';
import { LoyaltyDashboardComponent } from '../../commun/loyalty-dashboard/loyalty-dashboard.component';
import { GiftCardsComponent } from '../../commun/gift-cards/gift-cards.component';
import { ReferralDashboardComponent } from '../../commun/referral-dashboard/referral-dashboard.component';
import { WishlistCollectionsComponent } from '../../commun/wishlist-collections';
import { StockAlertsListComponent } from '../../commun/stock-alerts-list/stock-alerts-list.component';
import { StockAlertService, StockAlert as StockAlertModel } from '../../../services/stock-alert.service';
import { SavedAddressesComponent } from '../../commun/saved-addresses';
import { SavedPaymentsComponent } from '../../commun/saved-payments';

@Component({
  selector: 'app-compte',
  standalone: true,

  imports: [CommonModule, RouterModule, CouponsComponent, FormsModule, RetourComponent, ToastModule, AccountRecommendationsComponent, StyleProfileComponent, LoyaltyDashboardComponent, GiftCardsComponent, ReferralDashboardComponent, WishlistCollectionsComponent, StockAlertsListComponent, SavedAddressesComponent, SavedPaymentsComponent],
  providers: [MessageService],
  templateUrl: './compte.component.html',
  styleUrls: ['./compte.component.scss']
})
export class CompteComponent implements OnInit, AfterViewInit  {
  produits: any[] = []; // Liste des produits dans la wishlist
  isLoading: boolean = true; // Indicateur de chargement
  orders: any[] = [];
  isLoadingOrders: boolean = false;
  orderError: string | null = null;
  expandedOrders: Set<number> = new Set(); // Track which orders are expanded
  showCancelModal: boolean = false;
  cancelOrderId: number | null = null;
  motifs: any[] = [];
  loadingMotifs = true;
  errorMotifs = '';
  selectedMotifId: number | null = null;
  showRefundType = false;
  selectedRefundType: string | null = null;
  submitError: string = '';
  submitSuccess: boolean = false;
  loadingSubmit: boolean = false;
  holderName: string = '';
  rib: string = '';
  selectedFileName: string = 'Coordonnées bancaires';
  showCancel1 = true;
  showCancel2 = true;
  selectedFile: File | null = null;

  // Alerts properties
  alerts: ProductAlert[] = [];
  isLoadingAlerts: boolean = false;
  alertsError: string | null = null;
  showDeleteAlertModal: boolean = false;
  alertToDelete: ProductAlert | null = null;
  isDeletingAlert: boolean = false;

  // Wishlist Collections
  useCollectionsView: boolean = true; // Enable Pinterest-style collections

  // Stock Alerts properties
  stockAlerts: StockAlertModel[] = [];
  isLoadingStockAlerts: boolean = false;
  stockAlertsError: string | null = null;

  constructor(
    private profileService: ProfileService,
    public productService: ProductService,
    private authService: AuthService,
    private orderService: OrderService,
    private cartService: CartService,
    private router: Router,
    private titleService: TitleService,
    private cancelService: CancelService,
    private modalService: NgbModal,
    private messageService: MessageService,
    private productAlertService: ProductAlertService,
    private stockAlertService: StockAlertService
  ) { }
  private myModal!: Modal;
  private editProfileModal!: Modal;

  // Form model for profile editing
  editProfileForm = {
    email: '',
    firstName: '',
    lastName: '',
    birthday: '',
    gender: ''
  };

  // Current field being edited
  currentEditField: string = '';

  // Success/error messages
  updateMessage: string = '';
  updateSuccess: boolean = false;

  ngOnInit(): void {
    this.loadOrders();
    this.fetchWishlist();
    this.loadUserProfile();
    this.loadAlerts();
  }

  ngAfterViewInit() {
    const modalElement = document.getElementById('myModal');
    if (modalElement) {
      this.myModal = new Modal(modalElement);
    }

    // Initialiser la modal d'édition de profil
    setTimeout(() => {
      const editProfileModalElement = document.getElementById('editProfileModal');
      if (editProfileModalElement) {
        // S'assurer que les classes nécessaires sont présentes
        if (!editProfileModalElement.classList.contains('fade')) {
          editProfileModalElement.classList.add('fade');
        }

        // Initialiser la modal avec Bootstrap
        this.editProfileModal = new Modal(editProfileModalElement, {
          backdrop: 'static', // Empêcher la fermeture en cliquant à l'extérieur
          keyboard: true,
          focus: true
        });

        // Ajouter un gestionnaire d'événements pour la modal
        editProfileModalElement.addEventListener('shown.bs.modal', () => {
          document.body.classList.add('modal-open');
        });

        editProfileModalElement.addEventListener('hidden.bs.modal', () => {
          document.body.classList.remove('modal-open');
          // Supprimer le backdrop manuellement si nécessaire
          const backdropElement = document.querySelector('.modal-backdrop');
          if (backdropElement) {
            backdropElement.remove();
          }
        });
      } else {
        console.error('Edit profile modal element not found');
      }
    }, 100); // Petit délai pour s'assurer que le DOM est complètement chargé
  }

  openModal() {
    this.myModal.show();
  }

  closeModal() {
    this.myModal.hide();
  }

  // Open the edit profile modal for a specific field
  openEditProfileModal(field: string) {
    this.currentEditField = field;
    this.updateMessage = '';

    // Initialize form with current values
    this.editProfileForm = {
      email: this.userProfile.email,
      firstName: this.userProfile.firstName,
      lastName: this.userProfile.lastName,
      birthday: this.userProfile.birthday,
      gender: this.userProfile.gender
    };

    // Vérifier si la modal est initialisée
    if (!this.editProfileModal) {
      const editProfileModalElement = document.getElementById('editProfileModal');
      if (editProfileModalElement) {
        // Initialiser la modal avec Bootstrap
        this.editProfileModal = new Modal(editProfileModalElement, {
          backdrop: 'static', // Empêcher la fermeture en cliquant à l'extérieur
          keyboard: true,
          focus: true
        });
      } else {
        console.error('Edit profile modal element not found');
        return;
      }
    }

    // Nettoyer les modals précédentes
    const existingBackdrop = document.querySelector('.modal-backdrop');
    if (existingBackdrop) {
      existingBackdrop.remove();
    }

    // Réinitialiser les classes du body
    document.body.classList.remove('modal-open');

    // Ajouter un petit délai avant d'afficher la modal
    setTimeout(() => {
      // Afficher la modal
      this.editProfileModal.show();

      // Créer un nouveau backdrop si nécessaire
      if (!document.querySelector('.modal-backdrop')) {
        const newBackdrop = document.createElement('div');
        newBackdrop.className = 'modal-backdrop fade show';
        document.body.appendChild(newBackdrop);
      }

      // Ajouter la classe modal-open au body
      document.body.classList.add('modal-open');

      // Ajouter la classe show à la modal
      const modalElement = document.getElementById('editProfileModal');
      if (modalElement && !modalElement.classList.contains('show')) {
        modalElement.classList.add('show');
        modalElement.style.display = 'block';
      }
    }, 50);
  }

  // Close the edit profile modal
  closeEditProfileModal() {
    // Vérifier si la modal existe
    if (!this.editProfileModal) {
      return;
    }

    // Cacher la modal
    this.editProfileModal.hide();

    // Supprimer le backdrop manuellement
    const backdropElement = document.querySelector('.modal-backdrop');
    if (backdropElement) {
      backdropElement.remove();
    }

    // Supprimer les classes ajoutées
    document.body.classList.remove('modal-open');

    // Supprimer la classe show et le style display de la modal
    const modalElement = document.getElementById('editProfileModal');
    if (modalElement) {
      modalElement.classList.remove('show');
      modalElement.style.display = 'none';
    }
  }

  // Submit the profile update
  submitProfileUpdate() {
    // Create update object with only the fields that should be updated
    const updateData: any = {};

    // Only include the field being edited
    switch (this.currentEditField) {
      case 'email':
        if (this.editProfileForm.email && this.editProfileForm.email.trim() !== '') {
          updateData.email = this.editProfileForm.email.trim();
        }
        break;
      case 'firstName':
        if (this.editProfileForm.firstName && this.editProfileForm.firstName.trim() !== '') {
          updateData.firstName = this.editProfileForm.firstName.trim();
        }
        break;
      case 'lastName':
        if (this.editProfileForm.lastName && this.editProfileForm.lastName.trim() !== '') {
          updateData.lastName = this.editProfileForm.lastName.trim();
        }
        break;
      case 'birthday':
        if (this.editProfileForm.birthday) {
          updateData.birthday = this.editProfileForm.birthday;
        }
        break;
      case 'gender':
        if (this.editProfileForm.gender) {
          updateData.gender = this.editProfileForm.gender;
        }
        break;
    }

    // Only proceed if there's data to update
    if (Object.keys(updateData).length === 0) {
      this.updateMessage = 'Aucune modification à enregistrer';
      this.updateSuccess = false;
      return;
    }

    // Call the update API
    this.authService.updateAccount(updateData).subscribe({
      next: (response) => {
        this.updateMessage = 'Profil mis à jour avec succès';
        this.updateSuccess = true;
        this.userProfile = {
          ...this.userProfile,
          ...updateData
        };
      },
      error: (error) => {
        this.updateMessage = 'Erreur lors de la mise à jour du profil';
        this.updateSuccess = false;
      }
    });
  }

  addresses: any[] = [];

  notif = [
    { image: 'images/inter1.jpg', texte: 'Découvrez nos offres spéciales' },
    { image: 'images/inter1.jpg', texte: 'Découvrez les nouveautées de BARSHA ' },
    { image: 'images/inter1.jpg', texte: 'Découvrez nos offres spéciales' }
];
  selectedTab: string = 'achat'; // Default selected tab
  selectedColor: string | null = null;


  userProfile = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthday: '',
    gender: '',
    addresses: [] as any[],
    cards: [] as any[]
  };

  // Method to handle editing profile fields
  editField(field: string): void {
    // This would open a modal or enable editing for the specific field
    // console.log(`Editing field: ${field}`);
  }

  // Method to handle logout
  logout(): void {
    localStorage.removeItem('jwt');
    this.router.navigate(['/']);
  }

  // Method to handle account deletion

   // Method to change the selected tab
  selectTab(tab: string): void {
    this.selectedTab = tab;
  }

  onStyleProfileSaved(profile: any): void {
    // Profile saved notification
    this.messageService.add({
      severity: 'success',
      summary: 'Profil style sauvegardé',
      detail: 'Vos préférences de style ont été mises à jour'
    });




  }


  fetchWishlist(): void {
    this.isLoading = true;
    this.productService.getWishlist().subscribe(
      (response) => {
        this.produits = this.mapApiDataToProducts(response.data);
        this.fetchStockForProducts(); // Récupérer le stock pour chaque produit
        this.isLoading = false;
      },
      (error) => {
        console.error('Erreur lors de la récupération de la wishlist:', error);
        this.isLoading = false;
      }
    );
  }

  // Mapper les données de l'API aux produits affichés
  mapApiDataToProducts(apiData: any[]): any[] {
    return apiData.map((item) => ({
      id: item.id,
      image: item.firstImg?.url || 'assets/default-image.jpg', // Utiliser une image par défaut si aucune image n'est disponible
      nom: item.title,
      prix: `${item.currentPrice.toFixed(3)} TND`,
      isInWishlist: true, // Tous les produits de la wishlist sont dans la wishlist
      colors: item.declinaisons.map((declinaison: any) => ({
        name: declinaison.libellet,
        textureImage: declinaison.texture?.url || 'assets/default-texture.jpg',
        mainImage: declinaison.images[0]?.url || item.firstImg?.url,
      })),
      declinaisons: item.declinaisons,
      selectedColorIndex: 0, // Index de la couleur sélectionnée
      tailles: [], // Stock des tailles
      activeImageIndex: 0, // Index de l'image active
      imageInterval: null, // Intervalle pour changer les images
    }));
  }

  // Récupérer le stock pour chaque produit
  fetchStockForProducts(): void {
    this.produits.forEach((produit) => {
      const declinaisonId = produit.declinaisons[produit.selectedColorIndex]?.id;
      if (declinaisonId) {
        this.productService.getDeclinaisonStock(declinaisonId).subscribe(
          (stockData) => {
            produit.tailles = stockData.data.map((item: any) => ({
              size: item.size,
              qte: item.qte,
            }));
          },
          (error) => {
            console.error(`Erreur lors de la récupération du stock pour ${produit.nom}`, error);
            produit.tailles = [];
          }
        );
      }
    });
  }

  // Sélectionner une couleur
  selectColor(produit: any, index: number): void {
    produit.selectedColorIndex = index;
    this.resetActiveImage(produit); // Réinitialiser l'image active
    this.fetchStockForProduct(produit); // Récupérer le stock pour la nouvelle couleur
  }

  // Récupérer le stock pour un produit spécifique
  fetchStockForProduct(produit: any): void {
    const declinaisonId = produit.declinaisons[produit.selectedColorIndex]?.id;
    if (declinaisonId) {
      this.productService.getDeclinaisonStock(declinaisonId).subscribe(
        (stockData) => {
          produit.tailles = stockData.data.map((item: any) => ({
            size: item.size,
            qte: item.qte,
          }));
        },
        (error) => {
          console.error(`Erreur lors de la récupération du stock pour ${produit.nom}`, error);
          produit.tailles = [];
        }
      );
    }
  }

  // Changer l'image active toutes les 2 secondes
  changeActiveImage(produit: any): void {
    produit.imageInterval = setInterval(() => {
      const images = produit.declinaisons[produit.selectedColorIndex]?.images;
      if (images && images.length > 1) {
        produit.activeImageIndex = (produit.activeImageIndex + 1) % images.length;
        produit.colors[produit.selectedColorIndex].mainImage = images[produit.activeImageIndex].url;
      }
    }, 2000);
  }


  resetActiveImage(produit: any): void {
    if (produit.imageInterval) {
      clearInterval(produit.imageInterval);
      produit.imageInterval = null;
    }
    produit.activeImageIndex = 0;
    produit.colors[produit.selectedColorIndex].mainImage =
      produit.declinaisons[produit.selectedColorIndex].images[0]?.url ||
      produit.colors[produit.selectedColorIndex].mainImage;
  }

  // Vérifier si une taille est en stock
  isInStock(produit: any, taille: string): boolean {
    const sizeObj = produit.tailles.find((t: any) => t.size === taille);
    return sizeObj ? sizeObj.qte > 0 : false;
  }

  // Basculer l'état de la wishlist
  toggleWishlist(produit: any): void {
    produit.isInWishlist = !produit.isInWishlist;

    if (produit.isInWishlist) {
      // Ajouter le produit à la wishlist
      this.productService.addToWishList(produit.id).subscribe(
        (response) => {
          // console.log('Produit ajouté à la wishlist:', response);
        },
        (error) => {
          console.error('Erreur lors de l\'ajout à la wishlist:', error);
          produit.isInWishlist = !produit.isInWishlist; // Revenir à l'état précédent en cas d'erreur
        }
      );
    } else {
      // Supprimer le produit de la wishlist
      this.productService.removeFromWishList(produit.id).subscribe(
        (response) => {
          // console.log('Produit supprimé de la wishlist:', response);
          // Retirer le produit de la liste affichée
          this.produits = this.produits.filter((p) => p.id !== produit.id);
        },
        (error) => {
          console.error('Erreur lors de la suppression de la wishlist:', error);
          produit.isInWishlist = !produit.isInWishlist; // Revenir à l'état précédent en cas d'erreur
        }
      );
    }
  }
  private loadUserProfile(): void {
    this.authService.getCurrentUser().subscribe({
      next: (profile: any) => {
        this.userProfile = {
          ...this.userProfile,
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          phone: profile.phone,
          birthday: profile.birthday,
          gender: profile.gender
        };
      },
      error: (err: any) => console.error('Erreur de chargement du profil', err)
    });
  }
  loadOrders(): void {
    this.isLoadingOrders = true;
    this.orderError = null;

    this.orderService.getOrders().subscribe({
      next: (response) => {
        if (response.status === 200) {
          this.orders = response.data.map((order: any) => {
            return {
              ...order,
              createdAt: new Date(order.createdAt)
            };
          });
        } else {
          this.orderError = 'Erreur lors du chargement des commandes';
        }
        this.isLoadingOrders = false;
      },
      error: (error) => {
        console.error('Error loading orders:', error);
        this.orderError = 'Erreur de connexion au serveur';
        this.isLoadingOrders = false;
      }
    });
  }

deleteAccount(): void {
  this.authService.deleteAccount().subscribe({
    next: () => {
      localStorage.removeItem('jwt');
      localStorage.removeItem('user');
      this.cartService.clearCart();
      this.messageService.add({
        severity: 'success',
        summary: 'Compte supprimé',
        detail: 'Votre compte a été supprimé et vous avez été déconnecté.',
        life: 3000
      });
      this.router.navigate(['/']);
    },
    error: () => {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'La suppression du compte a échoué.',
        life: 3000
      });
    }
  });
}

  updateAccount(): void {
    this.authService.updateAccount(this.userProfile).subscribe({
      next: (response) => {
        // console.log('Account updated:', response);
      },
      error: (error) => {
        console.error('Error updating account:', error);
      }
    });
  }

  /**
   * Get product detail URL for right-click functionality
   * @param produit Product to get URL for
   * @returns Product detail URL string
   */
  getProductDetailUrl(produit: any): string {
    if (!produit || !produit.id) {
      return '/produit/0-produit';
    }

    // Use the ProductService to generate the correct slug format (ID-name)
    const slug = this.productService.generateProductSlug(produit);
    return `/produit/${slug}`;
  }

  /**
   * Toggle order details visibility
   * @param orderId Order ID to toggle
   */
  toggleOrderDetails(orderId: number): void {
    if (this.expandedOrders.has(orderId)) {
      this.expandedOrders.delete(orderId);
    } else {
      this.expandedOrders.add(orderId);
    }
  }

  /**
   * Check if order details are expanded
   * @param orderId Order ID to check
   * @returns True if order is expanded
   */
  isOrderExpanded(orderId: number): boolean {
    return this.expandedOrders.has(orderId);
  }

  openCancelModal(orderId: number) {
    this.cancelOrderId = orderId;
    this.showCancelModal = true;
    this.fetchMotifs();
    setTimeout(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 0);
  }
  closeCancelModal() {
    this.showCancelModal = false;
    this.cancelOrderId = null;
  }

  fetchMotifs() {
    this.loadingMotifs = true;
    this.errorMotifs = '';
    this.cancelService.getmotifCancelOrder().subscribe({
      next: (res) => {
        this.motifs = res?.hits || [];
        this.loadingMotifs = false;
      },
      error: (err) => {
        this.errorMotifs = 'Erreur lors du chargement des motifs.';
        this.loadingMotifs = false;
      }
    });
  }

  selectMotif(id: number) {
    this.selectedMotifId = id;
  }

  /**
   * Appliquer le motif sélectionné et gérer l'annulation selon le statut de paiement
   */
  applyMotif() {
    if (!this.selectedMotifId || !this.cancelOrderId) return;
    const order = this.orders.find(o => o.id === this.cancelOrderId);
    if (!order) return;
    if (order.paymentStatusId === 7) {
      this.loadingSubmit = true;
      this.cancelService.cancelOrder(
        this.cancelOrderId,
        this.selectedMotifId
      ).subscribe({
        next: () => {
          this.loadingSubmit = false;
          this.submitSuccess = true;
          this.submitError = '';
          this.showCancelModal = false;
          this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Annulation avec succès' });
          setTimeout(() => {
            window.location.reload();
          }, 1200);
        },
        error: (err) => {
          this.loadingSubmit = false;
          this.submitError = 'Erreur lors de l\'annulation.';
          this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Erreur lors de l\'annulation.' });
        }
      });
    } else {
      this.showRefundType = true;
      this.showCancel1 = true;
      this.showCancel2 = false;
      this.selectedRefundType = null;
      setTimeout(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 0);
    }
  }

  /**
   * Soumettre une demande d'annulation avec type de remboursement "Avoir"
   */
  submitAvoirRefund() {
    if (!this.cancelOrderId || !this.selectedMotifId) return;
    this.loadingSubmit = true;
    this.cancelService.cancelOrder(
      this.cancelOrderId,
      this.selectedMotifId,
      'Avoir'
    ).subscribe({
      next: () => {
        this.loadingSubmit = false;
        this.submitSuccess = true;
        this.submitError = '';
        this.showCancelModal = false;
        this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Annulation avec succès' });
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      },
      error: (err) => {
        this.loadingSubmit = false;
        this.submitError = 'Erreur lors de l\'annulation.';
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Erreur lors de l\'annulation.' });
      }
    });
  }

  /**
   * Soumettre une demande d'annulation avec type de remboursement bancaire
   */
  submitBankRefund(documentFile?: File | null) {
    const fileToSend = documentFile !== undefined ? documentFile : this.selectedFile;
    // Validate RIB length (must be exactly 20 digits)
    if (!/^\d{20}$/.test(this.rib)) {
      this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Le RIB doit être exactement 20 chiffres.' });
      return;
    }
    if (!this.cancelOrderId || !this.selectedMotifId || !this.rib || !this.holderName || !fileToSend) {
      this.submitError = 'Veuillez remplir tous les champs et joindre un document.';
      return;
    }
    this.loadingSubmit = true;
    this.cancelService.cancelOrder(
      this.cancelOrderId,
      this.selectedMotifId,
      'BankTransfer',
      this.rib,
      this.holderName,
      fileToSend
    ).subscribe({
      next: () => {
        this.loadingSubmit = false;
        this.submitSuccess = true;
        this.submitError = '';
        this.showCancelModal = false;
        this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Annulation avec succès' });
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      },
      error: (err) => {
        this.loadingSubmit = false;
        this.submitError = 'Erreur lors de l\'annulation.';
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Erreur lors de l\'annulation.' });
      }
    });
  }

  /**
   * Afficher un message de succès temporaire
   */
  showSuccessMessage(message: string) {
    this.updateMessage = message;
    this.updateSuccess = true;
    setTimeout(() => {
      this.updateMessage = '';
      this.updateSuccess = false;
    }, 2500);
  }

  onClose() {
    this.showCancelModal = false;
  }

  selectRefundType(type: string) {
    this.selectedRefundType = type;
    if (type === 'bancaire') {
      this.showCancel1 = false;
      this.showCancel2 = true;
    } else {
      this.showCancel1 = true;
      this.showCancel2 = false;
    }
    setTimeout(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 0);
  }

  goBack() {
    if (this.selectedRefundType) {
      // If a refund type is selected, go back to the refund type selection
      this.selectedRefundType = null;
      this.showCancel2 = false;
      this.showCancel1 = true;
    } else {
      // If no refund type is selected, go back to the orders list
      this.showRefundType = false;
      this.showCancel1 = true;
      this.showCancel2 = true;
      this.selectedMotifId = null;
      this.cancelOrderId = null;
      this.showCancelModal = false;
    }
    setTimeout(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 0);
  }

  submitReturnRequest() {
    this.loadingSubmit = true;
    setTimeout(() => {
      this.loadingSubmit = false;
      this.submitSuccess = true;
      this.submitError = '';
    }, 1000);
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFileName = file.name;
      this.selectedFile = file;
    }
  }

  triggerFileInput() {
    const fileInput = document.getElementById('ribFile') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  onRibInput() {
    // Supprimer tout caractère non numérique
    if (this.rib) {
      this.rib = this.rib.replace(/\D/g, '');
      if (this.rib.length > 20) {
        this.rib = this.rib.slice(0, 20);
      }
    }
  }

  // ========================================================================
  // Alerts Management Methods
  // ========================================================================

  /**
   * Load user's active alerts
   */
  loadAlerts(): void {
    this.isLoadingAlerts = true;
    this.alertsError = null;

    this.productAlertService.getMyAlerts().subscribe({
      next: (alerts) => {
        this.alerts = alerts.filter(alert => alert.is_active);
        this.isLoadingAlerts = false;
      },
      error: (error) => {
        console.error('Error loading alerts:', error);
        this.alertsError = 'Erreur lors du chargement des alertes';
        this.isLoadingAlerts = false;
      }
    });
  }

  /**
   * Get alert type label in French
   */
  getAlertTypeLabel(alertType: string): string {
    switch (alertType) {
      case 'price_drop':
        return 'Baisse de prix';
      case 'back_in_stock':
        return 'Retour en stock';
      default:
        return alertType;
    }
  }

  /**
   * Get alert type badge class
   */
  getAlertTypeBadgeClass(alertType: string): string {
    switch (alertType) {
      case 'price_drop':
        return 'badge-price-drop';
      case 'back_in_stock':
        return 'badge-back-in-stock';
      default:
        return 'badge-default';
    }
  }

  /**
   * Open confirmation modal for deleting an alert
   */
  openDeleteAlertModal(alert: ProductAlert): void {
    this.alertToDelete = alert;
    this.showDeleteAlertModal = true;
  }

  /**
   * Close delete alert confirmation modal
   */
  closeDeleteAlertModal(): void {
    this.showDeleteAlertModal = false;
    this.alertToDelete = null;
  }

  /**
   * Confirm and delete the selected alert
   */
  confirmDeleteAlert(): void {
    if (!this.alertToDelete) return;

    this.isDeletingAlert = true;

    this.productAlertService.unsubscribeAlert(this.alertToDelete.id).subscribe({
      next: (success) => {
        if (success) {
          // Remove alert from local list
          this.alerts = this.alerts.filter(a => a.id !== this.alertToDelete?.id);
          this.messageService.add({
            severity: 'success',
            summary: 'Alerte supprimee',
            detail: 'L\'alerte a ete supprimee avec succes'
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Impossible de supprimer l\'alerte'
          });
        }
        this.isDeletingAlert = false;
        this.closeDeleteAlertModal();
      },
      error: (error) => {
        console.error('Error deleting alert:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Une erreur est survenue lors de la suppression'
        });
        this.isDeletingAlert = false;
        this.closeDeleteAlertModal();
      }
    });
  }

  /**
   * Navigate to product detail page
   */
  navigateToProduct(productId: number): void {
    this.router.navigate(['/produit', productId]);
  }

  /**
   * Format date for display
   */
  formatAlertDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  /**
   * Get number of price drop alerts
   */
  getPriceDropAlertsCount(): number {
    return this.alerts.filter(a => a.alert_type === 'price_drop').length;
  }

  /**
   * Get number of back in stock alerts
   */
  getBackInStockAlertsCount(): number {
    return this.alerts.filter(a => a.alert_type === 'back_in_stock').length;
  }

  // ========================================================================
  // Stock Alerts Management Methods
  // ========================================================================

  /**
   * Handle stock alert deletion event from StockAlertsListComponent
   */
  onStockAlertDeleted(alertId: number): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Alerte supprimee',
      detail: 'L\'alerte de retour en stock a ete supprimee'
    });
  }

  /**
   * Load stock alerts (if needed for any reason)
   */
  loadStockAlerts(): void {
    this.isLoadingStockAlerts = true;
    this.stockAlertsError = null;

    this.stockAlertService.getMyAlerts().subscribe({
      next: (response) => {
        this.stockAlerts = response.alerts;
        this.isLoadingStockAlerts = false;
      },
      error: (error) => {
        console.error('Error loading stock alerts:', error);
        this.stockAlertsError = 'Erreur lors du chargement des alertes';
        this.isLoadingStockAlerts = false;
      }
    });
  }

}