import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HomeService } from './home';
import { CommonModule } from '@angular/common';
import { TitleService } from '../../../services/title.service';
import { WelcomePopupComponent } from '../../shared/welcome-popup.component';

@Component({
  selector: 'app-home-all',
  standalone: true,
  imports: [RouterModule, CommonModule, WelcomePopupComponent],
  templateUrl: './home-all.component.html',
  styleUrl: './home-all.component.scss'
})
export class HomeAllComponent implements OnInit {
  searchResults: any;
  isLoading: boolean = true;
  showWelcomePopup: boolean = false; // Initialiser à false pour permettre le chargement des données
  popupData: any;
  promoSection: any = null; // Add this line
  isMobile: boolean = false;

  constructor(
    private homeService: HomeService,
    private titleService: TitleService
  ) { }

  ngAfterViewInit(): void {
    this.checkIfMobile();
    window.addEventListener('resize', () => this.checkIfMobile());
  }

  checkIfMobile(): void {
    this.isMobile = window.innerWidth <= 767;
  }

  ngOnInit(): void {
    // Définir le titre de la page d'accueil
    this.titleService.setSpecificTitle('Accueil');
    this.checkIfMobile();

    this.isLoading = true;
    this.homeService.searchHome().subscribe(
      (data) => {
        this.searchResults = data;
        this.isLoading = false;
   
        if (data.hits[0] && data.hits[0].popup ) {
          this.popupData = data.hits[0].popup;
          
          // Délai pour permettre le chargement complet des données avant d'afficher le popup
          setTimeout(() => {
            this.showWelcomePopup = true;
          }, 300);
            } else {
              this.showWelcomePopup = false;
            }
        // Extract promoSection if present
        if (data.hits[0] && data.hits[0].promoSection) {
          this.promoSection = data.hits[0].promoSection;
        } else {
          this.promoSection = null;
        }
        // console.log(this.searchResults);
      },
      (error) => {
        console.error('Erreur lors de la récupération des données', error);
        this.isLoading = false;
      }
    );
  }

  // Méthode pour gérer le clic sur les boutons de genre
  onGenderButtonClick(button: any): void {
    // Déterminer le genre basé sur le texte du bouton
    let selectedGender: string = '';

    if (button.text && button.text.toLowerCase().includes('elle')) {
      selectedGender = 'Femme';
    } else if (button.text && button.text.toLowerCase().includes('lui')) {
      selectedGender = 'Homme';
    }

    // Sauvegarder le choix dans localStorage si un genre valide est détecté
    if (selectedGender) {
      localStorage.setItem('selectedGender', selectedGender);
   
    }
  }

  onCloseWelcomePopup() {
    this.showWelcomePopup = false;
  }

  // Expose global window object for template usage
  get window(): Window {
    return window;
  }
}