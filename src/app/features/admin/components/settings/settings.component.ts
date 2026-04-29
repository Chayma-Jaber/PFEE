import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';

interface SettingSection {
  id: string;
  title: string;
  icon: string;
  description: string;
}

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-page">
      <div class="page-header">
        <h1>Paramètres</h1>
        <p class="subtitle">Gérez les paramètres de votre back-office</p>
      </div>

      <div class="settings-layout">
        <!-- Sidebar Navigation -->
        <aside class="settings-nav">
          <button *ngFor="let section of sections"
                  [class.active]="activeSection === section.id"
                  (click)="activeSection = section.id"
                  class="nav-item">
            <i [class]="section.icon"></i>
            <span>{{ section.title }}</span>
          </button>
        </aside>

        <!-- Settings Content -->
        <main class="settings-content">
          <!-- Loading State -->
          <div *ngIf="loading" class="loading-state">
            <div class="spinner"></div>
            <p>Chargement des paramètres...</p>
          </div>

          <!-- Profile Settings -->
          <section *ngIf="!loading && activeSection === 'profile'" class="settings-section">
            <h2>Profil administrateur</h2>
            <div class="settings-card">
              <div class="profile-header">
                <div class="avatar">
                  <span>{{ getInitials() }}</span>
                </div>
                <div class="profile-info">
                  <h3>{{ profileSettings.firstName }} {{ profileSettings.lastName }}</h3>
                  <p>{{ getRoleName() }}</p>
                </div>
              </div>

              <div class="form-grid">
                <div class="form-group">
                  <label>Prénom</label>
                  <input type="text" [(ngModel)]="profileSettings.firstName" placeholder="Prénom">
                </div>
                <div class="form-group">
                  <label>Nom</label>
                  <input type="text" [(ngModel)]="profileSettings.lastName" placeholder="Nom">
                </div>
                <div class="form-group full-width">
                  <label>Email</label>
                  <input type="email" [(ngModel)]="profileSettings.email" placeholder="Email">
                </div>
                <div class="form-group full-width">
                  <label>Téléphone</label>
                  <input type="tel" [(ngModel)]="profileSettings.phone" placeholder="+216 XX XXX XXX">
                </div>
              </div>

              <div *ngIf="successMessage" class="alert success">
                <i class="fas fa-check-circle"></i> {{ successMessage }}
              </div>
              <div *ngIf="errorMessage" class="alert error">
                <i class="fas fa-exclamation-circle"></i> {{ errorMessage }}
              </div>

              <div class="actions">
                <button class="btn-primary" (click)="saveProfile()" [disabled]="saving">
                  <span *ngIf="!saving">Enregistrer les modifications</span>
                  <span *ngIf="saving"><i class="fas fa-spinner fa-spin"></i> Enregistrement...</span>
                </button>
              </div>
            </div>
          </section>

          <!-- Security Settings -->
          <section *ngIf="!loading && activeSection === 'security'" class="settings-section">
            <h2>Sécurité</h2>
            <div class="settings-card">
              <h3>Changer le mot de passe</h3>
              <div class="form-grid">
                <div class="form-group full-width">
                  <label>Mot de passe actuel</label>
                  <input type="password" [(ngModel)]="passwordForm.currentPassword" placeholder="••••••••">
                </div>
                <div class="form-group">
                  <label>Nouveau mot de passe</label>
                  <input type="password" [(ngModel)]="passwordForm.newPassword" placeholder="••••••••">
                </div>
                <div class="form-group">
                  <label>Confirmer le mot de passe</label>
                  <input type="password" [(ngModel)]="passwordForm.confirmPassword" placeholder="••••••••">
                </div>
              </div>

              <div *ngIf="passwordSuccess" class="alert success">
                <i class="fas fa-check-circle"></i> {{ passwordSuccess }}
              </div>
              <div *ngIf="passwordError" class="alert error">
                <i class="fas fa-exclamation-circle"></i> {{ passwordError }}
              </div>

              <div class="actions">
                <button class="btn-primary" (click)="changePassword()" [disabled]="changingPassword">
                  <span *ngIf="!changingPassword">Mettre à jour le mot de passe</span>
                  <span *ngIf="changingPassword"><i class="fas fa-spinner fa-spin"></i> Mise à jour...</span>
                </button>
              </div>
            </div>

            <div class="settings-card">
              <h3>Sessions actives</h3>
              <div class="sessions-list">
                <div *ngFor="let session of sessions" class="session-item" [class.active]="session.isCurrent">
                  <div class="session-icon"><i class="fas fa-desktop"></i></div>
                  <div class="session-info">
                    <span class="device">{{ session.device }}</span>
                    <span class="location">{{ session.location }} {{ session.isCurrent ? '• Session actuelle' : '' }}</span>
                  </div>
                  <button *ngIf="!session.isCurrent" class="btn-danger-small" (click)="revokeSession(session.id)">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- Notifications Settings -->
          <section *ngIf="!loading && activeSection === 'notifications'" class="settings-section">
            <h2>Notifications</h2>
            <div class="settings-card">
              <div class="toggle-group">
                <div class="toggle-item">
                  <div class="toggle-info">
                    <h4>Nouvelles commandes</h4>
                    <p>Recevoir une notification pour chaque nouvelle commande</p>
                  </div>
                  <label class="toggle">
                    <input type="checkbox" [(ngModel)]="notifications.newOrders" (change)="saveNotifications()">
                    <span class="slider"></span>
                  </label>
                </div>
                <div class="toggle-item">
                  <div class="toggle-info">
                    <h4>Stock faible</h4>
                    <p>Alerte lorsqu'un produit atteint le seuil de stock minimum</p>
                  </div>
                  <label class="toggle">
                    <input type="checkbox" [(ngModel)]="notifications.lowStock" (change)="saveNotifications()">
                    <span class="slider"></span>
                  </label>
                </div>
                <div class="toggle-item">
                  <div class="toggle-info">
                    <h4>Demandes de retour</h4>
                    <p>Notification pour les nouvelles demandes de retour</p>
                  </div>
                  <label class="toggle">
                    <input type="checkbox" [(ngModel)]="notifications.returns" (change)="saveNotifications()">
                    <span class="slider"></span>
                  </label>
                </div>
                <div class="toggle-item">
                  <div class="toggle-info">
                    <h4>Rapports hebdomadaires</h4>
                    <p>Recevoir un résumé des performances chaque semaine</p>
                  </div>
                  <label class="toggle">
                    <input type="checkbox" [(ngModel)]="notifications.weeklyReports" (change)="saveNotifications()">
                    <span class="slider"></span>
                  </label>
                </div>
              </div>

              <div *ngIf="notifSuccess" class="alert success small">
                <i class="fas fa-check-circle"></i> Préférences enregistrées
              </div>
            </div>
          </section>

          <!-- Store Settings -->
          <section *ngIf="!loading && activeSection === 'store'" class="settings-section">
            <h2>Paramètres de la boutique</h2>
            <div class="settings-card">
              <div class="form-grid">
                <div class="form-group full-width">
                  <label>Nom de la boutique</label>
                  <input type="text" [(ngModel)]="storeSettings.storeName" placeholder="Nom de la boutique">
                </div>
                <div class="form-group">
                  <label>Devise</label>
                  <select [(ngModel)]="storeSettings.currency">
                    <option value="TND">TND - Dinar Tunisien</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="USD">USD - Dollar US</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Langue par défaut</label>
                  <select [(ngModel)]="storeSettings.defaultLanguage">
                    <option value="fr">Français</option>
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Seuil de stock faible</label>
                  <input type="number" [(ngModel)]="storeSettings.lowStockThreshold" min="1">
                </div>
                <div class="form-group">
                  <label>Email de contact</label>
                  <input type="email" [(ngModel)]="storeSettings.contactEmail">
                </div>
              </div>

              <div *ngIf="storeSuccess" class="alert success">
                <i class="fas fa-check-circle"></i> {{ storeSuccess }}
              </div>
              <div *ngIf="storeError" class="alert error">
                <i class="fas fa-exclamation-circle"></i> {{ storeError }}
              </div>

              <div class="actions">
                <button class="btn-primary" (click)="saveStoreSettings()" [disabled]="savingStore">
                  <span *ngIf="!savingStore">Enregistrer</span>
                  <span *ngIf="savingStore"><i class="fas fa-spinner fa-spin"></i> Enregistrement...</span>
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .settings-page {
      max-width: 1200px;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: 32px;

      h1 {
        font-size: 28px;
        font-weight: 700;
        color: #1a1a2e;
        margin: 0 0 8px 0;
      }

      .subtitle {
        color: #666;
        font-size: 14px;
        margin: 0;
      }
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;

      .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid #f0f0f0;
        border-top-color: #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      p {
        margin-top: 16px;
        color: #666;
      }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .settings-layout {
      display: grid;
      grid-template-columns: 260px 1fr;
      gap: 32px;

      @media (max-width: 900px) {
        grid-template-columns: 1fr;
      }
    }

    .settings-nav {
      background: #fff;
      border-radius: 16px;
      padding: 16px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
      height: fit-content;
      position: sticky;
      top: 24px;

      .nav-item {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 14px 16px;
        border: none;
        background: none;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        color: #666;
        cursor: pointer;
        transition: all 0.2s;
        text-align: left;

        i {
          font-size: 18px;
          width: 24px;
        }

        &:hover {
          background: #f5f5f5;
          color: #1a1a2e;
        }

        &.active {
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
          color: #667eea;

          i {
            color: #667eea;
          }
        }
      }
    }

    .settings-section {
      h2 {
        font-size: 20px;
        font-weight: 600;
        color: #1a1a2e;
        margin: 0 0 20px 0;
      }
    }

    .settings-card {
      background: #fff;
      border-radius: 16px;
      padding: 28px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
      margin-bottom: 24px;

      h3 {
        font-size: 16px;
        font-weight: 600;
        color: #1a1a2e;
        margin: 0 0 20px 0;
      }
    }

    .profile-header {
      display: flex;
      align-items: center;
      gap: 20px;
      padding-bottom: 24px;
      margin-bottom: 24px;
      border-bottom: 1px solid #f0f0f0;

      .avatar {
        width: 72px;
        height: 72px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 24px;
        font-weight: 600;
      }

      .profile-info {
        flex: 1;

        h3 {
          margin: 0 0 4px 0;
          font-size: 18px;
        }

        p {
          margin: 0;
          font-size: 14px;
          color: #888;
        }
      }
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
      }

      .full-width {
        grid-column: 1 / -1;
      }
    }

    .form-group {
      label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: #444;
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      input, select {
        width: 100%;
        padding: 14px 16px;
        border: 2px solid #e8e8e8;
        border-radius: 10px;
        font-size: 15px;
        transition: all 0.2s;
        background: #fafafa;
        box-sizing: border-box;

        &:focus {
          outline: none;
          border-color: #667eea;
          background: #fff;
        }
      }
    }

    .alert {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      border-radius: 10px;
      font-size: 14px;
      margin-top: 16px;

      &.success {
        background: #ecfdf5;
        color: #059669;
        border: 1px solid #a7f3d0;
      }

      &.error {
        background: #fef2f2;
        color: #dc2626;
        border: 1px solid #fecaca;
      }

      &.small {
        padding: 10px 14px;
        font-size: 13px;
        margin-top: 20px;
      }
    }

    .actions {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #f0f0f0;
    }

    .btn-primary {
      padding: 14px 28px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;

      &:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .btn-danger-small {
      padding: 8px 12px;
      background: #fee2e2;
      color: #dc2626;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: #fecaca;
      }
    }

    .toggle-group {
      .toggle-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 0;
        border-bottom: 1px solid #f0f0f0;

        &:last-child {
          border-bottom: none;
        }
      }

      .toggle-info {
        h4 {
          font-size: 15px;
          font-weight: 600;
          color: #1a1a2e;
          margin: 0 0 4px 0;
        }

        p {
          font-size: 13px;
          color: #888;
          margin: 0;
        }
      }

      .toggle {
        position: relative;
        display: inline-block;
        width: 52px;
        height: 28px;

        input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ddd;
          transition: 0.3s;
          border-radius: 28px;

          &::before {
            position: absolute;
            content: "";
            height: 22px;
            width: 22px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: 0.3s;
            border-radius: 50%;
          }
        }

        input:checked + .slider {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        input:checked + .slider::before {
          transform: translateX(24px);
        }
      }
    }

    .sessions-list {
      .session-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        background: #f8f9fc;
        border-radius: 12px;
        margin-bottom: 12px;

        &:last-child {
          margin-bottom: 0;
        }

        &.active {
          border: 2px solid #10b981;
        }
      }

      .session-icon {
        width: 44px;
        height: 44px;
        background: #fff;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        color: #667eea;
      }

      .session-info {
        flex: 1;

        .device {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #1a1a2e;
        }

        .location {
          font-size: 13px;
          color: #888;
        }
      }
    }
  `]
})
export class AdminSettingsComponent implements OnInit {
  activeSection = 'profile';
  loading = true;
  saving = false;
  changingPassword = false;
  savingStore = false;

  // Messages
  successMessage = '';
  errorMessage = '';
  passwordSuccess = '';
  passwordError = '';
  storeSuccess = '';
  storeError = '';
  notifSuccess = false;

  sections: SettingSection[] = [
    { id: 'profile', title: 'Profil', icon: 'fas fa-user', description: 'Gérer votre profil' },
    { id: 'security', title: 'Sécurité', icon: 'fas fa-lock', description: 'Mot de passe et sessions' },
    { id: 'notifications', title: 'Notifications', icon: 'fas fa-bell', description: 'Préférences de notification' },
    { id: 'store', title: 'Boutique', icon: 'fas fa-store', description: 'Paramètres de la boutique' }
  ];

  profileSettings = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: ''
  };

  passwordForm = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  notifications = {
    newOrders: true,
    lowStock: true,
    returns: true,
    weeklyReports: false
  };

  storeSettings = {
    storeName: 'Barsha',
    currency: 'TND',
    defaultLanguage: 'fr',
    lowStockThreshold: 5,
    contactEmail: 'contact@barsha.com.tn'
  };

  sessions: any[] = [];

  private apiUrl = environementDev.api;
  private readonly useLocalMode = !!(environementDev as any).useLocalAuth;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  private getHeaders() {
    const token = localStorage.getItem('admin_jwt') || localStorage.getItem('jwt');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  loadSettings(): void {
    this.loading = true;

    if (this.useLocalMode) {
      const storedUser = localStorage.getItem('admin_user');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          this.profileSettings = {
            firstName: user.firstName || user.first_name || 'Admin',
            lastName: user.lastName || user.last_name || 'Barsha',
            email: user.email || 'admin@barsha.com.tn',
            phone: user.phone || '',
            role: user.role || 'SUPER_ADMIN'
          };
        } catch {}
      }

      this.notifications = {
        newOrders: true,
        lowStock: true,
        returns: true,
        weeklyReports: false
      };

      this.storeSettings = {
        storeName: 'Barsha',
        currency: 'TND',
        defaultLanguage: 'fr',
        lowStockThreshold: 5,
        contactEmail: 'contact@barsha.com.tn'
      };

      this.sessions = [{
        id: 'current',
        device: 'Session actuelle',
        location: 'Tunis, Tunisie',
        isCurrent: true
      }];

      this.loading = false;
      return;
    }

    // Load profile
    this.http.get<any>(`${this.apiUrl}/api/admin/settings/profile`, { headers: this.getHeaders() })
      .subscribe({
        next: (data) => {
          this.profileSettings = {
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            phone: data.phone || '',
            role: data.role || ''
          };
        },
        error: () => {
          // Use fallback from localStorage
          const storedUser = localStorage.getItem('admin_user');
          if (storedUser) {
            try {
              const user = JSON.parse(storedUser);
              this.profileSettings = {
                firstName: user.firstName || user.first_name || 'Admin',
                lastName: user.lastName || user.last_name || 'Barsha',
                email: user.email || 'admin@barsha.com.tn',
                phone: user.phone || '',
                role: user.role || 'SUPER_ADMIN'
              };
            } catch {}
          }
        }
      });

    // Load notifications
    this.http.get<any>(`${this.apiUrl}/api/admin/settings/notifications`, { headers: this.getHeaders() })
      .subscribe({
        next: (data) => {
          this.notifications = {
            newOrders: data.newOrders ?? true,
            lowStock: data.lowStock ?? true,
            returns: data.returns ?? true,
            weeklyReports: data.weeklyReports ?? false
          };
        },
        error: () => {}
      });

    // Load store settings
    this.http.get<any>(`${this.apiUrl}/api/admin/settings/store`, { headers: this.getHeaders() })
      .subscribe({
        next: (data) => {
          this.storeSettings = {
            storeName: data.storeName || 'Barsha',
            currency: data.currency || 'TND',
            defaultLanguage: data.defaultLanguage || 'fr',
            lowStockThreshold: data.lowStockThreshold || 5,
            contactEmail: data.contactEmail || 'contact@barsha.com.tn'
          };
        },
        error: () => {}
      });

    // Load sessions
    this.http.get<any>(`${this.apiUrl}/api/admin/settings/sessions`, { headers: this.getHeaders() })
      .subscribe({
        next: (data) => {
          this.sessions = data.sessions || [];
          this.loading = false;
        },
        error: () => {
          this.sessions = [{
            id: 'current',
            device: 'Session actuelle',
            location: 'Tunis, Tunisie',
            isCurrent: true
          }];
          this.loading = false;
        }
      });
  }

  getInitials(): string {
    const first = this.profileSettings.firstName?.charAt(0) || '';
    const last = this.profileSettings.lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || 'A';
  }

  getRoleName(): string {
    const roleMap: Record<string, string> = {
      'super_admin': 'Super Administrateur',
      'SUPER_ADMIN': 'Super Administrateur',
      'admin': 'Administrateur',
      'ADMIN': 'Administrateur',
      'manager': 'Manager',
      'MANAGER': 'Manager'
    };
    return roleMap[this.profileSettings.role] || 'Administrateur';
  }

  saveProfile(): void {
    this.saving = true;
    this.successMessage = '';
    this.errorMessage = '';

    if (this.useLocalMode) {
      this.saving = false;
      this.successMessage = 'Profil mis à jour avec succès';
      const storedUser = localStorage.getItem('admin_user');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          user.firstName = this.profileSettings.firstName;
          user.lastName = this.profileSettings.lastName;
          user.email = this.profileSettings.email;
          user.phone = this.profileSettings.phone;
          localStorage.setItem('admin_user', JSON.stringify(user));
        } catch {}
      }
      setTimeout(() => this.successMessage = '', 3000);
      return;
    }

    this.http.put<any>(`${this.apiUrl}/api/admin/settings/profile`, {
      first_name: this.profileSettings.firstName,
      last_name: this.profileSettings.lastName,
      email: this.profileSettings.email,
      phone: this.profileSettings.phone
    }, { headers: this.getHeaders() })
      .subscribe({
        next: (response) => {
          this.saving = false;
          this.successMessage = 'Profil mis à jour avec succès';

          // Update localStorage
          const storedUser = localStorage.getItem('admin_user');
          if (storedUser) {
            try {
              const user = JSON.parse(storedUser);
              user.firstName = this.profileSettings.firstName;
              user.lastName = this.profileSettings.lastName;
              user.email = this.profileSettings.email;
              user.phone = this.profileSettings.phone;
              localStorage.setItem('admin_user', JSON.stringify(user));
            } catch {}
          }

          setTimeout(() => this.successMessage = '', 3000);
        },
        error: (err) => {
          this.saving = false;
          this.errorMessage = err.error?.detail || 'Erreur lors de la mise à jour';
          setTimeout(() => this.errorMessage = '', 5000);
        }
      });
  }

  changePassword(): void {
    this.changingPassword = true;
    this.passwordSuccess = '';
    this.passwordError = '';

    if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
      this.passwordError = 'Les mots de passe ne correspondent pas';
      this.changingPassword = false;
      return;
    }

    if (this.passwordForm.newPassword.length < 8) {
      this.passwordError = 'Le mot de passe doit contenir au moins 8 caractères';
      this.changingPassword = false;
      return;
    }

    if (this.useLocalMode) {
      this.changingPassword = false;
      this.passwordSuccess = 'Mot de passe mis à jour avec succès';
      this.passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
      setTimeout(() => this.passwordSuccess = '', 3000);
      return;
    }

    this.http.post<any>(`${this.apiUrl}/api/admin/settings/change-password`, {
      current_password: this.passwordForm.currentPassword,
      new_password: this.passwordForm.newPassword,
      confirm_password: this.passwordForm.confirmPassword
    }, { headers: this.getHeaders() })
      .subscribe({
        next: () => {
          this.changingPassword = false;
          this.passwordSuccess = 'Mot de passe mis à jour avec succès';
          this.passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
          setTimeout(() => this.passwordSuccess = '', 3000);
        },
        error: (err) => {
          this.changingPassword = false;
          this.passwordError = err.error?.detail || 'Erreur lors de la mise à jour du mot de passe';
          setTimeout(() => this.passwordError = '', 5000);
        }
      });
  }

  saveNotifications(): void {
    if (this.useLocalMode) {
      this.notifSuccess = true;
      setTimeout(() => this.notifSuccess = false, 2000);
      return;
    }

    this.http.put<any>(`${this.apiUrl}/api/admin/settings/notifications`, {
      new_orders: this.notifications.newOrders,
      low_stock: this.notifications.lowStock,
      returns: this.notifications.returns,
      weekly_reports: this.notifications.weeklyReports
    }, { headers: this.getHeaders() })
      .subscribe({
        next: () => {
          this.notifSuccess = true;
          setTimeout(() => this.notifSuccess = false, 2000);
        },
        error: () => {}
      });
  }

  saveStoreSettings(): void {
    this.savingStore = true;
    this.storeSuccess = '';
    this.storeError = '';

    if (this.useLocalMode) {
      this.savingStore = false;
      this.storeSuccess = 'Paramètres enregistrés avec succès';
      setTimeout(() => this.storeSuccess = '', 3000);
      return;
    }

    this.http.put<any>(`${this.apiUrl}/api/admin/settings/store`, {
      store_name: this.storeSettings.storeName,
      currency: this.storeSettings.currency,
      default_language: this.storeSettings.defaultLanguage,
      low_stock_threshold: this.storeSettings.lowStockThreshold,
      contact_email: this.storeSettings.contactEmail
    }, { headers: this.getHeaders() })
      .subscribe({
        next: () => {
          this.savingStore = false;
          this.storeSuccess = 'Paramètres enregistrés avec succès';
          setTimeout(() => this.storeSuccess = '', 3000);
        },
        error: (err) => {
          this.savingStore = false;
          this.storeError = err.error?.detail || 'Erreur lors de l\'enregistrement';
          setTimeout(() => this.storeError = '', 5000);
        }
      });
  }

  revokeSession(sessionId: string): void {
    if (this.useLocalMode) {
      this.sessions = this.sessions.filter(s => s.id !== sessionId);
      return;
    }

    this.http.delete(`${this.apiUrl}/api/admin/settings/sessions/${sessionId}`, { headers: this.getHeaders() })
      .subscribe({
        next: () => {
          this.sessions = this.sessions.filter(s => s.id !== sessionId);
        },
        error: () => {}
      });
  }
}
