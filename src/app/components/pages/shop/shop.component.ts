// src/app/shop/shop.component.ts
import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/Product';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { HomeService } from '../../../components/pages/home-all/home';
import { FilterComponent, SelectedFilters } from './filter/filter.component';
import { FilterService, ProductFilterParams } from './filter/filter';
import { TitleService } from '../../../services/title.service';
import { filter } from 'rxjs/operators';
import { MenuService } from '../../../services/menu.service';
import { SeoService } from '../../../services/seo.service';
import { ScrollPositionService } from '../../../services/scroll-position.service';
import { Category } from '../../../models/menu';
import { SkeletonLoaderComponent } from '../../shared/skeleton-loader/skeleton-loader.component';
import { ProductSkeletonComponent } from '../../shared/product-skeleton/product-skeleton.component';
import { FilterSkeletonComponent } from '../../shared/filter-skeleton/filter-skeleton.component';
import { ControlsSkeletonComponent } from '../../shared/controls-skeleton/controls-skeleton.component';
import { BreadcrumbComponent } from '../../commun/breadcrumb/breadcrumb.component';
import { ProductComparisonService } from '../../../services/product-comparison.service';
import { QuickViewService } from '../../../services/quick-view.service';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ToastModule,
    FilterComponent,
    SkeletonLoaderComponent,
    ProductSkeletonComponent,
    FilterSkeletonComponent,
    ControlsSkeletonComponent,
    BreadcrumbComponent
  ],
  templateUrl: './shop.component.html',
  styleUrls: ['./shop.component.scss'],
  providers: [MessageService],
})
export class ShopComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('filterButtonsScroll') filterButtonsScroll!: ElementRef;

  produits: Product[] = [];
  categoryId: number | null = null;
  originalProduits: Product[] = [];
  isBlurred: boolean = false;
  activePopupProduct: Product | null = null;
  showFilterPopup: boolean = false;
  selectedFilterIndex: number = 0;
  currentViewMode: 'single' | 'double' | 'triple' | 'grid' = 'grid';
  isLoading: boolean = true;
  clothingSizes: string[] = [];
  shoeSizes: number[] = [];
  filters = ['Touts afficher', 'Coupe droite', 'Baggy', 'Jeans large', 'Mom', 'Skinny', 'Flare'];
  searchResults: any;
  filteredProductsCount: number = 0;

  // Pagination properties
  currentOffset: number = 0;
  limit: number = 20;
  hasMoreProducts: boolean = true;
  isLoadingMore: boolean = false;
  totalProducts: number = 0;
  isUsingFilters: boolean = false;

  // Scroll handling
  private scrollThreshold = 200; // Distance from bottom to trigger loading
  private lastScrollPosition: number = 0;

  // Scroll navigation properties
  showLeftArrow: boolean = false;
  showRightArrow: boolean = false;

  // Category banner properties
  categoryBannerUrl: string | null = null;
  showCategoryBanner: boolean = false;

  // Track window resize to update button widths and arrow visibility
  @HostListener('window:resize')
  onResize() {
    this.adjustButtonWidths();
    this.checkArrowsVisibility();
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(event?: Event) {
    if (this.isLoadingMore || !this.hasMoreProducts || this.isLoading) {
      return;
    }

    const position = window.scrollY + window.innerHeight;
    const height = document.documentElement.scrollHeight;

    if (position > height - this.scrollThreshold) {
      // Save current scroll position before loading more
      this.lastScrollPosition = window.scrollY;

      if (this.hasActiveFilters()) {
        this.loadMoreFilteredProducts();
      } else {
        this.loadMoreProducts();
      }
    }
  }

  isFilterSelected(index: number): boolean {
    return this.selectedFilterIndex === index;
  }

  // Filter options are now loaded dynamically in the filter component
  selectedFilters: SelectedFilters = {
    ordre: '',
    taille: [] as string[],
    couleur: [] as string[],
    prix: 200,
    minPrix: 0,
    type: ''
  };

  toggleProductType(type: string): void {
    this.selectedFilters.type = this.selectedFilters.type === type ? '' : type;
    this.applyFilters();
  }

  constructor(
    public productService: ProductService,
    private route: ActivatedRoute,
    private router: Router,
    private messageService: MessageService,
    private homeService: HomeService,
    private titleService: TitleService,
    private menuService: MenuService,
    private seoService: SeoService,
    private filterService: FilterService,
    private scrollPositionService: ScrollPositionService,
    private comparisonService: ProductComparisonService,
    private quickViewService: QuickViewService
  ) {
    // Suivre les changements de route, y compris après actualisation
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updateTitleFromUrl();
      });
  }

  // Méthode pour extraire le nom de la catégorie de l'URL (avec segment 'shop', 'tn' ou direct)
  private updateTitleFromUrl(): void {
    const currentUrl = this.router.url;
    // Extraire le segment shop/X-nom-categorie, tn/X-nom-categorie ou directement X-nom-categorie
    const categoryUrlPattern = /\/(?:shop\/|tn\/)?(\d+)-(.*?)(?:\/|$)/;
    const match = currentUrl.match(categoryUrlPattern);

    if (match && match[2]) {
      // Formater le nom de la catégorie (première lettre en majuscule)
      const categoryName = match[2].replace(/-/g, ' ');
      const formattedName = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
      // Définir le titre de la page
      this.titleService.setSpecificTitle(formattedName);
    }
  }

  /**
   * Set default view mode based on screen size
   * Mobile: double (2 columns)
   * Desktop: grid (5 columns)
   */
  private setDefaultViewMode(): void {
    const screenWidth = window.innerWidth;

    if (screenWidth < 768) {
      // Mobile devices and tablets: use double view (2 columns)
      this.currentViewMode = 'double';
    } else {
      // Desktop: use grid view (5 columns)
      this.currentViewMode = 'grid';
    }
  }

  ngOnInit(): void {
    // Ensure "Tout" option is selected by default
    this.selectedFilterIndex = 0;

    // Set default view mode based on screen size
    this.setDefaultViewMode();

    // Mettre à jour le titre basé sur l'URL actuelle
    this.updateTitleFromUrl();

    // Add sitelinks search box
    this.seoService.addSitelinksSearchBox();

    // Récupérer l'ID de catégorie depuis les paramètres de la route
    this.route.paramMap.subscribe(params => {
      const categoryIdParam = params.get('categoryId');

      if (categoryIdParam) {
        // Extract category id and check if it's using idOrigin format
        if (categoryIdParam.includes('-')) {
          const parts = categoryIdParam.split('-');
          const categoryId = parseInt(parts[0], 10);

          // Check if this is an old URL with idOrigin
          this.checkForIdOriginRedirect(categoryId, categoryIdParam);
        } else {
          // If no name in the URL, just use the ID
          this.categoryId = parseInt(categoryIdParam, 10);
          this.fetchProducts(this.categoryId);
          this.fetchCategoryBanner(this.categoryId); // Fetch category banner
          this.titleService.setSpecificTitle('Boutique');
        }
      } else {
        this.titleService.setSpecificTitle('Boutique');
      }
    });

    // Utiliser une approche plus efficace pour charger les données de la page d'accueil
    this.homeService.searchHome().subscribe({
      next: (data) => {
        this.searchResults = data;
      },
      error: (error) => {
        console.error('Erreur lors de la récupération des données de la page d\'accueil:', error);
      }
    });
  }

  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
  }

  private fetchCategoryBanner(categoryId: number): void {
    this.menuService.getCategoryBanner(categoryId).subscribe({
      next: (response) => {
        if (response && response.hits && response.hits.length > 0) {
          const category = response.hits[0];

          // Check if category has a banner with URL directly in banner object
          if (category.banner && category.banner.url) {
            this.categoryBannerUrl = category.banner.url;
            this.showCategoryBanner = true;

          } else {
            this.showCategoryBanner = false;
            this.categoryBannerUrl = null;

          }
        } else {
          this.showCategoryBanner = false;
          this.categoryBannerUrl = null;

        }
      },
      error: (error) => {
        console.error('Error fetching category banner:', error);
        this.showCategoryBanner = false;
        this.categoryBannerUrl = null;
      }
    });
  }
  // for testing idOrigin redirect in console log  


  // Check if URL uses old idOrigin format and redirect if needed
  private checkForIdOriginRedirect(categoryId: number, fullSlug: string): void {
    // First, try to find a category with this ID directly (not idOrigin)
    this.menuService.getCategories().subscribe(categories => {
      const category = this.findCategoryById(categories, categoryId);

      if (category) {
        // Category found with direct ID, proceed normally
        this.categoryId = categoryId;
        // Apply SEO metadata from the API
        this.applySeoMetadata(category);
        this.fetchProducts(categoryId);
        this.fetchCategoryBanner(categoryId); // Fetch category banner
      } else {
        // No category with this ID found, check if it's an idOrigin
        this.menuService.getCategoryByIdOrigin(categoryId).subscribe(categoryWithIdOrigin => {
          if (categoryWithIdOrigin) {
            // This is an old URL with idOrigin, redirect to the new URL with current ID using 'tn' segment
            this.router.navigate(['/tn', categoryWithIdOrigin.link], { replaceUrl: true });
          } else {
            // Not found as idOrigin either, just proceed with the original ID
            this.categoryId = categoryId;
            this.fetchProducts(categoryId);
            this.fetchCategoryBanner(categoryId); // Fetch category banner
            // Try to set title from slug parts
            const categoryName = fullSlug.substring(fullSlug.indexOf('-') + 1);
            const formattedName = categoryName.charAt(0).toUpperCase() + categoryName.slice(1).replace(/-/g, ' ');
            this.titleService.setSpecificTitle(formattedName);
            // Set default SEO metadata
            this.seoService.updateDescription(`Découvrez notre collection ${formattedName} chez Barsha. Retrouvez les dernières tendances mode.`);
            this.seoService.updateKeywords(`${formattedName}, barsha, vêtements, collection, mode`);
            this.seoService.updateCanonicalUrl(window.location.href);
          }
        });
      }
    });
  }





  /**
   * Apply comprehensive SEO metadata from the category data
   * This enhances search engine visibility and understanding of category pages
   * @param category The category object containing metadata
   */
  private applySeoMetadata(category: Category): void {
    // Set page title from metaTitle or name with proper formatting
    const title = category.metaTitle || category.name;
    this.titleService.setSpecificTitle(title);

    // Generate a detailed description for the category
    let description = '';
    if (category.metaDescription) {
      // Use API-provided description if available
      description = category.metaDescription;
    } else {
      // Generate a detailed fallback description
      const categoryType = this.getCategoryType(category.name);
      description = `Découvrez notre collection ${category.name} ${categoryType} chez Barsha. Retrouvez les dernières tendances mode, des vêtements de qualité et un large choix de styles. Livraison disponible partout en Tunisie.`;
    }
    this.seoService.updateDescription(description);

    // Set comprehensive keywords
    if (category.keywords) {
      // Use API-provided keywords if available
      this.seoService.updateKeywords(category.keywords);
    } else {
      // Generate detailed fallback keywords
      const categoryType = this.getCategoryType(category.name);
      const keywords = [
        category.name,
        `${category.name} ${categoryType}`,
        `vêtements ${category.name}`,
        `mode ${category.name}`,
        `collection ${category.name}`,
        'barsha',
        'vêtements',
        'collection',
        'mode',
        'tunisie',
        'achat en ligne'
      ].join(', ');
      this.seoService.updateKeywords(keywords);
    }

    // Set canonical URL to ensure proper indexing
    const canonicalUrl = window.location.href;
    this.seoService.updateCanonicalUrl(canonicalUrl);

    // Add enhanced structured data for category
    this.addCategoryStructuredData(category);

    // Add category sitelinks for better search results display
    this.seoService.addCategorySitelinks(category);
  }

  /**
   * Helper method to determine category type based on name
   * @param categoryName The name of the category
   * @returns A string describing the category type
   */
  private getCategoryType(categoryName: string): string {
    const name = categoryName.toLowerCase();

    if (name.includes('femme') || name.includes('fille')) {
      return 'pour femme';
    } else if (name.includes('homme') || name.includes('garçon')) {
      return 'pour homme';
    } else if (name.includes('enfant')) {
      return 'pour enfant';
    } else if (name.includes('accessoire')) {
      return 'et accessoires';
    }

    return '';
  }

  /**
   * Add enhanced structured data for category pages
   * This improves search engine understanding of the category content
   * @param category The category object
   */
  private addCategoryStructuredData(category: Category): void {
    // Get the number of products in this category (if available)
    const numberOfItems = this.produits?.length || 0;

    // Get the category type for better descriptions
    const categoryType = this.getCategoryType(category.name);

    // Create enhanced structured data with more detailed information
    const categoryData: any = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      'name': category.metaTitle || category.name,
      'description': category.metaDescription ||
        `Collection ${category.name} ${categoryType} chez Barsha. Découvrez notre sélection de vêtements et accessoires de qualité.`,
      'url': window.location.href,
      'provider': {
        '@type': 'Organization',
        'name': 'Barsha',
        'url': 'https://www.barsha.com.tn',
        'logo': 'https://www.barsha.com.tn/assets/images/logo.png'
      },
      // Add breadcrumb information for better navigation understanding
      'breadcrumb': {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Accueil',
            'item': 'https://www.barsha.com.tn'
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': category.name,
            'item': window.location.href
          }
        ]
      }
    };

    // Add information about number of items if available
    if (numberOfItems > 0) {
      categoryData.numberOfItems = numberOfItems;
    }

    // Add the structured data to the page
    this.seoService.addStructuredData(categoryData);
  }

  // Helper method to find a category by ID
  private findCategoryById(categories: any[], id: number): any {
    for (const category of categories) {
      if (category.id === id) {
        return category;
      }

      if (category.subCategories && category.subCategories.length > 0) {
        const found = this.findCategoryById(category.subCategories, id);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  fetchProducts(categoryId: number): void {
    this.isLoading = true;
    this.currentOffset = 0; // Reset offset for new category
    this.hasMoreProducts = true;
    this.produits = []; // Clear existing products
    this.isUsingFilters = false; // Reset filter flag when loading category products

    // Récupérer les produits de la catégorie avec pagination
    this.productService.getProductsByCategory(categoryId, this.limit, this.currentOffset).subscribe({
      next: (data) => {
        this.produits = this.mapApiDataToProducts(data.hits);
        this.originalProduits = [...this.produits];
        this.totalProducts = data.estimatedTotalHits || data.hits.length;

        // Check if there are more products to load
        this.hasMoreProducts = this.produits.length >= this.limit && this.produits.length < this.totalProducts;
        this.currentOffset += this.limit;

        // Vérifier si l'utilisateur est connecté
        const token = localStorage.getItem('jwt');

        if (token) {
          // Récupérer la wishlist si l'utilisateur est connecté
          this.productService.getWishlist().subscribe({
            next: (wishlistResponse) => {
              const wishlistProductIds = wishlistResponse.data.map((product) => product.id);

              // Mettre à jour l'état isInWishlist pour chaque produit
              this.produits.forEach((produit) => {
                produit.isInWishlist = wishlistProductIds.includes(produit.id);
              });

              this.fetchStockForProducts();
              this.isLoading = false;

              // Restaurer la position de défilement après le chargement complet
              this.restoreScrollPositionAfterLoad();
            },
            error: (error) => {
              console.error('Erreur lors de la récupération de la wishlist:', error);
              this.isLoading = false;
              this.restoreScrollPositionAfterLoad();
            }
          });
        } else {
          // Si l'utilisateur n'est pas connecté, ne pas récupérer la wishlist
          this.fetchStockForProducts();
          this.isLoading = false;
          this.restoreScrollPositionAfterLoad();
        }
      },
      error: (error) => {
        console.error('Erreur lors de la récupération des produits:', error);
        this.isLoading = false;
        this.restoreScrollPositionAfterLoad();
      }
    });
  }

  private loadMoreProducts(): void {
    if (!this.categoryId || this.isLoadingMore || !this.hasMoreProducts) {
      return;
    }

    this.isLoadingMore = true;

    this.productService.getProductsByCategory(this.categoryId, this.limit, this.currentOffset).subscribe({
      next: (data) => {
        const newProducts = this.mapApiDataToProducts(data.hits);

        // Update total products from API response
        this.totalProducts = data.estimatedTotalHits || this.totalProducts;

        // Check if there are more products to load
        this.hasMoreProducts = (this.produits.length + newProducts.length) < this.totalProducts;
        this.currentOffset += this.limit;

        // Append new products to existing ones
        this.produits = [...this.produits, ...newProducts];

        // Check wishlist status for new products
        const token = localStorage.getItem('jwt');
        if (token) {
          this.productService.getWishlist().subscribe({
            next: (wishlistResponse) => {
              const wishlistProductIds = wishlistResponse.data.map((product) => product.id);
              newProducts.forEach((produit) => {
                produit.isInWishlist = wishlistProductIds.includes(produit.id);
              });
              this.fetchStockForNewProducts(newProducts);
              this.isLoadingMore = false;
            },
            error: (error) => {
              console.error('Erreur lors de la récupération de la wishlist:', error);
              this.fetchStockForNewProducts(newProducts);
              this.isLoadingMore = false;
            }
          });
        } else {
          this.fetchStockForNewProducts(newProducts);
          this.isLoadingMore = false;
        }
      },
      error: (error) => {
        console.error('Erreur lors du chargement de plus de produits:', error);
        this.isLoadingMore = false;
      }
    });
  }

  private fetchStockForNewProducts(newProducts: Product[]): void {
    // No longer automatically fetch stock for products on load
    // Stock will be fetched only when user selects a color
    console.log(`Skipping automatic stock fetch for ${newProducts.length} products. Stock will be loaded when colors are selected.`);
  }

  /**
   * Check if there are active filters applied
   */
  hasActiveFilters(): boolean {
    return this.isUsingFilters;
  }

  /**
   * Load more filtered products for infinite scrolling
   */
  loadMoreFilteredProducts(): void {
    if (!this.categoryId || this.isLoadingMore || !this.hasMoreProducts) {
      return;
    }

    this.isLoadingMore = true;

    // Convertir les filtres sélectionnés au format attendu par l'API
    const filterParams: ProductFilterParams = {
      idCategory: this.categoryId,
      limit: this.limit,
      offset: this.currentOffset,
    };

    // Ajouter les couleurs sélectionnées si présentes
    if (this.selectedFilters.couleur && this.selectedFilters.couleur.length > 0) {
      filterParams.colors = this.selectedFilters.couleur.map(color =>
        color.toUpperCase()
      );
    }

    // Ajouter les tailles sélectionnées si présentes
    if (this.selectedFilters.taille && this.selectedFilters.taille.length > 0) {
      filterParams.sizes = this.selectedFilters.taille;
    }

    // Ajouter le tri par prix si sélectionné
    if (this.selectedFilters.ordre) {
      filterParams.sortPrice = this.selectedFilters.ordre === 'croissant' ? 'asc' : 'desc';
    }

    // Ajouter le prix minimum et maximum si définis
    if (this.selectedFilters.prix && this.selectedFilters.prix > 0) {
      filterParams.maxPrice = this.selectedFilters.prix;
    }

    if (this.selectedFilters.minPrix !== undefined) {
      filterParams.minPrice = this.selectedFilters.minPrix;
    }

    // Appeler l'API pour récupérer plus de produits filtrés
    this.filterService.fetchProductsByFilters(filterParams).subscribe({
      next: (response: any) => {
        const newProducts = this.mapApiDataToProducts(response.data);

        // Update total products from API response
        this.totalProducts = response.total || this.totalProducts;

        // Check if there are more products to load
        this.hasMoreProducts = (this.produits.length + newProducts.length) < this.totalProducts;
        this.currentOffset += this.limit;

        // Append new products to existing ones
        this.produits = [...this.produits, ...newProducts];

        // Récupérer les informations de stock pour les nouveaux produits
        this.fetchStockForNewProducts(newProducts);

        this.isLoadingMore = false;
      },
      error: (error: any) => {
        console.error('Error loading more filtered products:', error);
        this.isLoadingMore = false;
      }
    });
  }

  fetchStockForProducts(): void {
    // No longer automatically fetch stock for products on load
    // Stock will be fetched only when user selects a color
    console.log(`Skipping automatic stock fetch for ${this.produits.length} products. Stock will be loaded when colors are selected.`);
  }

  private mapApiDataToProducts(apiData: any[]): Product[] {
    return apiData.map((item) => {
      // Ensure declinaisons is an array
      const declinaisons = item.declinaisons || [];

      // Map colors with proper fallbacks
      const colors = declinaisons.map((d: any) => ({
        name: d.libellet || '',
        textureImage: d.texture?.url || '',
        mainImage: d.images?.[0]?.url || '',
      }));

      // If no colors were mapped, add a default color
      if (colors.length === 0) {
        colors.push({
          name: 'Default',
          textureImage: '',
          mainImage: '',
        });
      }

      return {
        sku: item.sku || '',
        title: item.title || '',
        id: item.id,
        idOrigin: item.idOrigin,
        price: item.price || 0,
        currentPrice: item.currentPrice || 0,
        discount: item.discount || false,
        discountValue: item.discountValue || 0,
        imageInterval: item.imageInterval,
        Persona: item.Persona || 'unknown',
        activeImageIndex: 0,
        complements: item.complements || [],
        declinaisons: declinaisons,
        categories: item.categories || [],
        Famille: item.Famille || '',
        Ligne: item.Ligne || '',
        tailles: [],  // No sizes displayed by default
        colors: colors,
        selectedColorIndex: -1,  // No color selected by default
        isInWishlist: false,
        articlesSimilaires: [],
        firstImg: item.firstImg || { url: '' },
        secondImg: item.secondImg || { url: '' }
      };
    });
  }

  changeActiveImage(produit: Product): void {
    // Only start image rotation if a color is selected and has multiple images
    if (produit.selectedColorIndex >= 0) {
      const images = produit.declinaisons[produit.selectedColorIndex]?.images;
      if (images && images.length > 1) {
        produit.imageInterval = setInterval(() => {
          produit.activeImageIndex = (produit.activeImageIndex + 1) % images.length;
          produit.colors[produit.selectedColorIndex].mainImage = images[produit.activeImageIndex].url;
        }, 1500);
      }
    }
  }

  resetActiveImage(produit: Product): void {
    // Arrêter l'intervalle
    if (produit.imageInterval) {
      clearInterval(produit.imageInterval);
      produit.imageInterval = null;
    }

    produit.activeImageIndex = 0;
    // Only reset to first image if a color is selected
    if (produit.selectedColorIndex >= 0) {
      produit.colors[produit.selectedColorIndex].mainImage =
        produit.declinaisons[produit.selectedColorIndex].images[0]?.url || produit.colors[produit.selectedColorIndex].mainImage;
    }
  }

  generateSimilarArticles(product: any): any[] {
    return [
      {
        image: product.secondImg?.url || product.firstImg.url,
        nom: `${product.title} Similaire`,
        prix: `${(product.price * 0.9).toFixed(3)} TND`,
        isInWishlist: false,
      },
    ];
  }

  selectColor(produit: Product, index: number) {
    produit.selectedColorIndex = index;

    // Reset active image when selecting a new color
    this.resetActiveImage(produit);

    // Update the main image for the selected color with the first image from declinaison
    if (produit.declinaisons[index]?.images && produit.declinaisons[index].images.length > 0) {
      produit.colors[index].mainImage = produit.declinaisons[index].images[0].url;
    }

    const productId = produit.id;
    const selectedColor = produit.declinaisons[index]?.libellet || produit.colors[index]?.name;
    if (productId) {
      this.productService.getDeclinaisonStock(productId).subscribe({
        next: (stockData) => {
          const sizesForColor = this.productService.extractSizesForColor(stockData, selectedColor);
          produit.tailles = sizesForColor.map((item: any) => ({
            size: item.size,
            qte: item.qte,
            ean13: item.ean13 || '',
          }));
        },
        error: (error) => {
          console.error(`Erreur lors de la récupération du stock pour ${produit.title}`, error);
          produit.tailles = [];
        }
      });
    } else {
      // Clear sizes if no valid declinaison
      produit.tailles = [];
    }
  }

  isInStock(produit: Product, taille: string): boolean {
    const sizeObj = produit.tailles.find((t) => t.size === taille);
    return sizeObj ? sizeObj.qte > 0 : false;
  }

  toggleWishlist(produit: Product) {
    produit.isInWishlist = !produit.isInWishlist;

    if (produit.isInWishlist) {
      this.productService.addToWishList(produit.id).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Produit ajouté à la liste de souhaits',
            detail: 'Veuillez vérifier votre liste de souhaits',
            life: 3000,
          });
        },
        error: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Veuillez vous connecter',
            detail: 'Veuillez vous connecter pour ajouter un produit à votre liste de souhaits',
            life: 3000,
          });
          produit.isInWishlist = !produit.isInWishlist;
        }
      });
    } else {
      this.productService.removeFromWishList(produit.id).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Produit supprimé de la liste de souhaits',
            life: 3000,
          });
        },
        error: (error) => {
          console.error('Erreur lors de la suppression du produit de la liste de souhaits:', error);
          produit.isInWishlist = !produit.isInWishlist;
        }
      });
    }
  }

  /**
   * Get product detail URL for right-click functionality
   * @param product Product to get URL for
   * @returns Product detail URL string
   */
  getProductDetailUrl(product: Product): string {
    if (!product || !product.id) {
      return '/produit/0-produit';
    }

    // Use the ProductService to generate the correct slug format (ID-name)
    const slug = this.productService.generateProductSlug(product);
    return `/produit/${slug}`;
  }

  /**
   * Handle product click to save scroll position before navigation
   */
  onProductClick(): void {
    // Save current scroll position before navigation
    const currentScrollPosition = window.scrollY;
    this.scrollPositionService.savePositionBeforeProductNavigation();
  }

  /**
   * Debug method to check scroll positions (temporary for testing)
   */
  debugScrollPositions(): void {
    this.scrollPositionService.debugScrollPositions();
  }

  /**
   * Restore scroll position after all data has been loaded
   */
  private restoreScrollPositionAfterLoad(): void {
    // Wait for all data to be loaded and DOM to be fully rendered
    setTimeout(() => {
      const currentUrl = this.router.url;

      // Force scroll position restoration with multiple attempts
      const attempts = [200, 500, 800, 1000];

      attempts.forEach(delay => {
        setTimeout(() => {
          this.scrollPositionService.forceRestorePosition(currentUrl);
        }, delay);
      });
    }, 200);
  }

  changeViewMode(mode: 'single' | 'double' | 'triple' | 'grid') {
    this.currentViewMode = mode;
  }

  selectFilter(index: number) {
    this.selectedFilterIndex = index;
  }

  // Implement AfterViewInit lifecycle hook
  ngAfterViewInit() {
    // Check if we need to show scroll arrows after view is initialized
    setTimeout(() => {
      // Adjust button widths to ensure exactly 5 items are visible
      this.adjustButtonWidths();

      // Check arrow visibility
      this.checkArrowsVisibility();

      // Show right arrow by default if there are more than 5 items
      if (this.filters.length > 5) {
        this.showRightArrow = true;
      }
    }, 0);
  }

  // Adjust button widths to ensure exactly 5 items on desktop and 2 on mobile
  private adjustButtonWidths() {
    if (!this.filterButtonsScroll) return;

    const scrollElement = this.filterButtonsScroll.nativeElement;
    const containerWidth = scrollElement.clientWidth;
    const buttonElements = scrollElement.querySelectorAll('.filter-button');

    if (buttonElements.length === 0) return;

    // Determine if we're on mobile (screen width < 576px)
    const isMobile = window.innerWidth < 576;

    // Calculate optimal width for buttons
    // 2 items on mobile, 5 items on desktop
    const itemsToShow = isMobile ? 2 : 5;
    const optimalWidth = Math.floor((containerWidth / itemsToShow) - 12); // 12px for margins

    // Apply width to all buttons
    buttonElements.forEach((button: HTMLElement) => {
      button.style.width = `${optimalWidth}px`;
      button.style.minWidth = `${optimalWidth}px`;
    });
  }

  // Calculate item width to ensure correct number of items are visible
  private calculateItemWidth(): number {
    if (!this.filterButtonsScroll) return 0;

    const containerWidth = this.filterButtonsScroll.nativeElement.clientWidth;
    // Determine if we're on mobile (screen width < 576px)
    const isMobile = window.innerWidth < 576;

    // Calculate width for each item (2 items on mobile, 5 on desktop + some margin)
    const itemsToShow = isMobile ? 2.2 : 5.2; // .2 to account for margins
    return containerWidth / itemsToShow;
  }

  // Check if scroll arrows should be visible
  checkArrowsVisibility() {
    if (!this.filterButtonsScroll) return;

    const scrollElement = this.filterButtonsScroll.nativeElement;

    // Show left arrow if scrolled to the right
    this.showLeftArrow = scrollElement.scrollLeft > 10; // Small threshold to avoid flickering

    // Show right arrow if there's more content to scroll to
    this.showRightArrow =
      scrollElement.scrollWidth > scrollElement.clientWidth &&
      scrollElement.scrollLeft < (scrollElement.scrollWidth - scrollElement.clientWidth - 10); // Small threshold
  }

  // Handle scrolling when arrows are clicked
  scrollFilters(direction: 'left' | 'right') {
    if (!this.filterButtonsScroll) return;

    const scrollElement = this.filterButtonsScroll.nativeElement;
    // Scroll by exactly one item width to ensure smooth navigation
    const itemWidth = this.calculateItemWidth();
    const scrollAmount = itemWidth * (direction === 'left' ? -1 : 1);

    scrollElement.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    });

    // Update arrow visibility after scrolling
    setTimeout(() => {
      this.checkArrowsVisibility();
    }, 300); // Wait for smooth scroll to complete
  }

  toggleFilterPopup() {
    this.showFilterPopup = !this.showFilterPopup;
  }

  toggleFilter(type: 'taille' | 'couleur', value: string) {
    const index = this.selectedFilters[type].indexOf(value);
    if (index === -1) {
      this.selectedFilters[type].push(value);
    } else {
      this.selectedFilters[type].splice(index, 1);
    }
  }

  updatePriceFilter(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.selectedFilters.prix = Number(target.value);
  }

  toggleOrder(ordre: 'croissant' | 'décroissant') {
    this.selectedFilters.ordre = ordre;
  }

  setActivePopup(product: Product) {
    this.activePopupProduct = product;
    this.isBlurred = true;
  }

  clearActivePopup() {
    this.activePopupProduct = null;
    this.isBlurred = false;
  }

  handleFilterPopupToggle(isOpen: boolean): void {
    this.showFilterPopup = isOpen;
  }

  handleFiltersChanged(filters: SelectedFilters): void {
    // Store filters locally without triggering API calls
    // API calls are now only triggered when "Voir" button is clicked
    this.selectedFilters = filters;
    this.applyFilters();
  }

  applyFilters(): void {
    if (!this.categoryId) {
      console.error('Category ID is required to apply filters');
      return;
    }

    this.isLoading = true;
    // Reset pagination when applying filters
    this.currentOffset = 0;
    this.hasMoreProducts = true;
    this.produits = [];
    this.isUsingFilters = true; // Set flag to indicate filters are being used

    // Convertir les filtres sélectionnés au format attendu par l'API
    const filterParams: ProductFilterParams = {
      idCategory: this.categoryId,
      limit: this.limit, // Use the same limit as pagination
      offset: this.currentOffset,
    };

    // Ajouter les couleurs sélectionnées si présentes
    if (this.selectedFilters.couleur && this.selectedFilters.couleur.length > 0) {
      // Convertir les noms de couleurs formatés en majuscules comme attendu par l'API
      filterParams.colors = this.selectedFilters.couleur.map(color =>
        color.toUpperCase()
      );
    }

    // Ajouter les tailles sélectionnées si présentes
    if (this.selectedFilters.taille && this.selectedFilters.taille.length > 0) {
      filterParams.sizes = this.selectedFilters.taille;
    }

    // Ajouter le tri par prix si sélectionné
    if (this.selectedFilters.ordre) {
      filterParams.sortPrice = this.selectedFilters.ordre === 'croissant' ? 'asc' : 'desc';
    }

    // Ajouter le prix minimum et maximum si définis
    if (this.selectedFilters.prix && this.selectedFilters.prix > 0) {
      // Utiliser la valeur du prix comme maxPrice
      filterParams.maxPrice = this.selectedFilters.prix;
    }

    // Ajouter le prix minimum s'il est défini
    if (this.selectedFilters.minPrix !== undefined) {
      filterParams.minPrice = this.selectedFilters.minPrix;
    }

    // Appeler l'API pour récupérer les produits filtrés
    this.filterService.fetchProductsByFilters(filterParams).subscribe({
      next: (response: any) => {
        // Mettre à jour les produits avec les résultats filtrés
        this.produits = this.mapApiDataToProducts(response.data);

        // Use the total from API response to determine if there are more products
        this.totalProducts = response.total || 0;

        // Check if there are more products to load
        this.hasMoreProducts = this.produits.length < this.totalProducts;
        this.currentOffset += this.limit;

        // Mettre à jour le nombre de produits filtrés
        this.filteredProductsCount = this.produits.length;

        // Récupérer les informations de stock pour les produits filtrés
        this.fetchStockForProducts();

        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error applying filters:', error);
        this.isLoading = false;

        // En cas d'erreur, conserver les produits actuels
        this.filteredProductsCount = this.produits.length;
      }
    });
  }

  /**
   * Add product to comparison
   */
  addToComparison(produit: Product, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const productData = {
      id: produit.id,
      title: produit.title,
      price: produit.price,
      currentPrice: produit.currentPrice,
      discount: produit.discount,
      discountValue: produit.discountValue,
      image: produit.selectedColorIndex >= 0 && produit.colors[produit.selectedColorIndex]?.mainImage
        ? produit.colors[produit.selectedColorIndex].mainImage
        : (produit.firstImg?.url || produit.declinaisons?.[0]?.images?.[0]?.url || ''),
      Famille: produit.Famille,
      sizes: produit.tailles?.map(t => t.size) || [],
      colors: produit.colors?.map(c => c.name) || [],
      inStock: produit.tailles?.some(t => t.qte > 0) ?? true,
      sku: produit.sku
    };

    const added = this.comparisonService.addToComparisonFromCard(productData);

    if (added) {
      this.messageService.add({
        severity: 'success',
        summary: 'Comparaison',
        detail: 'Produit ajoute a la comparaison',
        life: 3000
      });
    }
  }

  /**
   * Check if product is in comparison
   */
  isInComparison(productId: number): boolean {
    return this.comparisonService.isInComparison(productId);
  }

  /**
   * Remove product from comparison
   */
  removeFromComparison(productId: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.comparisonService.removeFromComparison(productId);
  }

  /**
   * Opens the quick view modal for a product
   * @param produit The product to preview
   * @param event The click event
   */
  openQuickView(produit: Product, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.quickViewService.openQuickViewWithProduct(produit);
  }
}
