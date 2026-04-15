/**
 * BARSHA RECENTLY VIEWED SERVICE
 * ================================
 * Manages recently viewed products with persistence and sync.
 * Provides "Continue Shopping" functionality.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface RecentlyViewedProduct {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  discount?: boolean;
  discountValue?: number;
  image: string;
  family?: string;
  viewedAt: number;  // Timestamp
}

const MAX_RECENTLY_VIEWED = 20;
const STORAGE_KEY = 'barsha_recently_viewed';

@Injectable({
  providedIn: 'root'
})
export class RecentlyViewedService {
  private recentlyViewedSubject = new BehaviorSubject<RecentlyViewedProduct[]>([]);
  public recentlyViewed$ = this.recentlyViewedSubject.asObservable();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Add a product to recently viewed
   */
  addProduct(product: {
    id: number;
    title?: string;
    name?: string;
    currentPrice?: number;
    price?: number;
    discount?: boolean;
    discountValue?: number;
    image?: string;
    firstImg?: { url: string };
    Famille?: string;
    family?: string;
  }): void {
    const current = this.recentlyViewedSubject.value;

    // Remove if already exists
    const filtered = current.filter(p => p.id !== product.id);

    // Create new entry
    const newEntry: RecentlyViewedProduct = {
      id: product.id,
      name: product.title || product.name || 'Product',
      price: product.currentPrice || product.price || 0,
      originalPrice: product.discount ? product.price : undefined,
      discount: product.discount,
      discountValue: product.discountValue,
      image: product.image || product.firstImg?.url || '',
      family: product.Famille || product.family,
      viewedAt: Date.now()
    };

    // Add to beginning and limit to max
    const updated = [newEntry, ...filtered].slice(0, MAX_RECENTLY_VIEWED);

    this.recentlyViewedSubject.next(updated);
    this.saveToStorage(updated);

    // Also update the simple ID list for AI recommendations
    this.updateProductIdList(updated);
  }

  /**
   * Get recently viewed products
   */
  getRecentlyViewed(limit?: number): RecentlyViewedProduct[] {
    const products = this.recentlyViewedSubject.value;
    return limit ? products.slice(0, limit) : products;
  }

  /**
   * Get recently viewed product IDs (for recommendations)
   */
  getRecentlyViewedIds(limit?: number): number[] {
    const products = this.recentlyViewedSubject.value;
    const ids = products.map(p => p.id);
    return limit ? ids.slice(0, limit) : ids;
  }

  /**
   * Check if a product was recently viewed
   */
  wasRecentlyViewed(productId: number): boolean {
    return this.recentlyViewedSubject.value.some(p => p.id === productId);
  }

  /**
   * Get the last viewed product (for "Continue Shopping")
   */
  getLastViewed(): RecentlyViewedProduct | null {
    const products = this.recentlyViewedSubject.value;
    return products.length > 0 ? products[0] : null;
  }

  /**
   * Clear all recently viewed products
   */
  clearAll(): void {
    this.recentlyViewedSubject.next([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('recentlyViewed');
  }

  /**
   * Remove a specific product from history
   */
  removeProduct(productId: number): void {
    const current = this.recentlyViewedSubject.value;
    const filtered = current.filter(p => p.id !== productId);
    this.recentlyViewedSubject.next(filtered);
    this.saveToStorage(filtered);
    this.updateProductIdList(filtered);
  }

  /**
   * Get viewing history grouped by date
   */
  getGroupedByDate(): { date: string; products: RecentlyViewedProduct[] }[] {
    const products = this.recentlyViewedSubject.value;
    const groups = new Map<string, RecentlyViewedProduct[]>();

    products.forEach(product => {
      const date = new Date(product.viewedAt);
      const dateKey = this.formatDateKey(date);

      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(product);
    });

    return Array.from(groups.entries()).map(([date, products]) => ({
      date,
      products
    }));
  }

  private formatDateKey(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (this.isSameDay(date, today)) {
      return "Aujourd'hui";
    } else if (this.isSameDay(date, yesterday)) {
      return 'Hier';
    } else {
      return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
    }
  }

  private isSameDay(d1: Date, d2: Date): boolean {
    return d1.getDate() === d2.getDate() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getFullYear() === d2.getFullYear();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const products = JSON.parse(stored) as RecentlyViewedProduct[];
        // Filter out old entries (older than 30 days)
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const recent = products.filter(p => p.viewedAt > thirtyDaysAgo);
        this.recentlyViewedSubject.next(recent);
      }
    } catch (e) {
      console.error('Error loading recently viewed from storage:', e);
      this.recentlyViewedSubject.next([]);
    }
  }

  private saveToStorage(products: RecentlyViewedProduct[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    } catch (e) {
      console.error('Error saving recently viewed to storage:', e);
    }
  }

  private updateProductIdList(products: RecentlyViewedProduct[]): void {
    // Also update the simple ID list for backward compatibility
    const ids = products.map(p => p.id);
    localStorage.setItem('recentlyViewed', JSON.stringify(ids));
  }
}
