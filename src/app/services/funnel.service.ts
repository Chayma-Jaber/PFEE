import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { environementDev } from '../../environements/environementDev';

/**
 * Wave 2 — Storefront funnel tracker.
 *
 * Each storefront page calls track() when the user hits that funnel step.
 * Requests are fire-and-forget; the method never throws and the app never
 * waits for a response, so analytics can never degrade UX.
 *
 * Uses a stable session id stored in localStorage so anonymous users still
 * contribute to drop-off stats.
 */
export type FunnelStep =
  | 'VIEW_HOME'
  | 'VIEW_PRODUCT'
  | 'ADD_TO_CART'
  | 'START_CHECKOUT'
  | 'COMPLETE_PURCHASE'
  | 'EXIT_INTENT';

const SESSION_KEY = 'barsha_funnel_session';

@Injectable({ providedIn: 'root' })
export class FunnelService {
  private readonly url = `${environementDev.api}/api/storefront/funnel/track`;
  private sessionId: string;

  constructor(private http: HttpClient) {
    let sid = '';
    try {
      sid = localStorage.getItem(SESSION_KEY) || '';
      if (!sid) {
        sid = 'ses-' + Math.random().toString(36).slice(2, 11) + '-' + Date.now().toString(36);
        localStorage.setItem(SESSION_KEY, sid);
      }
    } catch {
      sid = 'ses-' + Math.random().toString(36).slice(2, 11);
    }
    this.sessionId = sid;
  }

  track(step: FunnelStep, productId?: number, metadata?: any): void {
    const token = localStorage.getItem('jwt') || localStorage.getItem('admin_jwt');
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    this.http
      .post(this.url, { step, sessionId: this.sessionId, productId, metadata }, { headers })
      .pipe(catchError(() => of(null)))
      .subscribe();
  }
}
