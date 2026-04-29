import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';

export interface FeaturedProduct {
  id: number;
  title: string;
  price: number;
  currentPrice: number;
  discount: boolean;
  discountValue: number;
  image: string;
  secondImage?: string;
  colors: { name: string; textureImage: string }[];
  isNew?: boolean;
}

export interface FeaturedCategory {
  id: number;
  name: string;
  image: string;
  link: string;
}

@Injectable({
  providedIn: 'root'
})
export class FeaturedProductsService {
  private apiUrl = environementDev.apiSearchDev;
  private token = environementDev.tokenSearchDev;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });
  }

  getNewArrivals(limit: number = 8): Observable<FeaturedProduct[]> {
    limit = limit || 8;
    const body = {
      q: '',
      filter: 'disponible = true',
      sort: ['id:desc'],
      limit: limit
    };

    return this.http.post<any>(`${this.apiUrl}/indexes/products/search`, body, {
      headers: this.getHeaders()
    }).pipe(
      map(response => this.mapProducts(response.hits, true)),
      catchError(err => {
        console.error('Error fetching new arrivals:', err);
        return of([]);
      })
    );
  }

  getTrendingProducts(limit: number = 8): Observable<FeaturedProduct[]> {
    limit = limit || 8;
    const body = {
      q: '',
      filter: 'disponible = true AND discount = true',
      sort: ['discountValue:desc'],
      limit: limit
    };

    return this.http.post<any>(`${this.apiUrl}/indexes/products/search`, body, {
      headers: this.getHeaders()
    }).pipe(
      map(response => this.mapProducts(response.hits, false)),
      catchError(err => {
        console.error('Error fetching trending products:', err);
        return of([]);
      })
    );
  }

  getBestSellers(limit: number = 8): Observable<FeaturedProduct[]> {
    limit = limit || 8;
    const body = {
      q: '',
      filter: 'disponible = true',
      sort: ['currentPrice:asc'],
      limit: limit
    };

    return this.http.post<any>(`${this.apiUrl}/indexes/products/search`, body, {
      headers: this.getHeaders()
    }).pipe(
      map(response => this.mapProducts(response.hits, false)),
      catchError(err => {
        console.error('Error fetching best sellers:', err);
        return of([]);
      })
    );
  }

  getProductsByCategory(categoryId: number, limit: number = 4): Observable<FeaturedProduct[]> {
    limit = limit || 4;
    const body = {
      q: '',
      filter: `disponible = true AND categories.id = ${categoryId}`,
      limit: limit
    };

    return this.http.post<any>(`${this.apiUrl}/indexes/products/search`, body, {
      headers: this.getHeaders()
    }).pipe(
      map(response => this.mapProducts(response.hits, false)),
      catchError(err => {
        console.error('Error fetching category products:', err);
        return of([]);
      })
    );
  }

  getFeaturedCategories(): Observable<FeaturedCategory[]> {
    return this.http.post<any>(`${this.apiUrl}/indexes/categories/search`, {
      q: '',
      filter: 'active = true',
      limit: 6
    }, {
      headers: this.getHeaders()
    }).pipe(
      map(response => {
        return (response.hits || []).slice(0, 6).map((cat: any) => ({
          id: cat.id,
          name: cat.name || cat.publicName || 'Catégorie',
          // Handle multiple possible image field formats
          image: cat.bannerUrl || cat.banner_url || cat.banner?.url || cat.imageUrl || cat.image_url || cat.image?.url || '/assets/images/placeholder.jpg',
          link: cat.link || `${cat.id}-${this.slugify(cat.name || '')}`
        }));
      }),
      catchError(err => {
        console.error('Error fetching featured categories:', err);
        return of([]);
      })
    );
  }

  getAllHomeData(limits: { newArrivals: number; trending: number; categories: number } = { newArrivals: 8, trending: 8, categories: 6 }): Observable<{
    newArrivals: FeaturedProduct[];
    trending: FeaturedProduct[];
    categories: FeaturedCategory[];
  }> {
    return forkJoin({
      newArrivals: this.getNewArrivals(limits.newArrivals),
      trending: this.getTrendingProducts(limits.trending),
      categories: this.getFeaturedCategories()
    });
  }

  private mapProducts(hits: any[], markAsNew: boolean): FeaturedProduct[] {
    return (hits || []).map((product: any) => ({
      id: product.id,
      title: product.title || product.nom || product.name || '',
      price: Number(product.price || product.prix || product.currentPrice || 0),
      currentPrice: Number(product.currentPrice || product.prix || product.price || 0),
      discount: Boolean(product.discount || (product.discountValue || 0) > 0 || (product.price && product.currentPrice && product.price > product.currentPrice)),
      discountValue: Number(
        product.discountValue ||
        product.discount_value ||
        ((product.price && product.currentPrice && product.price > product.currentPrice)
          ? Math.round((1 - Number(product.currentPrice) / Number(product.price)) * 100)
          : 0)
      ),
      // Handle multiple possible image field formats
      image: product.firstImageUrl || product.firstImg?.url || product.image?.url || product.image || product.declinaisons?.[0]?.images?.[0]?.url || '/assets/images/placeholder.png',
      secondImage: product.secondImageUrl || product.secondImg?.url || product.declinaisons?.[0]?.images?.[1]?.url || '',
      colors: (product.colors || product.declinaisons || product.variants || []).map((d: any) => ({
        name: d.name || d.libellet || d.couleur || d.color || '',
        textureImage: d.texture?.url || d.textureImage || d.texture_image || ''
      })),
      isNew: markAsNew
    }));
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
