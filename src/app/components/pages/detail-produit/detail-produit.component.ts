import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CarouselModule } from 'primeng/carousel';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Product } from '../../../models/Product';
import { ProductService } from '../../../services/product.service';
import { CartService, CartItem } from '../../../services/cart.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { SeoService } from '../../../services/seo.service';
import { TitleService } from '../../../services/title.service';
import { ScrollPositionService } from '../../../services/scroll-position.service';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AnalyticsService } from '../../../services/analytics.service';


interface CartItemm {
  image: string;
  price: string;
  couleur: string;
  total: string;
  ref: string;
  nom: string;
}

interface Produit {
  id?: number;
  image: string;
  nom: string;
  prix: string;
  isInWishlist: boolean;
  colors?: string[];
}

@Component({
  selector: 'app-detail-produit',
  standalone: true,
  imports: [FormsModule, CommonModule, CarouselModule, RouterModule, ToastModule],
  templateUrl: './detail-produit.component.html',
  styleUrls: ['./detail-produit.component.scss'],
  providers: [MessageService, AnalyticsService],
})
export class DetailProduitComponent implements OnInit {
  product!: Product;
  productMeta: any = null;
  categoryId!: number;
  isBlurred: boolean = false;
  showDetails: boolean = false;
  showComposition: boolean = false;
  showRetours: boolean = false;
  showSizeTable: boolean = false;
  selectedSize: string | null = null;
  selectedColor: string | null = null;
  selectedColorIndex: number = 0;
  activeThumbnail: number = 0;
  isLoading: boolean = true;
  showCartPopup: boolean = false;
  quantity: number = 1;
  cartItem: CartItemm = this.initializeCartItem();
  totalPrice: string = '65.900';
  images: string[] = [];
  produits: Produit[] = []; // Will be populated with total look products
  totalLookLoading: boolean = true;
  produitss: Produit[] = [];
  isInWishlist: boolean = false; // Track if the main product is in the wishlist
  visibleRelatedProducts: Produit[] = [];
  relatedProductsStartIndex: number = 0;
  relatedProductsPerPage: number = 4;
  zoomLevel: number = 1;
  isZoomed: boolean = false;
  lastClickTime: number = 0;
  zoomTimeout: any;
  isDragging: boolean = false;
  translateX: number = 0;
  translateY: number = 0;
  startX: number = 0;
  startY: number = 0;
  lastX: number = 0;
  lastY: number = 0;
  showFullScreenImage: boolean = false;
  fullScreenImageSrc: string = '';
  // Mobile zoom properties
  mobileZoomLevel: number = 1;
  mobileIsZoomed: boolean = false;
  mobileIsDragging: boolean = false;
  mobileTranslateX: number = 0;
  mobileTranslateY: number = 0;
  mobileStartX: number = 0;
  mobileStartY: number = 0;
  mobileLastX: number = 0;
  mobileLastY: number = 0;
  mobileInitialDistance: number = 0;
  mobileCurrentDistance: number = 0;
  mobileIsPinching: boolean = false;
  mobileTouchStartTime: number = 0;
  mobileDoubleTapTimeout: any;

  // Fullscreen image interactions
  fsZoomLevel: number = 1;
  fsIsZoomed: boolean = false;
  fsIsDragging: boolean = false;
  fsTranslateX: number = 0;
  fsTranslateY: number = 0;
  fsStartX: number = 0;
  fsStartY: number = 0;
  fsLastX: number = 0;
  fsLastY: number = 0;

  // Responsive breakpoints
  private mobileBreakpoint: number = 576; // Breakpoint for mobile view (xs)
  private tabletBreakpoint: number = 768; // Breakpoint for tablet view (sm)
  private smallMobileBreakpoint: number = 480; // Breakpoint for small mobile
  private lastScreenWidth: number = window.innerWidth;

  @ViewChild('totalLookItems') totalLookItemsRef!: ElementRef;
  @ViewChild('fullscreenContainer') fullscreenContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('fullscreenImage') fullscreenImageRef!: ElementRef<HTMLImageElement>;
  handleImageClick(event: MouseEvent): void {
    const currentTime = new Date().getTime();

    // Set the full screen image source
    this.fullScreenImageSrc = this.images[this.activeThumbnail];

    if (currentTime - this.lastClickTime < 300) { // Double click detected
      if (this.isZoomed) {
        this.zoomLevel = 1;
        this.isZoomed = false;
        this.translateX = 0;
        this.translateY = 0;
        document.body.style.cursor = 'default';
      } else {
        this.zoomLevel = 2;
        this.isZoomed = true;
        document.body.style.cursor = 'grab';
      }
    } else {
      // Single click - show full screen image
      this.showFullScreenImage = true;
    }
    this.lastClickTime = currentTime;
  }

  closeFullScreenImage(): void {
    this.showFullScreenImage = false;
    // Reset fullscreen interaction state
    this.fsZoomLevel = 1;
    this.fsIsZoomed = false;
    this.fsIsDragging = false;
    this.fsTranslateX = 0;
    this.fsTranslateY = 0;
    this.fsStartX = 0;
    this.fsStartY = 0;
    this.fsLastX = 0;
    this.fsLastY = 0;
  }

  // Toggle zoom on double click in fullscreen
  toggleFullscreenZoom(event: MouseEvent): void {
    event.preventDefault();
    if (this.fsIsZoomed) {
      // Reset zoom
      this.fsZoomLevel = 1;
      this.fsIsZoomed = false;
      this.fsTranslateX = 0;
      this.fsTranslateY = 0;
    } else {
      // Zoom in - allow higher zoom levels for better exploration
      this.fsZoomLevel = 2.5; // Increased zoom level for better detail
      this.fsIsZoomed = true;
      // Reset position to center
      this.fsTranslateX = 0;
      this.fsTranslateY = 0;
      this.clampFullscreenTranslation();
    }
  }

  startFullscreenDrag(event: MouseEvent): void {
    if (!this.fsIsZoomed) return;
    event.preventDefault();
    this.fsIsDragging = true;
    this.fsStartX = event.clientX;
    this.fsStartY = event.clientY;
    this.fsLastX = this.fsTranslateX;
    this.fsLastY = this.fsTranslateY;
  }

  onFullscreenDrag(event: MouseEvent): void {
    if (!this.fsIsDragging || !this.fsIsZoomed) return;
    event.preventDefault();
    const deltaX = event.clientX - this.fsStartX;
    const deltaY = event.clientY - this.fsStartY;

    // Calculate new position with better movement sensitivity
    this.fsTranslateX = this.fsLastX + (deltaX / this.fsZoomLevel);
    this.fsTranslateY = this.fsLastY + (deltaY / this.fsZoomLevel);

    // Apply boundaries to prevent image from going too far
    this.clampFullscreenTranslation();
  }

  stopFullscreenDrag(): void {
    if (!this.fsIsDragging) return;
    this.fsIsDragging = false;
    this.clampFullscreenTranslation();
  }

  // Ensure panning stays within bounds based on container and scaled image size
  private clampFullscreenTranslation(): void {
    const container = this.fullscreenContainerRef?.nativeElement;
    const imgEl = this.fullscreenImageRef?.nativeElement;
    if (!container || !imgEl) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const baseWidth = imgEl.clientWidth; // pre-transform size
    const baseHeight = imgEl.clientHeight; // pre-transform size

    const scaledWidth = baseWidth * this.fsZoomLevel;
    const scaledHeight = baseHeight * this.fsZoomLevel;

    // Calculate maximum offsets to ensure the entire image can be viewed
    // Allow the image to be moved so that all parts are visible
    const maxOffsetX = Math.max(0, (scaledWidth - containerWidth) / this.fsZoomLevel);
    const maxOffsetY = Math.max(0, (scaledHeight - containerHeight) / this.fsZoomLevel);

    // Clamp with better boundaries - allow full image exploration
    // Add some padding to prevent the image from being cut off at edges
    if (this.fsTranslateX > maxOffsetX) this.fsTranslateX = maxOffsetX;
    if (this.fsTranslateX < -maxOffsetX) this.fsTranslateX = -maxOffsetX;
    if (this.fsTranslateY > maxOffsetY) this.fsTranslateY = maxOffsetY;
    if (this.fsTranslateY < -maxOffsetY) this.fsTranslateY = -maxOffsetY;
  }

  // Add wheel zoom support for better user experience
  @HostListener('wheel', ['$event'])
  onWheel(event: WheelEvent): void {
    if (!this.showFullScreenImage || !this.fsIsZoomed) return;

    event.preventDefault();
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(1, Math.min(4, this.fsZoomLevel * zoomFactor));

    if (newZoom !== this.fsZoomLevel) {
      this.fsZoomLevel = newZoom;
      this.clampFullscreenTranslation();
    }
  }
  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private cartService: CartService,
    private router: Router,
    private messageService: MessageService,
    private seoService: SeoService,
    private titleService: TitleService,
    private scrollPositionService: ScrollPositionService
  ) { }

  ngOnInit(): void {
    this.loadProduct();

    // Initialize mobile zoom functionality
    this.initMobileZoom();

    // Add SEO optimization when product data is loaded
    this.route.paramMap.subscribe(params => {
      const productId = params.get('productId');
      if (productId && productId !== 'null') {
        const numericId = Number(productId);
        this.productService.getProductById(numericId).subscribe({
          next: (productData) => {
            // Product data is already loaded in loadProduct()

            // SEO optimization
            if (this.product) {
              // Le titre est déjà défini dans loadProduct avec le genre
              // Il n'est pas nécessaire de le redéfinir ici

              // Update SEO information after meta info is loaded
              this.seoService.updateDescription(this.getDescription());

              // Use keywords from meta info if available, otherwise fallback to default keywords
              const keywords = this.productMeta?.keywords ||
                `${this.product.title || ''}, barsha, mode, vêtements`;
              this.seoService.updateKeywords(keywords);

              // Canonical URL is now set in fetchProductById or loadProduct methods

              // Add structured data for product
              this.addProductStructuredData();
            }
          }
        });
      }
    });

    // Initialize visible related products
    this.updateVisibleRelatedProducts();
  }

  /**
   * Updates the visible related products based on the current start index
   */
  private updateVisibleRelatedProducts(): void {
    // Make sure we don't go out of bounds
    if (this.relatedProductsStartIndex < 0) {
      this.relatedProductsStartIndex = 0;
    }

    if (this.relatedProductsStartIndex > this.produitss.length - this.relatedProductsPerPage) {
      this.relatedProductsStartIndex = Math.max(0, this.produitss.length - this.relatedProductsPerPage);
    }

    // Get the products to display
    this.visibleRelatedProducts = this.produitss.slice(
      this.relatedProductsStartIndex,
      this.relatedProductsStartIndex + this.relatedProductsPerPage
    );
  }

  /**
   * Navigate to previous related products
   */
  prevRelatedProduct(): void {
    if (this.relatedProductsStartIndex > 0) {
      this.relatedProductsStartIndex -= 1;
      this.updateVisibleRelatedProducts();
    }
  }

  /**
   * Navigate to next related products
   */
  nextRelatedProduct(): void {
    if (this.relatedProductsStartIndex < this.produitss.length - this.relatedProductsPerPage) {
      this.relatedProductsStartIndex += 1;
      this.updateVisibleRelatedProducts();
    }
  }

  /**
   * Check if the current view is mobile
   * @returns true if the screen width is less than the mobile breakpoint
   */
  isMobileView(): boolean {
    return window.innerWidth < this.mobileBreakpoint;
  }

  /**
   * Check if the current view is small mobile
   * @returns true if the screen width is less than the small mobile breakpoint
   */
  isSmallMobileView(): boolean {
    return window.innerWidth < this.smallMobileBreakpoint;
  }

  /**
   * Check if the current view is tablet
   * @returns true if the screen width is between mobile and desktop breakpoints
   */
  isTabletView(): boolean {
    return window.innerWidth >= this.mobileBreakpoint && window.innerWidth < this.tabletBreakpoint;
  }

  /**
   * Handle mobile image click for zoom functionality
   */
  handleMobileImageClick(event: TouchEvent | PointerEvent | MouseEvent): void {
    const currentTime = new Date().getTime();

    if (currentTime - this.mobileTouchStartTime < 300) { // Double tap detected
      this.toggleMobileZoom();
    } else {
      // Single tap - prepare for potential double tap
      this.mobileTouchStartTime = currentTime;

      // Clear any existing timeout
      if (this.mobileDoubleTapTimeout) {
        clearTimeout(this.mobileDoubleTapTimeout);
      }

      // Set timeout for single tap action (show fullscreen after delay)
      this.mobileDoubleTapTimeout = setTimeout(() => {
        this.showMobileFullScreen();
      }, 300);
    }
  }

  /**
   * Toggle mobile zoom
   */
  toggleMobileZoom(): void {
    if (this.mobileIsZoomed) {
      this.resetMobileZoom();
    } else {
      this.zoomMobileImage();
    }
  }

  /**
   * Zoom mobile image
   */
  zoomMobileImage(): void {
    this.mobileZoomLevel = 2.5;
    this.mobileIsZoomed = true;
    this.mobileTranslateX = 0;
    this.mobileTranslateY = 0;
    this.clampMobileTranslation();
  }

  /**
   * Reset mobile zoom
   */
  resetMobileZoom(): void {
    this.mobileZoomLevel = 1;
    this.mobileIsZoomed = false;
    this.mobileTranslateX = 0;
    this.mobileTranslateY = 0;
  }

  /**
   * Show mobile fullscreen image
   */
  showMobileFullScreen(): void {
    this.fullScreenImageSrc = this.images[this.activeThumbnail];
    this.showFullScreenImage = true;
    // Reset mobile zoom state
    this.resetMobileZoom();
  }

  /**
   * Handle mobile touch start
   */
  onMobileTouchStart(event: TouchEvent): void {
    if (!this.mobileIsZoomed) return;

    event.preventDefault();
    this.mobileIsDragging = true;

    if (event.touches.length === 1) {
      // Single touch - dragging
      const touch = event.touches[0];
      this.mobileStartX = touch.clientX;
      this.mobileStartY = touch.clientY;
      this.mobileLastX = this.mobileTranslateX;
      this.mobileLastY = this.mobileTranslateY;
    } else if (event.touches.length === 2) {
      // Two touches - pinching
      this.mobileIsPinching = true;
      this.mobileInitialDistance = this.getTouchDistance(event.touches[0], event.touches[1]);
    }
  }

  /**
   * Handle mobile touch move
   */
  onMobileTouchMove(event: TouchEvent): void {
    if (!this.mobileIsDragging || !this.mobileIsZoomed) return;

    event.preventDefault();

    if (event.touches.length === 1 && !this.mobileIsPinching) {
      // Single touch dragging
      const touch = event.touches[0];
      const deltaX = touch.clientX - this.mobileStartX;
      const deltaY = touch.clientY - this.mobileStartY;

      this.mobileTranslateX = this.mobileLastX + (deltaX / this.mobileZoomLevel);
      this.mobileTranslateY = this.mobileLastY + (deltaY / this.mobileZoomLevel);

      this.clampMobileTranslation();
    } else if (event.touches.length === 2 && this.mobileIsPinching) {
      // Pinch to zoom
      this.mobileCurrentDistance = this.getTouchDistance(event.touches[0], event.touches[1]);
      const scale = this.mobileCurrentDistance / this.mobileInitialDistance;

      const newZoom = Math.max(1, Math.min(4, this.mobileZoomLevel * scale));
      if (newZoom !== this.mobileZoomLevel) {
        this.mobileZoomLevel = newZoom;
        this.clampMobileTranslation();
      }
    }
  }

  /**
   * Handle mobile touch end
   */
  onMobileTouchEnd(event: TouchEvent): void {
    if (!this.mobileIsDragging) return;

    this.mobileIsDragging = false;
    this.mobileIsPinching = false;
    this.clampMobileTranslation();
  }

  /**
   * Calculate distance between two touch points
   */
  private getTouchDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Clamp mobile translation to prevent image from going out of bounds
   */
  private clampMobileTranslation(): void {
    const container = document.querySelector('.mobile-image-container');
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Calculate maximum offsets based on zoom level
    const maxOffsetX = Math.max(0, (containerWidth * this.mobileZoomLevel - containerWidth) / (2 * this.mobileZoomLevel));
    const maxOffsetY = Math.max(0, (containerHeight * this.mobileZoomLevel - containerHeight) / (2 * this.mobileZoomLevel));

    // Clamp translations
    this.mobileTranslateX = Math.max(-maxOffsetX, Math.min(maxOffsetX, this.mobileTranslateX));
    this.mobileTranslateY = Math.max(-maxOffsetY, Math.min(maxOffsetY, this.mobileTranslateY));
  }

  /**
   * Handle mobile wheel zoom (for devices with mouse wheel)
   */
  @HostListener('wheel', ['$event'])
  onMobileWheel(event: WheelEvent): void {
    if (!this.mobileIsZoomed || !this.isMobileView()) return;

    event.preventDefault();
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(1, Math.min(4, this.mobileZoomLevel * zoomFactor));

    if (newZoom !== this.mobileZoomLevel) {
      this.mobileZoomLevel = newZoom;
      this.clampMobileTranslation();
    }
  }

  /**
   * Enhanced mobile zoom with better touch handling
   */
  private enhanceMobileZoom(): void {
    // Add touch-action CSS property dynamically for better mobile experience
    const mobileImages = document.querySelectorAll('.mobile-product-image');
    mobileImages.forEach((img: Element) => {
      if (img instanceof HTMLElement) {
        img.style.touchAction = 'none';
      }
    });
  }

  /**
   * Initialize mobile zoom functionality
   */
  private initMobileZoom(): void {
    // Reset mobile zoom state
    this.resetMobileZoom();

    // Enhance touch handling
    this.enhanceMobileZoom();

    // Add resize listener for mobile
    if (this.isMobileView()) {
      this.onResize();
    }
  }
  /**
   * Listen for window resize events to update the view
   */
  @HostListener('window:resize')
  onResize(): void {
    // If we're not in mobile view, make sure visible products are updated
    if (!this.isMobileView()) {
      this.updateVisibleRelatedProducts();
    }

    // Handle mobile zoom reset on orientation change or resize
    if (this.isMobileView() && this.mobileIsZoomed) {
      // Reset zoom if screen size changes significantly
      const currentWidth = window.innerWidth;
      if (Math.abs(currentWidth - this.lastScreenWidth) > 50) {
        this.resetMobileZoom();
        this.lastScreenWidth = currentWidth;
      }
    }

    // Reinitialize mobile zoom for better touch handling
    if (this.isMobileView()) {
      this.enhanceMobileZoom();
    }
  }

  /**
   * Generate a comprehensive SEO-friendly description for the product
   * @returns A detailed product description for SEO
   */
  private getDescription(): string {
    // Use meta description if available from API
    if (this.productMeta && this.productMeta.description) {
      return this.productMeta.description.substring(0, 160);
    }

    if (this.product && this.product.title) {
      // Determine product gender/category
      let genderText = '';
      let categoryText = '';

      // Extract gender information
      if (this.product.Famille) {
        const familleText = this.product.Famille.toLowerCase();
        if (familleText.includes('femme')) {
          genderText = 'pour femme';
        } else if (familleText.includes('homme')) {
          genderText = 'pour homme';
        } else if (familleText.includes('fille')) {
          genderText = 'pour fille';
        } else if (familleText.includes('garçon')) {
          genderText = 'pour garçon';
        }
      }

      // Extract category information if available
      if (this.product.categories && this.product.categories.length > 0) {
        const categoryId = this.product.categories[0].id;
        // You could fetch category name here if needed
        categoryText = categoryId ? ' de qualité' : '';
      }

      // Include available colors if present
      let colorsText = '';
      if (this.product.colors && this.product.colors.length > 0) {
        const colorNames = this.product.colors.map(c => c.name).slice(0, 3);
        if (colorNames.length > 0) {
          colorsText = ` disponible en ${colorNames.join(', ')}`;
        }
      }

      // Include price information
      const priceText = this.product.currentPrice ?
        ` - Prix: ${this.product.currentPrice.toFixed(3)} TND` :
        ` - Prix: ${this.product.price.toFixed(3)} TND`;

      // Combine all elements into a comprehensive description
      return `Achetez ${this.product.title}${genderText}${categoryText}${colorsText} chez Barsha${priceText}. Livraison disponible partout en Tunisie.`.substring(0, 160);
    }

    return `Découvrez nos produits Barsha en ligne - Vêtements de qualité avec livraison disponible partout en Tunisie.`;
  }

  addToWishlist(): void {
    const token = localStorage.getItem('jwt'); // Vérifiez si l'utilisateur est connecté

    if (!token) {
      // Si l'utilisateur n'est pas connecté, redirigez-le vers la page de connexion
      this.router.navigate(['/login']);
      return;
    }

    // Toggle the wishlist state
    this.isInWishlist = !this.isInWishlist;

    if (this.isInWishlist) {
      // Appelez le service pour ajouter le produit à la wishlist
      this.productService.addToWishList(this.product.id).subscribe({
        next: () => {
          // Affichez un message de succès
          this.messageService.add({
            severity: 'success',
            summary: 'Produit ajouté aux favoris',
            detail: 'Veuillez vérifier votre liste de favoris',
            life: 3000,
          });
        },
        error: (error) => {
          // En cas d'erreur, revert the state and show error message
          this.isInWishlist = !this.isInWishlist;
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Impossible d\'ajouter le produit aux favoris',
            life: 3000,
          });
          console.error('Erreur lors de l\'ajout aux favoris:', error);
        }
      });
    } else {
      // Appelez le service pour supprimer le produit de la wishlist
      this.productService.removeFromWishList(this.product.id).subscribe({
        next: () => {
          // Affichez un message de succès
          this.messageService.add({
            severity: 'success',
            summary: 'Produit retiré des favoris',
            life: 3000,
          });
        },
        error: (error) => {
          // En cas d'erreur, revert the state and show error message
          this.isInWishlist = !this.isInWishlist;
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Impossible de retirer le produit des favoris',
            life: 3000,
          });
          console.error('Erreur lors de la suppression des favoris:', error);
        }
      });
    }
  }
  private initializeCartItem(): CartItemm {
    return {
      image: '',
      price: '65.900',
      couleur: '',
      total: '',
      ref: '',
      nom: ''
    };
  }

  isSizeSelectionRequired: boolean = true;
  sizeLabel: string = 'LA TAILLE';

  /**
   * Maps API product data to the Produit interface for display in the UI
   * @param products Array of products from the API
   * @returns Array of Produit objects
   */
  private mapTotalLookProducts(products: Product[]): Produit[] {
    return products.map(product => ({
      id: product.id, // Include the product ID for navigation
      image: product.declinaisons && product.declinaisons[0]?.images && product.declinaisons[0]?.images[0]?.url || '',
      nom: product.title || 'Produit',
      prix: `${(product.currentPrice || 0).toFixed(3)} TND`,
      isInWishlist: false,
      colors: product.declinaisons ? product.declinaisons.map(d => d.libellet || '') : []
    }));
  }

  private detectProductTypeAndSetupUI(): void {
    if (!this.product || !this.product.tailles || this.product.tailles.length === 0) {
      return;
    }

    const sizes = this.product.tailles;
    const firstSize = sizes[0].size;

    // Case 1: Accessories/Fragrances (Single size "TU" or "STD")
    // User requirement: "ajout direct sans afficher la case de selection"
    if (sizes.length === 1 && (firstSize.toUpperCase() === 'TU' || firstSize.toUpperCase() === 'STD')) {
      this.isSizeSelectionRequired = false;
      this.selectedSize = firstSize; // Auto-select TU or STD
      this.sizeLabel = ''; // Not needed
      return;
    }

    // Case 2 & 3: Shoes vs Clothes
    this.isSizeSelectionRequired = true;

    // Check if the first size is numeric (indicative of shoes OR belts)
    // We treat "37", "38", "40.5" as numbers. "S", "M", "L", "XL" are NaN.
    const isNumericSize = !isNaN(Number(firstSize));

    // Keywords to identify shoes
    const shoeKeywords = ['CHAUSSURE', 'BOTTINE', 'BASKET', 'SANDALE', 'MULE', 'SABOT', 'ESCARPIN', 'MOCASSIN', 'DERBY', 'BALLERINE', 'BOOTS', 'CLAQUETTE', 'TONG'];
    const titleUpper = this.product.title ? this.product.title.toUpperCase() : '';
    const isShoe = shoeKeywords.some(keyword => titleUpper.includes(keyword));

    if (isNumericSize && isShoe) {
      // Case 2: Shoes
      this.sizeLabel = 'LA POINTURE';
    } else {
      // Case 3: Clothes (Default) or Accessories (Belts)
      this.sizeLabel = 'LA TAILLE';
    }
  }

  toggleDetails(): void {
    this.showDetails = !this.showDetails;
  }

  toggleComposition(): void {
    this.showComposition = !this.showComposition;
  }

  toggleRetours(): void {
    this.showRetours = !this.showRetours;
  }

  selectColor(index: number): void {
    this.product.selectedColorIndex = index;
    this.images = this.product.declinaisons[index].images.map((img: any) => img.url);
    this.activeThumbnail = 0;
    this.loadStockForColor(index);
  }

  setActiveThumbnail(index: number): void {
    this.activeThumbnail = index;
  }

  toggleWishlist(produit: Produit): void {
    const token = localStorage.getItem('jwt');

    if (!token) {
      // Si l'utilisateur n'est pas connecté, redirigez-le vers la page de connexion
      this.router.navigate(['/login']);
      return;
    }

    // Toggle the wishlist state
    produit.isInWishlist = !produit.isInWishlist;

    if (produit.isInWishlist) {
      // Ajouter le produit à la wishlist
      if (produit.id) {
        this.productService.addToWishList(produit.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Produit ajouté aux favoris',
              detail: 'Veuillez vérifier votre liste de favoris',
              life: 3000,
            });
          },
          error: (error) => {
            produit.isInWishlist = !produit.isInWishlist; // Revenir à l'état précédent en cas d'erreur
            this.messageService.add({
              severity: 'error',
              summary: 'Erreur',
              detail: 'Impossible d\'ajouter le produit aux favoris',
              life: 3000,
            });
            console.error('Erreur lors de l\'ajout aux favoris:', error);
          }
        });
      }
    } else {
      // Supprimer le produit de la wishlist
      if (produit.id) {
        this.productService.removeFromWishList(produit.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Produit retiré des favoris',
              life: 3000,
            });
          },
          error: (error) => {
            produit.isInWishlist = !produit.isInWishlist; // Revenir à l'état précédent en cas d'erreur
            this.messageService.add({
              severity: 'error',
              summary: 'Erreur',
              detail: 'Impossible de retirer le produit des favoris',
              life: 3000,
            });
            console.error('Erreur lors de la suppression des favoris:', error);
          }
        });
      }
    }
  }

  closeCartPopup(): void {
    this.showCartPopup = false;
    this.isBlurred = false;
  }

  addToCart(): void {
    const jwt = localStorage.getItem('jwt');
    const allSizesOutOfStock = this.product.tailles.every(taille => taille.state === 'Rupture de stock');
    if (allSizesOutOfStock) {
      this.messageService.add({
        severity: 'error',
        summary: 'Rupture de stock',
        detail: 'Stock épuisé pour l\'ensemble des tailles de cette référence couleur. Veuillez sélectionner une autre variante.',
        life: 3000,
      });
      return;
    }
    if (!this.selectedSize) {
      this.messageService.add({
        severity: 'success',
        summary: 'Veuillez sélectionner une taille',
        detail: 'Veuillez sélectionner une taille',
        life: 3000,
      });
      return;
    }

    const selectedColor = this.product.colors[this.selectedColorIndex].name;

    const selectedTaille = this.product.tailles.find(t => t.size === this.selectedSize);
    if (!selectedTaille) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Veuillez sélectionner une taille valide'
      });
      return;
    }

    // Création d'un nouvel item avec une copie profonde du produit
    const cartItem: CartItem = {
      product: JSON.parse(JSON.stringify(this.product)), // Copie profonde du produit
      image: this.images[this.activeThumbnail],
      quantity: this.quantity,
      selectedColor: selectedColor,
      selectedSize: this.selectedSize,
      ean13: selectedTaille.ean13
    };

    // Mise à jour de l'image dans le cartItem du popup
    this.cartItem.image = this.images[this.activeThumbnail];
    this.cartItem.nom = this.product.title;
    this.cartItem.ref = this.product.sku;
    this.cartItem.couleur = selectedColor;
    this.cartItem.price = this.product.currentPrice.toFixed(3);

    // Ajout au panier avec vérification de stock
    this.cartService.addToCart(cartItem).subscribe({
      next: (result) => {
        if (result.success) {
          // Affichez un message de confirmation
          this.showCartPopup = true;
          this.isBlurred = true;

          setTimeout(() => {
            this.showCartPopup = false;
            this.isBlurred = false;
          }, 2000);

          // Réinitialisez la quantité
          this.quantity = 1;
          this.updateTotal();
        } else {
          // Afficher un message d'erreur si le stock est insuffisant
          this.messageService.add({
            severity: 'warn',
            summary: 'Stock insuffisant',
            detail: result.message || 'La quantité demandée dépasse le stock disponible',
            life: 3000
          });
        }
      },
      error: (error) => {
        console.error('Erreur lors de l\'ajout au panier:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Impossible d\'ajouter l\'article au panier',
          life: 3000
        });
      }
    });
  }

  updateTotal(): void {
    const basePrice = parseFloat(this.cartItem.price);
    const total = basePrice * this.quantity;
    this.cartItem.total = `${total.toFixed(3)} TND`;
    this.totalPrice = total.toFixed(3);
  }

  toggleSizeTable(): void {
    this.showSizeTable = !this.showSizeTable;
  }

  selectSize(size: string): void {
    this.selectedSize = size;
    this.showSizeTable = false;
    // console.log(`Selected size: ${size}`);

  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.size-section')) {
      this.showSizeTable = false;
    }
  }

  private loadProduct(): void {
    this.isLoading = true;
    this.route.paramMap.subscribe(params => {
      let productIdParam = params.get('id') || params.get('slug');
      let productId: number;

      if (productIdParam) {
        // Extraction de l'ID à partir du slug (format "942-nomProduit")
        if (productIdParam.includes('-')) {
          productId = parseInt(productIdParam.split('-')[0], 10);
        } else {
          productId = parseInt(productIdParam, 10);
        }

        // Récupération du paramètre categoryId de l'URL si présent
        this.route.queryParamMap.subscribe(qParams => {
          const categoryIdParam = qParams.get('categoryId');
          if (categoryIdParam) {
            this.categoryId = parseInt(categoryIdParam, 10);
          }
        });

        // First check if this is an idOrigin (old product ID for tracking)
        this.productService.getProductByIdOrigin(productId).subscribe({
          next: (product: Product) => {
            if (product) {
              // Redirect to the current product ID URL with proper slug
              const currentSlug = this.productService.generateProductSlug(product);

              // Set canonical URL for SEO indexation before redirect
              const canonicalUrl = `${window.location.origin}/barsha/fr/produit/${currentSlug}`;
              this.seoService.updateCanonicalUrl(canonicalUrl);

              this.router.navigate([`/produit/${currentSlug}`], {
                replaceUrl: true,
                queryParams: {} // Preserve original tracking info
              });
            } else {
              // If not found as idOrigin, fetch as regular product id
              this.fetchProductById(productId);
            }
          },
          error: () => {
            // If error occurred, try fetching as regular product id
            this.fetchProductById(productId);
          }
        });
      } else {
        this.isLoading = false;
        this.router.navigate(['/404']);
      }
    });
  }

  private fetchProductById(productId: number): void {
    this.productService.getProductById(productId).subscribe({
      next: (product) => {
        if (product) {
          this.product = this.mapProductData(product);
          this.initializeProductDetails();

          // Add product sitelinks
          this.seoService.addProductSitelinks(this.product);



          // Load similar products if we have all required data, but don't block main product display
          if (this.product.title && this.product.Famille && this.product.Persona) {
            this.productService.getSimilarProducts(
              this.product.title,
              this.product.Famille,
              this.product.Persona
            ).subscribe({
              next: (response) => {
                // Filter out the current product
                const similarProducts = response.hits.filter(p => p.id !== this.product.id);
                // console.log('Filtered similar products:', similarProducts);

                // Map the products to the Produit interface format
                this.produitss = similarProducts.map(product => {
                  const mappedProduct = {
                    id: product.id,
                    image: product.declinaisons?.[0]?.images?.[0]?.url || '',
                    nom: product.title || '',
                    prix: `${product.currentPrice.toFixed(3)} TND`,
                    isInWishlist: false,
                    colors: product.declinaisons?.map(d => d.libellet) || []
                  };
                  // console.log('Mapped product:', mappedProduct);
                  return mappedProduct;
                });

                // console.log('Final produitss array:', this.produitss);

                // Force change detection
                this.updateVisibleRelatedProducts();
                // console.log('Visible related products:', this.visibleRelatedProducts);
              },
              error: (error) => {
                console.error('Error loading similar products:', error);
                this.produitss = [];
                this.updateVisibleRelatedProducts();
              }
            });
          } else {
            console.warn('Missing required product data for similar products:', {
              hasTitle: !!this.product.title,
              hasFamille: !!this.product.Famille,
              hasPersona: !!this.product.Persona
            });
            // Set empty array for similar products but continue with main product display
            this.produitss = [];
            this.updateVisibleRelatedProducts();
          }

          // Check if the product is in the wishlist
          const token = localStorage.getItem('jwt');
          if (token) {
            this.productService.getWishlist().subscribe(
              (wishlistResponse) => {
                const wishlistProductIds = wishlistResponse.data.map((product) => product.id);
                // Update the main product wishlist state
                this.isInWishlist = wishlistProductIds.includes(this.product.id);

                // Update related products wishlist state
                this.produitss.forEach((produit) => {
                  if (produit.id) {
                    produit.isInWishlist = wishlistProductIds.includes(produit.id);
                  }
                });
              },
              (error) => {
                console.error('Erreur lors de la récupération de la wishlist:', error);
              }
            );
          }

          // Fetch product meta information and total look products in parallel
          forkJoin({
            metaInfo: this.productService.getProductMetaInfo(productId).pipe(
              catchError(err => {
                console.error('Error loading product meta info:', err);
                return of(null);
              })
            ),
            // Load total look products based on product categories
            totalLook: this.loadTotalLookProducts(product)
          }).subscribe(results => {
            // Handle meta info
            this.productMeta = results.metaInfo;
            if (results.metaInfo) {

              // console.log('Product complements:', results.totalLook);
            }
          });

          // Generate the canonical slug URL
          const canonicalSlug = this.productService.generateProductSlug(product);
          const canonicalUrl = `${window.location.origin}/barsha/fr/produit/${canonicalSlug}`;

          // Set canonical URL for SEO indexation - makes both URL formats equivalent
          this.seoService.updateCanonicalUrl(canonicalUrl);


          const currentUrl = this.router.url;
          const expectedSlug = canonicalSlug;

          if (!currentUrl.includes('-') && product.title) {
            this.router.navigate([`/produit/${expectedSlug}`], {
              replaceUrl: true,
              queryParams: {} // Supprimer tous les paramètres de requête au lieu de les conserver
            });
          }

          // SEO
          const titlePrefix = product.Famille
            ? product.Famille.toLowerCase().includes('femme')
              ? 'Vêtement Femme'
              : product.Famille.toLowerCase().includes('homme')
                ? 'Vêtement Homme'
                : 'Vêtement'
            : 'Vêtement';

          this.titleService.setSpecificTitle(`${product.title}-${titlePrefix}`);

          this.isLoading = false;
        } else {
          this.router.navigate(['/404']);
        }
      },
      error: (error) => {
        console.error('Erreur lors du chargement du produit:', error);
        this.isLoading = false;
        this.router.navigate(['/404']);
      }
    });
  }

  /**
   * Loads total look products based on the product's complements
   * @param product The current product
   * @returns Observable with total look products
   */
  private loadTotalLookProducts(product: Product) {
    this.totalLookLoading = true;
    // console.log('Product complements:', product.complements);

    // Extract IDs from the product's complements array
    const complementIds = Array.isArray(product.complements) ? product.complements : [];
    // console.log('Complement IDs:', complementIds);

    // If no complements, return empty array
    if (!complementIds.length) {
      // console.log('No complement IDs found');
      this.totalLookLoading = false;
      this.produits = [];
      return of([]);
    }

    // Get products from the complements (excluding the current product)
    return this.productService.getTotalLook(complementIds).pipe(
      catchError(error => {
        console.error('Error loading total look products:', error);
        this.totalLookLoading = false;
        return of({ hits: [] });
      }),
      map((response: { hits: Product[] }) => {
        // console.log('Total look API response:', response);

        // Filter out the current product and ensure we have valid products
        const totalLookProducts = response.hits
          .filter((p: Product) => {
            const isValid = p && p.id !== product.id && p.declinaisons && p.declinaisons.length > 0;
            if (!isValid) {
              // console.log('Filtered out product:', p);
            }
            return isValid;
          });

        // console.log('Filtered total look products:', totalLookProducts);

        // Map to UI format with improved error handling
        this.produits = totalLookProducts.map(product => {
          const mappedProduct = {
            id: product.id,
            image: product.declinaisons[0]?.images?.[0]?.url || '',
            nom: product.title || 'Produit',
            prix: `${(product.currentPrice || 0).toFixed(3)} TND`,
            isInWishlist: false,
            colors: product.declinaisons?.map(d => d.libellet || '') || []
          };
          // console.log('Mapped product:', mappedProduct);
          return mappedProduct;
        });

        // Check wishlist status for all products
        const token = localStorage.getItem('jwt');
        if (token) {
          this.productService.getWishlist().subscribe(
            (wishlistResponse) => {
              const wishlistProductIds = wishlistResponse.data.map((product) => product.id);
              this.produits.forEach((produit) => {
                if (produit.id) {
                  produit.isInWishlist = wishlistProductIds.includes(produit.id);
                }
              });
            },
            (error) => {
              console.error('Erreur lors de la récupération de la wishlist:', error);
            }
          );
        }

        this.totalLookLoading = false;
        return totalLookProducts;
      })
    );
  }

  private mapProductData(apiProduct: any): Product {

    return {
      sku: apiProduct.sku || '',
      title: apiProduct.title || '',
      id: apiProduct.id,
      idOrigin: apiProduct.idOrigin,
      price: apiProduct.price || 0,
      currentPrice: apiProduct.currentPrice || 0,
      discount: apiProduct.discount || false,
      discountValue: apiProduct.discountValue || 0,
      imageInterval: apiProduct.imageInterval,
      Persona: apiProduct.Persona || 'unknown',
      activeImageIndex: 0,
      complements: Array.isArray(apiProduct.complements) ? apiProduct.complements : [],
      declinaisons: apiProduct.declinaisons || [],
      categories: apiProduct.categories || [],
      Famille: apiProduct.Famille || 'unknown',
      Ligne: apiProduct.Ligne || '',
      tailles: [],  // Will be populated later with stock information
      colors: (apiProduct.declinaisons || []).map((d: any) => ({
        name: d.libellet || '',
        textureImage: d.texture?.url || '',
        mainImage: d.images?.[0]?.url || apiProduct.firstImg?.url || ''
      })),
      selectedColorIndex: 0,
      isInWishlist: false,
      articlesSimilaires: []
    };
  }

  private initializeProductDetails(): void {
    // Ensure we have declinaisons before accessing them
    if (this.product.declinaisons && this.product.declinaisons.length > 0) {
      this.images = this.product.declinaisons[0]?.images?.map((img: any) => img.url) || [];
      this.activeThumbnail = 0;
      this.loadStockForColor(0);
    } else {
      console.warn('Product has no declinaisons available');
      this.images = [];
      this.activeThumbnail = 0;
      // Initialize empty tailles array if no declinaisons
      this.product.tailles = [];
    }
  }

  private loadStockForColor(index: number): void {
    const declinaisonId = this.product.declinaisons[index]?.id;
    if (declinaisonId) {
      this.productService.getDeclinaisonStock(declinaisonId).subscribe({
        next: (stockData) => {
          this.product.tailles = stockData.data.map((item: any) => ({
            size: item.size,
            qte: item.qte,
            state: this.getSizeState(item.qte),
            ean13: item.ean13
          }));

          // Sélectionner automatiquement la taille si il n'y a qu'un seul élément
          if (this.product.tailles.length === 1 && this.product.tailles[0].state !== 'Rupture de stock') {
            this.selectSize(this.product.tailles[0].size);
          }
          this.detectProductTypeAndSetupUI();
        },
        error: (err) => console.error('Error loading stock:', err)
      });
    }
  }

  private getSizeState(qte: number): string {
    if (qte === 0) return 'Rupture de stock';
    if (qte <= 2) return 'Dernières pièces';
    return '';
  }

  startDragging(event: MouseEvent): void {
    if (this.isZoomed) {
      event.preventDefault(); // Empêche la sélection de l'image
      this.isDragging = true;
      this.startX = event.clientX;
      this.startY = event.clientY;
      this.lastX = this.translateX;
      this.lastY = this.translateY;
      document.body.style.cursor = 'grabbing';
    }
  }

  onDrag(event: MouseEvent): void {
    if (this.isDragging && this.isZoomed) {
      event.preventDefault(); // Empêche la sélection de l'image
      const deltaX = event.clientX - this.startX;
      const deltaY = event.clientY - this.startY;

      this.translateX = this.lastX + deltaX;
      this.translateY = this.lastY + deltaY;
    }
  }

  stopDragging(): void {
    if (this.isDragging) {
      this.isDragging = false;
      document.body.style.cursor = 'grab';
    }
  }

  /**
   * Add comprehensive structured data for the product
   * This improves search engine understanding of the product
   */
  private addProductStructuredData(): void {
    if (!this.product) return;

    // Get all product images for the current color
    const productImages = this.product.declinaisons?.[this.product.selectedColorIndex || 0]?.images?.map(img => img.url) || [];

    // Get all available sizes that are in stock
    const availableSizes = this.product.tailles
      ?.filter(taille => taille.qte > 0)
      ?.map(taille => taille.size) || [];

    // Define the product data with proper typing and enhanced information
    const productData: any = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: this.product.title || '',
      image: productImages.length > 0 ? productImages : [this.product.colors?.[0]?.mainImage || ''],
      description: this.productMeta?.description || this.getDescription(),
      sku: this.product.sku || '',
      brand: {
        '@type': 'Brand',
        name: 'Barsha'
      },
      offers: {
        '@type': 'Offer',
        price: this.product.currentPrice || this.product.price || 0,
        priceCurrency: 'TND',
        availability: this.hasStock() ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url: window.location.href,
        // Add seller information
        seller: {
          '@type': 'Organization',
          name: 'Barsha',
          url: 'https://www.barsha.com.tn'
        }
      }
    };

    // Add color information if available
    if (this.product.colors && this.product.colors.length > 0) {
      productData.color = this.product.colors.map(color => color.name).join(', ');
    }

    // Add size information if available
    if (availableSizes.length > 0) {
      productData.size = availableSizes.join(', ');
    }

    // Add category information if available
    if (this.product.Famille) {
      productData.category = this.product.Famille;
    }

    // Add additional metadata if available from the API
    if (this.productMeta) {
      // Update keywords
      if (this.productMeta.keywords) {
        this.seoService.updateKeywords(this.productMeta.keywords);
      } else {
        // Generate keywords from product attributes if not provided
        const keywords = [
          this.product.title,
          this.product.Famille,
          ...this.product.colors.map(c => c.name),
          'Barsha',
          'vêtements',
          'mode',
          'Tunisie'
        ].filter(Boolean).join(', ');

        this.seoService.updateKeywords(keywords);
      }

      // Add custom attributes as additional properties
      if (this.productMeta.customAttributes) {
        productData.additionalProperty = Object.entries(this.productMeta.customAttributes).map(([name, value]) => ({
          '@type': 'PropertyValue',
          'name': name,
          'value': value
        }));
      }
    }

    this.seoService.addStructuredData(productData);
  }

  // Helper to check if product has stock
  private hasStock(): boolean {
    if (!this.product || !this.product.tailles) return false;
    return this.product.tailles.some(taille => taille.qte > 0);
  }

  /**
   * Scroll the total look products horizontally
   * @param direction 'prev' or 'next'
   */
  scrollTotalLook(direction: 'prev' | 'next'): void {
    if (!this.totalLookItemsRef) return;

    const container = this.totalLookItemsRef.nativeElement;
    const itemWidth = container.querySelector('.total-look-item')?.clientWidth || 0;

    // Calculate scroll amount based on item width (scroll by 3 items on desktop, 2 on mobile)
    const isMobile = window.innerWidth <= this.mobileBreakpoint;
    const itemsToScroll = isMobile ? 2 : 3;
    const scrollAmount = itemWidth * itemsToScroll;

    if (direction === 'prev') {
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  }

  /**
   * Generate a product detail URL from a product
   * @param produit The product to generate URL for
   * @returns The URL string for the product detail page
   */
  getProductDetailUrl(produit: Produit): string {
    if (!produit || !produit.id) return '/produit/0-produit';

    const id = produit.id || 0;
    const name = produit.nom || 'produit';

    // Create a slug from the product name
    const slug = name.toLowerCase()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ç]/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return `/produit/${id}-${slug}`;
  }

  /**
   * Handle product click to save scroll position before navigation
   */
  onProductClick(): void {
    this.scrollPositionService.savePositionBeforeProductNavigation();
  }
}