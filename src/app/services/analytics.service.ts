import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';


declare let gtag: Function;

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private environment =environementDev;

  constructor(private router: Router) {
    // Écouter les événements de navigation
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.trackPageView(event.urlAfterRedirects);
    });

    // Assurez-vous que l'ID GA4 est correctement configuré à l'initialisation
    this.updateGaConfig();
  }

  /**
   * Met à jour l'ID de configuration GA4 dans le script
   */
  private updateGaConfig(): void {
    // Si window et document sont disponibles (environnement navigateur)
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      // Mettre à jour l'ID dans le tag script
      const scriptTag = document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
      if (scriptTag) {
        scriptTag.setAttribute('src', `https://www.googletagmanager.com/gtag/js?id=${this.environment.googleAnalyticsId}`);
      }

      // Mettre à jour l'ID dans la configuration
      if (typeof gtag === 'function') {
        gtag('config', this.environment.googleAnalyticsId);
      }
    }
  }

  /**
   * Suit une vue de page
   */
  trackPageView(path: string): void {
    if (typeof gtag === 'function') {
      gtag('config', this.environment.googleAnalyticsId, {
        page_path: path
      });
    }
  }

  /**
   * Suit un événement personnalisé
   */
  trackEvent(eventName: string, eventParams: Record<string, any> = {}): void {
    if (typeof gtag === 'function') {
      gtag('event', eventName, eventParams);
    }
  }

  /**
   * Tracking e-commerce avancé pour Google Tag Manager (dataLayer)
   */
  private get dataLayer() {
    (window as any).dataLayer = (window as any).dataLayer || [];
    return (window as any).dataLayer;
  }

  viewItem(product: { id: string, name: string, sku: string }) {
    this.dataLayer.push({
      event: 'view_item',
      ecommerce: {
        items: [{
          item_id: product.id,
          item_name: product.name,
          item_sku: product.sku
        }]
      }
    });
  }

  addToCart(product: { id: string, name: string, sku: string }) {
    this.dataLayer.push({
      event: 'add_to_cart',
      ecommerce: {
        items: [{
          item_id: product.id,
          item_name: product.name,
          item_sku: product.sku
        }]
      }
    });
  }

  purchase(order: { id: string, total: number, items: any[] }) {
    this.dataLayer.push({
      event: 'purchase',
      ecommerce: {
        transaction_id: order.id,
        value: order.total,
        currency: 'TND',
        items: order.items.map(item => ({
          item_id: item.id,
          item_name: item.name,
          item_sku: item.sku
        }))
      }
    });
  }

  viewCategory(category: { id: string, name: string }) {
    this.dataLayer.push({
      event: 'view_item_list',
      ecommerce: {
        item_list_id: category.id,
        item_list_name: category.name
      }
    });
  }

  openMenu(menu: { id: string, name: string }) {
    this.dataLayer.push({
      event: 'open_menu',
      menu_id: menu.id,
      menu_name: menu.name
    });
  }

  scroll(percent: number) {
    this.dataLayer.push({
      event: 'scroll',
      scroll_percent: percent
    });
  }

  actionClick(info: { id?: string, class?: string }) {
    this.dataLayer.push({
      event: 'action_click',
      button_id: info.id,
      button_class: info.class
    });
  }

  /**
   * Track user account creation
   * @param user Utilisateur avec id, codeErp, phone, firstName, lastName, email
   */
  trackUserAccountCreation(user: { id: number|string, codeErp: string, phone: string, firstName: string, lastName: string, email: string }) {
    this.dataLayer.push({
      event: 'user_account_creation',
      id_user: user.id,
      code_erp: user.codeErp,
      phone: user.phone,
      first_name: user.firstName,
      last_name: user.lastName,
      email: user.email
    });
  }

  /**
   * Track clicks on forms
   * @param formId Identifiant du formulaire
   */
  trackFormClick(formId: string) {
    this.dataLayer.push({
      event: 'form_click',
      form_id: formId
    });
  }

  /**
   * Track removal of a product from the cart
   * @param removal Informations sur la suppression : id produit, sku, id panier, montant total
   */
  removeFromCart(removal: { productId: string, sku: string, cartId: string, totalAmount: number }) {
    this.dataLayer.push({
      event: 'remove_from_cart',
      product_id: removal.productId,
      sku: removal.sku,
      cart_id: removal.cartId,
      total_amount: removal.totalAmount
    });
  }

  /**
   * Track application of a coupon code
   * @param coupon Informations sur le coupon appliqué : code_copon, id_codecopon, montant_avant, montant_après
   */
  applyCoupon(coupon: { code_copon: string, id_codecopon: string, montant_avant: number, montant_apres: number }) {
    this.dataLayer.push({
      event: 'apply_coupon',
      code_copon: coupon.code_copon,
      id_codecopon: coupon.id_codecopon,
      montant_avant: coupon.montant_avant,
      montant_apres: coupon.montant_apres
    });
  }

  /**
   * Track final validation of an e-commerce order
   * @param order Informations sur la commande validée
   */
  validateOrder(order: {
    montant_total: number,
    nombre_articles: number,
    liste_produits: Array<{
      id: string,
      reference: string,
      nom: string,
      quantite: number,
      prix_avant_remise: number,
      prix_apres_remise: number,
      id_panier: string
    }>,
    methode_livraison: string,
    methode_paiement: string,
    sous_total: number,
    total: number,
    frais_livraison: number
  }) {
    this.dataLayer.push({
      event: 'order_validation',
      montant_total: order.montant_total,
      nombre_articles: order.nombre_articles,
      liste_produits: order.liste_produits,
      methode_livraison: order.methode_livraison,
      methode_paiement: order.methode_paiement,
      sous_total: order.sous_total,
      total: order.total,
      frais_livraison: order.frais_livraison
    });
  }
} 