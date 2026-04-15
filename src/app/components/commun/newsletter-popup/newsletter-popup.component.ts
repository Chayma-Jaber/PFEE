import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NewsletterService, NewsletterPreferences } from '../../../services/newsletter.service';

@Component({
  selector: 'app-newsletter-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="newsletter-overlay" *ngIf="isVisible" (click)="onOverlayClick($event)">
      <div class="newsletter-popup" [class.success]="isSuccess">
        <!-- Close Button -->
        <button class="close-btn" (click)="closePopup()" aria-label="Fermer">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <!-- Content Container -->
        <div class="popup-content">
          <!-- Image Section -->
          <div class="popup-image">
            <div class="image-overlay">
              <span class="discount-badge">-15%</span>
              <span class="discount-text">Sur votre premiere commande</span>
            </div>
          </div>

          <!-- Form Section -->
          <div class="popup-form" *ngIf="!isSuccess">
            <h2>Rejoignez notre Newsletter</h2>
            <p class="subtitle">
              Inscrivez-vous pour recevoir nos offres exclusives,
              les nouveautes et des conseils mode personnalises.
            </p>

            <form (ngSubmit)="onSubmit()" #newsletterForm="ngForm">
              <!-- Email Field -->
              <div class="form-group">
                <input
                  type="email"
                  id="email"
                  name="email"
                  [(ngModel)]="email"
                  required
                  email
                  placeholder="Votre adresse email"
                  [class.error]="emailError"
                />
                <span class="error-message" *ngIf="emailError">{{ emailError }}</span>
              </div>

              <!-- Name Field (Optional) -->
              <div class="form-group">
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  [(ngModel)]="firstName"
                  placeholder="Votre prenom (optionnel)"
                />
              </div>

              <!-- Preferences -->
              <div class="preferences">
                <p class="preferences-title">Je souhaite recevoir :</p>
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="preferences.promotions" name="promotions" />
                  <span class="checkmark"></span>
                  Promotions et ventes flash
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="preferences.new_arrivals" name="new_arrivals" />
                  <span class="checkmark"></span>
                  Nouvelles collections
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="preferences.style_tips" name="style_tips" />
                  <span class="checkmark"></span>
                  Conseils mode et tendances
                </label>
              </div>

              <!-- Submit Button -->
              <button type="submit" class="submit-btn" [disabled]="isLoading">
                <span *ngIf="!isLoading">S'inscrire</span>
                <span *ngIf="isLoading" class="loader"></span>
              </button>

              <!-- Error Message -->
              <p class="api-error" *ngIf="apiError">{{ apiError }}</p>
            </form>

            <!-- No Thanks Link -->
            <button class="no-thanks" (click)="closePopup()">Non merci</button>

            <!-- Privacy Note -->
            <p class="privacy-note">
              En vous inscrivant, vous acceptez notre politique de confidentialite.
              Vous pouvez vous desabonner a tout moment.
            </p>
          </div>

          <!-- Success Message -->
          <div class="popup-success" *ngIf="isSuccess">
            <div class="success-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <h2>Merci pour votre inscription !</h2>
            <p>{{ successMessage }}</p>
            <button class="submit-btn" (click)="closePopup()">Continuer mes achats</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .newsletter-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.3s ease;
      backdrop-filter: blur(4px);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .newsletter-popup {
      background: #fff;
      border-radius: 16px;
      max-width: 800px;
      width: 95%;
      max-height: 90vh;
      overflow: hidden;
      position: relative;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.4s ease;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .close-btn {
      position: absolute;
      top: 16px;
      right: 16px;
      background: rgba(255, 255, 255, 0.9);
      border: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    .close-btn:hover {
      background: #fff;
      transform: scale(1.1);
    }

    .close-btn svg {
      color: #333;
    }

    .popup-content {
      display: flex;
      min-height: 500px;
    }

    .popup-image {
      flex: 1;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      background-image: url('https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80');
      background-size: cover;
      background-position: center;
      position: relative;
      display: none;
    }

    @media (min-width: 768px) {
      .popup-image {
        display: block;
      }
    }

    .image-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 40px 30px;
      background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
      color: #fff;
      text-align: center;
    }

    .discount-badge {
      display: block;
      font-size: 48px;
      font-weight: 700;
      letter-spacing: -2px;
      margin-bottom: 8px;
    }

    .discount-text {
      display: block;
      font-size: 16px;
      opacity: 0.9;
    }

    .popup-form, .popup-success {
      flex: 1;
      padding: 40px;
      display: flex;
      flex-direction: column;
    }

    .popup-form h2, .popup-success h2 {
      font-size: 28px;
      font-weight: 700;
      color: #1a1a2e;
      margin: 0 0 12px 0;
    }

    .subtitle {
      color: #666;
      font-size: 15px;
      line-height: 1.6;
      margin: 0 0 24px 0;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group input[type="email"],
    .form-group input[type="text"] {
      width: 100%;
      padding: 14px 16px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 15px;
      transition: all 0.2s ease;
      box-sizing: border-box;
    }

    .form-group input:focus {
      outline: none;
      border-color: #1a1a2e;
    }

    .form-group input.error {
      border-color: #e74c3c;
    }

    .error-message {
      color: #e74c3c;
      font-size: 13px;
      margin-top: 4px;
      display: block;
    }

    .preferences {
      margin-bottom: 24px;
    }

    .preferences-title {
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin: 0 0 12px 0;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      padding: 8px 0;
      font-size: 14px;
      color: #444;
    }

    .checkbox-label input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: #1a1a2e;
      cursor: pointer;
    }

    .submit-btn {
      width: 100%;
      padding: 16px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-bottom: 16px;
    }

    .submit-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(26, 26, 46, 0.3);
    }

    .submit-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .loader {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 2px solid #fff;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .api-error {
      color: #e74c3c;
      font-size: 14px;
      text-align: center;
      margin: 0 0 16px 0;
    }

    .no-thanks {
      background: none;
      border: none;
      color: #888;
      font-size: 14px;
      cursor: pointer;
      padding: 8px;
      margin: 0 auto;
      display: block;
      transition: color 0.2s ease;
    }

    .no-thanks:hover {
      color: #333;
      text-decoration: underline;
    }

    .privacy-note {
      font-size: 12px;
      color: #999;
      text-align: center;
      margin-top: auto;
      line-height: 1.5;
    }

    /* Success State */
    .popup-success {
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    .success-icon {
      color: #27ae60;
      margin-bottom: 24px;
    }

    .popup-success p {
      color: #666;
      font-size: 15px;
      line-height: 1.6;
      margin: 0 0 24px 0;
      max-width: 300px;
    }

    .popup-success .submit-btn {
      max-width: 250px;
    }

    /* Mobile Styles */
    @media (max-width: 767px) {
      .newsletter-popup {
        max-width: 95%;
        margin: 16px;
      }

      .popup-form, .popup-success {
        padding: 32px 24px;
      }

      .popup-form h2, .popup-success h2 {
        font-size: 24px;
      }
    }
  `]
})
export class NewsletterPopupComponent implements OnInit, OnDestroy {
  @Output() closed = new EventEmitter<void>();

  isVisible = false;
  isLoading = false;
  isSuccess = false;

  email = '';
  firstName = '';
  emailError = '';
  apiError = '';
  successMessage = '';

  preferences: NewsletterPreferences = {
    promotions: true,
    new_arrivals: true,
    style_tips: true
  };

  private showTimeout: any;
  private exitIntentBound: (e: MouseEvent) => void;

  constructor(private newsletterService: NewsletterService) {
    this.exitIntentBound = this.handleExitIntent.bind(this);
  }

  ngOnInit(): void {
    // Check if popup should be shown
    if (this.shouldShowPopup()) {
      this.setupTriggers();
    }
  }

  ngOnDestroy(): void {
    this.clearTriggers();
  }

  private shouldShowPopup(): boolean {
    // Don't show if already shown this session
    if (this.newsletterService.hasPopupBeenShown()) {
      return false;
    }
    // Don't show if user already subscribed
    if (this.newsletterService.hasUserSubscribed()) {
      return false;
    }
    return true;
  }

  private setupTriggers(): void {
    // Show after 30 seconds
    this.showTimeout = setTimeout(() => {
      this.showPopup();
    }, 30000);

    // Exit intent detection (desktop only)
    if (window.innerWidth > 768) {
      document.addEventListener('mouseout', this.exitIntentBound);
    }
  }

  private clearTriggers(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
    }
    document.removeEventListener('mouseout', this.exitIntentBound);
  }

  private handleExitIntent(e: MouseEvent): void {
    // Detect when mouse moves to top of page (exit intent)
    if (e.clientY < 10 && !this.isVisible && this.shouldShowPopup()) {
      this.showPopup();
    }
  }

  showPopup(): void {
    if (!this.isVisible && this.shouldShowPopup()) {
      this.isVisible = true;
      this.newsletterService.markPopupAsShown();
      this.clearTriggers();
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    }
  }

  closePopup(): void {
    this.isVisible = false;
    document.body.style.overflow = '';
    this.closed.emit();
  }

  onOverlayClick(event: MouseEvent): void {
    // Close if clicking on overlay (not popup)
    if ((event.target as HTMLElement).classList.contains('newsletter-overlay')) {
      this.closePopup();
    }
  }

  validateEmail(): boolean {
    this.emailError = '';
    if (!this.email) {
      this.emailError = 'Veuillez entrer votre adresse email';
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.emailError = 'Veuillez entrer une adresse email valide';
      return false;
    }
    return true;
  }

  onSubmit(): void {
    this.apiError = '';

    if (!this.validateEmail()) {
      return;
    }

    this.isLoading = true;

    this.newsletterService.subscribe(
      this.email,
      this.firstName || undefined,
      this.preferences,
      'popup'
    ).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.isSuccess = true;
        this.successMessage = response.message;
        this.newsletterService.markUserAsSubscribed();
      },
      error: (error) => {
        this.isLoading = false;
        this.apiError = error.error?.detail || 'Une erreur est survenue. Veuillez reessayer.';
      }
    });
  }
}
