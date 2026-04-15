import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Product } from '../models/Product';

export interface ComparisonProduct {
  id: number;
  title: string;
  price: number;
  currentPrice: number;
  discount?: boolean;
  discountValue?: number;
  image: string;
  category?: string;
  Famille?: string;
  material?: string;
  sizes: string[];
  colors: string[];
  rating?: number;
  inStock: boolean;
  sku: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductComparisonService {
  private readonly STORAGE_KEY = 'barsha_comparison_products';
  private readonly MAX_PRODUCTS = 4;

  private comparedProductsSubject = new BehaviorSubject<ComparisonProduct[]>([]);
  comparedProducts$ = this.comparedProductsSubject.asObservable();

  private toastMessageSubject = new BehaviorSubject<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  toastMessage$ = this.toastMessageSubject.asObservable();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load comparison products from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const products = JSON.parse(stored);
        if (Array.isArray(products)) {
          this.comparedProductsSubject.next(products);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des produits de comparaison:', error);
      this.comparedProductsSubject.next([]);
    }
  }

  /**
   * Save comparison products to localStorage
   */
  private saveToStorage(products: ComparisonProduct[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(products));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des produits de comparaison:', error);
    }
  }

  /**
   * Show toast notification
   */
  private showToast(type: 'success' | 'error' | 'warning', message: string): void {
    this.toastMessageSubject.next({ type, message });
    // Auto-clear toast after 3 seconds
    setTimeout(() => {
      this.toastMessageSubject.next(null);
    }, 3000);
  }

  /**
   * Add a product to comparison
   */
  addToComparison(product: Product): boolean {
    const currentProducts = this.comparedProductsSubject.getValue();

    // Check if product is already in comparison
    if (currentProducts.some(p => p.id === product.id)) {
      this.showToast('warning', 'Ce produit est deja dans la comparaison');
      return false;
    }

    // Check if maximum limit reached
    if (currentProducts.length >= this.MAX_PRODUCTS) {
      this.showToast('error', `Vous ne pouvez comparer que ${this.MAX_PRODUCTS} produits maximum`);
      return false;
    }

    // Convert Product to ComparisonProduct
    const comparisonProduct: ComparisonProduct = {
      id: product.id,
      title: product.title,
      price: product.price,
      currentPrice: product.currentPrice,
      discount: product.discount,
      discountValue: product.discountValue,
      image: product.declinaisons?.[0]?.images?.[0]?.url || product.firstImg?.url || '',
      category: product.categories?.[0]?.id?.toString() || '',
      Famille: product.Famille,
      material: '', // Material info would come from productMeta if available
      sizes: product.tailles?.map(t => t.size) || [],
      colors: product.colors?.map(c => c.name) || product.declinaisons?.map(d => d.libellet) || [],
      rating: undefined, // Rating would come from reviews if available
      inStock: product.tailles?.some(t => t.qte > 0) ?? true,
      sku: product.sku
    };

    const updatedProducts = [...currentProducts, comparisonProduct];
    this.comparedProductsSubject.next(updatedProducts);
    this.saveToStorage(updatedProducts);
    this.showToast('success', 'Produit ajoute a la comparaison');
    return true;
  }

  /**
   * Add a product from simplified data (for use in product cards)
   */
  addToComparisonFromCard(productData: {
    id: number;
    title: string;
    price: number;
    currentPrice: number;
    discount?: boolean;
    discountValue?: number;
    image: string;
    Famille?: string;
    sizes?: string[];
    colors?: string[];
    inStock?: boolean;
    sku?: string;
  }): boolean {
    const currentProducts = this.comparedProductsSubject.getValue();

    // Check if product is already in comparison
    if (currentProducts.some(p => p.id === productData.id)) {
      this.showToast('warning', 'Ce produit est deja dans la comparaison');
      return false;
    }

    // Check if maximum limit reached
    if (currentProducts.length >= this.MAX_PRODUCTS) {
      this.showToast('error', `Vous ne pouvez comparer que ${this.MAX_PRODUCTS} produits maximum`);
      return false;
    }

    const comparisonProduct: ComparisonProduct = {
      id: productData.id,
      title: productData.title,
      price: productData.price,
      currentPrice: productData.currentPrice,
      discount: productData.discount,
      discountValue: productData.discountValue,
      image: productData.image,
      category: '',
      Famille: productData.Famille,
      material: '',
      sizes: productData.sizes || [],
      colors: productData.colors || [],
      rating: undefined,
      inStock: productData.inStock ?? true,
      sku: productData.sku || ''
    };

    const updatedProducts = [...currentProducts, comparisonProduct];
    this.comparedProductsSubject.next(updatedProducts);
    this.saveToStorage(updatedProducts);
    this.showToast('success', 'Produit ajoute a la comparaison');
    return true;
  }

  /**
   * Remove a product from comparison
   */
  removeFromComparison(productId: number): void {
    const currentProducts = this.comparedProductsSubject.getValue();
    const updatedProducts = currentProducts.filter(p => p.id !== productId);
    this.comparedProductsSubject.next(updatedProducts);
    this.saveToStorage(updatedProducts);
    this.showToast('success', 'Produit retire de la comparaison');
  }

  /**
   * Clear all products from comparison
   */
  clearComparison(): void {
    this.comparedProductsSubject.next([]);
    this.saveToStorage([]);
    this.showToast('success', 'Comparaison videe');
  }

  /**
   * Get current compared products
   */
  getComparedProducts(): ComparisonProduct[] {
    return this.comparedProductsSubject.getValue();
  }

  /**
   * Get the number of products in comparison
   */
  getComparisonCount(): number {
    return this.comparedProductsSubject.getValue().length;
  }

  /**
   * Check if a product is in comparison
   */
  isInComparison(productId: number): boolean {
    return this.comparedProductsSubject.getValue().some(p => p.id === productId);
  }

  /**
   * Get maximum number of products allowed
   */
  getMaxProducts(): number {
    return this.MAX_PRODUCTS;
  }

  /**
   * Check if comparison is full
   */
  isComparisonFull(): boolean {
    return this.comparedProductsSubject.getValue().length >= this.MAX_PRODUCTS;
  }
}
