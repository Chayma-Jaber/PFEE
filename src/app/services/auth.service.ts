import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';

export interface User {
  id: number;
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  role: string;
  gender?: string;
  birthday?: string;
  isActive: boolean;
  isVerified?: boolean;
  codeErp?: string;
}

export interface AuthResponse {
  user: User;
  tokens: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  };
  // Legacy alias for backwards compatibility
  jwt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environementDev.api;
  private useLocalAuth = (environementDev as any).useLocalAuth || false;

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    // Load user from storage on init
    this.loadStoredUser();
  }

  private loadStoredUser(): void {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        this.currentUserSubject.next(JSON.parse(storedUser));
      } catch {
        this.currentUserSubject.next(null);
      }
    }
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwt');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    });
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem('jwt');
  }

  /**
   * Get current user synchronously
   */
  getCurrentUserSync(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Login with email and password
   */
  login(identifier: string, password: string): Observable<AuthResponse> {
    if (this.useLocalAuth) {
      // Local backend login
      return this.http.post<AuthResponse>(`${this.apiUrl}/api/auth/login`, {
        email: identifier,
        password: password
      }).pipe(
        tap(response => this.handleAuthSuccess(response)),
        catchError(error => this.handleAuthError(error))
      );
    } else {
      // External API login (Strapi-style)
      return this.http.post<any>(`${this.apiUrl}/api/auth/local`, {
        identifier,
        password
      }).pipe(
        map(response => this.transformStrapiResponse(response)),
        tap(response => this.handleAuthSuccess(response)),
        catchError(error => this.handleAuthError(error))
      );
    }
  }

  /**
   * Register new user
   */
  register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Observable<AuthResponse> {
    if (this.useLocalAuth) {
      return this.http.post<AuthResponse>(`${this.apiUrl}/api/auth/register`, {
        email: userData.email,
        password: userData.password,
        first_name: userData.firstName,
        last_name: userData.lastName,
        phone: userData.phone
      }).pipe(
        tap(response => this.handleAuthSuccess(response)),
        catchError(error => this.handleAuthError(error))
      );
    } else {
      return this.http.post<any>(`${this.apiUrl}/api/auth/local/register`, userData).pipe(
        map(response => this.transformStrapiResponse(response)),
        tap(response => this.handleAuthSuccess(response)),
        catchError(error => this.handleAuthError(error))
      );
    }
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): Observable<User> {
    const token = localStorage.getItem('jwt');
    if (!token) {
      return throwError(() => new Error('No authentication token'));
    }

    if (this.useLocalAuth) {
      return this.http.get<User>(`${this.apiUrl}/api/auth/me`, {
        headers: this.getHeaders()
      }).pipe(
        tap(user => {
          this.currentUserSubject.next(user);
          localStorage.setItem('user', JSON.stringify(user));
        }),
        catchError(error => {
          if (error.status === 401) {
            this.logout();
          }
          return throwError(() => error);
        })
      );
    } else {
      return this.http.get<any>(`${this.apiUrl}/api/users/me`, {
        headers: this.getHeaders()
      }).pipe(
        map(response => this.transformStrapiUser(response)),
        tap(user => {
          this.currentUserSubject.next(user);
          localStorage.setItem('user', JSON.stringify(user));
        }),
        catchError(error => {
          if (error.status === 401) {
            this.logout();
          }
          return throwError(() => error);
        })
      );
    }
  }

  /**
   * Update user profile
   */
  updateAccount(userData: Partial<User>): Observable<User> {
    if (this.useLocalAuth) {
      return this.http.put<User>(`${this.apiUrl}/api/auth/profile`, userData, {
        headers: this.getHeaders()
      }).pipe(
        tap(user => {
          this.currentUserSubject.next(user);
          localStorage.setItem('user', JSON.stringify(user));
        })
      );
    } else {
      return this.http.put<any>(`${this.apiUrl}/api/updateAccount`, userData, {
        headers: this.getHeaders()
      }).pipe(
        map(response => this.transformStrapiUser(response)),
        tap(user => {
          this.currentUserSubject.next(user);
          localStorage.setItem('user', JSON.stringify(user));
        })
      );
    }
  }

  /**
   * Delete user account
   */
  deleteAccount(): Observable<void> {
    if (this.useLocalAuth) {
      return this.http.delete<void>(`${this.apiUrl}/api/auth/account`, {
        headers: this.getHeaders()
      }).pipe(
        tap(() => this.logout())
      );
    } else {
      return this.http.delete<void>(`${this.apiUrl}/api/removeAccount`, {
        headers: this.getHeaders()
      }).pipe(
        tap(() => this.logout())
      );
    }
  }

  /**
   * Change password
   */
  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/auth/change-password`, {
      current_password: currentPassword,
      new_password: newPassword
    }, { headers: this.getHeaders() });
  }

  /**
   * Logout user
   */
  logout(): void {
    localStorage.removeItem('jwt');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
  }

  /**
   * Generate OTP for phone verification
   */
  generateOtp(phoneNumber: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/code-otp/generate`, { phone: phoneNumber });
  }

  /**
   * Validate OTP
   */
  validateOtp(phoneNumber: string, code: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/code-otp/validate`, {
      phone: phoneNumber,
      code
    });
  }

  /**
   * Check phone count (for registration)
   */
  countPhone(phoneNumber: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/usersCount`, { phone: phoneNumber });
  }

  /**
   * Forgot password
   */
  forgotPassword(phone: string, codeOtp: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/auth/forgot-password`, { phone, codeOtp });
  }

  /**
   * Reset password
   */
  resetPassword(data: { code: string; password: string; passwordConfirmation: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/auth/reset-password`, data);
  }

  // Private helper methods

  private handleAuthSuccess(response: AuthResponse): void {
    if (response.tokens) {
      localStorage.setItem('jwt', response.tokens.access_token);
      if (response.tokens.refresh_token) {
        localStorage.setItem('refresh_token', response.tokens.refresh_token);
      }
    }
    if (response.user) {
      localStorage.setItem('user', JSON.stringify(response.user));
      this.currentUserSubject.next(response.user);
    }
  }

  private handleAuthError(error: any): Observable<never> {
    let message = 'Une erreur est survenue';
    if (error.status === 401) {
      message = 'Email ou mot de passe incorrect';
    } else if (error.status === 400) {
      message = error.error?.detail || 'Données invalides';
    } else if (error.status === 409) {
      message = 'Cet email est déjà utilisé';
    }
    return throwError(() => new Error(message));
  }

  private transformStrapiResponse(response: any): AuthResponse {
    return {
      user: this.transformStrapiUser(response.user || response),
      tokens: {
        access_token: response.jwt || response.token,
        refresh_token: '',
        token_type: 'bearer',
        expires_in: 86400
      }
    };
  }

  private transformStrapiUser(user: any): User {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName || user.first_name || '',
      lastName: user.lastName || user.last_name || '',
      role: user.role?.name || user.role || 'customer',
      gender: user.gender,
      birthday: user.birthday,
      isActive: user.isActive !== false,
      isVerified: user.isVerified || user.confirmed
    };
  }
}
