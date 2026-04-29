/**
 * Product Q&A Service
 * ====================
 * Handles product questions and answers API interactions.
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';

export interface QAUser {
  id: number;
  firstName: string;
  lastInitial: string;
}

export interface ProductAnswer {
  id: number;
  questionId: number;
  answerText: string;
  isStaff: boolean;
  helpfulCount: number;
  isPublished: boolean;
  createdAt: string;
  user?: QAUser;
  hasVoted?: boolean;
}

export interface ProductQuestion {
  id: number;
  productId: string;
  questionText: string;
  isPublished: boolean;
  createdAt: string;
  answerCount: number;
  user?: QAUser;
  answers?: ProductAnswer[];
}

export interface QuestionsResponse {
  questions: ProductQuestion[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AskQuestionRequest {
  questionText: string;
}

export interface AnswerQuestionRequest {
  answerText: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductQAService {
  private readonly apiUrl = `${environementDev.backendAiUrl}/api/products`;

  // Cache for questions
  private questionsCache = new Map<string, QuestionsResponse>();
  private questionsCacheTime = new Map<string, number>();
  private readonly CACHE_TTL = 3 * 60 * 1000; // 3 minutes

  constructor(private http: HttpClient) {}

  private getEmptyQuestionsResponse(): QuestionsResponse {
    return {
      questions: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        pages: 0,
      },
    };
  }

  private normalizeUser(user: any): QAUser | undefined {
    if (!user) {
      return undefined;
    }

    const firstName = user.firstName ?? user.first_name ?? '';
    const lastName = user.lastName ?? user.last_name ?? '';

    return {
      id: Number(user.id ?? 0),
      firstName,
      lastInitial: (user.lastInitial ?? lastName?.charAt(0) ?? '').toUpperCase(),
    };
  }

  private normalizeQuestionsResponse(response: any): QuestionsResponse {
    const rawQuestions = Array.isArray(response?.questions) ? response.questions : [];
    const page = Number(response?.pagination?.page ?? response?.page ?? 1);
    const limit = Number(response?.pagination?.limit ?? response?.limit ?? 10);
    const total = Number(response?.pagination?.total ?? response?.total ?? rawQuestions.length);
    const pages = Number(response?.pagination?.pages ?? response?.totalPages ?? Math.ceil(total / Math.max(limit, 1)));

    return {
      questions: rawQuestions.map((question: any) => {
        const normalizedAnswer = question?.answer
          ? [{
              id: Number(question.id ?? 0),
              questionId: Number(question.id ?? 0),
              answerText: question.answer,
              isStaff: true,
              helpfulCount: Number(question.helpful_count ?? question.helpfulCount ?? 0),
              isPublished: true,
              createdAt: question.answered_at ?? question.answeredAt ?? question.created_at ?? question.createdAt ?? '',
              user: this.normalizeUser(question.answered_by),
              hasVoted: false,
            }]
          : [];

        return {
          id: Number(question?.id ?? 0),
          productId: String(question?.productId ?? question?.product_id ?? ''),
          questionText: question?.questionText ?? question?.question ?? '',
          isPublished: question?.isPublished ?? question?.is_published ?? true,
          createdAt: question?.createdAt ?? question?.created_at ?? '',
          answerCount: question?.answerCount ?? normalizedAnswer.length,
          user: this.normalizeUser(question?.user),
          answers: Array.isArray(question?.answers) ? question.answers : normalizedAnswer,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    };
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwt');
    if (token) {
      return new HttpHeaders().set('Authorization', `Bearer ${token}`);
    }
    return new HttpHeaders();
  }

  private getCacheKey(productId: string, options: any): string {
    return `${productId}_${JSON.stringify(options)}`;
  }

  /**
   * Get questions for a product
   */
  getQuestions(
    productId: string | number,
    options: {
      page?: number;
      limit?: number;
      search?: string;
    } = {}
  ): Observable<QuestionsResponse> {
    const pid = productId.toString();
    const cacheKey = this.getCacheKey(pid, options);

    // Check cache
    const cached = this.questionsCache.get(cacheKey);
    const cacheTime = this.questionsCacheTime.get(cacheKey);
    if (cached && cacheTime && Date.now() - cacheTime < this.CACHE_TTL) {
      return of(cached);
    }

    let params = new HttpParams();

    if (options.page) params = params.set('page', options.page.toString());
    if (options.limit) params = params.set('limit', options.limit.toString());
    if (options.search) params = params.set('search', options.search);

    return this.http.get<QuestionsResponse>(
      `${this.apiUrl}/${pid}/questions`,
      { params, headers: this.getHeaders() }
    ).pipe(
      map(response => this.normalizeQuestionsResponse(response)),
      tap(response => {
        this.questionsCache.set(cacheKey, response);
        this.questionsCacheTime.set(cacheKey, Date.now());
      }),
      catchError(err => {
        console.error('Error fetching questions:', err);
        return of(this.getEmptyQuestionsResponse());
      })
    );
  }

  /**
   * Ask a question about a product
   */
  askQuestion(productId: string | number, questionText: string): Observable<{ success: boolean; question?: ProductQuestion; message: string }> {
    const pid = productId.toString();
    const normalizedQuestion = questionText.trim();

    return this.http.post<{ success: boolean; question?: ProductQuestion; message: string }>(
      `${this.apiUrl}/${pid}/questions`,
      {
        question: normalizedQuestion,
        questionText: normalizedQuestion,
      },
      { headers: this.getHeaders() }
    ).pipe(
      tap(() => {
        // Invalidate cache for this product
        this.invalidateProductCache(pid);
      }),
      catchError(err => {
        console.error('Error asking question:', err);
        const message = err.error?.detail || err.error?.message || 'Impossible de soumettre votre question';
        return of({ success: false, message });
      })
    );
  }

  /**
   * Answer a question
   */
  answerQuestion(questionId: number, answerText: string): Observable<{ success: boolean; answer?: ProductAnswer; message: string }> {
    return this.http.post<{ success: boolean; answer?: ProductAnswer; message: string }>(
      `${this.apiUrl}/questions/${questionId}/answers`,
      { answerText },
      { headers: this.getHeaders() }
    ).pipe(
      tap(() => {
        // Clear all caches as we don't know which product this belongs to
        this.questionsCache.clear();
        this.questionsCacheTime.clear();
      }),
      catchError(err => {
        console.error('Error answering question:', err);
        const message = err.error?.detail || 'Impossible de soumettre votre reponse';
        return of({ success: false, message });
      })
    );
  }

  /**
   * Mark an answer as helpful
   */
  markHelpful(answerId: number): Observable<{ success: boolean; helpfulCount: number; hasVoted: boolean; message: string }> {
    return this.http.post<{ success: boolean; helpfulCount: number; hasVoted: boolean; message: string }>(
      `${this.apiUrl}/answers/${answerId}/helpful`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      catchError(err => {
        console.error('Error marking helpful:', err);
        return of({ success: false, helpfulCount: 0, hasVoted: false, message: 'Erreur lors du vote' });
      })
    );
  }

  /**
   * Get current user's questions
   */
  getMyQuestions(page = 1, limit = 10): Observable<QuestionsResponse> {
    return this.http.get<QuestionsResponse>(
      `${this.apiUrl}/questions/my-questions`,
      {
        params: new HttpParams().set('page', page.toString()).set('limit', limit.toString()),
        headers: this.getHeaders()
      }
    ).pipe(
      map(response => this.normalizeQuestionsResponse(response)),
      catchError(err => {
        console.error('Error fetching user questions:', err);
        return of(this.getEmptyQuestionsResponse());
      })
    );
  }

  /**
   * Invalidate cache for a product
   */
  private invalidateProductCache(productId: string): void {
    // Remove all cache entries that start with this product ID
    for (const key of this.questionsCache.keys()) {
      if (key.startsWith(productId + '_')) {
        this.questionsCache.delete(key);
        this.questionsCacheTime.delete(key);
      }
    }
  }

  /**
   * Format date for display - time ago format
   */
  formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffYears > 0) {
      return `il y a ${diffYears} an${diffYears > 1 ? 's' : ''}`;
    } else if (diffMonths > 0) {
      return `il y a ${diffMonths} mois`;
    } else if (diffWeeks > 0) {
      return `il y a ${diffWeeks} semaine${diffWeeks > 1 ? 's' : ''}`;
    } else if (diffDays > 0) {
      return `il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
    } else if (diffMinutes > 0) {
      return `il y a ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
    } else {
      return 'a l\'instant';
    }
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-TN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
}
