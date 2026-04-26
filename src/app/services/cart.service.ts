import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Product } from '../models/Product';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ProductService } from './product.service';
import { AnalyticsService } from './analytics.service';
import { FunnelService } from './funnel.service';

export interface CartItem {
  product: Product;
  image: string;
  quantity: number;
  selectedColor: string;
  selectedSize: string;
  ean13: string;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private cartItemsSource = new BehaviorSubject<CartItem[]>([]);
  cartItems$ = this.cartItemsSource.asObservable();
  private currentUserId: string | null = null;

  constructor(private http: HttpClient, private productService: ProductService, private analyticsService: AnalyticsService, private funnel: FunnelService) {
    // Écouter les changements de stockage pour la synchronisation entre les onglets
    window.addEventListener('storage', (e) => {
      if (e.key === 'jwt') {
        // Si le token change (connexion/déconnexion), on recharge le panier
        setTimeout(() => this.handleAuthenticationChange(), 100);
      } else if (e.key === this.getStorageKey()) {
        this.loadCurrentUserCart();
      }
    });

    // Premier chargement du panier
    this.loadCurrentUserCart();
  }

  private handleAuthenticationChange() {
    console.log('Changement d\'authentification détecté');
    const token = localStorage.getItem('jwt');
    
    if (token) {
      // L'utilisateur vient de se connecter
      console.log('Connexion détectée - début de la synchronisation');
      this.syncGuestCart(token);
    } else {
      // L'utilisateur vient de se déconnecter
      console.log('Déconnexion détectée - réinitialisation du panier');
      this.currentUserId = null;
      this.loadCurrentUserCart();
    }
  }

  private getStorageKey(): string {
    const userId = this.getUserIdFromToken();
    if (!userId) {
      return 'cartItems_guest';
    }
    return `cartItems_${userId}`;
  }

  private getUserIdFromToken(): string | null {
    const token = localStorage.getItem('jwt');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.id;
    } catch (e) {
      console.error('Erreur lors de la décodage du token:', e);
      return null;
    }
  }

  private getGuestId(): string {
    let guestId = localStorage.getItem('guestId');
    if (!guestId) {
      guestId = 'guest_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('guestId', guestId);
    }
    return guestId;
  }

  public loadCurrentUserCart() {
    const newUserId = this.getUserIdFromToken();
    const oldUserId = this.currentUserId;
    
    console.log('Chargement du panier utilisateur...');
    console.log('Ancien ID utilisateur:', oldUserId);
    console.log('Nouvel ID utilisateur:', newUserId);
    
    // Si l'utilisateur a changé, on met à jour l'ID et on gère la synchronisation
    if (newUserId !== oldUserId) {
      console.log('Changement d\'utilisateur détecté');
      this.currentUserId = newUserId;

      // Si c'est une connexion (passage de null à un ID)
      if (newUserId && !oldUserId) {
        console.log('Connexion détectée - tentative de synchronisation du panier invité');
        // On garde une copie du panier invité avant de changer la clé
        const guestItems = localStorage.getItem('cartItems_guest');
        
        if (guestItems) {
          try {
            const parsedGuestItems = JSON.parse(guestItems);
            if (Array.isArray(parsedGuestItems) && parsedGuestItems.length > 0) {
              console.log('Panier invité trouvé:', parsedGuestItems);
              // On sauvegarde directement le panier invité dans le panier utilisateur
              localStorage.setItem(`cartItems_${newUserId}`, guestItems);
              // On supprime le panier invité
              localStorage.removeItem('cartItems_guest');
              // On met à jour le BehaviorSubject
              this.cartItemsSource.next(parsedGuestItems);
              console.log('Synchronisation directe du panier invité effectuée');
              return;
            }
          } catch (e) {
            console.error('Erreur lors de la synchronisation directe:', e);
          }
        }
      }
      
      // Si on passe d'utilisateur connecté à invité
      if (!newUserId && oldUserId) {
        console.log('Passage en mode invité - création d\'un nouveau panier');
        this.updateCart([]);
        return;
      }
    }

    const currentKey = this.getStorageKey();
    console.log('Clé de stockage actuelle:', currentKey);
    const storedItems = localStorage.getItem(currentKey);
    
    try {
      const parsedItems = storedItems ? JSON.parse(storedItems) : [];
      console.log('Articles chargés:', parsedItems);
      
      // Vérifier que les données parsées sont bien un tableau
      if (!Array.isArray(parsedItems)) {
        console.error('Les données du panier ne sont pas un tableau valide');
        this.cartItemsSource.next([]);
      } else {
        this.cartItemsSource.next(parsedItems);
        console.log('Panier mis à jour avec succès');
      }
    } catch (e) {
      console.error('Erreur lors du chargement du panier:', e);
      this.cartItemsSource.next([]);
    }
  }

  addToCart(item: CartItem): Observable<{success: boolean, message?: string}> {
    // Wave 2: fire funnel event (fire-and-forget)
    try { this.funnel.track('ADD_TO_CART', item?.product?.id); } catch {}
    return new Observable(observer => {
      // Récupérer les articles actuels du panier
      let currentItems = this.cartItemsSource.getValue();

      // Vérifier que currentItems est bien un tableau
      if (!Array.isArray(currentItems)) {
        console.warn('Le panier n\'était pas un tableau, initialisation d\'un nouveau panier');
        currentItems = [];
      }

      try {
        // Recherche d'un item existant avec exactement les mêmes caractéristiques
        const existingItemIndex = currentItems.findIndex(i =>
          i.product && item.product && // Vérifier que les objets product existent
          i.product.id === item.product.id &&
          i.selectedColor === item.selectedColor &&
          i.selectedSize === item.selectedSize &&
          i.ean13 === item.ean13
        );

        if (existingItemIndex !== -1) {
          // Si l'item existe, vérifier le stock avant d'incrémenter
          const newQuantity = Math.min(10, currentItems[existingItemIndex].quantity + item.quantity);

          // Vérification du stock avec la nouvelle quantité
          this.productService.checkStock(item.ean13, newQuantity).subscribe({
            next: (response: any) => {
              if (response.data.inStock) {
                currentItems[existingItemIndex].quantity = newQuantity;
                this.updateCart(currentItems);
                // Ajout événement GA4
                this.analyticsService.trackEvent('add_to_cart', {
                  id_produit: item.product.id,
                  sku: item.product.sku,
                  nom: item.product.title,
                  quantite: newQuantity,
                  currentprice: item.product.currentPrice
                });
                observer.next({success: true});
                observer.complete();
              } else {
                observer.next({
                  success: false,
                  message: 'Stock insuffisant pour cette quantité'
                });
                observer.complete();
              }
            },
            error: (error: any) => {
              console.error('Erreur lors de la vérification du stock:', error);
              observer.next({
                success: false,
                message: 'Impossible de vérifier le stock'
              });
              observer.complete();
            }
          });
        } else {
          // Si l'item n'existe pas, vérifier le stock pour la quantité demandée
          this.productService.checkStock(item.ean13, item.quantity).subscribe({
            next: (response: any) => {
              if (response.data.inStock) {
                currentItems.push({...item});
                this.updateCart(currentItems);
                // Ajout événement GA4
                this.analyticsService.trackEvent('add_to_cart', {
                  id_produit: item.product.id,
                  sku: item.product.sku,
                  nom: item.product.title,
                  quantite: item.quantity,
                  currentprice: item.product.currentPrice
                });
                observer.next({success: true});
                observer.complete();
              } else {
                observer.next({
                  success: false,
                  message: 'Stock insuffisant pour cette quantité'
                });
                observer.complete();
              }
            },
            error: (error: any) => {
              console.error('Erreur lors de la vérification du stock:', error);
              observer.next({
                success: false,
                message: 'Impossible de vérifier le stock'
              });
              observer.complete();
            }
          });
        }
      } catch (error) {
        console.error('Erreur lors de l\'ajout au panier:', error);
        observer.next({
          success: false,
          message: 'Erreur lors de l\'ajout au panier'
        });
        observer.complete();
      }
    });
  }

  // Méthode pour ajouter sans vérification de stock (pour la compatibilité)
  addToCartDirectly(item: CartItem) {
    // Récupérer les articles actuels du panier
    let currentItems = this.cartItemsSource.getValue();

    // Vérifier que currentItems est bien un tableau
    if (!Array.isArray(currentItems)) {
      console.warn('Le panier n\'était pas un tableau, initialisation d\'un nouveau panier');
      currentItems = [];
    }

    try {
      // Recherche d'un item existant avec exactement les mêmes caractéristiques
      const existingItemIndex = currentItems.findIndex(i =>
        i.product && item.product && // Vérifier que les objets product existent
        i.product.id === item.product.id &&
        i.selectedColor === item.selectedColor &&
        i.selectedSize === item.selectedSize &&
        i.ean13 === item.ean13
      );

      if (existingItemIndex !== -1) {
        // Si l'item existe, on met à jour la quantité en respectant la limite de 10
        const newQuantity = Math.min(10, currentItems[existingItemIndex].quantity + item.quantity);
        currentItems[existingItemIndex].quantity = newQuantity;

      } else {
        // Si l'item n'existe pas, on l'ajoute
        currentItems.push({...item});

      }

      // Mettre à jour le panier
      this.updateCart(currentItems);
    } catch (error) {
      console.error('Erreur lors de l\'ajout au panier:', error);
      // En cas d'erreur, on ajoute quand même l'article
      currentItems.push({...item});
      this.updateCart(currentItems);
    }
  }

  removeFromCart(productId: number, color: string, size: string) {
    const currentItems = this.cartItemsSource.getValue();
    const itemToRemove = currentItems.find(item => item.product.id === productId && item.selectedColor === color && item.selectedSize === size);
    const updatedItems = currentItems.filter(item => 
      !(item.product.id === productId && 
        item.selectedColor === color && 
        item.selectedSize === size)
    );
    this.updateCart(updatedItems);
    // Ajout événement GA4
    if (itemToRemove) {
      const montant_total = updatedItems.reduce((sum, item) => sum + (item.product.currentPrice * item.quantity), 0);
      this.analyticsService.trackEvent('remove_from_cart', {
        id_produit: itemToRemove.product.id,
        sku: itemToRemove.product.sku,
        montant_total: montant_total
      });
    }
  }

  updateQuantity(productId: number, color: string, size: string, quantity: number) {
    const currentItems = this.cartItemsSource.getValue();
    const itemIndex = currentItems.findIndex(i => 
      i.product.id === productId && 
      i.selectedColor === color && 
      i.selectedSize === size
    );
    
    if (itemIndex !== -1) {
      currentItems[itemIndex].quantity = Math.min(10, quantity);
      this.updateCart(currentItems);
    }
  }

  clearCart() {
    this.updateCart([]);
  }

  private updateCart(items: CartItem[]) {
    // Vérifier que items est bien un tableau
    if (!Array.isArray(items)) {
      console.error('Tentative de mise à jour du panier avec des données non valides');
      items = [];
    }
    
    this.cartItemsSource.next(items);
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(items));
    } catch (e) {
      console.error('Erreur lors de la sauvegarde du panier dans le localStorage:', e);
    }
  }

  // Synchronise le panier guest avec le compte utilisateur après connexion
  syncGuestCart(userToken: string) {
    if (!userToken) {
      console.error('Token manquant lors de la synchronisation du panier');
      return;
    }

    // Extraire l'ID utilisateur du token
    let userId: string | null;
    try {
      const payload = JSON.parse(atob(userToken.split('.')[1]));
      userId = payload.id;
    } catch (e) {
      console.error('Erreur lors du décodage du token:', e);
      return;
    }

    if (!userId) {
      console.error('ID utilisateur non trouvé dans le token');
      return;
    }

    // Force la mise à jour de l'ID utilisateur
    this.currentUserId = userId;
    
    const guestKey = 'cartItems_guest';
    const userKey = `cartItems_${userId}`;
    
    console.log('Début de la synchronisation du panier...');
    console.log('Guest key:', guestKey);
    console.log('User key:', userKey);
    console.log('User ID:', userId);
    
    const guestCart = localStorage.getItem(guestKey);
    const userCart = localStorage.getItem(userKey);

    if (guestCart) {
      try {
        const guestItems: CartItem[] = JSON.parse(guestCart);
        console.log('Articles du panier invité:', guestItems);
        
        let finalCart: CartItem[] = [];

        if (userCart) {
          const userItems: CartItem[] = JSON.parse(userCart);
          console.log('Articles du panier utilisateur existant:', userItems);
          finalCart = [...userItems];

          // Fusion intelligente des items (sans vérification de stock pour la synchronisation)
          guestItems.forEach((guestItem: CartItem) => {
            const existingItemIndex = finalCart.findIndex(i =>
              i.product.id === guestItem.product.id &&
              i.selectedColor === guestItem.selectedColor &&
              i.selectedSize === guestItem.selectedSize &&
              i.ean13 === guestItem.ean13
            );

            if (existingItemIndex !== -1) {
              // Si l'item existe, on met à jour la quantité en respectant la limite de 10
              const newQuantity = Math.min(10, finalCart[existingItemIndex].quantity + guestItem.quantity);
              finalCart[existingItemIndex].quantity = newQuantity;
            } else {
              // Si l'item n'existe pas, on l'ajoute
              finalCart.push({...guestItem});
            }
          });
        } else {
          console.log('Aucun panier utilisateur existant, utilisation du panier invité');
          finalCart = guestItems;
        }

        console.log('Panier final après fusion:', finalCart);

        // Mise à jour du panier utilisateur
        localStorage.setItem(userKey, JSON.stringify(finalCart));
        this.cartItemsSource.next(finalCart);
        
        // Suppression du panier invité
        localStorage.removeItem(guestKey);
        console.log('Synchronisation du panier terminée avec succès');
      } catch (e) {
        console.error('Erreur lors de la synchronisation du panier:', e);
      }
    } else {
      console.log('Aucun panier invité trouvé, aucune synchronisation nécessaire');
    }
    
    // Force le rechargement du panier après la synchronisation
    this.loadCurrentUserCart();
  }

  // Gestion de l'ID de commande temporaire
  private tempOrderIdSource = new BehaviorSubject<number | null>(null);
  tempOrderId$ = this.tempOrderIdSource.asObservable();

  setTempOrderId(orderId: number) {
    this.tempOrderIdSource.next(orderId);
    localStorage.setItem(`${this.getStorageKey()}_tempOrderId`, orderId.toString());
  }

  getTempOrderId(): number | null {
    const storedId = localStorage.getItem(`${this.getStorageKey()}_tempOrderId`);
    return storedId ? parseInt(storedId, 10) : null;
  }

  clearTempOrderId() {
    this.tempOrderIdSource.next(null);
    localStorage.removeItem(`${this.getStorageKey()}_tempOrderId`);
  }

}