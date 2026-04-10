import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ProductService } from '../../../services/product.service';
import { TitleService } from '../../../services/title.service';

@Component({
  selector: 'app-favoris',
  standalone: true,
  imports: [CommonModule, RouterModule,],
  templateUrl: './favoris.component.html',
  styleUrls: ['./favoris.component.scss'],
})
export class FavorisComponent implements OnInit {
  selectedColor: string | null = null;
  produits: any[] = []; // Liste des produits dans la wishlist
  isLoading: boolean = true; // Indicateur de chargement

  constructor(

    public productService: ProductService,
    private titleService: TitleService
  ) { }

  ngOnInit(): void {
    // Définir le titre de la page pour les favoris
    this.titleService.setSpecificTitle('Mes Favoris');

    this.fetchWishlist();
  }

  // Récupérer les produits de la wishlist
  fetchWishlist(): void {
    this.isLoading = true;
    this.productService.getWishlist().subscribe(
      (response) => {
        this.produits = this.mapApiDataToProducts(response.data);
        this.fetchStockForProducts(); // Récupérer le stock pour chaque produit
        this.isLoading = false;
      },
      (error) => {
        console.error('Erreur lors de la récupération de la wishlist:', error);
        this.isLoading = false;
      }
    );
  }

  // Mapper les données de l'API aux produits affichés
  mapApiDataToProducts(apiData: any[]): any[] {
    return apiData.map((item) => ({
      id: item.id,
      image: item.firstImg?.url || 'assets/default-image.jpg', // Utiliser une image par défaut si aucune image n'est disponible
      nom: item.title,
      prix: `${item.currentPrice.toFixed(3)} TND`,
      isInWishlist: true, // Tous les produits de la wishlist sont dans la wishlist
      colors: item.declinaisons.map((declinaison: any) => ({
        name: declinaison.libellet,
        textureImage: declinaison.texture?.url || 'assets/default-texture.jpg',
        mainImage: declinaison.images[0]?.url || item.firstImg?.url,
      })),
      declinaisons: item.declinaisons,
      selectedColorIndex: 0, // Index de la couleur sélectionnée
      tailles: [], // Stock des tailles
      activeImageIndex: 0, // Index de l'image active
      imageInterval: null, // Intervalle pour changer les images
    }));
  }






  // Récupérer le stock pour chaque produit
  fetchStockForProducts(): void {
    this.produits.forEach((produit) => {
      const declinaisonId = produit.declinaisons[produit.selectedColorIndex]?.id;
      if (declinaisonId) {
        this.productService.getDeclinaisonStock(declinaisonId).subscribe(
          (stockData) => {
            produit.tailles = stockData.data.map((item: any) => ({
              size: item.size,
              qte: item.qte,
            }));
          },
          (error) => {
            console.error(`Erreur lors de la récupération du stock pour ${produit.nom}`, error);
            produit.tailles = [];
          }
        );
      }
    });
  }

  // Sélectionner une couleur
  selectColor(produit: any, index: number): void {
    produit.selectedColorIndex = index;
    this.resetActiveImage(produit); // Réinitialiser l'image active
    this.fetchStockForProduct(produit); // Récupérer le stock pour la nouvelle couleur
  }

  // Récupérer le stock pour un produit spécifique
  fetchStockForProduct(produit: any): void {
    const declinaisonId = produit.declinaisons[produit.selectedColorIndex]?.id;
    if (declinaisonId) {
      this.productService.getDeclinaisonStock(declinaisonId).subscribe(
        (stockData) => {
          produit.tailles = stockData.data.map((item: any) => ({
            size: item.size,
            qte: item.qte,
          }));
        },
        (error) => {
          console.error(`Erreur lors de la récupération du stock pour ${produit.nom}`, error);
          produit.tailles = [];
        }
      );
    }
  }

  // Changer l'image active toutes les 2 secondes
  changeActiveImage(produit: any): void {
    produit.imageInterval = setInterval(() => {
      const images = produit.declinaisons[produit.selectedColorIndex]?.images;
      if (images && images.length > 1) {
        produit.activeImageIndex = (produit.activeImageIndex + 1) % images.length;
        produit.colors[produit.selectedColorIndex].mainImage = images[produit.activeImageIndex].url;
      }
    }, 2000); // Changer l'image toutes les 2 secondes
  }

  // Réinitialiser l'image active
  resetActiveImage(produit: any): void {
    if (produit.imageInterval) {
      clearInterval(produit.imageInterval);
      produit.imageInterval = null;
    }
    produit.activeImageIndex = 0;
    produit.colors[produit.selectedColorIndex].mainImage =
      produit.declinaisons[produit.selectedColorIndex].images[0]?.url ||
      produit.colors[produit.selectedColorIndex].mainImage;
  }

  // Vérifier si une taille est en stock
  isInStock(produit: any, taille: string): boolean {
    const sizeObj = produit.tailles.find((t: any) => t.size === taille);
    return sizeObj ? sizeObj.qte > 0 : false;
  }


  // Basculer l'état de la wishlist
  toggleWishlist(produit: any): void {
    produit.isInWishlist = !produit.isInWishlist;

    if (produit.isInWishlist) {
      // Ajouter le produit à la wishlist
      this.productService.addToWishList(produit.id).subscribe(
        (response) => {
          // console.log('Produit ajouté à la wishlist:', response);
        },
        (error) => {
          console.error('Erreur lors de l\'ajout à la wishlist:', error);
          produit.isInWishlist = !produit.isInWishlist; // Revenir à l'état précédent en cas d'erreur
        }
      );
    } else {
      // Supprimer le produit de la wishlist
      this.productService.removeFromWishList(produit.id).subscribe(
        (response) => {
          // console.log('Produit supprimé de la wishlist:', response);
          // Retirer le produit de la liste affichée
          this.produits = this.produits.filter((p) => p.id !== produit.id);
        },
        (error) => {
          console.error('Erreur lors de la suppression de la wishlist:', error);
          produit.isInWishlist = !produit.isInWishlist; // Revenir à l'état précédent en cas d'erreur
        }
      );
    }
  }

  /**
   * Get product detail URL for right-click functionality
   * @param produit Product to get URL for
   * @returns Product detail URL string
   */
  getProductDetailUrl(produit: any): string {
    if (!produit || !produit.id) {
      return '/produit/0-produit';
    }

    // Use the ProductService to generate the correct slug format (ID-name)
    const slug = this.productService.generateProductSlug(produit);
    return `/produit/${slug}`;
  }

}