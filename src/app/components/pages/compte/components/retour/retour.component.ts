import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReturnService } from '../../../../../services/return.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AddressListModalComponent } from '../../../sign/components/address-list-modal/address-list-modal.component';
import { ProfileService } from '../../../sign/profile';
import { MessageService } from 'primeng/api';
import { AnalyticsService } from '../../../../../services/analytics.service';

import { ToastModule } from 'primeng/toast';
interface DetailRetour {
  ref: string;
  image: string;
  produit: string;
  quantite: number;
  quantiteMax: number;
  motif: string;
  taille: string;
  selected?: boolean;
  selectedMotif?: string;
  idCartProd: string;
}

// Interface pour les commandes
interface Retour {
  id: number;
  date: string;
  ref: string;
  montant: string;
  etat: string;
  source: string;
}

// Interface pour les motifs de retour
interface MotifReturn {
  id: number;
  code: string;
  name: string;
}

@Component({
  selector: 'app-retour',
  imports: [CommonModule, FormsModule,ToastModule],
  templateUrl: './retour.component.html',
  styleUrl: './retour.component.scss',
  providers: [MessageService, AnalyticsService]
})
export class RetourComponent implements OnInit {
  // État de l'interface
  showReturnInterface = false;
  showViewReturnInterface = false;
  selectedOrderRef = '';
  showMotifModal = false;
  selectedItemIndex: number | null = null;
  selectedMotifInModal: string = '';
  showRefundType = false;
  selectedRefundType: any = null;
  selectedFileName: string = 'Coordonnées bancaires';


  retours: Retour[] = [];
  detailRetours: DetailRetour[] = [];
  motifs: MotifReturn[] = []; 
  selectedReturnProducts: DetailRetour[] = [];

  // Loading states for buttons
  loadingReturnRef: string | null = null;
  loadingViewRef: string | null = null;

  showAddressSelection = false;
  selectedAddress: any = null;

  // Ajout des propriétés pour le formulaire bancaire
  holderName: string = '';
  rib: string = '';
  ribFile: File | null = null;
  loadingSubmit: boolean = false;
  submitError: string = '';
  submitSuccess: boolean = false;

  selectedOrderId: number | null = null;

  ribTouched = false;

  retoursLivre: Retour[] = [];
  retoursEnregistre: Retour[] = [];

  constructor(
    private returnService: ReturnService,
    private modalService: NgbModal,
    private profileService: ProfileService,
    private messageService: MessageService,
    private analytics: AnalyticsService
  ) {
    this.loadStateFromSessionStorage();
  }

  ngOnInit() {
    this.loadMotifs();
    this.loadOrders();
  }

  private loadStateFromSessionStorage() {
    const savedState = sessionStorage.getItem('returnState');
    if (savedState) {
      const state = JSON.parse(savedState);
      this.showReturnInterface = state.showReturnInterface || false;
      this.selectedOrderRef = state.selectedOrderRef || '';
      this.showRefundType = state.showRefundType || false;
      this.selectedRefundType = state.selectedRefundType || null;
      this.showAddressSelection = state.showAddressSelection || false;
      this.selectedAddress = state.selectedAddress || null;
    }
  }

  private saveStateToSessionStorage() {
    const state = {
      showReturnInterface: this.showReturnInterface,
      selectedOrderRef: this.selectedOrderRef,
      showRefundType: this.showRefundType,
      selectedRefundType: this.selectedRefundType,
      showAddressSelection: this.showAddressSelection,
      selectedAddress: this.selectedAddress
    };
    sessionStorage.setItem('returnState', JSON.stringify(state));
  }

  loadMotifs() {
    this.returnService.getmotifOrderReturn().subscribe({
      next: (response) => {
        if (response && response.hits) {
          this.motifs = response.hits;
        }
      },
      error: (error) => {
        console.error('Error loading motifs:', error);
      }
    });
  }

  /**
   * Charge dynamiquement les commandes (Livré et Retour Envoyé)
   */
  loadOrders() {
    this.retours = [];
    // Commandes Livré
    this.returnService.getavailablesOrdersForReturnRequest().subscribe({
      next: (response) => {
        if (response && response.data) {
          this.retoursLivre = response.data.map((order: any) => ({
            id: order.id,
            date: order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '',
            ref: order.slug,
            montant: order.total ? order.total + ' TND' : '',
            etat: order.status,
            source: 'order'
          }));
        }
      },
      error: (error) => {
        console.error('Erreur lors du chargement des commandes Livré:', error);
      }
    });

    // Commandes Retour Envoyé
    this.returnService.getOrdersReturns().subscribe({
      next: (response) => {
        if (response && response.data) {
          this.retoursEnregistre = response.data.map((ret: any) => ({
            id: ret.id,
            date: ret.createdAt ? new Date(ret.createdAt).toLocaleDateString() : '',
            ref: ret.slug,
            montant: ret.total ? ret.total + ' TND' : '',
            etat: ret.statuses && ret.statuses.length > 0 ? ret.statuses[0].state : '',
            source: 'return'
          })).filter((r: Retour) => r.etat === 'Enregistré');
        }
      },
      error: (error) => {
        console.error('Erreur lors du chargement des retours envoyés:', error);
      }
    });
  }


  private resetReturnState(): void {
    this.showReturnInterface = false;
    this.showRefundType = false;
    this.selectedRefundType = null;
    this.detailRetours = [];
  }

  // Ajoute le scroll vers le haut à chaque changement d'interface
  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** 
   * Affiche l'interface de retour pour une commande spécifique
   */
  showReturnForm(orderRef: string): void {
    this.scrollToTop();
    const selected = this.retoursLivre.find(r => r.ref === orderRef && r.etat === 'Livré');
    if (!selected) return;
    this.loadingReturnRef = orderRef;
    this.selectedOrderRef = orderRef;
    this.selectedOrderId = selected.id;
    this.resetReturnState();
    this.returnService.getavailablesOrderProductsForReturn(selected.id).subscribe({
      next: (response) => {
        if (response && response.data) {
          this.detailRetours = response.data.map((prod: any) => ({
            ref: prod.sku,
            idCartProd: prod.idCartProd,
            image: prod.image,
            produit: prod.title,
            quantite: prod.quantity,
            quantiteMax: prod.quantity,
            taille: prod.size,
            motif: '',
            selected: false,
            selectedMotif: ''
          }));
        }
        this.showReturnInterface = true;
        this.loadingReturnRef = null;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des produits de la commande:', error);
        this.loadingReturnRef = null;
      }
    });
    this.saveStateToSessionStorage();
  }

  /**
   * Ouvre le modal de sélection de motif
   */
  openMotifModal(index: number): void {
    this.selectedItemIndex = index;
    this.selectedMotifInModal = this.detailRetours[index].selectedMotif || '';
    this.showMotifModal = true;
  }

  /**
   * Ferme le modal de sélection de motif
   */
  closeMotifModal(): void {
    this.showMotifModal = false;
    this.selectedItemIndex = null;
    this.selectedMotifInModal = '';
  }

  /**
   * Sélectionne un motif dans le modal
   */
  selectMotifInModal(motif: string): void {
    this.selectedMotifInModal = motif;
  }

  /**
   * Gère l'input du motif 'Autre'
   */

  /**
   * Applique le motif sélectionné au produit
   */
  applyMotif(): void {
    if (this.selectedItemIndex !== null) {
      let motifToApply = this.selectedMotifInModal;
      this.detailRetours[this.selectedItemIndex].selectedMotif = motifToApply;
      this.detailRetours[this.selectedItemIndex].motif = motifToApply;
    }
    this.closeMotifModal();
  }

  /**
   * Gère la sélection/désélection d'un produit
   */
  toggleProductSelection(index: number): void {
    this.detailRetours[index].selected = !this.detailRetours[index].selected;
    if (!this.detailRetours[index].selected) {
      this.detailRetours[index].selectedMotif = '';
    }
  }

  /**
   * Vérifie si au moins un produit est sélectionné avec un motif
   */
  canProceed(): boolean {
    // Tous les produits sélectionnés doivent avoir un motif
    return this.detailRetours.filter(item => item.selected).every(item => !!item.selectedMotif) && this.detailRetours.some(item => item.selected);
  }

  /**
   * Traite la demande de retour
   */
  processReturn(): void {
    // Tracking clic bouton "Valider retour"
    this.analytics.actionClick({
      id: 'btn-valider-retour',
      class: 'btn-primary'
    });
    this.scrollToTop();
    const selectedItems = this.detailRetours.filter(item => item.selected && item.selectedMotif);
    if (selectedItems.length > 0) {
      this.selectedReturnProducts = selectedItems;
      this.showReturnInterface = false;
      this.showAddressSelection = true;
      this.saveStateToSessionStorage();
    }
  }

  increaseQuantity(index: number) {
    if (this.detailRetours[index].selected && this.detailRetours[index].quantite < this.detailRetours[index].quantiteMax) {
      this.detailRetours[index].quantite++;
    }
  }

  decreaseQuantity(index: number) {
    if (this.detailRetours[index].selected && this.detailRetours[index].quantite > 1) {
      this.detailRetours[index].quantite--;
    }
  }

  selectRefundType(type: 'avoir' | 'bancaire') {
    this.scrollToTop();
    this.selectedRefundType = type;
    this.saveStateToSessionStorage();
  }

  goBack() {
    this.scrollToTop();
    if (this.showViewReturnInterface) {
      this.showViewReturnInterface = false;
      this.selectedOrderRef = '';
    } else if (this.selectedRefundType === 'bancaire') {
      this.selectedRefundType = null;
    } else if (this.showRefundType) {
      this.showRefundType = false;
      this.showAddressSelection = true;
    } else if (this.showAddressSelection) {
      this.showAddressSelection = false;
      this.showReturnInterface = true;
    } else if (this.showReturnInterface) {
      this.showReturnInterface = false;
      this.selectedOrderRef = '';
    }
    this.saveStateToSessionStorage();
  }

  triggerFileInput() {
    const fileInput = document.getElementById('ribFile') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.selectedFileName = file.name;
      this.ribFile = file;
    } else {
      this.selectedFileName = 'Joindre';
      this.ribFile = null;
    }
  }

  /**
   * Affiche l'interface de visualisation du détail de retour pour une commande spécifique
   */
  voirRetour(ref: string) {
    this.scrollToTop();
    const selected = this.retoursEnregistre.find(r => r.ref === ref && (r.etat === 'Enregistré'));
    if (!selected) return;
    this.loadingViewRef = ref;
    this.selectedOrderRef = ref;
    this.resetReturnState();
    this.showViewReturnInterface = false;
    this.returnService.getOrdersReturnsById(selected.id).subscribe({
      next: (response) => {
        if (response && response.data && response.data.products) {
          this.detailRetours = response.data.products.map((prod: any) => ({
            ref: prod.product.sku,
            image: prod.product.image,
            produit: prod.product.title,
            quantite: prod.quantity,
            taille: prod.product.size,
            motif: prod.motif,
            selected: true,
            selectedMotif: prod.motif
          }));
        }
        this.showViewReturnInterface = true;
        this.loadingViewRef = null;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des produits du retour:', error);
        this.loadingViewRef = null;
      }
    });
  }

  openAddressModal() {
    const modalRef = this.modalService.open(AddressListModalComponent, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false
    });
    modalRef.result.then(
      (result) => {
        this.selectedAddress = result;
        this.saveStateToSessionStorage();
      },
      (reason: any) => {}
    );
  }

  confirmAddress() {
    this.scrollToTop();
    if (this.selectedAddress) {
      this.showAddressSelection = false;
      this.showRefundType = true;
      this.saveStateToSessionStorage();
    }
  }

  /**
   * Soumet la demande de retour à l'API
   */
  submitReturnRequest() {
    this.loadingSubmit = true;
    this.submitError = '';
    this.submitSuccess = false;

    const selectedItems = this.selectedReturnProducts;
    if (!this.selectedOrderId || !this.selectedRefundType || !this.selectedAddress || selectedItems.length === 0) {
      this.loadingSubmit = false;
      this.submitError = 'Veuillez remplir tous les champs obligatoires.';
      return;
    }

    const products = selectedItems.map(item => ({
      cart_product: item.idCartProd,
      motif: this.motifs.find(m => m.name === item.selectedMotif)?.id || item.selectedMotif,
      quantity: item.quantite,
      notes: ''
    }));

    // Toujours utiliser FormData
    const body = new FormData();
    body.append('order', this.selectedOrderId.toString());
    body.append('pickupAddress', this.selectedAddress.id);
    body.append('refundType', this.selectedRefundType === 'bancaire' ? 'BankTransfer' : 'Avoir');
    body.append('products', JSON.stringify(products));

    if (this.selectedRefundType === 'bancaire') {
      if (!this.holderName || !this.rib) {
        this.loadingSubmit = false;
        this.submitError = 'Veuillez renseigner le nom du titulaire et le RIB.';
        return;
      }
      body.append('rib', this.rib);
      body.append('holderName', this.holderName);
      if (this.ribFile) {
        body.append('document', this.ribFile);
      }
    }

    this.returnService.createReturnRequest(body).subscribe({
      next: (res) => {
        this.scrollToTop();
        this.loadingSubmit = false;
        this.submitSuccess = true;
        this.resetReturnState();
        this.showRefundType = false;
        this.showAddressSelection = false;
        this.selectedOrderRef = '';
        this.selectedOrderId = null;
        this.selectedRefundType = null;
        this.holderName = '';
        this.rib = '';
        this.ribFile = null;
        this.selectedFileName = 'Joindre';
        this.selectedReturnProducts = [];
        this.loadOrders();
        // Toast de succès
        this.messageService.add({
          severity: 'success',
          summary: 'Succès',
          detail: 'Votre demande de retour a été envoyée avec succès.'
        });
        // Vider le returnState du sessionStorage
        sessionStorage.removeItem('returnState');
      },
      error: (err) => {
        this.loadingSubmit = false;
        this.submitError = 'Erreur lors de la soumission de la demande de retour.';
      }
    });
  }

  /**
   * Gère le clic sur le checkbox d'un produit : sélectionne/désélectionne et ouvre le modal si coché
   */
  onProductCheckboxChange(index: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.detailRetours[index].selected = checked;
    if (!checked) {
      this.detailRetours[index].selectedMotif = '';
    } else {
      this.openMotifModal(index);
    }
  }

  isRibValid(): boolean {
    return /^\d{20}$/.test(this.rib || '');
  }

  onRibInput() {
    if (this.rib && this.rib.length > 20) {
      this.rib = this.rib.slice(0, 20);
    }
  }
}
