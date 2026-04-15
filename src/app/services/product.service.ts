import { Injectable } from '@angular/core';
import { Product } from '../models/Product';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  private api = 'https://main.barsha.com.tn';

  constructor(private http: HttpClient) {}

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
    return this.http.get<any>(`${environementDev.api}/api/getDeclinaisonStock/${declinaisonId}`);
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

    return this.http.get<{ data: Product[] }>(`${environementDev.api}/api/getWishListItems`, { headers });
  }

  removeFromWishList(productId: number): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('jwt')}`,
      'Content-Type': 'application/json'
    });

    return this.http.delete<any>(`${environementDev.api}/api/removeWishListItem/${productId}`, { headers });
  }

  checkStock(ean13: string, quantity: number): Observable<any> {
    const payload = { ean13, quantity };
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
