/**
 * BARSHA USER PREFERENCES SERVICE
 * ================================
 * Service for managing user style preferences with backend persistence.
 *
 * Features:
 * - Sync preferences with backend API
 * - localStorage fallback for offline/anonymous
 * - Session merge on login
 * - Behavior-inferred preferences
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';

export interface UserStyleProfile {
  id?: number;
  user_id?: number;
  session_id?: string;
  preferred_styles: string[];
  preferred_colors: string[];
  preferred_occasions: string[];
  preferred_categories: string[];
  size_top?: string;
  size_bottom?: string;
  size_shoes?: string;
  price_sensitivity?: string;
  min_price?: number;
  max_price?: number;
  inferred_styles?: string[];
  inferred_colors?: string[];
  category_affinity?: { [key: string]: number };
  completion_score?: number;
  updated_at?: string;
}

export interface RecommendationContext {
  user_id?: number;
  session_id?: string;
  preferred_styles: string[];
  preferred_colors: string[];
  preferred_occasions: string[];
  preferred_categories: string[];
  category_affinity: { [key: string]: number };
  price_sensitivity: string;
  min_price?: number;
  max_price?: number;
  size_top?: string;
  size_bottom?: string;
  profile_completeness: number;
}

interface ProfileResponse {
  success: boolean;
  profile: UserStyleProfile;
  message?: string;
}

interface ContextResponse {
  success: boolean;
  context: RecommendationContext;
}

@Injectable({
  providedIn: 'root'
})
export class UserPreferencesService {
  private readonly apiUrl = `${environementDev.backendAiUrl}/api/preferences`;
  private readonly LOCAL_STORAGE_KEY = 'barsha_style_profile';
  private readonly SESSION_ID_KEY = 'barsha_session_id';
  private readonly useLocalOnly = !!(environementDev as any).useLocalAuth;

  private profileSubject = new BehaviorSubject<UserStyleProfile | null>(null);
  public profile$ = this.profileSubject.asObservable();

  constructor(private http: HttpClient) {
    // Initialize session ID
    this.ensureSessionId();
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  private ensureSessionId(): string {
    let sessionId = sessionStorage.getItem(this.SESSION_ID_KEY);
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem(this.SESSION_ID_KEY, sessionId);
    }
    return sessionId;
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwt');
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-Session-ID': this.ensureSessionId()
    });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  // ============================================================================
  // PROFILE OPERATIONS
  // ============================================================================

  /**
   * Get user style profile from backend.
   * Falls back to localStorage if backend unavailable.
   */
  getProfile(): Observable<UserStyleProfile> {
    if (this.useLocalOnly) {
      const profile = this.getFromLocalStorage();
      this.profileSubject.next(profile);
      return of(profile);
    }

    return this.http.get<ProfileResponse>(
      `${this.apiUrl}/profile`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => {
        if (response.success && response.profile) {
          this.profileSubject.next(response.profile);
          this.saveToLocalStorage(response.profile);
          return response.profile;
        }
        throw new Error('Invalid response');
      }),
      catchError(error => {
        console.warn('Failed to fetch profile from backend, using localStorage:', error);
        return of(this.getFromLocalStorage());
      })
    );
  }

  /**
   * Update user style profile on backend.
   * Also saves to localStorage as backup.
   */
  updateProfile(profile: Partial<UserStyleProfile>): Observable<UserStyleProfile> {
    if (this.useLocalOnly) {
      const localProfile = this.getFromLocalStorage();
      const updatedProfile = { ...localProfile, ...profile, updated_at: new Date().toISOString() };
      this.saveToLocalStorage(updatedProfile);
      this.profileSubject.next(updatedProfile);
      return of(updatedProfile);
    }

    const payload = {
      styles: profile.preferred_styles,
      colors: profile.preferred_colors,
      occasions: profile.preferred_occasions,
      categories: profile.preferred_categories,
      size_top: profile.size_top,
      size_bottom: profile.size_bottom,
      size_shoes: profile.size_shoes,
      price_sensitivity: profile.price_sensitivity,
      min_price: profile.min_price,
      max_price: profile.max_price
    };

    return this.http.put<ProfileResponse>(
      `${this.apiUrl}/profile`,
      payload,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => {
        if (response.success && response.profile) {
          this.profileSubject.next(response.profile);
          this.saveToLocalStorage(response.profile);
          return response.profile;
        }
        throw new Error('Invalid response');
      }),
      catchError(error => {
        console.warn('Failed to update profile on backend, saving to localStorage:', error);
        // Save locally even if backend fails
        const localProfile = this.getFromLocalStorage();
        const updatedProfile = { ...localProfile, ...profile, updated_at: new Date().toISOString() };
        this.saveToLocalStorage(updatedProfile);
        this.profileSubject.next(updatedProfile);
        return of(updatedProfile);
      })
    );
  }

  /**
   * Merge anonymous session profile into authenticated user profile.
   * Call this after user login.
   */
  mergeSessionToUser(): Observable<UserStyleProfile> {
    if (this.useLocalOnly) {
      const profile = this.getFromLocalStorage();
      this.profileSubject.next(profile);
      return of(profile);
    }

    const sessionId = this.ensureSessionId();

    return this.http.post<ProfileResponse>(
      `${this.apiUrl}/merge`,
      { session_id: sessionId },
      { headers: this.getHeaders() }
    ).pipe(
      map(response => {
        if (response.success && response.profile) {
          this.profileSubject.next(response.profile);
          this.saveToLocalStorage(response.profile);
          return response.profile;
        }
        throw new Error('Invalid response');
      }),
      catchError(error => {
        console.warn('Failed to merge session profile:', error);
        return of(this.getFromLocalStorage());
      })
    );
  }

  /**
   * Get recommendation context optimized for the recommendation engine.
   */
  getRecommendationContext(): Observable<RecommendationContext> {
    if (this.useLocalOnly) {
      const profile = this.getFromLocalStorage();
      return of(this.buildContextFromProfile(profile));
    }

    return this.http.get<ContextResponse>(
      `${this.apiUrl}/context`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => {
        if (response.success && response.context) {
          return response.context;
        }
        throw new Error('Invalid response');
      }),
      catchError(error => {
        console.warn('Failed to get recommendation context:', error);
        // Build context from local profile
        const profile = this.getFromLocalStorage();
        return of(this.buildContextFromProfile(profile));
      })
    );
  }

  /**
   * Refresh behavior-inferred preferences from recent activity.
   */
  refreshInferredPreferences(lookbackDays: number = 30): Observable<any> {
    if (this.useLocalOnly) {
      return of({ success: true, local: true });
    }

    return this.http.post(
      `${this.apiUrl}/refresh-inferred?lookback_days=${lookbackDays}`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
        // Refresh full profile after inference update
        this.getProfile().subscribe();
      }),
      catchError(error => {
        console.warn('Failed to refresh inferred preferences:', error);
        return of({ success: false });
      })
    );
  }

  // ============================================================================
  // LOCAL STORAGE OPERATIONS
  // ============================================================================

  private saveToLocalStorage(profile: UserStyleProfile): void {
    try {
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.error('Failed to save profile to localStorage:', e);
    }
  }

  private getFromLocalStorage(): UserStyleProfile {
    try {
      const stored = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to read profile from localStorage:', e);
    }

    // Return empty profile
    return {
      preferred_styles: [],
      preferred_colors: [],
      preferred_occasions: [],
      preferred_categories: [],
      completion_score: 0
    };
  }

  private buildContextFromProfile(profile: UserStyleProfile): RecommendationContext {
    return {
      preferred_styles: [
        ...(profile.preferred_styles || []),
        ...(profile.inferred_styles || [])
      ],
      preferred_colors: [
        ...(profile.preferred_colors || []),
        ...(profile.inferred_colors || [])
      ],
      preferred_occasions: profile.preferred_occasions || [],
      preferred_categories: profile.preferred_categories || [],
      category_affinity: profile.category_affinity || {},
      price_sensitivity: profile.price_sensitivity || 'medium',
      min_price: profile.min_price,
      max_price: profile.max_price,
      size_top: profile.size_top,
      size_bottom: profile.size_bottom,
      profile_completeness: profile.completion_score || 0
    };
  }

  // ============================================================================
  // QUICK ACCESS METHODS
  // ============================================================================

  /**
   * Get current profile synchronously from cache.
   */
  getCurrentProfile(): UserStyleProfile | null {
    return this.profileSubject.value;
  }

  /**
   * Check if user has any style preferences set.
   */
  hasPreferences(): boolean {
    const profile = this.getCurrentProfile() || this.getFromLocalStorage();
    return (
      (profile.preferred_styles?.length || 0) > 0 ||
      (profile.preferred_colors?.length || 0) > 0 ||
      (profile.preferred_occasions?.length || 0) > 0
    );
  }

  /**
   * Check if user is authenticated.
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem('jwt');
  }
}
