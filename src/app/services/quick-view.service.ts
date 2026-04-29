import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Product } from '../models/Product';
import { ProductService } from './product.service';

export interface QuickViewState {
  isOpen: boolean;
  productId: number | null;
  product: Product | null;
  isLoading: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class QuickViewService {
  private initialState: QuickViewState = {
    isOpen: false,
    productId: null,
    product: null,
    isLoading: false
  };

  private stateSubject = new BehaviorSubject<QuickViewState>(this.initialState);
  state$ = this.stateSubject.asObservable();

  constructor(private productService: ProductService) {}

  /**
   * Opens the quick view modal for a specific product
   * @param productId The ID of the product to display
   */
  openQuickView(productId: number): void {
    // Set loading state
    this.stateSubject.next({
      isOpen: true,
      productId: productId,
      product: null,
      isLoading: true
    });

    // Fetch product details
    this.productService.getProductById(productId).subscribe({
      next: (product) => {
        if (product) {
          // Map the product data
          const mappedProduct = this.mapProductData(product);

          this.stateSubject.next({
            isOpen: true,
            productId: productId,
            product: mappedProduct,
            isLoading: false
          });

          // Load stock for the first color
          if (mappedProduct.declinaisons && mappedProduct.declinaisons.length > 0) {
            this.loadStockForColor(mappedProduct, 0);
          }
        } else {
          this.closeQuickView();
        }
      },
      error: (error) => {
        console.error('Error loading product for quick view:', error);
        this.closeQuickView();
      }
    });
  }

  /**
   * Opens the quick view modal with an already loaded product
   * @param product The product to display
   */
  openQuickViewWithProduct(product: Product): void {
    const mappedProduct = this.mapProductData(product);

    this.stateSubject.next({
      isOpen: true,
      productId: product.id,
      product: mappedProduct,
      isLoading: false
    });

    // Load stock for the first color
    if (mappedProduct.declinaisons && mappedProduct.declinaisons.length > 0) {
      this.loadStockForColor(mappedProduct, 0);
    }
  }

  /**
   * Closes the quick view modal
   */
  closeQuickView(): void {
    this.stateSubject.next(this.initialState);
  }

  /**
   * Gets the current state synchronously
   */
  getCurrentState(): QuickViewState {
    return this.stateSubject.getValue();
  }

  /**
   * Updates the product in the current state
   */
  updateProduct(product: Product): void {
    const currentState = this.stateSubject.getValue();
    this.stateSubject.next({
      ...currentState,
      product: product
    });
  }

  /**
   * Loads stock information for a specific color
   */
  loadStockForColor(product: Product, colorIndex: number): void {
    const productId = product.id;
    const selectedColor = product.declinaisons[colorIndex]?.libellet || product.colors[colorIndex]?.name;
    if (productId) {
      this.productService.getDeclinaisonStock(productId).subscribe({
        next: (stockData) => {
          const sizesForColor = this.productService.extractSizesForColor(stockData, selectedColor);
          product.tailles = sizesForColor.map((item: any) => ({
            size: item.size,
            qte: item.qte,
            state: this.getSizeState(item.qte),
            ean13: item.ean13
          }));
          product.selectedColorIndex = colorIndex;
          this.updateProduct(product);
        },
        error: (error) => {
          console.error('Error loading stock:', error);
          product.tailles = [];
          this.updateProduct(product);
        }
      });
    }
  }

  /**
   * Maps API product data to the Product interface
   */
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
      tailles: [],
      colors: (apiProduct.declinaisons || []).map((d: any) => ({
        name: d.libellet || '',
        textureImage: d.texture?.url || '',
        mainImage: d.images?.[0]?.url || apiProduct.firstImg?.url || ''
      })),
      selectedColorIndex: 0,
      isInWishlist: apiProduct.isInWishlist || false,
      articlesSimilaires: [],
      firstImg: apiProduct.firstImg,
      secondImg: apiProduct.secondImg
    };
  }

  /**
   * Gets the state label for a given quantity
   */
  private getSizeState(qte: number): string {
    if (qte === 0) return 'Rupture de stock';
    if (qte <= 2) return 'Dernières pièces';
    return '';
  }
}
