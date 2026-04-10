import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Category, CategoryTitle, ProductTitle, SearchResult } from '../models/menu';
import { environementDev } from '../../environements/environementDev';
@Injectable({
  providedIn: 'root'
})
export class MenuService {


  constructor(private http: HttpClient) { }
  getCategories(): Observable<Category[]> {

    return this.http.get<{ hits: any[] }>(environementDev.apiSearchDev + '/indexes/categories/search', { headers: { 'Authorization': `Bearer ${environementDev.tokenSearchDev}` } }).pipe(
      map(response => this.transformCategories(response.hits))
    );
  }

  private transformCategories(data: any[]): Category[] {
    return data.map(item => ({
      id: item.id,
      idOrigin: item.idOrigin,
      name: item.name,
      link: item.link,
      publicName: item.publicName,
      position: item.position,
      parentCategory: item.parentCategory,
      // Include SEO metadata fields from API response
      metaTitle: item.metaTitle,
      keywords: item.keywords,
      metaDescription: item.metaDescription,
      htmlDescription: item.htmlDescription,
      fontColor: item.fontColor,
      subCategories: this.transformCategories(item.subCategories || [])
    }));
  }

  // Method to get category by idOrigin
  getCategoryByIdOrigin(idOrigin: number): Observable<Category | null> {
    return this.getCategories().pipe(
      map(categories => this.findCategoryByIdOrigin(categories, idOrigin))
    );
  }

  // Helper method to recursively find a category by idOrigin
  private findCategoryByIdOrigin(categories: Category[], idOrigin: number): Category | null {
    for (const category of categories) {
      if (category.idOrigin === idOrigin) {
        return category;
      }

      if (category.subCategories && category.subCategories.length > 0) {
        const found = this.findCategoryByIdOrigin(category.subCategories, idOrigin);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  /**
   * Search for category titles
   * @param q Search query string
   * @param filter Filter condition (e.g., "parentCategory = 1")
   * @param limit Maximum number of results to return (default: 1000)
   * @returns Observable of search results containing category titles
   */
  searchCategoryTitles(q: string, filter?: string, limit: number = 1000): Observable<{ hits: CategoryTitle[] }> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`,
      'Content-Type': 'application/json'
    });

    const body: any = {
      q,
      limit
    };

    if (filter) {
      body.filter = filter;
    }



    return this.http.post<{ hits: CategoryTitle[] }>(
      `${environementDev.apiSearchDev}/indexes/categories-titles/search`,
      body,
      { headers }
    );
  }

  /**
   * Search for product titles
   * @param q Search query string
   * @param filter Filter condition (e.g., "category = 1")
   * @param limit Maximum number of results to return (default: 1000)
   * @returns Observable of search results containing product titles
   */
  searchProductTitles(q: string, filter?: string, limit: number = 1000): Observable<{ hits: ProductTitle[] }> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`,
      'Content-Type': 'application/json'
    });

    // Build the filter with the new format
    let finalFilter = '';

    if (filter) {
      finalFilter = filter;
    }

    // Add the title search condition if query is provided
    if (q && q.trim() !== '' && q !== '*') {
      const titleCondition = `title STARTS WITH '${q}'`;
      if (finalFilter) {
        finalFilter = `${finalFilter} AND ${titleCondition}`;
      } else {
        finalFilter = titleCondition;
      }
    }

    const body: any = {
      limit
    };

    if (finalFilter) {
      body.filter = finalFilter;
    }



    return this.http.post<{ hits: ProductTitle[] }>(
      `${environementDev.apiSearchDev}/indexes/products-titles/search`,
      body,
      { headers }
    );
  }

  /**
   * Get featured products for search panel by category
   * @param categoryId Category ID (1 for Femme, 2 for Homme)
   * @param limit Maximum number of results to return (default: 12)
   * @returns Observable of featured products
   */
  getFeaturedProductsInSearch(categoryId: number, limit: number = 12): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`,
      'Content-Type': 'application/json'
    });

    const body = {
      limit,
      offset: 0,
      filter: `categories.id = ${categoryId} AND featuredInSearch = true`
    };


    return this.http.post<any>(
      `${environementDev.apiSearchDev}/indexes/products/search`,
      body,
      { headers }
    );
  }

  /**
   * Search products with custom filter
   * @param filter Filter string for the search
   * @param limit Maximum number of results to return (default: 12)
   * @param offset Offset for pagination (default: 0)
   * @returns Observable of products
   */
  searchProducts(filter: string, limit: number = 12, offset: number = 0): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`,
      'Content-Type': 'application/json'
    });

    const body = {
      filter,
      limit,
      offset
    };



    return this.http.post<any>(
      `${environementDev.apiSearchDev}/indexes/products/search`,
      body,
      { headers }
    );
  }

  /**
   * Search for product titles only using the products-titles API
   * @param q Search query string
   * @param gender Selected gender for filtering (e.g., 'Femme', 'Homme')
   * @param limit Maximum number of results to return (default: 10)
   * @returns Observable of search results
   */
  searchAll(q: string, gender?: string, limit: number = 10): Observable<SearchResult[]> {
    // If query is empty, return empty results
    if (!q || q.trim() === '') {
      return of([]);
    }

    // Determine the category ID based on gender
    let categoryId: number | undefined;
    if (gender === 'Femme' || gender === 'FEMME') {
      categoryId = 1; // ID for women's products
    } else if (gender === 'Homme' || gender === 'HOMME') {
      categoryId = 2; // ID for men's products
    }

    // Create filter string if gender is selected
    const productFilter = categoryId ? `category = ${categoryId}` : undefined;

    // Search only in products-titles
    return this.searchProductTitles(q, productFilter, limit).pipe(
      catchError(error => {
        console.error('Error searching products:', error);
        return of({ hits: [] });
      }),
      map(results => {
        const searchResults: SearchResult[] = [];

        // Since we're now using STARTS WITH in the API filter,
        // all returned results should already match our criteria
        results.hits.forEach(product => {
          searchResults.push({
            text: product.title,
            type: 'product',
            id: product.id,
            parentCategory: product.category
          });
        });

        // Sort results alphabetically
        searchResults.sort((a, b) => {
          return a.text.toLowerCase().localeCompare(b.text.toLowerCase());
        });

        // Limit the total number of results
        return searchResults.slice(0, limit);
      })
    );
  }

  /**
   * Optimized search for product titles - fetches all results once and filters on frontend
   * @param gender Selected gender for filtering (e.g., 'Femme', 'Homme')
   * @param limit Maximum number of results to return (default: 1000)
   * @returns Observable of all product titles for the selected gender
   */
  fetchAllProductTitles(gender?: string, limit: number = 1000): Observable<ProductTitle[]> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`,
      'Content-Type': 'application/json'
    });

    // Determine the category ID based on gender
    let categoryId: number | undefined;
    if (gender === 'Femme' || gender === 'FEMME') {
      categoryId = 1; // ID for women's products
    } else if (gender === 'Homme' || gender === 'HOMME') {
      categoryId = 2; // ID for men's products
    }

    // Create filter string if gender is selected
    const productFilter = categoryId ? `category = ${categoryId}` : undefined;

    const body: any = {
      limit
    };

    if (productFilter) {
      body.filter = productFilter;
    }



    // Direct API call without using searchProductTitles to get all results
    return this.http.post<{ hits: ProductTitle[] }>(
      `${environementDev.apiSearchDev}/indexes/products-titles/search`,
      body,
      { headers }
    ).pipe(
      catchError(error => {
        console.error('Error fetching all product titles:', error);
        return of({ hits: [] });
      }),
      map(results => {
        return results.hits;
      })
    );
  }
  getCategoryBanner(id: number): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`,
      'Content-Type': 'application/json'
    });

    const body = {
      filter: `id=${id}`
    };

    return this.http.post<any>(
      `${environementDev.apiSearchDev}/indexes/all-categories/search`,
      body,
      { headers }
    ).pipe(
      catchError(error => {
        console.error('Error fetching category by ID:', error);
        return of(null);
      })
    );
  }
}