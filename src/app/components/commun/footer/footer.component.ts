import { Component, OnInit } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FooterService } from '../../../services/footer.service'; // Assurez-vous que le chemin est correct
import { NewsletterService } from '../../../services/newsletter.service';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';

import { ToastModule } from 'primeng/toast';
import { NewsletterFooterComponent } from '../newsletter-footer/newsletter-footer.component';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule, ToastModule, NewsletterFooterComponent],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  providers: [MessageService]
})
export class FooterComponent implements OnInit {
  footerData: any = { widgets: [], brand: 'Barsha' };
  socialLinks: any[] = [];
  email: string = ''; // Pour stocker l'adresse e-mail saisie
  errorMessage: string = ''; // Pour afficher les messages d'erreur
  successMessage: string = ''; // Pour afficher les messages de succès
  currentYear: number;
  isNewsletterLoading: boolean = false;
  isNewsletterSuccess: boolean = false;

  constructor(
    private footerService: FooterService,
    private newsletterService: NewsletterService,
    private messageService: MessageService,
    private router: Router
  ) {
    this.currentYear = new Date().getFullYear();
  }

  ngOnInit(): void {
    this.email = '';
    // Récupérer les données du footer
    this.footerService.getFooterData().subscribe(
      data => {
        const hit = data?.hits?.[0];
        if (hit) {
          // Ensure widgets is always an array
          if (!hit.widgets) {
            hit.widgets = [];
          }
          this.footerData = hit;
        } else {
          // Fallback: provide a minimal valid structure so the template never crashes
          this.footerData = { widgets: [], brand: 'Barsha' };
        }
      },
      () => {
        this.footerData = { widgets: [], brand: 'Barsha' };
      }
    );

    // Récupérer les liens des réseaux sociaux
    this.footerService.getSocialLinks().subscribe(
      data => {
        this.socialLinks = data?.hits?.[0]?.links || [];
      },
      () => {
        this.socialLinks = [];
      }
    );
  }

  scrollToTop() {
    window.scrollTo(0, 0);
  }

  subscribeToNewsletter() {
    // Validation de l'adresse e-mail
    if (!this.email || !this.validateEmail(this.email)) {
      this.errorMessage = 'Veuillez saisir une adresse e-mail valide.';
      this.successMessage = '';
      return;
    }

    this.isNewsletterLoading = true;
    this.errorMessage = '';

    // Appel au nouveau service newsletter
    this.newsletterService.subscribe(this.email, undefined, undefined, 'footer').subscribe({
      next: (response) => {
        this.isNewsletterLoading = false;
        this.isNewsletterSuccess = true;
        this.messageService.add({
          severity: 'success',
          summary: 'Succes',
          detail: response.message || 'Vous etes maintenant abonne a notre newsletter !'
        });
        this.newsletterService.markUserAsSubscribed();
        this.email = ''; // Reinitialiser le champ e-mail
      },
      error: (error) => {
        this.isNewsletterLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: error.error?.detail || 'Une erreur est survenue lors de l\'inscription a la newsletter.'
        });
        this.successMessage = '';
      }
    });
  }

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Handle clicks on footer items.
   * If the item corresponds to account-related actions and the user is not authenticated,
   * prevent navigation and redirect to /login.
   */
  onItemClick(item: any, event: Event) {
    if (!item || !item.title) {
      return;
    }

    const title = (item.title || '').toString().toLowerCase();
    const isAccountAction = title === 'mon compte'.toLowerCase() || title === 'mes commandes'.toLowerCase();

    if (isAccountAction) {
      const token = localStorage.getItem('jwt');
      if (!token) {
        // Prevent the routerLink from activating and redirect to login
        event.preventDefault();
        this.router.navigate(['/login']);
      }
    }
  }
}
