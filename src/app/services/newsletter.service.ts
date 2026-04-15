import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environementDev } from '../../environements/environementDev';

export interface NewsletterPreferences {
  promotions: boolean;
  new_arrivals: boolean;
  style_tips: boolean;
}

export interface SubscribeRequest {
  email: string;
  first_name?: string;
  preferences?: NewsletterPreferences;
  source?: string;
}

export interface SubscribeResponse {
  success: boolean;
  message: string;
  requires_confirmation: boolean;
}

export interface UnsubscribeRequest {
  email: string;
  reason?: string;
}

export interface PreferencesUpdateRequest {
  email: string;
  preferences: NewsletterPreferences;
}

export interface SubscriptionStatus {
  subscribed: boolean;
  isActive?: boolean;
  isConfirmed?: boolean;
  preferences?: NewsletterPreferences;
  subscribedAt?: string;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NewsletterService {
  private apiUrl = `${environementDev.api}/api/newsletter`;

  constructor(private http: HttpClient) {}

  /**
   * Subscribe to the newsletter
   * @param email - Email address to subscribe
   * @param firstName - Optional first name
   * @param preferences - Optional preferences for email types
   * @param source - Where the subscription came from (popup, footer, etc.)
   */
  subscribe(
    email: string,
    firstName?: string,
    preferences?: Partial<NewsletterPreferences>,
    source: string = 'website'
  ): Observable<SubscribeResponse> {
    const request: SubscribeRequest = {
      email,
      first_name: firstName,
      preferences: preferences ? {
        promotions: preferences.promotions ?? true,
        new_arrivals: preferences.new_arrivals ?? true,
        style_tips: preferences.style_tips ?? true
      } : undefined,
      source
    };
    return this.http.post<SubscribeResponse>(`${this.apiUrl}/subscribe`, request);
  }

  /**
   * Confirm subscription with token
   * @param token - Confirmation token from email
   */
  confirmSubscription(token: string): Observable<{ success: boolean; message: string; already_confirmed?: boolean }> {
    return this.http.get<{ success: boolean; message: string; already_confirmed?: boolean }>(
      `${this.apiUrl}/confirm/${token}`
    );
  }

  /**
   * Unsubscribe from the newsletter
   * @param email - Email address to unsubscribe
   * @param reason - Optional reason for unsubscribing
   */
  unsubscribe(email: string, reason?: string): Observable<{ success: boolean; message: string }> {
    const request: UnsubscribeRequest = { email, reason };
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/unsubscribe`, request);
  }

  /**
   * Update newsletter preferences
   * @param email - Email address
   * @param preferences - New preferences
   */
  updatePreferences(
    email: string,
    preferences: NewsletterPreferences
  ): Observable<{ email: string; preferences: NewsletterPreferences; is_active: boolean }> {
    const request: PreferencesUpdateRequest = { email, preferences };
    return this.http.put<{ email: string; preferences: NewsletterPreferences; is_active: boolean }>(
      `${this.apiUrl}/preferences`,
      request
    );
  }

  /**
   * Get subscription status for an email
   * @param email - Email address to check
   */
  getStatus(email: string): Observable<SubscriptionStatus> {
    return this.http.get<SubscriptionStatus>(`${this.apiUrl}/status/${encodeURIComponent(email)}`);
  }

  /**
   * Check if popup has been shown this session
   */
  hasPopupBeenShown(): boolean {
    return sessionStorage.getItem('newsletter_popup_shown') === 'true';
  }

  /**
   * Mark popup as shown for this session
   */
  markPopupAsShown(): void {
    sessionStorage.setItem('newsletter_popup_shown', 'true');
  }

  /**
   * Check if user has previously subscribed (from localStorage)
   */
  hasUserSubscribed(): boolean {
    return localStorage.getItem('newsletter_subscribed') === 'true';
  }

  /**
   * Mark user as subscribed (in localStorage)
   */
  markUserAsSubscribed(): void {
    localStorage.setItem('newsletter_subscribed', 'true');
  }
}
