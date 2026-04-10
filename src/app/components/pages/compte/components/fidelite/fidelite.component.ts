import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FideliteService } from './fidelite';

// Interface for the API response
interface FaqResponse {
  hits: Array<{
    id: number;
    title: string;
    questions: Array<{
      question: string;
      answer: string;
    }>;
    lang: string;
  }>;

}

@Component({
  selector: 'app-fidelite',
  standalone: true,
  imports:[CommonModule, FormsModule],
  templateUrl: './fidelite.component.html',
  styleUrls: ['./fidelite.component.scss']
})
export class FideliteComponent implements OnInit {
  selectedTab: string = 'exchange';
  showConversionSection: boolean = false;
  showPoints: boolean = true;
  points: number = 0;
  pointsValue: string = '0.00 TND';
  faq:any;
  faqData: FaqResponse | null = null;
  card:any;
  loyaltyCardParams:any;
  // Add properties for conversion parameters
  convertRate: number = 0;
  minToConvert: number = 0;
  loyaltyCard:any;
  convertLoyaltyPoint:any;
  loyaltyCardTransactions:any;
  // Properties for loyalty card models
  loyaltyCardModels:any = null;
  currentLoyaltyLevel:any = null;
  cardImageUrl: string = '';
  // Image loading state
  isImageLoading: boolean = true;
  isImageLoadFailed: boolean = false;
  // Timestamp for image cache busting
  timestamp: number = Date.now();
  // Toast notification properties
  showToast: boolean = false;
  toastMessage: string = '';
  // Loading state for conversion button
  isConverting: boolean = false;

  constructor(private fideliteService: FideliteService) { }

  ngOnInit(): void {
    this.getFaq();
    this.getCard();
    this.getLoyaltyCardParams();
    this.fetchLoyaltyCard();
    this.fetchLoyaltyCardTransactions();
  }
//getFaq
  getFaq(): void {
    this.fideliteService.getFaq().subscribe({
      next: (data: any) => {
        this.faq = data;
        this.faqData = data;
      },
      error: (error: any) => {
        console.error('Error fetching FAQ:', error);
      }
    });
  }

  getCard(): void {
    this.fideliteService.getCard().subscribe({
      next: (data: any) => {
        this.card = data;
        this.loyaltyCardModels = data;
        this.updateLoyaltyLevel();
      },
      error: (error: any) => {
        console.error('Error fetching card models:', error);
      }
    });
  }

  getLoyaltyCardParams(): void {
    this.fideliteService.getLoyaltyCardParams().subscribe({
      next: (data: any) => {
        this.loyaltyCardParams = data;
        // Set the conversion parameters from the API response
        if (data && data.data) {
          this.convertRate = data.data.convertRate;
          this.minToConvert = data.data.minToConvert;
        }
      },
      error: (error: any) => {
        console.error('Error fetching loyalty card parameters:', error);
      }
    });
  }
  fetchLoyaltyCard(): void {
    this.fideliteService.fetchLoyaltyCard().subscribe({
      next: (data: any) => {
        this.loyaltyCard = data;
        this.updateLoyaltyLevel();
      },
      error: (error: any) => {
        if (error.status === 404) {
          // Create a default loyalty card data with 0 points and default nomination
          this.loyaltyCard = {
            data: {
              cardNumber: "",
              state: false,
              activationDate: "",
              points: 0,
              program: "",
              nomination: {
                id: 1,
                title: "Membre",
                minBalance: 0,
                maxBalance: 200,
                textColor: "#ffffff",
                image: {
                  url: "",
                  ext: "",
                  width: 0,
                  height: 0
                }
              }
            }
          };
          this.updateLoyaltyLevel();
        }
      }
    });
  }
  fetchLoyaltyCardTransactions(): void {
    this.fideliteService.fetchLoyaltyCardTransactions().subscribe({
      next: (data: any) => {
        this.loyaltyCardTransactions = data;
      },
      error: (error: any) => {
        console.error('Error fetching loyalty card transactions:', error);
      }
    });
  }

  // Method to determine current loyalty level based on points
  updateLoyaltyLevel(): void {
    // Check if we have the loyalty card data with nomination
    if (this.loyaltyCard?.data?.nomination) {
      // Use the nomination data directly from the API response
      const nomination = this.loyaltyCard.data.nomination;
      const currentImageUrl = this.cardImageUrl;

      // Set the current loyalty level from the nomination data
      this.currentLoyaltyLevel = nomination;

      // Only set loading state to true if the image URL actually changes
      if (currentImageUrl !== nomination.image.url) {
        this.isImageLoading = true;
      }

      // Set the card image URL from the nomination data
      this.cardImageUrl = nomination.image.url;

      // Update timestamp to force image reload
      this.timestamp = Date.now();
      return;
    }

    // Fallback to the old method if nomination data is not available
    if (!this.loyaltyCardModels || !this.loyaltyCardModels.hits) {
      return;
    }

    // If loyalty card data is null, default to 0 points
    const userPoints = this.loyaltyCard?.data?.points || 0;
    const currentImageUrl = this.cardImageUrl;

    // Get the first card model as default
    let selectedModel = this.loyaltyCardModels.hits[0];

    // Find the appropriate card model based on points
    for (const model of this.loyaltyCardModels.hits) {
      if (userPoints >= model.minBalance && userPoints <= model.maxBalance) {
        selectedModel = model;
        break;
      }
    }

    // Always set a model, even if it's the first one
    this.currentLoyaltyLevel = selectedModel;

    // Only set loading state to true if the image URL actually changes
    if (currentImageUrl !== selectedModel.image.url) {
      this.isImageLoading = true;
    }
    this.cardImageUrl = selectedModel.image.url;
    // Update timestamp to force image reload
    this.timestamp = Date.now();
  }



  // Method to show toast notification
  showToastNotification(message: string): void {
    this.toastMessage = message;
    this.showToast = true;

    // Hide toast after 3 seconds
    setTimeout(() => {
      this.showToast = false;
    }, 3000);
  }

  convertLoyaltyPoints(pointsToConvert?: number): void {
    // Use the input parameter or fallback to the component's points property
    const points = pointsToConvert !== undefined ? pointsToConvert : this.points;

    // Validate points minimum requirement
    if (points < this.minToConvert) {
      this.showToastNotification(`La valeur des points doit être au moins ${this.minToConvert}`);
      return;
    }

    // Validate user has enough points
    if (this.loyaltyCard && this.loyaltyCard.data && points > this.loyaltyCard.data.points) {
      this.showToastNotification(`Vous n'avez pas assez de points. Votre solde est de ${this.loyaltyCard.data.points} points.`);
      return;
    }

    // Create request payload
    const data = { points };

    // Set loading state to true
    this.isConverting = true;

    // Call the API
    this.fideliteService.convertLoyaltyPoints(data).subscribe({
      next: (response: any) => {
        // Set loading state to false
        this.isConverting = false;

        // console.log('Points converted successfully:', response);
        this.convertLoyaltyPoint = response;

        // Show success message with discount details
        if (response?.data) {
          const discount = response.data;
          const discountValue = discount.discount_amount > 0
            ? `${discount.discount_amount} TND`
            : `${discount.discount_percent}%`;

          this.showToastNotification(`Conversion réussie! Vous avez obtenu un bon de ${discountValue} valable jusqu'au ${this.formatTransactionDate(discount.date_to)}`);
        } else {
          this.showToastNotification('Points convertis avec succès!');
        }

        // Close conversion panel if open
        this.showConversionSection = false;

        // Update timestamp to force image reload
        this.timestamp = Date.now();

        // Refresh data
        this.fetchLoyaltyCardTransactions();

        this.fetchLoyaltyCard();
      },
      error: (error: any) => {
        // Set loading state to false
        this.isConverting = false;

        console.error('Error converting points:', error);

        // Handle specific error cases
        if (error.status === 400) {
          this.showToastNotification(error.error?.message || 'Paramètres de conversion invalides.');
        } else if (error.status === 403) {
          this.showToastNotification('Votre niveau de fidélité ne permet pas la conversion de points.');
        } else {
          this.showToastNotification('Une erreur est survenue lors de la conversion des points.');
        }
      }
    });
  }
  selectTab(tab: string): void {
    this.selectedTab = tab;
    this.showConversionSection = false;
  }

  toggleConversionSection(): void {
    this.showConversionSection = !this.showConversionSection;
  }

  cancelConversion(): void {
    this.showConversionSection = false;
  }

  convertPoints(): void {
    // Check if points meet the minimum required from API
    if (this.points < this.minToConvert) {
      this.showToastNotification(`La valeur des points doit être au moins ${this.minToConvert}`);
      return;
    }

    // Check if user has enough points
    if (this.loyaltyCard && this.loyaltyCard.data && this.points > this.loyaltyCard.data.points) {
      this.showToastNotification(`Vous n'avez pas assez de points. Votre solde est de ${this.loyaltyCard.data.points} points.`);
      return;
    }

    // Create data object to send to API
    const data = {
      points: this.points
    };

    // Set loading state to true
    this.isConverting = true;

    // Call API to convert points using the object syntax for subscribe
    this.fideliteService.convertLoyaltyPoints(data).subscribe({
      next: (response: any) => {
        // Set loading state to false
        this.isConverting = false;

        // console.log('Points convertis avec succès:', response);
        this.convertLoyaltyPoint = response;

        // Show success message with discount details
        if (response?.data) {
          const discount = response.data;
          const discountValue = discount.discount_amount > 0
            ? `${discount.discount_amount} TND`
            : `${discount.discount_percent}%`;

          this.showToastNotification(`Conversion réussie! Vous avez obtenu un bon de ${discountValue} valable jusqu'au ${this.formatTransactionDate(discount.date_to)}`);
        } else {
          this.showToastNotification('Points convertis avec succès!');
        }

        // Update timestamp to force image reload
        this.timestamp = Date.now();

        this.showConversionSection = false;

        // Refresh transactions to show new conversion
        this.fetchLoyaltyCardTransactions();
        // Refresh loyalty card to update points
        this.fetchLoyaltyCard();
      },
      error: (error: any) => {
        // Set loading state to false
        this.isConverting = false;

        console.error('Erreur lors de la conversion des points:', error);
        this.showToastNotification('Une erreur est survenue lors de la conversion des points.');
      }
    });
  }

  // Method to format answer text with line breaks
  formatAnswerText(text: string): string {
    if (!text) return '';
    return text.replace(/\n/g, '<br>');
  }

  // Method to format transaction date
  formatTransactionDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  // Method to update points value based on points
  updatePointsValue(): void {
    // Validate that entered points don't exceed user's available points
    if (this.loyaltyCard && this.loyaltyCard.data && this.points > this.loyaltyCard.data.points) {
      this.showToastNotification(`Vous n'avez pas assez de points. Votre solde est de ${this.loyaltyCard.data.points} points.`);

    }

    // Calculate value based on dynamic conversion rate from API
    if (this.points >= this.minToConvert && this.convertRate > 0) {
      const value = (this.points * this.convertRate).toFixed(2);
      this.pointsValue = `${value} TND`;
    } else {
      this.pointsValue = '0.00 TND';
    }
  }

  // Handle image loaded event
  onImageLoaded(): void {
    // console.log('Image loaded successfully');
    this.isImageLoading = false;
    this.isImageLoadFailed = false;
  }

  // Handle image error event
  onImageError(): void {
    console.log('Image loading error');
    this.isImageLoading = false;
    this.isImageLoadFailed = true;
  }

  refreshCardImage(): void {
    // Reset loading states
    this.isImageLoading = true;
    this.isImageLoadFailed = false;

    // Update timestamp to force reload
    this.timestamp = Date.now();

    // Optionally, we can also refresh the card data
    this.fetchLoyaltyCard();
  }
}