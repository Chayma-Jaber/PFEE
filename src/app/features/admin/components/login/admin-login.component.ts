import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-login-container">
      <!-- Animated Background -->
      <div class="bg-decoration">
        <div class="shape shape-1"></div>
        <div class="shape shape-2"></div>
        <div class="shape shape-3"></div>
      </div>

      <div class="login-card" [class.shake]="error">
        <div class="login-header">
          <div class="brand-logo">
            <span>B</span>
          </div>
          <h1>Barsha Admin</h1>
          <p class="subtitle">Espace d'administration premium</p>
        </div>

        <form (ngSubmit)="login()" class="login-form">
          <div class="form-group">
            <label for="email">
              <i class="fas fa-envelope"></i>
              Adresse email
            </label>
            <input
              type="email"
              id="email"
              [(ngModel)]="email"
              name="email"
              placeholder="admin@barsha.com.tn"
              required
              autocomplete="email">
          </div>

          <div class="form-group">
            <label for="password">
              <i class="fas fa-lock"></i>
              Mot de passe
            </label>
            <div class="password-wrapper">
              <input
                [type]="showPassword ? 'text' : 'password'"
                id="password"
                [(ngModel)]="password"
                name="password"
                placeholder="••••••••"
                required
                autocomplete="current-password">
              <button type="button" class="toggle-password" (click)="togglePassword()" [title]="showPassword ? 'Masquer' : 'Afficher'">
                <i class="fas" [ngClass]="showPassword ? 'fa-eye-slash' : 'fa-eye'"></i>
              </button>
            </div>
          </div>

          <div *ngIf="error" class="error-message">
            <i class="fas fa-exclamation-circle"></i>
            {{ error }}
          </div>

          <button type="submit" [disabled]="loading || !email || !password" class="btn-login">
            <span *ngIf="!loading">
              <i class="fas fa-sign-in-alt"></i>
              Se connecter
            </span>
            <span *ngIf="loading" class="loading-state">
              <span class="spinner"></span>
              Connexion en cours...
            </span>
          </button>
        </form>

        <div class="login-footer">
          <div class="secure-badge">
            <i class="fas fa-shield-alt"></i>
            <span>Connexion sécurisée SSL</span>
          </div>
          <div class="demo-credentials">
            <span class="demo-label">Accès démo</span>
            <code>admin&#64;barsha.com.tn / Admin123!</code>
          </div>
        </div>
      </div>

      <div class="footer-text">
        <p>&copy; {{ currentYear }} Barsha. Tous droits réservés.</p>
      </div>
    </div>
  `,
  styles: [`
    .admin-login-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
      padding: 20px;
      position: relative;
      overflow: hidden;
    }

    /* Animated Background Shapes */
    .bg-decoration {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }

    .shape {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.3;
      animation: float 20s infinite ease-in-out;
    }

    .shape-1 {
      width: 600px;
      height: 600px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      top: -200px;
      left: -200px;
      animation-delay: 0s;
    }

    .shape-2 {
      width: 500px;
      height: 500px;
      background: linear-gradient(135deg, #f093fb, #f5576c);
      bottom: -150px;
      right: -150px;
      animation-delay: -7s;
    }

    .shape-3 {
      width: 400px;
      height: 400px;
      background: linear-gradient(135deg, #4facfe, #00f2fe);
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      animation-delay: -14s;
    }

    @keyframes float {
      0%, 100% { transform: translate(0, 0) scale(1); }
      25% { transform: translate(30px, -30px) scale(1.05); }
      50% { transform: translate(-20px, 20px) scale(0.95); }
      75% { transform: translate(20px, 10px) scale(1.02); }
    }

    .login-card {
      background: rgba(255, 255, 255, 0.98);
      border-radius: 24px;
      padding: 48px 40px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 25px 80px rgba(0,0,0,0.4);
      position: relative;
      z-index: 1;
      animation: slideUp 0.6s ease;

      &.shake {
        animation: shake 0.5s ease;
      }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20%, 60% { transform: translateX(-10px); }
      40%, 80% { transform: translateX(10px); }
    }

    .login-header {
      text-align: center;
      margin-bottom: 36px;
    }

    .brand-logo {
      width: 72px;
      height: 72px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      box-shadow: 0 8px 24px rgba(102, 126, 234, 0.35);

      span {
        font-size: 32px;
        font-weight: 700;
        color: #fff;
        font-family: 'Georgia', serif;
      }
    }

    .login-header h1 {
      font-size: 26px;
      font-weight: 700;
      color: #1a1a2e;
      margin: 0 0 8px 0;
      letter-spacing: -0.5px;
    }

    .subtitle {
      color: #888;
      font-size: 14px;
      margin: 0;
      letter-spacing: 0.5px;
    }

    .form-group {
      margin-bottom: 24px;
    }

    .form-group label {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      font-weight: 600;
      color: #444;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;

      i {
        font-size: 14px;
        color: #667eea;
      }
    }

    .form-group input {
      width: 100%;
      padding: 16px 18px;
      border: 2px solid #e8e8e8;
      border-radius: 12px;
      font-size: 15px;
      transition: all 0.3s ease;
      box-sizing: border-box;
      background: #fafafa;

      &::placeholder {
        color: #bbb;
      }

      &:focus {
        outline: none;
        border-color: #667eea;
        background: #fff;
        box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
      }
    }

    .password-wrapper {
      position: relative;
    }

    .password-wrapper input {
      padding-right: 52px;
    }

    .toggle-password {
      position: absolute;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      padding: 6px;
      cursor: pointer;
      color: #999;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s;
      border-radius: 6px;

      &:hover {
        color: #667eea;
        background: rgba(102, 126, 234, 0.1);
      }

      i {
        font-size: 18px;
      }
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 10px;
      background: linear-gradient(135deg, #fee2e2, #fecaca);
      color: #dc2626;
      padding: 14px 16px;
      border-radius: 12px;
      margin-bottom: 24px;
      font-size: 14px;
      font-weight: 500;
      border: 1px solid rgba(220, 38, 38, 0.2);

      i {
        font-size: 18px;
      }
    }

    .btn-login {
      width: 100%;
      padding: 18px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-shadow: 0 8px 24px rgba(102, 126, 234, 0.35);

      &:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 12px 32px rgba(102, 126, 234, 0.45);
      }

      &:active:not(:disabled) {
        transform: translateY(0);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }

      .loading-state {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .spinner {
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .login-footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #eee;
    }

    .secure-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 12px;
      color: #10b981;
      margin-bottom: 16px;

      i {
        font-size: 14px;
      }
    }

    .demo-credentials {
      text-align: center;

      .demo-label {
        display: block;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #999;
        margin-bottom: 8px;
      }

      code {
        display: inline-block;
        background: #f5f5f5;
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 13px;
        color: #555;
        font-family: 'SF Mono', 'Monaco', monospace;
        border: 1px solid #e8e8e8;
      }
    }

    .footer-text {
      margin-top: 24px;
      text-align: center;
      z-index: 1;

      p {
        color: rgba(255,255,255,0.4);
        font-size: 12px;
        margin: 0;
      }
    }

    @media (max-width: 480px) {
      .login-card {
        padding: 36px 24px;
        border-radius: 20px;
      }

      .brand-logo {
        width: 60px;
        height: 60px;

        span {
          font-size: 26px;
        }
      }

      .login-header h1 {
        font-size: 22px;
      }
    }
  `]
})
export class AdminLoginComponent implements OnInit {
  private readonly apiUrl = environementDev.api;
  email = '';
  password = '';
  loading = false;
  error = '';
  showPassword = false;
  currentYear = new Date().getFullYear();

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    // Check if already logged in
    const token = localStorage.getItem('admin_jwt');
    if (token) {
      this.router.navigate(['/admin/dashboard']);
    }
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  login() {
    this.loading = true;
    this.error = '';

    this.http.post<any>(`${this.apiUrl}/api/auth/admin/login`, {
      email: this.email,
      password: this.password
    }).subscribe({
      next: (response) => {
        // Store tokens
        localStorage.setItem('admin_jwt', response.tokens.access_token);
        localStorage.setItem('admin_refresh', response.tokens.refresh_token);
        localStorage.setItem('admin_user', JSON.stringify(response.user));

        // Redirect to dashboard
        this.router.navigate(['/admin/dashboard']);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 401 || err.status === 403) {
          this.error = 'Email ou mot de passe incorrect';
        } else {
          this.error = 'Erreur de connexion. Veuillez réessayer.';
        }
      }
    });
  }
}
