/**
 * BARSHA FAVORITES SERVICE
 * ========================
 * Manages wishlist items and collections (Pinterest-style boards).
 * Provides CRUD operations for collections and item organization.
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';

// ========================
// Interfaces
// ========================

export interface WishlistCollection {
  id: number;
  userId: number;
  name: string;
  description?: string;
  isDefault: boolean;
  isPublic: boolean;
  shareToken?: string;
  coverImage?: string;
  itemCount: number;
  previewImages?: (string | null)[];
  createdAt: string;
  updatedAt?: string;
  items?: WishlistItem[];
}

export interface WishlistItem {
  id: number;
  userId: number;
  collectionId?: number;
  productId: number;
  notes?: string;
  addedAt: string;
  product?: {
    id: number;
    title: string;
    currentPrice: number;
    price: number;
    discount: boolean;
    firstImg?: { url: string };
    famille?: string;
  };
  createdAt: string;
}

export interface CreateCollectionRequest {
  name: string;
  description?: string;
  isPublic?: boolean;
}

export interface UpdateCollectionRequest {
  name?: string;
  description?: string;
  isPublic?: boolean;
}

export interface CollectionStats {
  totalCollections: number;
  totalItems: number;
  uncategorizedCount: number;
}

// ========================
// Service
// ========================

@Injectable({
  providedIn: 'root'
})
export class FavoritesService {
  private readonly apiUrl = `${environementDev.backendAiUrl}/api/wishlist/collections`;

  // State management
  private collectionsSubject = new BehaviorSubject<WishlistCollection[]>([]);
  private statsSubject = new BehaviorSubject<CollectionStats>({
    totalCollections: 0,
    totalItems: 0,
    uncategorizedCount: 0
  });

  public collections$ = this.collectionsSubject.asObservable();
  public stats$ = this.statsSubject.asObservable();

  constructor(private http: HttpClient) {}

  // ========================
  // Auth Headers
  // ========================

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwt');
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  // ========================
  // Collection Methods
  // ========================

  /**
   * Get all collections for the current user
   */
  getCollections(includeItems: boolean = false): Observable<WishlistCollection[]> {
    let params = new HttpParams();
    if (includeItems) {
      params = params.set('include_items', 'true');
    }

    return this.http.get<{
      success: boolean;
      collections: WishlistCollection[];
      uncategorizedCount: number;
      totalItems: number;
    }>(this.apiUrl, { headers: this.getHeaders(), params }).pipe(
      map(response => {
        const collections = response.collections || [];
        this.collectionsSubject.next(collections);
        this.statsSubject.next({
          totalCollections: collections.length,
          totalItems: response.totalItems || 0,
          uncategorizedCount: response.uncategorizedCount || 0
        });
        return collections;
      }),
      catchError(error => {
        console.error('Error fetching collections:', error);
        return of([]);
      })
    );
  }

  /**
   * Create a new collection
   */
  createCollection(name: string, description?: string, isPublic: boolean = false): Observable<WishlistCollection | null> {
    const body: CreateCollectionRequest = {
      name,
      description,
      isPublic
    };

    return this.http.post<{
      success: boolean;
      collection: WishlistCollection;
      message: string;
    }>(this.apiUrl, body, { headers: this.getHeaders() }).pipe(
      map(response => {
        if (response.success && response.collection) {
          const current = this.collectionsSubject.value;
          this.collectionsSubject.next([response.collection, ...current]);
          return response.collection;
        }
        return null;
      }),
      catchError(error => {
        console.error('Error creating collection:', error);
        return of(null);
      })
    );
  }

  /**
   * Get a specific collection with items
   */
  getCollection(collectionId: number): Observable<WishlistCollection | null> {
    return this.http.get<{
      success: boolean;
      collection: WishlistCollection;
    }>(`${this.apiUrl}/${collectionId}`, { headers: this.getHeaders() }).pipe(
      map(response => response.success ? response.collection : null),
      catchError(error => {
        console.error('Error fetching collection:', error);
        return of(null);
      })
    );
  }

  /**
   * Update a collection's settings
   */
  updateCollection(collectionId: number, data: UpdateCollectionRequest): Observable<WishlistCollection | null> {
    return this.http.put<{
      success: boolean;
      collection: WishlistCollection;
      message: string;
    }>(`${this.apiUrl}/${collectionId}`, data, { headers: this.getHeaders() }).pipe(
      map(response => {
        if (response.success && response.collection) {
          const current = this.collectionsSubject.value;
          const updated = current.map(c =>
            c.id === collectionId ? response.collection : c
          );
          this.collectionsSubject.next(updated);
          return response.collection;
        }
        return null;
      }),
      catchError(error => {
        console.error('Error updating collection:', error);
        return of(null);
      })
    );
  }

  /**
   * Delete a collection
   */
  deleteCollection(collectionId: number, moveItemsTo?: number | null): Observable<boolean> {
    let params = new HttpParams();
    if (moveItemsTo !== undefined && moveItemsTo !== null) {
      params = params.set('move_items_to', moveItemsTo.toString());
    }

    return this.http.delete<{
      success: boolean;
      message: string;
    }>(`${this.apiUrl}/${collectionId}`, { headers: this.getHeaders(), params }).pipe(
      map(response => {
        if (response.success) {
          const current = this.collectionsSubject.value;
          this.collectionsSubject.next(current.filter(c => c.id !== collectionId));
          return true;
        }
        return false;
      }),
      catchError(error => {
        console.error('Error deleting collection:', error);
        return of(false);
      })
    );
  }

  // ========================
  // Item Management Methods
  // ========================

  /**
   * Get all wishlist items with optional filtering
   */
  getCollectionItems(collectionId?: number, uncategorizedOnly: boolean = false): Observable<WishlistItem[]> {
    let params = new HttpParams();
    if (collectionId !== undefined && collectionId !== null) {
      params = params.set('collection_id', collectionId.toString());
    }
    if (uncategorizedOnly) {
      params = params.set('uncategorized_only', 'true');
    }

    return this.http.get<{
      success: boolean;
      items: WishlistItem[];
      total: number;
    }>(`${this.apiUrl}/items/all`, { headers: this.getHeaders(), params }).pipe(
      map(response => response.success ? response.items : []),
      catchError(error => {
        console.error('Error fetching items:', error);
        return of([]);
      })
    );
  }

  /**
   * Move an item to a different collection
   */
  moveToCollection(productId: number, collectionId: number | null): Observable<WishlistItem | null> {
    const body = {
      product_id: productId,
      target_collection_id: collectionId
    };

    return this.http.post<{
      success: boolean;
      item: WishlistItem;
      message: string;
    }>(`${this.apiUrl}/items/move`, body, { headers: this.getHeaders() }).pipe(
      map(response => {
        if (response.success) {
          // Refresh collections to update counts
          this.getCollections().subscribe();
          return response.item;
        }
        return null;
      }),
      catchError(error => {
        console.error('Error moving item:', error);
        return of(null);
      })
    );
  }

  /**
   * Remove an item from a specific collection (moves to uncategorized)
   */
  removeFromCollection(productId: number, collectionId: number): Observable<boolean> {
    let params = new HttpParams().set('collection_id', collectionId.toString());

    return this.http.delete<{
      success: boolean;
      message: string;
    }>(`${this.apiUrl}/items/${productId}`, { headers: this.getHeaders(), params }).pipe(
      map(response => {
        if (response.success) {
          this.getCollections().subscribe();
          return true;
        }
        return false;
      }),
      catchError(error => {
        console.error('Error removing item from collection:', error);
        return of(false);
      })
    );
  }

  /**
   * Update notes for a wishlist item
   */
  updateItemNotes(productId: number, notes: string | null): Observable<WishlistItem | null> {
    return this.http.put<{
      success: boolean;
      item: WishlistItem;
      message: string;
    }>(`${this.apiUrl}/items/${productId}/notes`, { notes }, { headers: this.getHeaders() }).pipe(
      map(response => response.success ? response.item : null),
      catchError(error => {
        console.error('Error updating notes:', error);
        return of(null);
      })
    );
  }

  // ========================
  // Sharing Methods
  // ========================

  /**
   * Toggle public sharing for a collection
   */
  toggleCollectionSharing(collectionId: number): Observable<{
    isPublic: boolean;
    shareToken?: string;
    shareUrl?: string;
  } | null> {
    return this.http.post<{
      success: boolean;
      isPublic: boolean;
      shareToken?: string;
      shareUrl?: string;
      message: string;
    }>(`${this.apiUrl}/${collectionId}/toggle-sharing`, {}, { headers: this.getHeaders() }).pipe(
      map(response => {
        if (response.success) {
          // Update collection in state
          const current = this.collectionsSubject.value;
          const updated = current.map(c => {
            if (c.id === collectionId) {
              return {
                ...c,
                isPublic: response.isPublic,
                shareToken: response.shareToken
              };
            }
            return c;
          });
          this.collectionsSubject.next(updated);

          return {
            isPublic: response.isPublic,
            shareToken: response.shareToken,
            shareUrl: response.shareUrl
          };
        }
        return null;
      }),
      catchError(error => {
        console.error('Error toggling sharing:', error);
        return of(null);
      })
    );
  }

  /**
   * Get a publicly shared collection
   */
  getSharedCollection(shareToken: string): Observable<{
    name: string;
    description?: string;
    itemCount: number;
    ownerName: string;
    items: WishlistItem[];
  } | null> {
    return this.http.get<{
      success: boolean;
      collection: {
        name: string;
        description?: string;
        itemCount: number;
        ownerName: string;
        items: WishlistItem[];
      };
    }>(`${this.apiUrl}/shared/${shareToken}`).pipe(
      map(response => response.success ? response.collection : null),
      catchError(error => {
        console.error('Error fetching shared collection:', error);
        return of(null);
      })
    );
  }

  /**
   * Generate share URL for a collection
   */
  getCollectionShareUrl(shareToken: string): string {
    return `${window.location.origin}/wishlist/collection/${shareToken}`;
  }

  /**
   * Copy collection share URL to clipboard
   */
  async copyShareUrl(shareToken: string): Promise<boolean> {
    const url = this.getCollectionShareUrl(shareToken);
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
      } catch (e) {
        document.body.removeChild(textArea);
        return false;
      }
    }
  }

  // ========================
  // Helper Methods
  // ========================

  /**
   * Get current collections from state
   */
  getCurrentCollections(): WishlistCollection[] {
    return this.collectionsSubject.value;
  }

  /**
   * Get current stats from state
   */
  getCurrentStats(): CollectionStats {
    return this.statsSubject.value;
  }

  /**
   * Refresh all data
   */
  refresh(): void {
    this.getCollections().subscribe();
  }
}
