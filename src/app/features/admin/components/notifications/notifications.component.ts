import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-notifications">
      <div class="page-header">
        <div>
          <h1>Notifications & Campagnes</h1>
          <p>Envoyez des notifications ciblées à vos clients</p>
        </div>
      </div>

      <div class="alert alert-success" *ngIf="successMessage"><i class="fas fa-check"></i> {{ successMessage }}</div>
      <div class="alert alert-error" *ngIf="errorMessage"><i class="fas fa-exclamation"></i> {{ errorMessage }}</div>

      <div class="stats-grid" *ngIf="stats">
        <div class="stat-card">
          <div class="stat-icon total"><i class="fas fa-bell"></i></div>
          <div class="stat-info"><span class="stat-value">{{ stats.total }}</span><span class="stat-label">Notifications envoyées</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon unread"><i class="fas fa-envelope"></i></div>
          <div class="stat-info"><span class="stat-value">{{ stats.unread }}</span><span class="stat-label">Non lues</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon customers"><i class="fas fa-users"></i></div>
          <div class="stat-info"><span class="stat-value">{{ stats.totalCustomers }}</span><span class="stat-label">Clients potentiels</span></div>
        </div>
      </div>

      <div class="layout">
        <!-- Broadcast form -->
        <div class="card broadcast-card">
          <h2><i class="fas fa-paper-plane"></i> Nouvelle campagne</h2>
          <div class="form-group">
            <label>Audience</label>
            <select [(ngModel)]="form.audience">
              <option value="customers">Tous les clients</option>
              <option value="all">Tous les utilisateurs (clients + staff)</option>
              <option value="specific">Utilisateurs spécifiques</option>
            </select>
          </div>
          <div class="form-group" *ngIf="form.audience === 'specific'">
            <label>IDs utilisateurs (séparés par virgule)</label>
            <input type="text" [(ngModel)]="userIdsRaw" placeholder="1, 5, 12" />
          </div>
          <div class="form-group">
            <label>Type</label>
            <select [(ngModel)]="form.type">
              <option value="PROMOTION">Promotion</option>
              <option value="PRODUCT">Produit</option>
              <option value="ORDER">Commande</option>
              <option value="SYSTEM">Système</option>
            </select>
          </div>
          <div class="form-group">
            <label>Titre *</label>
            <input type="text" [(ngModel)]="form.title" placeholder="Ex: Offre spéciale week-end!" />
          </div>
          <div class="form-group">
            <label>Message *</label>
            <textarea [(ngModel)]="form.message" rows="4" placeholder="Votre message..."></textarea>
          </div>
          <div class="form-group">
            <label>Lien d'action (optionnel)</label>
            <input type="text" [(ngModel)]="form.actionUrl" placeholder="/tn/shop?promo=WEEKEND" />
          </div>
          <div class="form-actions">
            <button class="btn-primary" (click)="send()" [disabled]="isSending">
              <i class="fas fa-paper-plane"></i>
              {{ isSending ? 'Envoi en cours...' : 'Envoyer la campagne' }}
            </button>
          </div>
          <div class="preview" *ngIf="form.title || form.message">
            <div class="preview-label">Aperçu:</div>
            <div class="preview-notif">
              <div class="preview-icon"><i class="fas fa-bell"></i></div>
              <div class="preview-body">
                <strong>{{ form.title || 'Titre' }}</strong>
                <p>{{ form.message || 'Message' }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent -->
        <div class="card recent-card">
          <h2><i class="fas fa-history"></i> Notifications récentes</h2>
          <div class="loading" *ngIf="isLoading">Chargement...</div>
          <div class="notifications-list" *ngIf="!isLoading">
            <div class="notification-item" *ngFor="let n of recent">
              <div class="notif-type" [class]="n.type?.toLowerCase()">
                <i class="fas" [class.fa-tag]="n.type === 'PROMOTION'" [class.fa-box]="n.type === 'PRODUCT'" [class.fa-shopping-bag]="n.type === 'ORDER'" [class.fa-cog]="n.type === 'SYSTEM'"></i>
              </div>
              <div class="notif-body">
                <div class="notif-title">{{ n.title }}</div>
                <div class="notif-message">{{ n.message }}</div>
                <div class="notif-meta">
                  <span>{{ n.userName }} ({{ n.userEmail }})</span>
                  <span [class.read]="n.isRead" [class.unread]="!n.isRead">{{ n.isRead ? 'Lu' : 'Non lu' }}</span>
                  <span>{{ formatDate(n.createdAt) }}</span>
                </div>
              </div>
            </div>
            <div class="empty" *ngIf="recent.length === 0">
              <p>Aucune notification envoyée</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-notifications { padding: 24px; max-width: 1400px; }
    .page-header { margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 600; color: #111827; margin: 0 0 4px 0; }
    .page-header p { color: #6b7280; margin: 0; font-size: 14px; }
    .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; display: flex; gap: 8px; }
    .alert-success { background: #d1fae5; color: #065f46; }
    .alert-error { background: #fee2e2; color: #991b1b; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; display: flex; gap: 14px; align-items: center; }
    .stat-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .stat-icon.total { background: #eef2ff; color: #6366f1; }
    .stat-icon.unread { background: #fef3c7; color: #f59e0b; }
    .stat-icon.customers { background: #d1fae5; color: #10b981; }
    .stat-value { display: block; font-size: 22px; font-weight: 700; color: #111827; }
    .stat-label { font-size: 13px; color: #6b7280; }
    .layout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
    .card h2 { font-size: 16px; font-weight: 600; margin: 0 0 16px 0; color: #111827; display: flex; align-items: center; gap: 8px; }
    .form-group { margin-bottom: 14px; }
    .form-group label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; color: #374151; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
    .form-actions { display: flex; gap: 10px; margin-top: 8px; }
    .btn-primary { padding: 12px 24px; background: #111; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; display: inline-flex; align-items: center; gap: 8px; }
    .btn-primary:hover { background: #333; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .preview { margin-top: 16px; padding-top: 16px; border-top: 1px solid #f3f4f6; }
    .preview-label { font-size: 12px; color: #9ca3af; margin-bottom: 8px; }
    .preview-notif { display: flex; gap: 12px; background: #f9fafb; padding: 12px; border-radius: 8px; }
    .preview-icon { width: 36px; height: 36px; background: #eef2ff; color: #6366f1; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
    .preview-body strong { display: block; color: #111827; font-size: 14px; }
    .preview-body p { margin: 4px 0 0 0; font-size: 13px; color: #6b7280; }
    .notifications-list { max-height: 600px; overflow-y: auto; }
    .notification-item { display: flex; gap: 12px; padding: 12px; border-bottom: 1px solid #f3f4f6; }
    .notification-item:last-child { border: none; }
    .notif-type { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .notif-type.promotion { background: #fce7f3; color: #ec4899; }
    .notif-type.product { background: #d1fae5; color: #10b981; }
    .notif-type.order { background: #eef2ff; color: #6366f1; }
    .notif-type.system { background: #f3f4f6; color: #6b7280; }
    .notif-body { flex: 1; min-width: 0; }
    .notif-title { font-weight: 600; color: #111827; font-size: 13px; }
    .notif-message { color: #6b7280; font-size: 13px; margin-top: 2px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .notif-meta { display: flex; gap: 10px; font-size: 11px; color: #9ca3af; margin-top: 6px; flex-wrap: wrap; }
    .notif-meta .read { color: #10b981; }
    .notif-meta .unread { color: #f59e0b; }
    .loading, .empty { text-align: center; padding: 40px; color: #6b7280; }
  `]
})
export class AdminNotificationsComponent implements OnInit {
  stats: any = null;
  recent: any[] = [];
  isLoading = false;
  isSending = false;
  userIdsRaw = '';
  form: any = {
    audience: 'customers',
    type: 'PROMOTION',
    title: '',
    message: '',
    actionUrl: ''
  };
  successMessage = '';
  errorMessage = '';

  constructor(private adminService: AdminService) {}

  ngOnInit() {
    this.loadStats();
    this.loadRecent();
  }

  loadStats() {
    this.adminService.getNotificationStats().subscribe(s => this.stats = s);
  }

  loadRecent() {
    this.isLoading = true;
    this.adminService.getRecentNotifications(30).subscribe({
      next: (res) => { this.recent = res.items || []; this.isLoading = false; },
      error: () => this.isLoading = false
    });
  }

  send() {
    if (!this.form.title?.trim()) { this.showError('Titre requis'); return; }
    if (!this.form.message?.trim()) { this.showError('Message requis'); return; }

    const payload: any = { ...this.form };
    if (this.form.audience === 'specific') {
      const ids = this.userIdsRaw.split(',').map(s => s.trim()).filter(Boolean).map(Number).filter(n => !isNaN(n));
      if (ids.length === 0) { this.showError('IDs utilisateurs requis'); return; }
      payload.userIds = ids;
    }

    this.isSending = true;
    this.adminService.broadcastNotification(payload).subscribe({
      next: (res) => {
        this.showSuccess(`Envoyé à ${res.sent} utilisateur(s)`);
        this.form = { audience: 'customers', type: 'PROMOTION', title: '', message: '', actionUrl: '' };
        this.userIdsRaw = '';
        this.loadStats(); this.loadRecent();
        this.isSending = false;
      },
      error: (err) => {
        this.showError(err?.error?.message || 'Erreur lors de l\'envoi');
        this.isSending = false;
      }
    });
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  showSuccess(m: string) { this.successMessage = m; this.errorMessage = ''; setTimeout(() => this.successMessage = '', 3000); }
  showError(m: string) { this.errorMessage = m; this.successMessage = ''; setTimeout(() => this.errorMessage = '', 5000); }
}
