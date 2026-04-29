import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';

export interface VisualSearchResult {
  detected: {
    title_guess: string;
    famille: string | null;
    colors: string[];
    style_keywords: string[];
    confidence: number;
  };
  similaires: string[];
  complements: string[];
  method?: string;
  total_searched?: number;
  error?: string;
}

interface StructuredVisualSearchResponse {
  method: string;
  results: Array<{
    id?: number;
    product_id?: number;
    nom?: string;
    prix?: number;
    currentPrice?: number;
    image?: string;
    famille?: string;
    category?: string;
    score?: number;
    similarity?: number;
  }>;
  count: number;
  confidence: number;
  error?: string;
}

export interface ParsedProduct {
  id: number;
  reference: string;
  name: string;
  price: string;
  famille: string;
  colors: string;
  image: string;
  url: string;
}

@Injectable({
  providedIn: 'root'
})
export class VisualSearchService {
  private apiUrl = environementDev.apiChatbot.replace('/api/chat', '');

  constructor(private http: HttpClient) {}

  searchByImage(imageBase64: string, imageUrl?: string): Observable<VisualSearchResult> {
    const normalizedImage = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const payload: any = { image: normalizedImage, limit: 12 };

    if (imageUrl) {
      payload.image_url = imageUrl;
    }

    return this.http.post<StructuredVisualSearchResponse>(`${this.apiUrl}/api/visual-search`, payload).pipe(
      map((response) => {
        const results = response.results || [];
        const hasCatalogFields = results.some((product) => !!product.id && !!product.nom);

        // When requests are routed through the Nest backend, /api/visual-search may
        // return only { product_id, similarity }. In that case we fall back to the
        // legacy /api/like-this endpoint, which still returns product-rich lines.
        if (results.length > 0 && !hasCatalogFields) {
          throw new Error('visual-search-results-missing-catalog-fields');
        }

        const hasResults = results.length > 0;

        return {
          method: response.method,
          similaires: results.map((product) =>
            `[ID:${product.id}] ${product.nom} - ${Number(product.currentPrice || product.prix || 0).toFixed(3)} TND | ${product.image || ''}`
          ),
          complements: [],
          detected: hasResults
            ? {
                title_guess: results[0]?.nom || 'RECHERCHE VISUELLE',
                famille: results[0]?.famille || null,
                colors: ['Match visuel'],
                style_keywords: ['clip'],
                confidence: response.confidence || 0,
              }
            : {
                title_guess: '',
                famille: null,
                colors: [],
                style_keywords: [],
                confidence: 0,
              },
          total_searched: response.count,
          error: response.error,
        };
      }),
      catchError(() =>
        this.http.post<VisualSearchResult>(`${this.apiUrl}/api/like-this`, payload).pipe(
          map((response) => this.normalizeLegacyResponse(response)),
          catchError(() =>
            of({
              method: 'error',
              similaires: [],
              complements: [],
              detected: {
                title_guess: '',
                famille: null,
                colors: [],
                style_keywords: [],
                confidence: 0,
              },
              error: 'La recherche visuelle est temporairement indisponible.',
            })
          )
        )
      )
    );
  }

  private normalizeLegacyResponse(response: VisualSearchResult): VisualSearchResult {
    const titleGuess = (response.detected?.title_guess || '').trim().toUpperCase();
    const isUnavailable =
      response.method === 'no_model' ||
      response.method === 'unavailable' ||
      titleGuess === 'AUCUN' ||
      titleGuess === 'ERREUR' ||
      titleGuess === 'SERVICE_UNAVAILABLE';

    if (!isUnavailable) {
      return response;
    }

    return {
      ...response,
      similaires: [],
      detected: {
        title_guess: '',
        famille: null,
        colors: [],
        style_keywords: [],
        confidence: 0,
      },
      error: this.getFriendlyErrorMessage(response.error),
    };
  }

  private getFriendlyErrorMessage(error?: string): string {
    const normalized = (error || '').trim().toLowerCase();
    if (!normalized) {
      return 'La recherche visuelle est temporairement indisponible.';
    }

    if (
      normalized.includes('clip') ||
      normalized.includes('no model') ||
      normalized.includes('service unavailable') ||
      normalized.includes('not available')
    ) {
      return 'La recherche visuelle est temporairement indisponible. Essayez de nouveau dans un moment.';
    }

    return error!;
  }

  parseProductLine(line: string): ParsedProduct | null {
    const idMatch = line.match(/\[ID:(\d+)\]/);
    if (!idMatch) return null;

    const id = parseInt(idMatch[1], 10);

    const fullMatch = line.match(/\] ([^|]+) \| ([^|]+) \| Famille:([^|]*) \| Couleurs\+Images: ([^|]*) \| ImgPrincipale: ([^|]*) \| (.+)$/);
    if (fullMatch) {
      const refMatch = line.match(/\[([A-Z0-9-]+)\]/g);
      return {
        id,
        reference: refMatch && refMatch.length > 1 ? refMatch[1].replace(/[\[\]]/g, '') : '',
        name: fullMatch[1].trim(),
        price: fullMatch[2].trim(),
        famille: fullMatch[3].trim(),
        colors: fullMatch[4].trim(),
        image: fullMatch[5].trim(),
        url: fullMatch[6].trim(),
      };
    }

    const simpleMatch = line.match(/\[ID:\d+\]\s*(.+?)(?:\s*-\s*)(\d+[\.,]?\d*\s*TND[^|]*)\|\s*(.+)$/);
    if (simpleMatch) {
      const imageUrl = simpleMatch[3].trim();
      return {
        id,
        reference: '',
        name: simpleMatch[1].trim(),
        price: simpleMatch[2].trim(),
        famille: '',
        colors: '',
        image: imageUrl,
        url: `/produit/${id}`,
      };
    }

    const afterId = line.substring(line.indexOf(']') + 1).trim();
    return {
      id,
      reference: '',
      name: afterId.split('|')[0]?.split('-')[0]?.trim() || `Product ${id}`,
      price: '',
      famille: '',
      colors: '',
      image: '',
      url: `/produit/${id}`,
    };
  }

  parseAllProducts(lines: string[]): ParsedProduct[] {
    return lines
      .map((line) => this.parseProductLine(line))
      .filter((p): p is ParsedProduct => p !== null);
  }
}
