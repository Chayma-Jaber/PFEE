/**
 * @deprecated This service (v1) is deprecated.
 * Please use NextGenRecommendationsService instead for all recommendation features.
 *
 * Migration: Import from '../services/next-gen-recommendations.service'
 *
 * This service will be removed in a future version.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';

/** @deprecated Use RecommendedProduct from next-gen-recommendations.service */
export interface RecommendedProduct {
  id: number;
  reference: string;
  name: string;
  price: string;
  image: string;
  url: string;
}

export interface RecommendationResponse {
  products: RecommendedProduct[];
  source: 'personalized' | 'trending' | 'similar' | 'fallback';
  context?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiRecommendationsService {
  private apiUrl = environementDev.apiChatbot;
  private cachedRecommendations = new BehaviorSubject<RecommendedProduct[]>([]);
  private lastFetchTime: number = 0;
  private cacheValidityMs = 5 * 60 * 1000; // 5 minutes cache

  constructor(private http: HttpClient) {}

  getPersonalizedRecommendations(limit: number = 8): Observable<RecommendationResponse> {
    // Check cache first
    const now = Date.now();
    if (this.cachedRecommendations.value.length > 0 && (now - this.lastFetchTime) < this.cacheValidityMs) {
      return of({
        products: this.cachedRecommendations.value.slice(0, limit),
        source: 'personalized' as const
      });
    }

    // Build context from user data
    const userContext = this.buildUserContext();

    const messages = [
      {
        role: 'user',
        content: 'Recommande-moi des articles qui pourraient me plaire en fonction de mes préférences.'
      }
    ];

    return this.http.post<any>(this.apiUrl, {
      messages,
      user_context: userContext
    }).pipe(
      map(response => {
        const products = this.parseProductsFromResponse(response);
        this.cachedRecommendations.next(products);
        this.lastFetchTime = Date.now();
        return {
          products: products.slice(0, limit),
          source: 'personalized' as const
        };
      }),
      catchError(err => {
        console.error('Error fetching AI recommendations:', err);
        return of({ products: [], source: 'fallback' as const });
      })
    );
  }

  getSimilarProducts(productId: number, productName: string, limit: number = 6): Observable<RecommendationResponse> {
    const messages = [
      {
        role: 'user',
        content: `Trouve des articles similaires à "${productName}" (ID: ${productId}).`
      }
    ];

    return this.http.post<any>(this.apiUrl, {
      messages,
      user_context: this.buildUserContext()
    }).pipe(
      map(response => {
        const products = this.parseProductsFromResponse(response)
          .filter(p => p.id !== productId); // Exclude current product
        return {
          products: products.slice(0, limit),
          source: 'similar' as const,
          context: productName
        };
      }),
      catchError(err => {
        console.error('Error fetching similar products:', err);
        return of({ products: [], source: 'fallback' as const });
      })
    );
  }

  getComplementaryProducts(productId: number, productName: string, limit: number = 4): Observable<RecommendationResponse> {
    const messages = [
      {
        role: 'user',
        content: `Quels articles iraient bien avec "${productName}"? Suggère des compléments.`
      }
    ];

    return this.http.post<any>(this.apiUrl, {
      messages,
      user_context: this.buildUserContext()
    }).pipe(
      map(response => {
        const products = this.parseProductsFromResponse(response)
          .filter(p => p.id !== productId);
        return {
          products: products.slice(0, limit),
          source: 'similar' as const,
          context: `Avec ${productName}`
        };
      }),
      catchError(err => {
        console.error('Error fetching complementary products:', err);
        return of({ products: [], source: 'fallback' as const });
      })
    );
  }

  private buildUserContext(): any {
    const token = localStorage.getItem('jwt');
    const userStr = localStorage.getItem('user');
    let profile = {};

    if (userStr) {
      try {
        profile = JSON.parse(userStr);
      } catch (e) {
        profile = {};
      }
    }

    return {
      isLoggedIn: !!token,
      profile,
      // The backend will fetch orders, wishlist, etc. based on the token
    };
  }

  private parseProductsFromResponse(response: any): RecommendedProduct[] {
    // First try to use catalog_hits if available (direct product data)
    if (response.catalog_hits && Array.isArray(response.catalog_hits)) {
      return response.catalog_hits.map((hit: any) => ({
        id: hit.id,
        reference: hit.reference || hit.sku || '',
        name: hit.nom || hit.name || hit.title || '',
        price: hit.prix || `${hit.currentPrice || hit.price || ''} TND`,
        image: hit.image || hit.firstImg?.url || '',
        url: hit.url || `/produit/${hit.id}`
      }));
    }

    // Otherwise, parse from AI response text
    const content = response.choices?.[0]?.message?.content || '';
    return this.parseProductLines(content);
  }

  private parseProductLines(content: string): RecommendedProduct[] {
    const products: RecommendedProduct[] = [];
    const lines = content.split('\n').filter(line => line.includes('[ID:'));

    for (const line of lines) {
      const idMatch = line.match(/\[ID:(\d+)\]/);
      const refMatch = line.match(/\[([A-Z0-9-]+)\]/g);
      const partsMatch = line.match(/\] ([^|]+) \| ([^|]+) \| .*ImgPrincipale: ([^\s|]+)/);

      if (idMatch && partsMatch) {
        products.push({
          id: parseInt(idMatch[1], 10),
          reference: refMatch && refMatch.length > 1 ? refMatch[1].replace(/[\[\]]/g, '') : '',
          name: partsMatch[1].trim(),
          price: partsMatch[2].trim(),
          image: partsMatch[3].trim(),
          url: `/produit/${idMatch[1]}`
        });
      }
    }

    return products;
  }

  clearCache(): void {
    this.cachedRecommendations.next([]);
    this.lastFetchTime = 0;
  }
}
