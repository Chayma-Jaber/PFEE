import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { GiftCardService } from './gift-card.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { AccordionModule } from 'primeng/accordion';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { environementDev } from '../../../../environements/environementDev';

interface GiftCardImage {
  url: string;
  alt: string;
  color: string;
  textColor?: string;
}

interface FaqItem {
  question: string;
  answer: string;
  isOpen?: boolean;
}

@Component({
  selector: 'app-gift-card',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule, AccordionModule, ToastModule],
  templateUrl: './gift-card.component.html',
  styleUrls: ['./gift-card.component.scss'],
  providers: [MessageService]
})
export class GiftCardComponent implements OnInit {
  errorMessage: string = '';
  prices: any[] = [];
  events: any[] = [];
  faqs: FaqItem[] = [];
  showConfirmationPopup: boolean = false;
  showFaqPopup: boolean = false;
  selectedEventIndex: number = -1;
  selectedPriceIndex: number = -1;
  selectedImageIndex: number = 0;
  recipientPhone: string = '';
  customMessage: string = '';
  isLoading: boolean = false;
  
  giftCardImages: GiftCardImage[] = [];

  // Ajout pour restauration
  private restoredGiftCard: any = null;
  private eventsLoaded = false;
  private pricesLoaded = false;
  private restorationDone = false;

  constructor(
    private giftCardService: GiftCardService,
    private router: Router,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  saveGiftCardToSession() {
    const data = {
      selectedEventIndex: this.selectedEventIndex,
      selectedPriceIndex: this.selectedPriceIndex,
      selectedImageIndex: this.selectedImageIndex,
      recipientPhone: this.recipientPhone,
      customMessage: this.customMessage
    };
    localStorage.setItem('giftCardCart', JSON.stringify(data));
  }

  ngOnInit() {
    // Charger les données du localStorage (toujours)
    const saved = localStorage.getItem('giftCardCart');
    if (saved) {
      this.restoredGiftCard = JSON.parse(saved);
    }
    this.loadGiftCardPrices();
    this.loadGiftCardEvents();
    this.loadGiftCardFaq();

    // Check if we should show the FAQ popup
    if (localStorage.getItem('showGiftCardFaq') === 'true') {
      this.openFaqPopup();
      localStorage.removeItem('showGiftCardFaq');
    }
    // Appel explicite pour restauration immédiate si jamais eventsLoaded et pricesLoaded sont déjà vrais
    this.tryRestoreGiftCardState();
  }

  private tryRestoreGiftCardState() {
    if (this.restoredGiftCard && this.eventsLoaded && this.pricesLoaded && !this.restorationDone) {
      // Restaurer les index si valides
      if (typeof this.restoredGiftCard.selectedEventIndex === 'number' && this.restoredGiftCard.selectedEventIndex < this.events.length) {
        this.selectedEventIndex = this.restoredGiftCard.selectedEventIndex;
      } else if (this.events.length > 0) {
        this.selectedEventIndex = 0;
      }
      if (typeof this.restoredGiftCard.selectedPriceIndex === 'number' && this.restoredGiftCard.selectedPriceIndex < this.prices.length) {
        this.selectedPriceIndex = this.restoredGiftCard.selectedPriceIndex;
      } else if (this.prices.length > 0) {
        this.selectedPriceIndex = 0;
      }
      // Mettre à jour les images puis restaurer l'image choisie
      this.updateImagesFromEvent(this.selectedEventIndex, true);
      if (typeof this.restoredGiftCard.selectedImageIndex === 'number' && this.giftCardImages.length > 0 && this.restoredGiftCard.selectedImageIndex < this.giftCardImages.length) {
        this.selectedImageIndex = this.restoredGiftCard.selectedImageIndex;
      }
      // Restaurer les champs texte
      this.recipientPhone = this.restoredGiftCard.recipientPhone ?? '';
      this.customMessage = this.restoredGiftCard.customMessage ?? '';
      this.restorationDone = true;
      // Forcer la détection de changement pour mettre à jour l'UI
      this.cdr.detectChanges();
    }
  }

  loadGiftCardPrices() {
    this.giftCardService.getGiftCardPrices().subscribe({
      next: (data) => {
        this.prices = data.hits.map((item: any) => ({
          id: item.id,
          amount: item.amount || item.price
        }));
        this.pricesLoaded = true;
        this.tryRestoreGiftCardState();
        if (!this.restoredGiftCard) {
          if (this.prices.length > 0) {
            this.selectedPriceIndex = 0;
          }
        }
      },
      error: (error) => {
        console.error('Error loading gift card prices:', error);
      }
    });
  }

  loadGiftCardEvents() {
    this.giftCardService.getGiftCardEvents().subscribe({
      next: (data) => {
        this.events = data.hits.map((item: any) => ({
          id: item.id,
          name: item.title,
          text: item.text,
          images: item.images
        }));
        this.eventsLoaded = true;
        this.tryRestoreGiftCardState();
        if (!this.restoredGiftCard) {
          if (this.events.length > 0) {
            this.selectedEventIndex = 0;
            this.updateImagesFromEvent(0);
          }
        }
      },
      error: (error) => {
        console.error('Error loading gift card events:', error);
      }
    });
  }

  loadGiftCardFaq() {
    this.giftCardService.getGiftCardFaq().subscribe({
      next: (data) => {
        if (data.hits && data.hits.length > 0) {
          this.faqs = data.hits[0].questions.map((q: any) => ({
            question: q.question || q.icon,
            answer: q.answer,
            isOpen: false
          }));
        }
      },
      error: (error) => {
        console.error('Error loading gift card FAQ:', error);
      }
    });
  }

  selectEvent(index: number) {
    this.selectedEventIndex = index;
    this.updateImagesFromEvent(index);
    this.customMessage = this.events[index]?.text || '';
    this.saveGiftCardToSession();
  }

  updateImagesFromEvent(index: number, isRestore: boolean = false) {
    if (this.events[index] && this.events[index].images) {
      this.giftCardImages = this.events[index].images.map((img: any) => {
        return {
          url: img.image.url,
          alt: this.events[index].name,
          color: 'custom',
          textColor: img.textColor || '#000000',
          text: this.events[index].text,
          eventText: this.events[index].text
        };
      });
      // Ne pas toucher selectedImageIndex ici lors de la restauration
      if (!isRestore) {
        this.selectedImageIndex = 0;
      }
    }
  }

  selectPrice(index: number) {
    this.selectedPriceIndex = index;
    this.saveGiftCardToSession();
  }

  selectImage(index: number) {
    this.selectedImageIndex = index;
    this.saveGiftCardToSession();
  }

  nextImage() {
    this.selectedImageIndex = (this.selectedImageIndex + 1) % this.giftCardImages.length;
  }

  prevImage() {
    this.selectedImageIndex = (this.selectedImageIndex - 1 + this.giftCardImages.length) % this.giftCardImages.length;
  }

  getSelectedImageUrl(): string {
    if (this.giftCardImages && this.giftCardImages.length > 0 && this.selectedImageIndex >= 0 && this.selectedImageIndex < this.giftCardImages.length) {
      return this.giftCardImages[this.selectedImageIndex].url;
    }
    return ''; // Return empty string or a default image URL
  }

  getSelectedTextColor(): string {
    if (this.giftCardImages.length > 0 && this.selectedImageIndex < this.giftCardImages.length) {
      return this.giftCardImages[this.selectedImageIndex].textColor || '#000000';
    }
    return '#000000';
  }

  get selectedPrice() {
    return this.selectedPriceIndex >= 0 ? this.prices[this.selectedPriceIndex] : null;
  }

  isFormValid(): boolean {
    return (
      this.selectedEventIndex >= 0 &&
      this.selectedPriceIndex >= 0 &&
      this.recipientPhone.trim().length > 0 &&
      this.customMessage.trim().length > 0
    );
  }

  buyGiftCard() {
    const token = localStorage.getItem('jwt'); // ou sessionStorage selon ton choix
  
    if (!token) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: "Vous n'êtes pas autorisé à voir cette page. Vous êtes redirigé vers la page de connexion!",
        life: 900
      });
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 500);
      return;
    }
  
    if (!this.isFormValid()) {
      return;
    }
  
    const giftCardData = {
      event: this.events[this.selectedEventIndex],
      price: this.prices[this.selectedPriceIndex],
      image: this.giftCardImages[this.selectedImageIndex],
      recipientPhone: this.recipientPhone,
      message: this.customMessage
    };
  
    console.log('Gift card purchase:', giftCardData);
    this.showConfirmationPopup = true;
  }
  
  
  closePopup() {
    this.showConfirmationPopup = false;
  }
  
 confirmPurchase() {
  // Reset error message
  this.errorMessage = '';
  this.isLoading = true;

  // Validate required fields
  if (!this.isFormValid()) {
    this.errorMessage = 'Veuillez remplir tous les champs obligatoires';
    this.isLoading = false;
    return;
  }

  // Get selected items
  const selectedEvent = this.events[this.selectedEventIndex];
  const selectedPrice = this.prices[this.selectedPriceIndex];
  const selectedImage = this.giftCardImages[this.selectedImageIndex];

  // Prepare payload
  const payload = {
    idCard: selectedEvent.id,
    amount: selectedPrice.amount,
    price: selectedPrice.amount,
    recipientPhone: this.recipientPhone,
    text: this.customMessage,
    cardImage: {
      url: selectedImage.url,
      textColor: selectedImage.textColor
    },
   
    redirectToAfterPay: environementDev.redirectUrlLocal
  };

  // Call API
  this.giftCardService.createGiftCardOrder(payload).subscribe({
    next: (response) => {
      this.isLoading = false;
      if (response.ctpUrl) {
        this.showConfirmationPopup = false;
        localStorage.removeItem('giftCardCart');
        window.location.href = response.ctpUrl;
      } else {
        this.errorMessage = 'Erreur lors de la création du paiement';
      }
    },
    error: (error) => {
      console.error('Error:', error);
      this.isLoading = false;
      this.errorMessage = 'Erreur lors de la commande. Veuillez réessayer.';
    }
  });
}

  openFaqPopup() {
    this.showFaqPopup = true;
  }

  closeFaqPopup() {
    this.showFaqPopup = false;
  }
}
