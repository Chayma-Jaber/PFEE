import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NewsletterService } from '../../../services/newsletter.service';

@Component({
  selector: 'app-newsletter-footer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="newsletter-footer">
      <div class="newsletter-content">
        <div class="newsletter-text">
          <h3>Newsletter</h3>
          <p>Recevez nos offres exclusives et les dernieres tendances mode</p>
        </div>

        <div class="newsletter-form-container" *ngIf="!isSuccess">
          <form class="newsletter-form" (ngSubmit)="onSubmit()" #form="ngForm">
            <div class="input-wrapper">
              <input
                type="email"
                [(ngModel)]="email"
                name="email"
                placeholder="Votre adresse email"
                required
                email
                [class.error]="errorMessage"
              />
              <button type="submit" [disabled]="isLoading">
                <span *ngIf="!isLoading">S'inscrire</span>
                <span *ngIf="isLoading" class="loader"></span>
              </button>
            </div>
            <span class="error-text" *ngIf="errorMessage">{{ errorMessage }}</span>
          </form>
        </div>

        <div class="success-message" *ngIf="isSuccess">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <span>{{ successText }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .newsletter-footer {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      padding: 32px 24px;
      border-radius: 12px;
      margin-bottom: 24px;
    }

    .newsletter-content {
      max-width: 600px;
      margin: 0 auto;
      text-align: center;
    }

    .newsletter-text {
      margin-bottom: 20px;
    }

    .newsletter-text h3 {
      color: #fff;
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 8px 0;
    }

    .newsletter-text p {
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
      margin: 0;
    }

    .newsletter-form {
      width: 100%;
    }

    .input-wrapper {
      display: flex;
      gap: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 6px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      transition: all 0.2s ease;
    }

    .input-wrapper:focus-within {
      border-color: rgba(255, 255, 255, 0.5);
      background: rgba(255, 255, 255, 0.15);
    }

    .input-wrapper input {
      flex: 1;
      border: none;
      background: transparent;
      padding: 12px 16px;
      font-size: 15px;
      color: #fff;
      outline: none;
    }

    .input-wrapper input::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }

    .input-wrapper input.error {
      color: #ff6b6b;
    }

    .input-wrapper button {
      padding: 12px 24px;
      background: #fff;
      color: #1a1a2e;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
      min-width: 100px;
    }

    .input-wrapper button:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(255, 255, 255, 0.3);
    }

    .input-wrapper button:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .loader {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid #1a1a2e;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error-text {
      display: block;
      color: #ff6b6b;
      font-size: 13px;
      margin-top: 8px;
      text-align: left;
      padding-left: 16px;
    }

    .success-message {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: #4ade80;
      font-size: 15px;
      padding: 12px;
      background: rgba(74, 222, 128, 0.1);
      border-radius: 8px;
      border: 1px solid rgba(74, 222, 128, 0.3);
    }

    .success-message svg {
      flex-shrink: 0;
    }

    /* Mobile Responsive */
    @media (max-width: 576px) {
      .newsletter-footer {
        padding: 24px 16px;
      }

      .newsletter-text h3 {
        font-size: 20px;
      }

      .input-wrapper {
        flex-direction: column;
        padding: 8px;
      }

      .input-wrapper input {
        padding: 14px 12px;
        text-align: center;
      }

      .input-wrapper button {
        width: 100%;
        padding: 14px;
      }
    }
  `]
})
export class NewsletterFooterComponent {
  email = '';
  isLoading = false;
  isSuccess = false;
  errorMessage = '';
  successText = '';

  constructor(private newsletterService: NewsletterService) {}

  onSubmit(): void {
    this.errorMessage = '';

    // Validate email
    if (!this.email) {
      this.errorMessage = 'Veuillez entrer votre adresse email';
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.errorMessage = 'Veuillez entrer une adresse email valide';
      return;
    }

    this.isLoading = true;

    this.newsletterService.subscribe(this.email, undefined, undefined, 'footer').subscribe({
      next: (response) => {
        this.isLoading = false;
        this.isSuccess = true;
        this.successText = response.message;
        this.newsletterService.markUserAsSubscribed();
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.error?.detail || 'Une erreur est survenue. Veuillez reessayer.';
      }
    });
  }
}
