import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FilterService, ProductFilters, ProductFilterParams } from './filter';

export interface FilterOptions {
  alphabeticSizes: string[];
  numericSizes: string[];
  standardSizes: string[];
  couleur: {
    name: string;
    code?: string;
    texture?: {
      url: string;
      ext: string;
      name: string;
      width: number;
      height: number;
    }
  }[];
  prix: {
    min: number;
    max: number;
    current: number;
  };
  ordre: string;
  count: number;
  categoryType?: 'hauts' | 'bas' | 'autre' | 'nouveautes';
}

export interface SelectedFilters {
  ordre: string;
  taille: string[];
  couleur: string[];
  prix: number;
  minPrix?: number; // Ajout du prix minimum
  type: string;
}

@Component({
  selector: 'app-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './filter.component.html',
  styleUrl: './filter.component.scss'
})
export class FilterComponent implements OnInit, OnChanges {
  @ViewChild('filterContent') filterContent!: ElementRef;
  @Input() showFilterPopup: boolean = false;
  @Input() categoryId: number | null = null;
  @Output() filterPopupToggle = new EventEmitter<boolean>();
  @Output() filtersChanged = new EventEmitter<SelectedFilters>();

  filteredProductsCount: number = 0;
  isLoading: boolean = false;

  // Default filter options that will be overridden by API data
  filterOptions: FilterOptions = {
    alphabeticSizes: [],
    numericSizes: [],
    standardSizes: [],
    couleur: [],
    prix: {
      min: 0,
      max: 200,
      current: 0
    },
    ordre: 'croissant',
    count: 0
  };

  selectedFilters: SelectedFilters = {
    ordre: '',
    taille: [] as string[],
    couleur: [] as string[],
    prix: 0.0,
    minPrix: 0.0, // Initialisation du prix minimum
    type: ''
  };

  constructor(private filterService: FilterService) {}

  ngOnInit(): void {
    // Nous ne chargeons pas les options de filtre ici pour éviter un appel API inutile
    // Les options seront chargées lorsque le popup sera ouvert

    // Initialize temporary price value with the current selected price
    this.tempPriceValue = this.selectedFilters.prix;
  }

  // Variable pour suivre si le filtre vient d'être ouvert
  private justOpened: boolean = false;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Vérifier si le filtre est ouvert
    if (this.showFilterPopup && this.filterContent) {
      // Vérifier si le clic est en dehors du contenu du filtre
      if (!this.filterContent.nativeElement.contains(event.target as Node)) {
        // Si le filtre vient d'être ouvert, ignorer ce clic
        if (this.justOpened) {
          this.justOpened = false;
          return;
        }
        // Fermer le filtre
        this.toggleFilterPopup();
      }
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Si le popup est ouvert et que nous avons un categoryId, charger les options de filtre
    if (changes['showFilterPopup'] &&
        changes['showFilterPopup'].currentValue === true &&
        this.categoryId) {
      // console.log('Filter popup opened via ngOnChanges, loading filter options for category ID:', this.categoryId);
      this.loadFilterOptions();
    }
  }

  // Cache pour stocker les résultats des appels API par categoryId
  private filterOptionsCache: Map<number, any> = new Map();

  /**
   * Loads filter options from the API based on the category ID
   * Utilise un cache pour éviter des appels API répétés
   */
  loadFilterOptions(): void {
    // console.log('loadFilterOptions called with categoryId:', this.categoryId);

    if (!this.categoryId) {
      return;
    }

    this.isLoading = true;

    // Vérifier si les données sont déjà en cache
    if (this.categoryId !== null && this.filterOptionsCache.has(this.categoryId)) {
      // console.log('Using cached filter options for categoryId:', this.categoryId);
      const cachedData = this.filterOptionsCache.get(this.categoryId);
      this.processFilterData(cachedData);
      this.isLoading = false;
      return;
    }

    // console.log('Making API call to fetchProductsFiltersByCategory with categoryId:', this.categoryId);

    // Utiliser un timeout pour annuler la requête si elle prend trop de temps
    const timeoutMs = 10000; // 10 secondes
    const timeoutId = setTimeout(() => {
      console.warn('API call timed out, using default values');
      this.isLoading = false;
      // Utiliser des valeurs par défaut en cas de timeout
      this.filterOptions = {
        alphabeticSizes: [],
        numericSizes: [],
        standardSizes: [],
        couleur: [],
        prix: {
          min: 0,
          max: 200,
          current: 0
        },
        ordre: 'croissant',
        count: 0
      };
    }, timeoutMs);

    this.filterService.fetchProductsFiltersByCategory(this.categoryId).subscribe({
      next: (response) => {
        clearTimeout(timeoutId); // Annuler le timeout
        // console.log('API response received:', response);

        // Stocker les données dans le cache
        if (this.categoryId !== null) {
          this.filterOptionsCache.set(this.categoryId, response.data);
        }

        // Traiter les données
        this.processFilterData(response.data);
        this.isLoading = false;
      },
      error: (error) => {
        clearTimeout(timeoutId); // Annuler le timeout
        console.error('Error loading filter options:', error);
        this.isLoading = false;
      }
    });
  }

  /**
   * Traite les données de filtre reçues de l'API
   * @param data Les données de filtre à traiter
   */
  private processFilterData(data: any): void {
    // Map API response to our FilterOptions interface
    const colorMap: { [key: string]: string } = {
      'NOIR': '#000000',
      'BLANC': '#FFFFFF',
      'ROUGE': '#FF0000',
      'BLEU': '#0000FF',
      'VERT': '#00FF00',
      'JAUNE': '#FFFF00',
      'ROSE': '#FFC0CB',
      'VIOLET': '#800080',
      'ORANGE': '#FFA500',
      'MARRON': '#8B4513',
      'GRIS': '#808080',
      'MULTI COULEUR': 'linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet)'
    };

    // Map colors to our format with name, code, and texture
    const mappedColors = data.colors.map((color: any) => ({
      name: this.formatColorName(color.name),
      code: colorMap[color.name] || '#CCCCCC', // Default to gray if color code not found
      texture: color.texture // Add texture information from API
    }));

    // Determine category type based on available sizes
    let categoryType: 'hauts' | 'bas' | 'autre' | 'nouveautes' = 'nouveautes';
    if (data.categoryType) {
      categoryType = data.categoryType;
    } else if (data.alphabeticSizes?.length > 0 && !data.numericSizes?.length) {
      categoryType = 'hauts';
    } else if (data.numericSizes?.length > 0 && !data.alphabeticSizes?.length) {
      categoryType = 'bas';
    } else if (data.standardSizes?.length > 0) {
      categoryType = 'autre';
    }

    this.filterOptions = {
      alphabeticSizes: data.alphabeticSizes || [],
      numericSizes: data.numericSizes?.map((size: number | string) => size.toString()) || [],
      standardSizes: data.standardSizes?.map((size: number | string) => size.toString()) || [],
      couleur: mappedColors,
      prix: {
        min: data.minPrice ,
        max: data.maxPrice ,
        current: data.maxPrice
      },
      ordre: 'croissant',
      count: data.count || 0,
      categoryType
    };

    // Debug: Log the filter options to see what data we have
    console.log('Filter options processed:', {
      alphabeticSizes: this.filterOptions.alphabeticSizes,
      numericSizes: this.filterOptions.numericSizes,
      standardSizes: this.filterOptions.standardSizes,
      categoryType: this.filterOptions.categoryType
    });

    // Update the selected filters with the new min and max prices
    this.selectedFilters.minPrix = this.filterOptions.prix.min;
    this.selectedFilters.prix = this.filterOptions.prix.max;

    // Also update the temporary price value
    this.tempPriceValue = this.filterOptions.prix.max;

    // Update the filtered products count
    this.filteredProductsCount = data.count || 0;
  }

  /**
   * Formats color names to be more user-friendly
   * @param color The color name from the API
   * @returns Formatted color name
   */
  formatColorName(color: string): string {
    if (!color) return '';
    return color.charAt(0) + color.slice(1).toLowerCase();
  }

  toggleFilterPopup(): void {
    this.showFilterPopup = !this.showFilterPopup;

    // Si le popup est ouvert et que nous avons un categoryId, charger les options de filtre
    if (this.showFilterPopup && this.categoryId) {
      // console.log('Filter popup toggled to open, loading filter options for category ID:', this.categoryId);
      this.loadFilterOptions();
      // Marquer que le filtre vient d'être ouvert pour éviter la fermeture immédiate
      this.justOpened = true;
    }

    this.filterPopupToggle.emit(this.showFilterPopup);
  }

  toggleFilter(type: 'taille' | 'couleur', value: string): void {
    const index = this.selectedFilters[type].indexOf(value);
    if (index === -1) {
      this.selectedFilters[type].push(value);
    } else {
      this.selectedFilters[type].splice(index, 1);
    }
    // After changing selection, update the dynamic count immediately
    this.updateFilteredProductsCount();
  }

  // Variable to track if the slider is being dragged
  isDraggingPriceSlider: boolean = false;
  // Temporary price value during dragging
  tempPriceValue: number = 0;

  // Called when slider input changes (during dragging)
  updatePriceFilter(event: Event): void {
    const target = event.target as HTMLInputElement;
    // Only update the temporary value during dragging, don't emit changes
    this.tempPriceValue = Number(target.value);
  }

  // Called when slider drag starts
  onPriceSliderStart(): void {
    this.isDraggingPriceSlider = true;
    // Initialize temporary value with current selected price
    this.tempPriceValue = this.selectedFilters.prix;
  }

  // Called when slider drag ends
  onPriceSliderEnd(): void {
    this.isDraggingPriceSlider = false;
    // Update the actual filter value with the temporary value
    this.selectedFilters.prix = this.tempPriceValue;
    // Store price selection locally without triggering API calls
    // API call will only be triggered when "Voir" button is clicked
  }

  toggleOrder(ordre: string): void {
    this.selectedFilters.ordre = ordre;
    // Store order selection locally without triggering API calls
    // API call will only be triggered when "Voir" button is clicked
  }

  toggleProductType(type: string): void {
    this.selectedFilters.type = this.selectedFilters.type === type ? '' : type;
    // Store product type selection locally without triggering API calls
    // API call will only be triggered when "Voir" button is clicked
  }

  resetFilters(): void {
    // Reset to show all products in the full price range
    this.selectedFilters = {
      ordre: '',
      taille: [],
      couleur: [],
      prix: this.filterOptions.prix.max,  // Set to max to show all products up to max price
      minPrix: this.filterOptions.prix.min,  // Keep min price at minimum
      type: ''
    };

    // Reset the temporary price value to match the selected price
    this.tempPriceValue = this.filterOptions.prix.max;

    // Reset the dragging state
    this.isDraggingPriceSlider = false;

    // Store reset filters locally without triggering API calls
    // API call will only be triggered when "Voir" button is clicked
  }

  applyFilters(): void {
    // Émettre les changements une dernière fois avant de fermer le popup
    this.filtersChanged.emit(this.selectedFilters);
    this.toggleFilterPopup();
  }

  /**
   * Calls the API to get filtered products and updates the count shown in the filter UI.
   * This uses the same parameters shape as `shop.component` when loading products.
   */
  updateFilteredProductsCount(): void {
    if (!this.categoryId) return;

    const params: ProductFilterParams = {
      idCategory: this.categoryId,
      limit: 1,
      offset: 0
    };

    // colors to uppercase as expected by backend
    if (this.selectedFilters.couleur && this.selectedFilters.couleur.length > 0) {
      params.colors = this.selectedFilters.couleur.map(c => c.toUpperCase());
    }

    if (this.selectedFilters.taille && this.selectedFilters.taille.length > 0) {
      params.sizes = this.selectedFilters.taille;
    }

    if (this.selectedFilters.ordre) {
      params.sortPrice = this.selectedFilters.ordre === 'croissant' ? 'asc' : 'desc';
    }

    if (this.selectedFilters.prix && this.selectedFilters.prix > 0) {
      params.maxPrice = this.selectedFilters.prix;
    }

    if (this.selectedFilters.minPrix !== undefined) {
      params.minPrice = this.selectedFilters.minPrix;
    }

    this.isLoading = true;
    this.filterService.fetchProductsByFilters(params).subscribe({
      next: (response: any) => {
        // Prefer `total` if backend provides it, otherwise fallback to `count` or data length
        this.filteredProductsCount = response.total ?? response.count ?? (response.data ? response.data.length : 0);
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Error updating filtered products count:', err);
        this.isLoading = false;
      }
    });
  }

  shouldShowSizeCategory(category: 'hauts' | 'bas' | 'autre'): boolean {
    // Show a size category if it has data, regardless of categoryType
    switch (category) {
      case 'hauts':
        return this.filterOptions.alphabeticSizes.length > 0;
      case 'bas':
        return this.filterOptions.numericSizes.length > 0;
      case 'autre':
        return this.filterOptions.standardSizes.length > 0;
      default:
        return false;
    }
  }

  getSizeCategoryLabel(category: 'hauts' | 'bas' | 'autre'): string {
    switch (category) {
      case 'hauts':
        return 'hauts';
      case 'bas':
        return 'bas';
      case 'autre':
        return 'autre';
      default:
        return '';
    }
  }

  getSizesForCategory(category: 'hauts' | 'bas' | 'autre'): string[] {
    switch (category) {
      case 'hauts':
        return this.filterOptions.alphabeticSizes;
      case 'bas':
        return this.filterOptions.numericSizes;
      case 'autre':
        return this.filterOptions.standardSizes;
      default:
        return [];
    }
  }
}
