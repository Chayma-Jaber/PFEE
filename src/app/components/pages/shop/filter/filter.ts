import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout, retry } from 'rxjs/operators';
import { tap } from 'rxjs/operators';

export interface ApiResponse {
  status: number;
  data: {
    colors: {
      name: string;
      texture: {
        url: string;
        ext: string;
        name: string;
        width: number;
        height: number;
      }
    }[];
    numericSizes: string[];
    alphabeticSizes: string[];
    standardSizes: string[];
    minPrice: number;
    maxPrice: number;
    count: number;
    categoryType?: 'hauts' | 'bas' | 'autre' | 'nouveautes';
  };
}

export interface ProductFilters {
  colors: {
    name: string;
    texture: {
      url: string;
      ext: string;
      name: string;
      width: number;
      height: number;
    }
  }[];
  numericSizes: string[];
  alphabeticSizes: string[];
  standardSizes: string[];
  minPrice: number;
  maxPrice: number;
  count: number;
  categoryType?: 'hauts' | 'bas' | 'autre' | 'nouveautes';
}

export interface ProductFilterParams {
  idCategory: number;
  colors?: string[]; // We still send color names as strings to the API
  sizes?: string[];
  sortPrice?: 'asc' | 'desc';
  minPrice?: number;
  maxPrice?: number;
  limit: number;
  offset: number;
  categoryType?: 'hauts' | 'bas' | 'autre' | 'nouveautes';
}

@Injectable({
  providedIn: 'root'
})
export class FilterService {
  private apiUrl = 'https://main.barsha.com.tn';

  constructor(private http: HttpClient) { }

  /**
   * Fetch available product filters by category ID
   * @param categoryId - The ID of the category to fetch filters for
   * @returns Observable with filter data including colors, sorted sizes, price range, and product count
   */
  fetchProductsFiltersByCategory(categoryId: number): Observable<ApiResponse> {
    if (!categoryId) {
      throw new Error('Category ID is required');
    }

    const url = `${this.apiUrl}/api/fetchProductsFiltersByCategory/${categoryId}`;


    return this.http.get<ApiResponse>(url).pipe(
      // Réessayer jusqu'à 2 fois en cas d'erreur
      retry(2),
      // Définir un timeout de 8 secondes
      timeout(8000),
      // Ajouter un opérateur tap pour mesurer le temps de réponse
      tap((response: ApiResponse) => {
        console.timeEnd(`api-call-${categoryId}`);
        // console.log(`API call for category ${categoryId} completed successfully with ${response.data.colors.length} colors and ${response.data.alphabeticSizes.length + response.data.numericSizes.length} sizes`);
      }),
      catchError(error => {
        console.timeEnd(`api-call-${categoryId}`);
        console.error('Error fetching product filters:', error);

        if (error instanceof TimeoutError) {
          console.error('Request timed out');
          // Retourner une réponse par défaut en cas de timeout
          return throwError(() => new Error('La requête a pris trop de temps. Veuillez réessayer.'));
        }

        return throwError(() => error);
      })
    );
  }

  /**
   * Fetch products by applying filters
   * @param params - Filter parameters including category ID, colors, sizes, price sorting, max price, limit, and offset
   * @returns Observable with filtered products data
   */
  fetchProductsByFilters(params: ProductFilterParams): Observable<any> {
    if (!params.idCategory) {
      throw new Error('Category ID is required');
    }

    if (params.limit === undefined || params.offset === undefined) {
      throw new Error('Limit and offset are required');
    }

    const url = `${this.apiUrl}/api/fetchProductsByFilters`;
    // console.log('FilterService: Making API call to:', url, 'with params:', params);
    console.time(`filter-api-call-${params.idCategory}`);

    return this.http.post<any>(url, params).pipe(
      // Réessayer jusqu'à 2 fois en cas d'erreur
      retry(2),
      // Définir un timeout de 8 secondes
      timeout(8000),
      // Ajouter un opérateur tap pour mesurer le temps de réponse
      tap((response: any) => {
        console.timeEnd(`filter-api-call-${params.idCategory}`);
    
      }),
      catchError(error => {
        console.timeEnd(`filter-api-call-${params.idCategory}`);
        console.error('Error fetching products by filters:', error);

        if (error instanceof TimeoutError) {
          console.error('Request timed out');
          // Retourner une réponse par défaut en cas de timeout
          return throwError(() => new Error('La requête a pris trop de temps. Veuillez réessayer.'));
        }

        return throwError(() => error);
      })
    );
  }
}
