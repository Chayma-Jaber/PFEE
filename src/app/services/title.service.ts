import { Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter, map, mergeMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class TitleService {
  // Titres des pages par défaut
  private pageTitles: { [key: string]: string } = {
    // Pages principales
    '': 'Accueil',
  
    'cart': 'Panier',
  
    'profile': 'Mon compte',
    'favoris': 'Mes favoris',
    'checkout': 'Commander',
    'order-confirmation': 'Confirmation de commande',
    'order-details': 'Détails de la commande',
    'gift-card': 'Carte cadeau',
    
    // Pages d'authentification
    'login': 'Connexion',
    'register': 'Inscription',
    'sign': 'Connexion/Inscription',
    'recover-password': 'Récupération du mot de passe',
    'verify-otp': 'Vérification OTP',
    
    // Pages d'information
    'about-us': 'À propos de nous',
    'contact-us': 'Contactez-nous',
    'our-history': 'Notre histoire',
    'stores': 'Nos magasins',
    'size-guide': 'Guide des tailles',
    'privacy': 'Politique de confidentialité',
    'cookies-policy': 'Politique des cookies',
    'delivery-return': 'Livraison & Retours',
    
    // Pages d'erreur
    '404': 'Page non trouvée'
  };

  constructor(
    private title: Title,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {}

  // Initialiser le service pour surveiller les changements de route
  initTitleService() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => this.activatedRoute),
      map(route => {
        while (route.firstChild) {
          route = route.firstChild;
        }
        return route;
      }),
      filter(route => route.outlet === 'primary'),
      mergeMap(route => route.data)
    ).subscribe(() => {
      this.updateTitleFromRoute(this.router.url);
    });
  }

  // Mettre à jour le titre en fonction de la route actuelle
  updateTitleFromRoute(url: string) {
    // Supprimer le premier slash et récupérer la partie principale de l'URL
    const path = url.split('/').filter(p => p.length > 0)[0] || '';
    
    // Obtenir le titre correspondant à la route
    let pageTitle = this.pageTitles[path] || 'Barsha - Tunisie';
    
    // Ajouter le suffixe du site
    this.title.setTitle(`${pageTitle} | Barsha - Tunisie` );
  }

  // Définir un titre de page spécifique (pour les pages avec contenu dynamique)
  setSpecificTitle(title: string) {
    this.title.setTitle(`${title} | Barsha - Tunisie`);
  }

  // Obtenir le titre pour une route spécifique
  getTitleForRoute(route: string): string {
    return this.pageTitles[route] || 'Barsha';
  }
} 