import { Injectable } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
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
    private meta: Meta,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {}

  /**
   * Set page SEO from entity SEO fields (product or category).
   * Falls back to fallback params when the entity has no metaTitle/metaDescription.
   */
  setSeo(opts: {
    metaTitle?: string | null;
    metaDescription?: string | null;
    keywords?: string | null;
    fallbackTitle?: string;
    fallbackDescription?: string;
    imageUrl?: string;
    url?: string;
  }) {
    const t = (opts.metaTitle && opts.metaTitle.trim()) || opts.fallbackTitle || 'Barsha - Tunisie';
    const d = (opts.metaDescription && opts.metaDescription.trim()) ||
              opts.fallbackDescription ||
              'Découvrez notre collection de mode premium chez Barsha - Tunisie.';

    this.title.setTitle(`${t} | Barsha - Tunisie`);
    this.meta.updateTag({ name: 'description', content: d });
    if (opts.keywords) this.meta.updateTag({ name: 'keywords', content: opts.keywords });

    // Open Graph
    this.meta.updateTag({ property: 'og:title', content: t });
    this.meta.updateTag({ property: 'og:description', content: d });
    if (opts.imageUrl) this.meta.updateTag({ property: 'og:image', content: opts.imageUrl });
    if (opts.url) this.meta.updateTag({ property: 'og:url', content: opts.url });
    this.meta.updateTag({ property: 'og:type', content: 'product' });

    // Twitter
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: t });
    this.meta.updateTag({ name: 'twitter:description', content: d });
    if (opts.imageUrl) this.meta.updateTag({ name: 'twitter:image', content: opts.imageUrl });
  }

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