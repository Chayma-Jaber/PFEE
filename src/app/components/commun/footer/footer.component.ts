import { Component, OnInit } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FooterService } from '../../../services/footer.service'; // Assurez-vous que le chemin est correct
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';

import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule, ToastModule],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  providers: [MessageService]
})
export class FooterComponent implements OnInit {
  footerData: any;
  socialLinks: any;
  email: string = ''; // Pour stocker l'adresse e-mail saisie
  errorMessage: string = ''; // Pour afficher les messages d'erreur
  successMessage: string = ''; // Pour afficher les messages de succès
  currentYear: number;

  constructor(private footerService: FooterService, private messageService: MessageService, private router: Router) {
    this.currentYear = new Date().getFullYear();
  }

  ngOnInit(): void {
    this.email = '';
    // Récupérer les données du footer
    this.footerService.getFooterData().subscribe(
      data => {
        this.footerData = data.hits[0]; // Récupérer le premier élément de la réponse
      },
      error => {

        console.error('Erreur lors de la récupération des données du footer :', error);
      }
    );

    // Récupérer les liens des réseaux sociaux
    this.footerService.getSocialLinks().subscribe(
      data => {
        this.socialLinks = data.hits[0].links; // Récupérer les liens des réseaux sociaux
      },
      error => {
        console.error('Erreur lors de la récupération des liens des réseaux sociaux :', error);
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

    // Appel à l'API pour s'abonner à la newsletter
    this.footerService.subscribeToNewsletter(this.email).subscribe(
      response => {
        this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Vous êtes maintenant abonné à notre newsletter !' });

        this.email = ''; // Réinitialiser le champ e-mail
      },
      error => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Une erreur est survenue lors de l\'inscription à la newsletter.' });
        this.successMessage = '';

      }
    );
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