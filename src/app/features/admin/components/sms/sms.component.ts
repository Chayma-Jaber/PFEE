import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';

interface SmsStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  deliveryRate: number;
}

interface SmsMessageRow {
  id: number;
  to: string;
  body: string;
  purpose: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED';
  provider: string;
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
}

@Component({
  selector: 'app-admin-sms',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-sms">
      <div class="page-header">
        <div>
          <h1>SMS — Transport &amp; activité</h1>
          <p>Journal des SMS envoyés (OTP, commandes, livraisons) et envoi de test.</p>
        </div>
      </div>

      <div class="alert alert-success" *ngIf="toast && toastKind === 'ok'"><i class="fas fa-check"></i> {{ toast }}</div>
      <div class="alert alert-error" *ngIf="toast && toastKind === 'err'"><i class="fas fa-exclamation"></i> {{ toast }}</div>

      <div class="stats-grid" *ngIf="stats">
        <div class="stat-card">
          <div class="stat-icon total"><i class="fas fa-sms"></i></div>
          <div class="stat-info"><span class="stat-value">{{ stats.total }}</span><span class="stat-label">Total</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon sent"><i class="fas fa-check"></i></div>
          <div class="stat-info"><span class="stat-value">{{ stats.sent }}</span><span class="stat-label">Envoyés</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon failed"><i class="fas fa-times"></i></div>
          <div class="stat-info"><span class="stat-value">{{ stats.failed }}</span><span class="stat-label">Échecs</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon pending"><i class="fas fa-hourglass-half"></i></div>
          <div class="stat-info"><span class="stat-value">{{ stats.pending }}</span><span class="stat-label">En attente</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon rate"><i class="fas fa-percentage"></i></div>
          <div class="stat-info"><span class="stat-value">{{ stats.deliveryRate }}%</span><span class="stat-label">Taux de livraison</span></div>
        </div>
      </div>

      <div class="layout">
        <div class="card test-card">
          <h2><i class="fas fa-paper-plane"></i> Envoi de test</h2>
          <p class="hint">Envoie un SMS réel si le provider est configuré, ou enregistre une trace console sinon.</p>
          <div class="form-group">
            <label>Numéro destinataire</label>
            <input type="tel" [(ngModel)]="testTo" placeholder="+21612345678 ou 12345678" />
          </div>
          <div class="form-group">
            <label>Message (optionnel)</label>
            <textarea [(ngModel)]="testBody" rows="3" maxlength="320"
              placeholder="Laisser vide pour un message de test par défaut"></textarea>
          </div>
          <div class="form-actions">
            <button class="btn-primary" (click)="sendTest()" [disabled]="isSending || !testTo">
              <i class="fas fa-paper-plane"></i>
              {{ isSending ? 'Envoi...' : 'Envoyer le test' }}
            </button>
          </div>
        </div>

        <div class="card list-card">
          <div class="list-head">
            <h2><i class="fas fa-history"></i> Messages récents</h2>
            <div class="filters">
              <select [(ngModel)]="filterStatus" (change)="loadRecent()">
                <option value="">Tous les statuts</option>
                <option value="SENT">Envoyés</option>
                <option value="FAILED">Échecs</option>
                <option value="PENDING">En attente</option>
              </select>
              <select [(ngModel)]="filterPurpose" (change)="loadRecent()">
                <option value="">Tous</option>
                <option value="OTP">OTP</option>
                <option value="ORDER">Commande</option>
                <option value="SHIPPING">Livraison</option>
                <option value="ADMIN_TEST">Test admin</option>
              </select>
              <button class="btn-refresh" (click)="loadRecent()" [disabled]="isLoading">
                <i class="fas fa-sync-alt" [class.spinning]="isLoading"></i>
              </button>
            </div>
          </div>
          <div class="list" *ngIf="!isLoading">
            <div class="empty" *ngIf="recent.length === 0">Aucun SMS enregistré.</div>
            <div class="sms-row" *ngFor="let m of recent" [class.row-failed]="m.status === 'FAILED'" [class.row-pending]="m.status === 'PENDING'">
              <div class="sms-left">
                <span class="status-badge" [class.s-sent]="m.status === 'SENT'" [class.s-failed]="m.status === 'FAILED'" [class.s-pending]="m.status === 'PENDING'">
                  {{ m.status }}
                </span>
                <span class="purpose-badge">{{ m.purpose }}</span>
              </div>
              <div class="sms-mid">
                <div class="to"><i class="fas fa-mobile-alt"></i> {{ m.to }}</div>
                <div class="body">{{ m.body }}</div>
                <div class="error" *ngIf="m.error_message">
                  <i class="fas fa-exclamation-circle"></i> {{ m.error_message }}
                </div>
              </div>
              <div class="sms-right">
                <small>{{ formatDate(m.created_at) }}</small>
                <small>{{ m.provider }}</small>
              </div>
            </div>
          </div>
          <div class="loading" *ngIf="isLoading">Chargement...</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-sms { padding: 24px; max-width: 1400px; }
    .page-header h1 { font-size: 24px; font-weight: 600; margin: 0 0 4px; color: #111827; }
    .page-header p { margin: 0 0 20px; color: #6b7280; font-size: 14px; }
    .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; display: flex; gap: 8px; }
    .alert-success { background: #d1fae5; color: #065f46; }
    .alert-error { background: #fee2e2; color: #991b1b; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 22px; }
    .stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; display: flex; gap: 12px; align-items: center; }
    .stat-icon { width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .stat-icon.total { background: #eef2ff; color: #6366f1; }
    .stat-icon.sent { background: #d1fae5; color: #10b981; }
    .stat-icon.failed { background: #fee2e2; color: #ef4444; }
    .stat-icon.pending { background: #fef3c7; color: #f59e0b; }
    .stat-icon.rate { background: #fce7f3; color: #ec4899; }
    .stat-value { display: block; font-size: 22px; font-weight: 700; color: #111827; }
    .stat-label { font-size: 12px; color: #6b7280; }
    .layout { display: grid; grid-template-columns: 340px 1fr; gap: 20px; align-items: flex-start; }
    @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
    .card h2 { font-size: 16px; font-weight: 600; margin: 0 0 14px 0; color: #111827; display: flex; align-items: center; gap: 8px; }
    .hint { font-size: 12px; color: #6b7280; margin-top: -8px; margin-bottom: 14px; }
    .form-group { margin-bottom: 12px; }
    .form-group label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; color: #374151; }
    .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; box-sizing: border-box; }
    .btn-primary { padding: 11px 20px; background: #111; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; display: inline-flex; gap: 8px; align-items: center; }
    .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
    .list-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 10px; flex-wrap: wrap; }
    .list-head h2 { margin: 0; }
    .filters { display: flex; gap: 8px; }
    .filters select { padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }
    .btn-refresh { background: transparent; border: 1px solid #d1d5db; width: 34px; height: 34px; border-radius: 6px; cursor: pointer; color: #6366f1; }
    .spinning { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .list { max-height: 560px; overflow-y: auto; }
    .sms-row { display: grid; grid-template-columns: 140px 1fr 140px; gap: 14px; padding: 12px; border-bottom: 1px solid #f3f4f6; align-items: flex-start; }
    .sms-row:last-child { border: none; }
    .row-failed { background: #fef2f2; }
    .row-pending { background: #fffbeb; }
    .sms-left { display: flex; flex-direction: column; gap: 4px; }
    .status-badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; letter-spacing: .5px; width: fit-content; }
    .s-sent { background: #d1fae5; color: #065f46; }
    .s-failed { background: #fee2e2; color: #991b1b; }
    .s-pending { background: #fef3c7; color: #92400e; }
    .purpose-badge { font-size: 10px; color: #6b7280; background: #f3f4f6; padding: 2px 8px; border-radius: 10px; width: fit-content; }
    .sms-mid .to { font-weight: 600; font-size: 13px; color: #111827; margin-bottom: 4px; }
    .sms-mid .to i { color: #6366f1; margin-right: 6px; }
    .sms-mid .body { font-size: 13px; color: #374151; line-height: 1.4; }
    .sms-mid .error { margin-top: 6px; font-size: 12px; color: #dc2626; }
    .sms-right { text-align: right; display: flex; flex-direction: column; gap: 2px; }
    .sms-right small { font-size: 11px; color: #9ca3af; }
    .empty, .loading { text-align: center; padding: 40px; color: #6b7280; font-size: 14px; }
  `]
})
export class AdminSmsComponent implements OnInit {
  stats: SmsStats | null = null;
  recent: SmsMessageRow[] = [];
  isLoading = false;
  isSending = false;

  testTo = '';
  testBody = '';
  filterStatus = '';
  filterPurpose = '';

  toast = '';
  toastKind: 'ok' | 'err' = 'ok';

  constructor(private http: HttpClient) {}

  ngOnInit() { this.loadStats(); this.loadRecent(); }

  private headers(): Record<string, string> {
    const t = localStorage.getItem('admin_jwt') || localStorage.getItem('jwt');
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  loadStats() {
    this.http.get<SmsStats>(`${environementDev.api}/api/admin/sms/stats`, { headers: this.headers() })
      .subscribe({ next: (r) => this.stats = r, error: () => this.stats = null });
  }

  loadRecent() {
    this.isLoading = true;
    const qs = new URLSearchParams({ limit: '50' });
    if (this.filterStatus) qs.set('status', this.filterStatus);
    if (this.filterPurpose) qs.set('purpose', this.filterPurpose);
    this.http.get<{ items: SmsMessageRow[] }>(
      `${environementDev.api}/api/admin/sms/recent?${qs.toString()}`,
      { headers: this.headers() }
    ).subscribe({
      next: (r) => { this.recent = r.items || []; this.isLoading = false; },
      error: () => { this.recent = []; this.isLoading = false; }
    });
  }

  sendTest() {
    if (!this.testTo) return;
    this.isSending = true;
    this.http.post<any>(`${environementDev.api}/api/admin/sms/test`,
      { to: this.testTo, message: this.testBody || undefined },
      { headers: this.headers() }
    ).subscribe({
      next: (r) => {
        this.isSending = false;
        if (r.ok) this.showToast(`Envoyé (${r.provider})`, 'ok');
        else this.showToast(`Échec: ${r.error || r.status}`, 'err');
        this.loadStats(); this.loadRecent();
      },
      error: (err) => {
        this.isSending = false;
        this.showToast(err?.error?.message || 'Erreur réseau', 'err');
      }
    });
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  private showToast(msg: string, kind: 'ok' | 'err') {
    this.toast = msg; this.toastKind = kind;
    setTimeout(() => this.toast = '', 3500);
  }
}
