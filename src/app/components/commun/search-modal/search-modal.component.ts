import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, ElementRef, ViewChild, HostListener, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MenuService } from '../../../services/menu.service';
import { Category, SearchResult, ProductTitle } from '../../../models/menu';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Product } from '../../../models/Product';
import { ProductService } from '../../../services/product.service';

@Component({
  selector: 'app-search-modal',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './search-modal.component.html',
  styleUrl: './search-modal.component.scss'
})
export class SearchModalComponent implements OnInit, OnDestroy, AfterViewInit {
  @Output() closeModalEvent = new EventEmitter<void>();
  @ViewChild('searchInput') searchInput!: ElementRef;
  @ViewChild('modalContainer') modalContainer!: ElementRef;

  categories: Category[] = [];
  selectedGender: string | null = null;
  genders: string[] = [];

  // Search properties
  searchQuery: string = '';
  searchResults: SearchResult[] = [];
  showSearchResults: boolean = false;
  selectedResultIndex: number = -1;

  // Optimized search properties
  private allProductTitles: ProductTitle[] = [];
  private isProductTitlesFetched: boolean = false;
  private currentGenderForTitles: string | null = null;

  // Featured products properties
  relatedProducts: Product[] = [];
  visibleRelatedProducts: Product[] = [];
  currentRelatedIndex: number = 0;
  productsPerPage: number = 4;
  isNavigating: boolean = false;

  // Pagination properties for search results
  currentOffset: number = 0;
  limit: number = 12;
  hasMoreProducts: boolean = true;
  isLoadingMore: boolean = false;
  totalProducts: number = 0;
  // Keep the last used products/search filter for pagination
  private currentFilter: string | null = null;
  // Show no-results message after explicit searches
  showNoResults: boolean = false;

  // Wishlist properties
  wishlistProductIds: number[] = [];
  isLoadingWishlist: boolean = false;

  private scrollPosition = 0;

  constructor(
    private categoryService: MenuService,
    private router: Router,
    private sanitizer: DomSanitizer,
    public productService: ProductService
  ) {}

  // Listen for scroll events in the modal to implement infinite scrolling
  @HostListener('window:scroll', ['$event'])
  onModalScroll(event: Event) {
    const container = this.modalContainer?.nativeElement;
    if (!container || this.isLoadingMore || !this.hasMoreProducts) {
      return;
    }

    const threshold = 200; // Distance from bottom to trigger loading
    const position = container.scrollTop + container.clientHeight;
    const height = container.scrollHeight;

    if (position > height - threshold) {
      this.loadMoreProducts();
    }
  }

  ngOnInit(): void {
    // Fix the body when modal is open
    this.disableBodyScroll();

    this.categoryService.getCategories().subscribe(data => {
      this.categories = data;
      this.extractGenders();
      if (this.genders.length > 0) {
        // Vérifier s'il y a un genre sauvegardé dans localStorage
        const savedGender = localStorage.getItem('selectedGender');
        if (savedGender && this.genders.includes(savedGender)) {
          this.selectedGender = savedGender;
        } else {
          this.selectedGender = this.genders[0];
        }
        // Load featured products for the selected gender
        this.loadFeaturedProducts();
      }
    });

    // Note: Removed debounced search as we now use optimized search with frontend filtering

    // Load user's wishlist
    this.fetchWishlist();
  }

  ngAfterViewInit(): void {
    // Auto-focus on search input when modal opens
    if (this.searchInput) {
      setTimeout(() => {
        this.searchInput.nativeElement.focus();
      }, 100); // Small delay to ensure the modal is fully rendered
    }
  }

  ngOnDestroy(): void {
    // Re-enable body scroll when component is destroyed
    this.enableBodyScroll();
  }

  /**
   * Disables scrolling on the body element and stores current scroll position
   */
  private disableBodyScroll(): void {
    // Store current scroll position
    this.scrollPosition = window.scrollY;

    // Add a class to the body to fix its position
    document.body.classList.add('search-modal-open');

    // Set the body position to fixed and adjust top to maintain visual position
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${this.scrollPosition}px`;
  }

  /**
   * Re-enables scrolling on the body element
   */
  private enableBodyScroll(): void {
    // Remove the class from body
    document.body.classList.remove('search-modal-open');

    // Reset the body position
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.top = '';

    // Restore scroll position
    window.scrollTo(0, this.scrollPosition);
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeModal();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Check if the click is outside the modal
    const target = event.target as HTMLElement;
    const modalContainer = document.querySelector('.search-modal-container');

    if (modalContainer && !modalContainer.contains(target)) {
      this.closeModal();
    }
  }

  extractGenders(): void {
    this.genders = this.categories
      .map(category => category.name)
      .filter((name, index, self) => self.indexOf(name) === index);

    // Normalize gender names to ensure consistent casing
    this.genders = this.genders.map(gender => {
      if (gender.toUpperCase() === 'FEMME') return 'Femme';
      if (gender.toUpperCase() === 'HOMME') return 'Homme';
      return gender;
    });
  }

  switchGender(gender: string) {
    const previousGender = this.selectedGender;

    // Normalize gender to ensure consistent casing
    if (gender.toUpperCase() === 'FEMME') {
      this.selectedGender = 'Femme';
    } else if (gender.toUpperCase() === 'HOMME') {
      this.selectedGender = 'Homme';
    } else {
      this.selectedGender = gender;
    }

    // Only reload if gender actually changed
    if (previousGender !== this.selectedGender) {
      // Reset product titles cache when gender changes
      this.resetProductTitlesCache();

      // Load featured products for the new gender
      this.loadFeaturedProducts();

      // If there's an active search, refresh the results with the new gender filter
      if (this.searchQuery.trim() !== '') {
        this.performOptimizedSearch(this.searchQuery);
      }
    }
  }

  closeModal() {
    // Re-enable body scroll when modal is closed
    this.enableBodyScroll();
    this.closeModalEvent.emit();
  }

  /**
   * Handle click on modal overlay (outside content)
   * @param event Mouse event
   */
  onOverlayClick(event: MouseEvent): void {
    // Only close if the click is directly on the overlay, not on child elements
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  /**
   * Prevent modal from closing when clicking inside content
   * @param event Mouse event
   */
  onContentClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  /**
   * Handle search input changes
   * @param event Input event from search field
   */
  onSearchInput(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchQuery = query;

    if (query.trim() === '') {
      this.clearSearchCompletely();
      return;
    }

    // If user is typing a SKU, do not trigger live search; wait for explicit search icon click
    if (this.isSkuQuery(query)) {
      this.showSearchResults = false;
      return;
    }

    // Use optimized search titles when not in SKU mode
    this.performOptimizedSearch(query);
  }

  /**
   * Clear search completely and reset to default products
   */
  clearSearchCompletely(): void {
    this.searchQuery = '';
    this.searchResults = [];
    this.showSearchResults = false;
    this.selectedResultIndex = -1;
    this.loadFeaturedProducts();
  }

  /**
   * Optimized search that fetches all product titles once and filters on frontend
   * @param query Search query string
   */
  private performOptimizedSearch(query: string): void {
    if (query.trim() === '') {
      this.clearSearch();
      return;
    }

    // Check if we need to fetch product titles for the current gender
    if (!this.isProductTitlesFetched || this.currentGenderForTitles !== this.selectedGender) {
      this.fetchProductTitlesForCurrentGender().then(() => {
        this.filterProductTitles(query);
      });
    } else {
      // Use cached results and filter on frontend
      this.filterProductTitles(query);
    }
  }

  /**
   * Fetch all product titles for the current gender
   * @returns Promise that resolves when titles are fetched
   */
  private fetchProductTitlesForCurrentGender(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.categoryService.fetchAllProductTitles(this.selectedGender || undefined).subscribe({
        next: (titles) => {
          this.allProductTitles = titles;
          this.isProductTitlesFetched = true;
          this.currentGenderForTitles = this.selectedGender;
          resolve();
        },
        error: (error) => {
          console.error('Error fetching product titles:', error);
          this.allProductTitles = [];
          this.isProductTitlesFetched = false;
          reject(error);
        }
      });
    });
  }

  /**
   * Filter cached product titles based on search query (start-with logic)
   * @param query Search query string
   */
  private filterProductTitles(query: string): void {
    const qLower = query.toLowerCase();
    const filteredTitles = this.allProductTitles.filter(title =>
      title.title.toLowerCase().startsWith(qLower)
    );

    // Convert to SearchResult format
    this.searchResults = filteredTitles.map(title => ({
      text: title.title,
      type: 'product' as const,
      id: title.id,
      parentCategory: title.category
    }));

    // Sort results alphabetically
    this.searchResults.sort((a, b) =>
      a.text.toLowerCase().localeCompare(b.text.toLowerCase())
    );

    // Limit results to 10 for display
    this.searchResults = this.searchResults.slice(0, 10);

    this.showSearchResults = this.searchResults.length > 0 || query.trim() !== '';
    this.selectedResultIndex = -1; // Reset selection

    // Update related products based on search results
    // this.updateRelatedProductsBasedOnSearch();
  }

  /**
   * Detect if current query looks like a SKU reference.
   * Simple heuristic: alphanumeric/hyphen only and contains at least one digit.
   */
  isSkuQuery(query: string): boolean {
    const q = (query || '').trim();
    if (q.length === 0) return false;
    return /^[A-Za-z0-9-]+$/.test(q) && /\d/.test(q);
  }

  /**
   * Detect if current product filter is by exact title (e.g. title = 'CEINTURE') or by SKU reference.
   * When true, the related-products section title should be hidden.
   */
  isTitleFiltered(): boolean {
    if (!this.currentFilter) return false;
    try {
      const isTitleFilter = /title\s*=\s*'[^']+'/.test(this.currentFilter);
      const isSkuFilter = /sku\s*=|sku\s+STARTS\s+WITH|sku\s+CONTAINS/.test(this.currentFilter);
      return isTitleFilter || isSkuFilter;
    } catch (e) {
      return false;
    }
  }

  /**
   * Reset product titles cache
   */
  private resetProductTitlesCache(): void {
    this.allProductTitles = [];
    this.isProductTitlesFetched = false;
    this.currentGenderForTitles = null;
  }

  /**
   * Clear search results
   */
  clearSearch(): void {
    this.searchResults = [];
    this.showSearchResults = false;
    this.selectedResultIndex = -1;
    this.currentFilter = null;

    // Don't reload featured products here to avoid repeated API calls
    // Featured products are already loaded once when the modal opens
  }
  /**
   * Handle click on a search result
   * This is the ONLY place where the products/search API is called
   * @param result The selected search result
   */
  selectSearchResult(result: SearchResult): void {
    if (result.type === 'product') {
      // Load products with the selected title in the related products section
      this.loadProductsByTitle(result.text);

      // Clear the search dropdown but keep the search query
      this.showSearchResults = false;
      this.selectedResultIndex = -1;

      // Update the search input to show the selected title
      this.searchQuery = result.text;
    } else if (result.type === 'category' && result.link) {
      // Navigate to category
      this.router.navigate(['/tn', result.link]);
      this.closeModal();
    }
  }

  /**
   * Highlights the matching part of the text with the search query
   * @param text The full text to display
   * @param query The search query to highlight
   * @returns SafeHtml with highlighted text
   */
  highlightMatchingText(text: string, query: string): SafeHtml {
    if (!text || !query || query.trim() === '') {
      return this.sanitizer.bypassSecurityTrustHtml(`<span style="color: #999; font-weight: normal;">${text}</span>`);
    }

    // Case insensitive search
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // We only highlight if the text starts with the query
    if (!lowerText.startsWith(lowerQuery)) {
      return this.sanitizer.bypassSecurityTrustHtml(`<span style="color: #999; font-weight: normal;">${text}</span>`);
    }

    // Split the text into two parts: match (beginning) and rest
    const match = text.substring(0, query.length);
    const rest = text.substring(query.length);

    // Create HTML with the match part in bold and black, rest in gray - matching the design
    const highlightedText = `<span style="color: #000; font-weight: 600; font-family: 'std55';">${match}</span><span style="color: #bbb; font-weight: normal; font-family: 'std55';">${rest}</span>`;

    // Return sanitized HTML
    return this.sanitizer.bypassSecurityTrustHtml(highlightedText);
  }

  /**
   * Load featured products based on selected gender
   */
  loadFeaturedProducts(): void {
    if (!this.selectedGender) return;

    // Reset pagination for new search
    this.currentOffset = 0;
    this.hasMoreProducts = true;
    this.relatedProducts = [];
    this.showNoResults = false;

    // Map gender to category ID (1 for Femme, 2 for Homme)
    const categoryId = this.selectedGender === 'Femme' ? 1 : 2;
    // Set current filter for pagination
    this.currentFilter = `categories.id = ${categoryId} AND featuredInSearch = true`;

    this.categoryService.searchProducts(this.currentFilter, this.limit, this.currentOffset).subscribe({
      next: (response) => {
        this.relatedProducts = this.mapApiDataToProducts(response.hits || []);
        this.totalProducts = response.estimatedTotalHits || response.hits.length;

        // Check if there are more products to load
        this.hasMoreProducts = this.relatedProducts.length >= this.limit && this.relatedProducts.length < this.totalProducts;
        this.currentOffset += this.limit;

        this.updateVisibleProducts();
        // Update wishlist status for newly loaded products
        this.updateProductsWishlistStatus();
      },
      error: (error) => {
        console.error('Error loading featured products:', error);
        this.relatedProducts = [];
        this.visibleRelatedProducts = [];
      }
    });
  }

  /**
   * Update related products based on search query
   * Note: Now avoids repeated API calls during search input
   */
  // private updateRelatedProductsBasedOnSearch(): void {
    // Don't reload featured products during search input to avoid repeated API calls
    // Featured products are already loaded once when the modal opens
    // The products/search API will only be called when user clicks on a search result
  // }

  /**
   * Load products by exact title
   * @param title Product title
   */
  private loadProductsByTitle(title: string): void {
    if (!this.selectedGender) return;

    // Reset pagination for new search
    this.currentOffset = 0;
    this.hasMoreProducts = true;
    this.relatedProducts = [];

    const categoryId = this.selectedGender === 'Femme' ? 1 : 2;
    const filter = `categories.id = ${categoryId} AND title = '${title}'`;
    // Set current filter for pagination
    this.currentFilter = filter;

    // Call the products/search API - only triggered when user clicks on search result
    this.categoryService.searchProducts(filter, this.limit, this.currentOffset).subscribe({
      next: (response: any) => {
        this.relatedProducts = this.mapApiDataToProducts(response.hits || []);
        this.totalProducts = response.estimatedTotalHits || response.hits.length;
        this.showNoResults = (this.relatedProducts.length === 0);

        // Check if there are more products to load
        this.hasMoreProducts = this.relatedProducts.length >= this.limit && this.relatedProducts.length < this.totalProducts;
        this.currentOffset += this.limit;

        this.updateVisibleProducts();
        // Update wishlist status for newly loaded products
        this.updateProductsWishlistStatus();
      },
      error: (error: any) => {
        console.error('Error loading products by title:', error);
        // Fallback to featured products
        this.loadFeaturedProducts();
      }
    });
  }

  /**
   * Load more products for infinite scrolling in search results
   */
  loadMoreProducts(): void {
    if (this.isLoadingMore || !this.hasMoreProducts || !this.selectedGender) {
      return;
    }

    this.isLoadingMore = true;

    // Reuse the last filter if set; otherwise default to featured in selected gender
    let filter = this.currentFilter;
    if (!filter) {
      const categoryId = this.selectedGender === 'Femme' ? 1 : 2;
      filter = `categories.id = ${categoryId} AND featuredInSearch = true`;
      this.currentFilter = filter;
    }

    this.categoryService.searchProducts(filter, this.limit, this.currentOffset).subscribe({
      next: (response: any) => {
        const newProducts = this.mapApiDataToProducts(response.hits || []);
        
        if (newProducts.length > 0) {
          // Append new products to existing ones
          this.relatedProducts = [...this.relatedProducts, ...newProducts];
          
          // Update total count and check if there are more products
          this.totalProducts = response.estimatedTotalHits || (this.relatedProducts.length + newProducts.length);
          this.hasMoreProducts = this.relatedProducts.length < this.totalProducts;
          
          // Increment offset for next load
          this.currentOffset += this.limit;
          
          // Update visible products
          this.updateVisibleProducts();
          
          // Update wishlist status for newly loaded products
          this.updateProductsWishlistStatus();

          // Précharger la prochaine page si on n'est pas à la fin
          if (this.hasMoreProducts) {
            setTimeout(() => {
              this.preloadNextPage();
            }, 500); // Attendre 500ms avant de précharger la prochaine page
          }
        } else {
          // No more products to load
          this.hasMoreProducts = false;
        }
        
        this.isLoadingMore = false;
      },
      error: (error: any) => {
        console.error('Error loading more products:', error);
        this.isLoadingMore = false;
        this.hasMoreProducts = false;
      }
    });
  }

  /**
   * Triggered when user submits search (Enter key). Performs reference (SKU) search within selected gender.
   */
  onSubmitSearch(): void {
    const reference = (this.searchQuery || '').trim();
    if (!reference) {
      return;
    }
    this.loadProductsByReference(reference);
  }

  /**
   * Load products by reference (SKU) using eq, STARTS WITH, CONTAINS
   * @param reference SKU reference to search for
   */
  private loadProductsByReference(reference: string): void {
    if (!this.selectedGender) return;

    // Reset pagination
    this.currentOffset = 0;
    this.hasMoreProducts = true;
    this.relatedProducts = [];
    this.showNoResults = false;

    const categoryId = this.selectedGender === 'Femme' ? 1 : 2;
    const sanitizedRef = reference.replace(/'/g, "''");
    const filter = `categories.id = ${categoryId} AND (sku = '${sanitizedRef}' OR sku STARTS WITH '${sanitizedRef}' OR sku CONTAINS '${sanitizedRef}')`;

    // Save filter for pagination
    this.currentFilter = filter;

    this.categoryService.searchProducts(filter, this.limit, this.currentOffset).subscribe({
      next: (response: any) => {
        this.relatedProducts = this.mapApiDataToProducts(response.hits || []);
        this.totalProducts = response.estimatedTotalHits || response.hits.length;
        this.showNoResults = (this.relatedProducts.length === 0);

        this.hasMoreProducts = this.relatedProducts.length >= this.limit && this.relatedProducts.length < this.totalProducts;
        this.currentOffset += this.limit;

        this.updateVisibleProducts();
        this.updateProductsWishlistStatus();
      },
      error: (error: any) => {
        console.error('Error loading products by reference:', error);
        // Keep current UI; do not fallback automatically to avoid confusion
      }
    });
  }

  /**
   * Map API data to Product interface
   */
  private mapApiDataToProducts(apiData: any[]): Product[] {
    return apiData.map((item) => ({
      sku: item.sku || '',
      title: item.title || '',
      id: item.id,
      idOrigin: item.idOrigin,
      price: item.currentPrice || item.price || 0,
      currentPrice: item.currentPrice || item.price || 0,
      imageInterval: item.imageInterval,
      Persona: item.Persona || 'unknown',
      activeImageIndex: 0,
      complements: item.complements || [],
      declinaisons: (item.declinaisons || []).map((d: any) => ({
        id: d.id,
        libellet: d.libellet || '',
        couleur: d.couleur || '',
        active: d.active !== undefined ? d.active : true,
        texture: d.texture ? {
          url: d.texture.url,
          ext: d.texture.ext,
          name: d.texture.name,
          width: d.texture.width,
          height: d.texture.height,
          medium: d.texture.medium
        } : undefined,
        images: (d.images || []).map((img: any) => ({
          url: img.url,
          ext: img.ext,
          name: img.name,
          width: img.width,
          height: img.height,
          medium: img.medium ? {
            url: img.medium.url,
            name: img.medium.name,
            width: img.medium.width,
            height: img.medium.height
          } : undefined
        }))
      })),
      categories: item.categories || [],
      Famille: item.Famille || '',
      Ligne: item.Ligne || '',
      tailles: [],
      colors: (item.declinaisons || []).map((d: any) => ({
        name: d.libellet || '',
        textureImage: d.texture?.url || '',
        mainImage: d.images?.[0]?.url || item.firstImg?.url || ''
      })),
      selectedColorIndex: 0,
      isInWishlist: false,
      articlesSimilaires: [],
      // Add properties for template compatibility
      firstImg: item.firstImg,
      secondImg: item.secondImg
    } as any));
  }

  /**
   * Update visible products for carousel
   */
  private updateVisibleProducts(): void {
    // Calculer l'index de début et de fin pour les produits visibles
    const startIndex = this.currentRelatedIndex;
    const endIndex = Math.min(startIndex + this.productsPerPage, this.relatedProducts.length);
    
    // Mettre à jour les produits visibles
    this.visibleRelatedProducts = this.relatedProducts.slice(startIndex, endIndex);
    
    // Si on n'a pas assez de produits visibles et qu'il y a plus de produits à charger
    if (this.visibleRelatedProducts.length < this.productsPerPage && this.hasMoreProducts && !this.isLoadingMore) {
      this.loadMoreProducts();
    }
  }

  /**
   * Navigate to previous products in carousel
   */
  prevRelatedProduct(): void {
    if (this.currentRelatedIndex > 0) {
      this.currentRelatedIndex = Math.max(0, this.currentRelatedIndex - this.productsPerPage);
      this.updateVisibleProducts();
    }
  }

  /**
   * Navigate to next products in carousel
   */
  nextRelatedProduct(): void {
    // Précharger les produits suivants si on est proche de la fin
    if (this.currentRelatedIndex + this.productsPerPage >= this.relatedProducts.length - 4) {
      this.preloadNextPage();
    }

    // Calculer le nouvel index
    const newIndex = Math.min(
      this.relatedProducts.length - this.productsPerPage,
      this.currentRelatedIndex + this.productsPerPage
    );

    // Ne mettre à jour que si on a un nouvel index valide
    if (newIndex > this.currentRelatedIndex) {
      this.currentRelatedIndex = newIndex;
      this.updateVisibleProducts();
    }
  }

  /**
   * Check if mobile view
   */
  isMobileView(): boolean {
    return window.innerWidth <= 768;
  }

  /**
   * Fetch user's wishlist from API
   */
  fetchWishlist(): void {
    // Only fetch if user is authenticated
    const token = localStorage.getItem('jwt');
    if (!token) {
      return;
    }

    this.isLoadingWishlist = true;
    this.productService.getWishlist().subscribe(
      (response) => {
        // Extract product IDs from wishlist
        this.wishlistProductIds = response.data.map((item: any) => item.id);

        // Update isInWishlist status for all products
        this.updateProductsWishlistStatus();

        this.isLoadingWishlist = false;
      },
      (error) => {
        console.error('Erreur lors de la récupération de la wishlist:', error);
        this.isLoadingWishlist = false;
      }
    );
  }

  /**
   * Update wishlist status for all products based on fetched wishlist
   */
  private updateProductsWishlistStatus(): void {
    // Update related products
    this.relatedProducts.forEach(product => {
      product.isInWishlist = this.wishlistProductIds.includes(product.id);
    });

    // Update visible products
    this.visibleRelatedProducts.forEach(product => {
      product.isInWishlist = this.wishlistProductIds.includes(product.id);
    });
  }

  /**
   * Select a color/texture for a product and update the main image
   */
  selectColor(product: any, index: number): void {
    if (!product || !product.declinaisons || index < 0 || index >= product.declinaisons.length) {
      return;
    }

    // Update selected color index
    product.selectedColorIndex = index;

    // Update the main image to show the first image of the selected color
    if (product.declinaisons[index] && product.declinaisons[index].images && product.declinaisons[index].images.length > 0) {
      // Update the colors array mainImage for consistency
      if (product.colors && product.colors[index]) {
        product.colors[index].mainImage = product.declinaisons[index].images[0].url;
      }
    }

    // Reset any active image cycling
    this.resetActiveImage(product);
  }

  /**
   * Reset active image to the first image of selected color
   */
  resetActiveImage(product: any): void {
    if (product.imageInterval) {
      clearInterval(product.imageInterval);
      product.imageInterval = null;
    }

    product.activeImageIndex = 0;

    // Set main image to first image of selected color
    if (product.declinaisons && product.declinaisons[product.selectedColorIndex]) {
      const selectedDeclinaison = product.declinaisons[product.selectedColorIndex];
      if (selectedDeclinaison.images && selectedDeclinaison.images.length > 0) {
        if (product.colors && product.colors[product.selectedColorIndex]) {
          product.colors[product.selectedColorIndex].mainImage = selectedDeclinaison.images[0].url;
        }
      }
    }
  }

  /**
   * Toggle wishlist for a product
   */
  toggleWishlist(product: any): void {
    // Check if user is authenticated
    const token = localStorage.getItem('jwt');
    if (!token) {
      console.warn('User not authenticated, cannot modify wishlist');
      return;
    }

    const wasInWishlist = product.isInWishlist;

    // Optimistically update UI
    product.isInWishlist = !product.isInWishlist;

    if (product.isInWishlist) {
      // Add to wishlist
      this.productService.addToWishList(product.id).subscribe(
        (response) => {
          // Add to local wishlist IDs
          if (!this.wishlistProductIds.includes(product.id)) {
            this.wishlistProductIds.push(product.id);
          }
        },
        (error) => {
          console.error('Erreur lors de l\'ajout à la wishlist:', error);
          // Revert optimistic update on error
          product.isInWishlist = wasInWishlist;
        }
      );
    } else {
      // Remove from wishlist
      this.productService.removeFromWishList(product.id).subscribe(
        (response) => {
          // Remove from local wishlist IDs
          this.wishlistProductIds = this.wishlistProductIds.filter(id => id !== product.id);
        },
        (error) => {
          console.error('Erreur lors de la suppression de la wishlist:', error);
          // Revert optimistic update on error
          product.isInWishlist = wasInWishlist;
        }
      );
    }
  }

  /**
   * Get product detail URL
   */
  getProductDetailUrl(product: any): string {
    if (!product || !product.id) {
      return '/produit/0-produit';
    }

    // Use the ProductService to generate the correct slug format (ID-name)
    return `/produit/${this.productService.generateProductSlug(product)}`;
  }

  /**
   * Navigate to product detail page and close modal
   * @param product Product to navigate to
   */
  navigateToProduct(product: any): void {
    if (!product || !product.id) {
      console.error('Cannot navigate: Invalid product', product);
      return;
    }

    // Prevent multiple clicks
    if (this.isNavigating) {
      return;
    }

    this.isNavigating = true;

    try {
      const productUrl = this.getProductDetailUrl(product);

      // Navigate first, then close modal after navigation is complete
      this.router.navigate([productUrl]).then((success) => {
        if (success) {
          this.closeModal();
        } else {
          console.error('Navigation failed');
        }
        this.isNavigating = false;
      }).catch((error) => {
        console.error('Navigation error:', error);
        this.isNavigating = false;
      });
    } catch (error) {
      console.error('Error navigating to product:', error);

      // Fallback navigation with just the product ID
      this.router.navigate(['/produit', product.id]).then((success) => {
        if (success) {
          this.closeModal();
        }
        this.isNavigating = false;
      }).catch((error) => {
        console.error('Fallback navigation error:', error);
        this.isNavigating = false;
      });
    }
  }

  /**
   * Get product image URL based on selected color
   */
  getProductImage(product: any): string {
    // Use selected color index if available
    const selectedIndex = product.selectedColorIndex || 0;

    // Try to get image from selected color's mainImage
    if (product.colors && product.colors[selectedIndex] && product.colors[selectedIndex].mainImage) {
      return product.colors[selectedIndex].mainImage;
    }

    // Try to get image from selected declinaison
    if (product.declinaisons && product.declinaisons[selectedIndex]) {
      const selectedDeclinaison = product.declinaisons[selectedIndex];
      if (selectedDeclinaison.images && selectedDeclinaison.images.length > 0) {
        return selectedDeclinaison.images[0].url;
      }
    }

    // Fallback to firstImg
    if (product.firstImg?.url) {
      return product.firstImg.url;
    }

    // Fallback to first declinaison if no selected color
    if (product.declinaisons && product.declinaisons.length > 0) {
      const firstDeclinaison = product.declinaisons[0];
      if (firstDeclinaison.images && firstDeclinaison.images.length > 0) {
        return firstDeclinaison.images[0].url;
      }
    }

    // Fallback to a default image or empty string
    return '';
  }

  private preloadNextPage(): void {
    if (this.hasMoreProducts && !this.isLoadingMore) {
      this.loadMoreProducts();
    }
  }
}
