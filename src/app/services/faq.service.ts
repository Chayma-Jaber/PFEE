import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';

export interface FAQCategory {
  id: number;
  name: string;
  nameEn?: string;
  slug: string;
  description?: string;
  icon?: string;
  order: number;
  isActive: boolean;
  faqCount: number;
  faqs?: FAQ[];
}

export interface FAQ {
  id: number;
  categoryId: number;
  question: string;
  questionEn?: string;
  answer: string;
  answerEn?: string;
  order: number;
  isActive: boolean;
  isFeatured: boolean;
  viewCount: number;
  helpfulYes: number;
  helpfulNo: number;
  helpfulnessScore: number;
  keywords: string[];
  categoryName?: string;
  categorySlug?: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class FAQService {
  private apiUrl = environementDev.api;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('admin_jwt') || localStorage.getItem('jwt');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // ==================== Public Endpoints ====================

  /**
   * Get all active FAQ categories
   */
  getCategories(): Observable<{ categories: FAQCategory[] }> {
    return this.http.get<{ categories: FAQCategory[] }>(
      `${this.apiUrl}/api/help/categories`
    );
  }

  /**
   * Get a category with its FAQs
   */
  getCategoryWithFAQs(slug: string): Observable<FAQCategory> {
    return this.http.get<FAQCategory>(
      `${this.apiUrl}/api/help/category/${slug}`
    );
  }

  /**
   * Get featured FAQs
   */
  getFeaturedFAQs(limit: number = 6): Observable<{ faqs: FAQ[] }> {
    return this.http.get<{ faqs: FAQ[] }>(
      `${this.apiUrl}/api/help/featured?limit=${limit}`
    );
  }

  /**
   * Search FAQs
   */
  searchFAQs(query: string): Observable<{ query: string; results: FAQ[]; count: number }> {
    return this.http.get<{ query: string; results: FAQ[]; count: number }>(
      `${this.apiUrl}/api/help/search?q=${encodeURIComponent(query)}`
    );
  }

  /**
   * Get a specific FAQ
   */
  getFAQ(id: number): Observable<FAQ> {
    return this.http.get<FAQ>(
      `${this.apiUrl}/api/help/faq/${id}`
    );
  }

  /**
   * Mark FAQ as helpful
   */
  markHelpful(faqId: number, helpful: boolean): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/help/faq/${faqId}/helpful?helpful=${helpful}`,
      {}
    );
  }

  /**
   * Get all FAQs grouped by category
   */
  getAllFAQs(): Observable<{ categories: FAQCategory[] }> {
    return this.http.get<{ categories: FAQCategory[] }>(
      `${this.apiUrl}/api/help/all`
    );
  }

  // ==================== Admin Endpoints ====================

  /**
   * Admin: Get all categories (including inactive)
   */
  adminGetCategories(): Observable<{ categories: FAQCategory[] }> {
    return this.http.get<{ categories: FAQCategory[] }>(
      `${this.apiUrl}/api/admin/faq/categories`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(() => of({ categories: [] }))
    );
  }

  /**
   * Admin: Create category
   */
  adminCreateCategory(data: Partial<FAQCategory>): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/admin/faq/categories`,
      data,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Admin: Update category
   */
  adminUpdateCategory(id: number, data: Partial<FAQCategory>): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/api/admin/faq/categories/${id}`,
      data,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Admin: Delete category
   */
  adminDeleteCategory(id: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/api/admin/faq/categories/${id}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Admin: Toggle category active status
   */
  adminToggleCategory(id: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/admin/faq/categories/${id}/toggle`,
      {},
      { headers: this.getHeaders() }
    );
  }

  /**
   * Admin: Get all FAQs
   */
  adminGetFAQs(categoryId?: number): Observable<{ faqs: FAQ[] }> {
    let url = `${this.apiUrl}/api/admin/faq/faqs`;
    if (categoryId) {
      url += `?category_id=${categoryId}`;
    }
    return this.http.get<{ faqs: FAQ[] }>(url, { headers: this.getHeaders() }).pipe(
      catchError(() => of({ faqs: [] }))
    );
  }

  /**
   * Admin: Create FAQ
   */
  adminCreateFAQ(data: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/admin/faq/faqs`,
      data,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Admin: Update FAQ
   */
  adminUpdateFAQ(id: number, data: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/api/admin/faq/faqs/${id}`,
      data,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Admin: Delete FAQ
   */
  adminDeleteFAQ(id: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/api/admin/faq/faqs/${id}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Admin: Toggle FAQ active status
   */
  adminToggleFAQ(id: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/admin/faq/faqs/${id}/toggle`,
      {},
      { headers: this.getHeaders() }
    );
  }

  /**
   * Admin: Toggle FAQ featured status
   */
  adminToggleFeatured(id: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/admin/faq/faqs/${id}/feature`,
      {},
      { headers: this.getHeaders() }
    );
  }
}
