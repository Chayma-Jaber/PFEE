import { Injectable } from '@angular/core';
import { Product } from '../models/Product';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';

interface NormalizedWishlistProduct {
  id: number;
  [key: string]: any;
}

interface NormalizedStockItem {
  size: string;
  qte: number;
  ean13: string;
  color?: string;
  productId?: number;
}

interface StockCheckSelector {
  productId?: number;
  color?: string;
  size?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  private api = 'https://main.barsha.com.tn';

  constructor(private http: HttpClient) {}

  private normalizeColorKey(value: string | null | undefined): string {
    return (value || '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '');
  }

  private normalizeWishlistProducts(response: any): NormalizedWishlistProduct[] {
    const rawItems = Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.items)
        ? response.items
        : Array.isArray(response)
          ? response
          : [];

    return rawItems
      .map((item: any) => {
        const normalizedId = Number(
          item?.product_id ??
          item?.productId ??
          item?.product?.id ??
          item?.id
        );

        if (!Number.isFinite(normalizedId)) {
          return null;
        }

        return {
          ...item,
          id: normalizedId,
        };
      })
      .filter((item: NormalizedWishlistProduct | null): item is NormalizedWishlistProduct => item !== null);
  }

  private normalizeStockItems(response: any): NormalizedStockItem[] {
    const rawItems = Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.items)
        ? response.items
        : Array.isArray(response)
          ? response
          : [];

    return rawItems.map((item: any) => ({
      size: item?.size ?? item?.taille ?? 'TU',
      qte: Number(item?.qte ?? item?.stock ?? 0),
      ean13: item?.ean13 ?? '',
      color: item?.color ?? item?.couleur ?? '',
      productId: Number(item?.productId ?? item?.product_id ?? 0) || undefined,
    }));
  }

  extractSizesForColor(response: any, selectedColor?: string | null): NormalizedStockItem[] {
    const items = this.normalizeStockItems(response);
    const selectedColorKey = this.normalizeColorKey(selectedColor);

    if (!selectedColorKey) {
      return items;
    }

    const matchingItems = items.filter((item) => {
      const itemColorKey = this.normalizeColorKey(item.color);
      return !itemColorKey || itemColorKey === selectedColorKey;
    });

    return matchingItems.length > 0 ? matchingItems : items;
  }

  getProductsByCategory(categoryId: number, limit: number = 12, offset: number = 0): Observable<{ hits: Product[], estimatedTotalHits?: number }> {
    limit = limit || 12;
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`,
      'Content-Type': 'application/json'
    });

    const body = {
      filter: `categories.id=${categoryId}`,
      limit: limit,
      offset: offset,
      sort: ["dateActivation:desc"]
    };

    return this.http.post<{ hits: Product[], estimatedTotalHits?: number }>(`${environementDev.apiSearchDev}/indexes/products/search`, body, { headers });
  }

  getDeclinaisonStock(declinaisonId: number): Observable<any> {
    return this.http.get<any>(`${environementDev.api}/api/getDeclinaisonStock/${declinaisonId}`).pipe(
      map((response) => ({
        data: this.normalizeStockItems(response),
      }))
    );
  }

  addToWishList(productId: number): Observable<any> {
    const body = { idProduct: productId };
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('jwt')}`,
      'Content-Type': 'application/json'
    });

    return this.http.post<any>(`${environementDev.api}/api/addWishListItem`, body, { headers });
  }

  getWishlist(): Observable<{ data: Product[] }> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('jwt')}`,
      'Content-Type': 'application/json'
    });

    return this.http.get<any>(`${environementDev.api}/api/getWishListItems`, { headers }).pipe(
      map((response) => ({
        data: this.normalizeWishlistProducts(response) as Product[],
      }))
    );
  }

  /**
   * Returns full Product records for the wishlist.
   * The legacy wishlist endpoint only returns product ids.
   */
  getWishlistProducts(): Observable<Product[]> {
    return this.getWishlist().pipe(
      switchMap((response) => {
        const wishlistItems = response?.data || [];
        const ids = wishlistItems
          .map((item: any) => Number(item?.id))
          .filter((id: number) => Number.isFinite(id));

        const uniqueIds = Array.from(new Set(ids));

        if (uniqueIds.length === 0) {
          return of([]);
        }

        return forkJoin(
          uniqueIds.map((id) =>
            this.getProductById(id).pipe(
              map((product) => product || this.createWishlistFallbackProduct(id)),
              catchError(() => of(this.createWishlistFallbackProduct(id)))
            )
          )
        ).pipe(map((products) => products.filter((p): p is Product => p != null)));
      })
    );
  }

  private createWishlistFallbackProduct(id: number): Product {
    return {
      id,
      title: `Produit #${id}`,
      currentPrice: 0,
      price: 0,
      firstImg: { url: 'assets/images/placeholder.png' },
      declinaisons: []
    } as unknown as Product;
  }

  removeFromWishList(productId: number): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('jwt')}`,
      'Content-Type': 'application/json'
    });

    return this.http.delete<any>(`${environementDev.api}/api/removeWishListItem/${productId}`, { headers });
  }

  checkStock(ean13: string, quantity: number, selector?: StockCheckSelector): Observable<any> {
    const payload = {
      ean13,
      quantity,
      productId: selector?.productId,
      color: selector?.color,
      size: selector?.size,
    };
    return this.http.post(`${environementDev.api}/api/checkStock`, payload);
  }

  getProductById(id: number): Observable<Product> {
    const params = new HttpParams()
      .set('filter', `id=${id}`)
      .set('sort', 'dateActivation:desc');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`
    });

    return this.http.get<{ hits: Product[] }>(`${environementDev.apiSearchDev}/indexes/products/search`, { params, headers }).pipe(
      map(response => response.hits[0])
    );
  }

  getProductByIdOrigin(idOrigin: number): Observable<Product> {
    const params = new HttpParams()
      .set('filter', `idOrigin=${idOrigin}`)
      .set('sort', 'dateActivation:desc');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`
    });

    return this.http.get<{ hits: Product[] }>(`${environementDev.apiSearchDev}/indexes/products/search`, { params, headers }).pipe(
      map(response => response.hits[0])
    );
  }

  generateProductSlug(product: Product): string {
    if (!product || !product.title) {
      return `${product.id}`;
    }

    const titleSlug = product.title
      .toLowerCase()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ç]/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return `${product.id}-${titleSlug}`;
  }

  getProductMetaInfo(productId: number, lang: string = 'fr'): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`,
      'Content-Type': 'application/json'
    });

    const body = {
      filter: `product = ${productId} AND lang = ${lang}`
    };

    return this.http.post<any>(`${environementDev.apiSearchDev}/indexes/product-meta-info/search`, body, { headers }).pipe(
      map(response => response.hits[0] || null)
    );
  }

  getTotalLook(productIds: number[]): Observable<{ hits: Product[] }> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`,
      'Content-Type': 'application/json'
    });

    const filterConditions = productIds.map(id => `id = ${id}`).join(' OR ');
    const body = {
      filter: filterConditions,
      limit: 100,
      sort: ["dateActivation:desc"]
    };

    return this.http.post<{ hits: Product[] }>(`${environementDev.apiSearchDev}/indexes/products/search`, body, { headers });
  }

  getSimilarProducts(title: string, famille: string, persona: string): Observable<{ hits: Product[] }> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`,
      'Content-Type': 'application/json'
    });

    const body = {
      q: title,
      filter: `Famille = '${famille}' AND Persona='${persona}'`,
      attributesToSearchOn: ['title'],
      sort: ["dateActivation:desc"]
    };

    return this.http.post<{ hits: Product[] }>(`${environementDev.apiSearchDev}/indexes/products/search`, body, { headers });
  }

}
