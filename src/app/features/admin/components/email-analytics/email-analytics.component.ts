import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';

interface EmailStats {
  windowDays: number;
  total: number;
  sent: number;
  failed: number;
  disabled: number;
  opened: number;
  clicked: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  byKind: Array<{ kind: string; count: number; openCount: number }>;
}

interface EmailLogRow {
  id: number;
  tracking_id: string;
  recipient: string;
  subject: string;
  kind: string;
  status: string;
  provider_message_id: string | null;
  error_message: string | null;
  opens_count: number;
  clicks_count: number;
  created_at: string;
  sent_at: string | null;
  first_opened_at: string | null;
}

@Component({
  selector: 'app-admin-email-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="email-analytics">
      <div class="page-header">
        <div>
          <h1>Email — Délivrabilité &amp; engagement</h1>
          <p>Envois SMTP, échecs, ouvertures (pixel) et clics sur les {{ windowDays }} derniers jours.</p>
        </div>
        <div class="window-picker">
          <label>Fenêtre :</label>
          <select [(ngModel)]="windowDays" (change)="loadStats()">
            <option [ngValue]="7">7 jours</option>
            <option [ngValue]="30">30 jours</option>
            <option [ngValue]="90">90 jours</option>
            <option [ngValue]="365">12 mois</option>
          </select>
        </div>
      </div>

      <div class="stats-grid" *ngIf="stats">
        <div class="stat-card">
          <div class="stat-icon total"><i class="fas fa-envelope"></i></div>
          <div class="stat-info"><span class="stat-value">{{ stats.total }}</span><span class="stat-label">Total envois</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon sent"><i class="fas fa-paper-plane"></i></div>
          <div class="stat-info"><span class="stat-value">{{ stats.sent }}</span><span class="stat-label">Livrés</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon failed"><i class="fas fa-times-circle"></i></div>
          <div class="stat-info"><span class="stat-value">{{ stats.failed }}</span><span class="stat-label">Échecs</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon opened"><i class="fas fa-eye"></i></div>
          <div class="stat-info"><span class="stat-value">{{ stats.opened }}</span><span class="stat-label">Ouverts ({{ stats.openRate }}%)</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon clicked"><i class="fas fa-mouse-pointer"></i></div>
          <div class="stat-info"><span class="stat-value">{{ stats.clicked }}</span><span class="stat-label">Cliqués ({{ stats.clickRate }}%)</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon rate"><i class="fas fa-percentage"></i></div>
          <div class="stat-info"><span class="stat-value">{{ stats.deliveryRate }}%</span><span class="stat-label">Taux de livraison</span></div>
        </div>
      </div>

      <div class="layout">
        <div class="card kind-card" *ngIf="stats && stats.byKind?.length">
          <h2><i class="fas fa-chart-pie"></i> Par type d'email</h2>
          <div class="kind-row" *ngFor="let k of stats.byKind">
            <div class="kind-name">{{ labelForKind(k.kind) }}</div>
            <div class="kind-bar-wrap">
              <div class="kind-bar" [style.width.%]="barWidth(k, stats)"></div>
            </div>
            <div class="kind-count">{{ k.count }} <span class="muted">({{ k.openCount }} ouv.)</span></div>
          </div>
        </div>

        <div class="card list-card">
          <div class="list-head">
            <h2><i class="fas fa-history"></i> Envois récents</h2>
            <div class="filters">
              <input type="text" [(ngModel)]="searchQ" (keyup.enter)="loadRecent()" placeholder="Destinataire / sujet..." />
              <select [(ngModel)]="filterStatus" (change)="loadRecent()">
                <option value="">Tous</option>
                <option value="SENT">Livrés</option>
                <option value="OPENED">Ouverts</option>
                <option value="CLICKED">Cliqués</option>
                <option value="FAILED">Échecs</option>
                <option value="QUEUED">En attente</option>
                <option value="DISABLED">Désactivé</option>
              </select>
              <select [(ngModel)]="filterKind" (change)="loadRecent()">
                <option value="">Tous types</option>
                <option value="ORDER_CONFIRMATION">Commande</option>
                <option value="PAYMENT_CONFIRMATION">Paiement</option>
                <option value="SHIPPING">Expédition</option>
                <option value="PASSWORD_RESET">Mot de passe</option>
                <option value="SUPPORT">Support</option>
                <option value="CART_RECOVERY">Panier</option>
                <option value="NEWSLETTER">Newsletter</option>
              </select>
              <button class="btn-refresh" (click)="loadRecent()" [disabled]="isLoading">
                <i class="fas fa-sync-alt" [class.spinning]="isLoading"></i>
              </button>
            </div>
          </div>
          <div class="list" *ngIf="!isLoading">
            <div class="empty" *ngIf="recent.length === 0">Aucun email enregistré.</div>
            <div class="row" *ngFor="let m of recent"
                 [class.row-failed]="m.status === 'FAILED'"
                 [class.row-disabled]="m.status === 'DISABLED'">
              <div class="r-left">
                <span class="badge" [class]="'s-' + m.status.toLowerCase()">{{ m.status }}</span>
                <span class="kind">{{ labelForKind(m.kind) }}</span>
              </div>
              <div class="r-mid">
                <div class="to"><i class="fas fa-at"></i> {{ m.recipient }}</div>
                <div class="subj">{{ m.subject }}</div>
                <div class="metrics">
                  <span *ngIf="m.opens_count > 0"><i class="fas fa-eye"></i> {{ m.opens_count }} ouv.</span>
                  <span *ngIf="m.clicks_count > 0"><i class="fas fa-mouse-pointer"></i> {{ m.clicks_count }} clic(s)</span>
                  <span *ngIf="m.first_opened_at">1er ouv. {{ formatDate(m.first_opened_at) }}</span>
                </div>
                <div class="error" *ngIf="m.error_message">
                  <i class="fas fa-exclamation-circle"></i> {{ m.error_message }}
                </div>
              </div>
              <div class="r-right">
                <small>{{ formatDate(m.created_at) }}</small>
                <small *ngIf="m.provider_message_id" class="mono">{{ m.provider_message_id.slice(0, 24) }}</small>
              </div>
            </div>
          </div>
          <div class="loading" *ngIf="isLoading">Chargement...</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .email-analytics { padding: 24px; max-width: 1400px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
    .page-header h1 { font-size: 24px; font-weight: 600; margin: 0 0 4px; color: #111827; }
    .page-header p { margin: 0; color: #6b7280; font-size: 14px; }
    .window-picker { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .window-picker select { padding: 7px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 22px; }
    .stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; display: flex; gap: 12px; align-items: center; }
    .stat-icon { width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .stat-icon.total { background: #eef2ff; color: #6366f1; }
    .stat-icon.sent { background: #d1fae5; color: #10b981; }
    .stat-icon.failed { background: #fee2e2; color: #ef4444; }
    .stat-icon.opened { background: #fef3c7; color: #f59e0b; }
    .stat-icon.clicked { background: #fce7f3; color: #ec4899; }
    .stat-icon.rate { background: #ccfbf1; color: #0d9488; }
    .stat-value { display: block; font-size: 22px; font-weight: 700; color: #111827; }
    .stat-label { font-size: 12px; color: #6b7280; }
    .layout { display: grid; grid-template-columns: 340px 1fr; gap: 20px; align-items: flex-start; }
    @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
    .card h2 { font-size: 16px; font-weight: 600; margin: 0 0 14px; color: #111827; display: flex; align-items: center; gap: 8px; }
    .kind-row { display: grid; grid-template-columns: 120px 1fr 110px; align-items: center; gap: 12px; margin-bottom: 10px; font-size: 13px; }
    .kind-name { color: #374151; }
    .kind-bar-wrap { background: #f3f4f6; border-radius: 6px; height: 10px; overflow: hidden; }
    .kind-bar { background: linear-gradient(135deg,#6366f1,#ec4899); height: 100%; transition: width .3s; }
    .kind-count { text-align: right; font-variant-numeric: tabular-nums; color: #111827; font-weight: 600; }
    .kind-count .muted { color: #9ca3af; font-weight: 400; font-size: 11px; }
    .list-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
    .list-head h2 { margin: 0; }
    .filters { display: flex; gap: 8px; flex-wrap: wrap; }
    .filters input, .filters select { padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }
    .filters input { width: 180px; }
    .btn-refresh { background: transparent; border: 1px solid #d1d5db; width: 34px; height: 34px; border-radius: 6px; cursor: pointer; color: #6366f1; }
    .spinning { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .list { max-height: 600px; overflow-y: auto; }
    .row { display: grid; grid-template-columns: 150px 1fr 150px; gap: 14px; padding: 12px; border-bottom: 1px solid #f3f4f6; }
    .row:last-child { border: none; }
    .row-failed { background: #fef2f2; }
    .row-disabled { background: #f9fafb; opacity: .7; }
    .r-left { display: flex; flex-direction: column; gap: 4px; }
    .badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; letter-spacing: .5px; width: fit-content; }
    .s-sent { background: #d1fae5; color: #065f46; }
    .s-opened { background: #fef3c7; color: #92400e; }
    .s-clicked { background: #fce7f3; color: #9d174d; }
    .s-failed { background: #fee2e2; color: #991b1b; }
    .s-queued { background: #eef2ff; color: #3730a3; }
    .s-disabled { background: #e5e7eb; color: #4b5563; }
    .s-bounced { background: #fee2e2; color: #991b1b; }
    .kind { font-size: 10px; color: #6b7280; background: #f3f4f6; padding: 2px 8px; border-radius: 10px; width: fit-content; }
    .r-mid .to { font-weight: 600; font-size: 13px; color: #111827; margin-bottom: 4px; }
    .r-mid .to i { color: #6366f1; margin-right: 6px; font-size: 11px; }
    .r-mid .subj { font-size: 13px; color: #374151; }
    .r-mid .metrics { display: flex; gap: 12px; margin-top: 6px; font-size: 11px; color: #6b7280; }
    .r-mid .metrics i { margin-right: 3px; }
    .r-mid .error { margin-top: 6px; font-size: 12px; color: #dc2626; }
    .r-right { text-align: right; display: flex; flex-direction: column; gap: 2px; }
    .r-right small { font-size: 11px; color: #9ca3af; }
    .mono { font-family: 'Courier New', monospace; }
    .empty, .loading { text-align: center; padding: 40px; color: #6b7280; font-size: 14px; }
  `]
})
export class AdminEmailAnalyticsComponent implements OnInit {
  stats: EmailStats | null = null;
  recent: EmailLogRow[] = [];
  isLoading = false;

  windowDays = 30;
  searchQ = '';
  filterStatus = '';
  filterKind = '';

  constructor(private http: HttpClient) {}

  ngOnInit() { this.loadStats(); this.loadRecent(); }

  private headers(): Record<string, string> {
    const t = localStorage.getItem('admin_jwt') || localStorage.getItem('jwt');
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  loadStats() {
    this.http.get<EmailStats>(
      `${environementDev.api}/api/admin/email-analytics/stats?days=${this.windowDays}`,
      { headers: this.headers() }
    ).subscribe({
      next: (r) => this.stats = r,
      error: () => this.stats = null
    });
  }

  loadRecent() {
    this.isLoading = true;
    const qs = new URLSearchParams({ limit: '60' });
    if (this.filterStatus) qs.set('status', this.filterStatus);
    if (this.filterKind) qs.set('kind', this.filterKind);
    if (this.searchQ.trim()) qs.set('q', this.searchQ.trim());
    this.http.get<{ items: EmailLogRow[] }>(
      `${environementDev.api}/api/admin/email-analytics/recent?${qs.toString()}`,
      { headers: this.headers() }
    ).subscribe({
      next: (r) => { this.recent = r.items || []; this.isLoading = false; },
      error: () => { this.recent = []; this.isLoading = false; }
    });
  }

  barWidth(k: { count: number }, s: EmailStats): number {
    const max = Math.max(...s.byKind.map((x) => x.count), 1);
    return Math.round((k.count / max) * 100);
  }

  labelForKind(k: string): string {
    const map: Record<string, string> = {
      ORDER_CONFIRMATION: 'Commande',
      PAYMENT_CONFIRMATION: 'Paiement',
      SHIPPING: 'Expédition',
      PASSWORD_RESET: 'Mot de passe',
      SUPPORT: 'Support',
      CART_RECOVERY: 'Panier abandonné',
      NEWSLETTER: 'Newsletter',
      ADMIN_TEST: 'Test admin',
      OTHER: 'Autre',
    };
    return map[k] || k;
  }

  formatDate(d: string | null): string {
    if (!d) return '';
    return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}
