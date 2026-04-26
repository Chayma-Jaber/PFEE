import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';
import { ADMIN_PAGE_STYLES, adminAuthHeaders } from '../_shared/admin-page.styles';

@Component({
  selector: 'app-admin-marketplace',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <div>
          <h1><i class="fas fa-store"></i> Marketplace — vendeurs &amp; payouts</h1>
          <p>Onboarding des vendeurs tiers, calcul des commissions, planification des virements.</p>
        </div>
      </div>
      <div class="toast" [class.ok]="toastKind==='ok'" [class.err]="toastKind==='err'" *ngIf="toast">{{ toast }}</div>

      <div class="stats-grid" *ngIf="stats">
        <div class="stat-card"><div class="stat-icon indigo"><i class="fas fa-store"></i></div><div><span class="stat-value">{{ stats.total }}</span><span class="stat-label">Vendeurs</span></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="fas fa-check"></i></div><div><span class="stat-value">{{ stats.approved }}</span><span class="stat-label">Approuvés</span></div></div>
        <div class="stat-card"><div class="stat-icon amber"><i class="fas fa-hourglass"></i></div><div><span class="stat-value">{{ stats.pending }}</span><span class="stat-label">En attente</span></div></div>
        <div class="stat-card"><div class="stat-icon red"><i class="fas fa-pause"></i></div><div><span class="stat-value">{{ stats.suspended }}</span><span class="stat-label">Suspendus</span></div></div>
        <div class="stat-card"><div class="stat-icon teal"><i class="fas fa-coins"></i></div><div><span class="stat-value">{{ stats.pendingPayouts }}</span><span class="stat-label">Payouts en attente</span></div></div>
      </div>

      <div class="filters">
        <button class="btn ghost" [class.primary]="tab==='sellers'" (click)="tab='sellers'">Vendeurs</button>
        <button class="btn ghost" [class.primary]="tab==='payouts'" (click)="tab='payouts'; loadPayouts()">Payouts</button>
      </div>

      <div class="card" *ngIf="tab==='sellers'">
        <div class="filters">
          <select [(ngModel)]="filterStatus" (change)="loadSellers()">
            <option value="">Tous</option><option value="PENDING">En attente</option><option value="APPROVED">Approuvés</option><option value="SUSPENDED">Suspendus</option><option value="REJECTED">Rejetés</option>
          </select>
        </div>
        <table *ngIf="sellers.length > 0">
          <thead><tr><th>ID</th><th>Slug</th><th>Société</th><th>Email</th><th>Commission</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            <tr *ngFor="let s of sellers">
              <td>#{{ s.id }}</td>
              <td class="mono">{{ s.slug }}</td>
              <td><strong>{{ s.business_name }}</strong></td>
              <td class="small">{{ s.contact_email }}</td>
              <td>{{ s.commission_pct }}%</td>
              <td>
                <span class="badge" [class.ok]="s.status==='APPROVED'" [class.warn]="s.status==='PENDING'" [class.err]="s.status==='REJECTED' || s.status==='SUSPENDED'">{{ s.status }}</span>
              </td>
              <td>
                <button *ngIf="s.status==='PENDING'" class="btn primary" style="padding:4px 8px;font-size:11px" (click)="approve(s)">Approuver</button>
                <button *ngIf="s.status==='PENDING'" class="btn danger" style="padding:4px 8px;font-size:11px" (click)="reject(s)">Rejeter</button>
                <button *ngIf="s.status==='APPROVED'" class="btn ghost" style="padding:4px 8px;font-size:11px" (click)="suspend(s)">Suspendre</button>
                <button *ngIf="s.status==='APPROVED'" class="btn primary" style="padding:4px 8px;font-size:11px" (click)="computePayout(s)">Calculer payout</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="empty" *ngIf="sellers.length === 0">Aucun vendeur.</div>
      </div>

      <div class="card" *ngIf="tab==='payouts'">
        <div class="filters">
          <select [(ngModel)]="payoutFilter" (change)="loadPayouts()">
            <option value="">Tous</option><option value="PENDING">En attente</option><option value="PAID">Payés</option>
          </select>
        </div>
        <table *ngIf="payouts.length > 0">
          <thead><tr><th>ID</th><th>Vendeur</th><th>Période</th><th>Brut</th><th>Commission</th><th>Net</th><th>Cmd.</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            <tr *ngFor="let p of payouts">
              <td>#{{ p.id }}</td>
              <td>{{ p.seller_id }}</td>
              <td class="small">{{ formatDate(p.period_start) }} → {{ formatDate(p.period_end) }}</td>
              <td>{{ p.gross_sales }}</td>
              <td>{{ p.commission_amount }}</td>
              <td><strong>{{ p.net_payout }} TND</strong></td>
              <td>{{ p.order_count }}</td>
              <td><span class="badge" [class.ok]="p.status==='PAID'" [class.warn]="p.status==='PENDING'">{{ p.status }}</span></td>
              <td><button *ngIf="p.status==='PENDING'" class="btn primary" style="padding:3px 8px;font-size:11px" (click)="markPaid(p)">Marquer payé</button></td>
            </tr>
          </tbody>
        </table>
        <div class="empty" *ngIf="payouts.length === 0">Aucun payout.</div>
      </div>
    </div>
  `,
  styles: [ADMIN_PAGE_STYLES]
})
export class AdminMarketplaceComponent implements OnInit {
  stats: any = null;
  sellers: any[] = [];
  payouts: any[] = [];
  tab: 'sellers'|'payouts' = 'sellers';
  filterStatus = '';
  payoutFilter = '';
  toast = ''; toastKind: 'ok'|'err' = 'ok';

  constructor(private http: HttpClient) {}
  ngOnInit() { this.loadStats(); this.loadSellers(); }

  loadStats() {
    this.http.get<any>(`${environementDev.api}/api/admin/marketplace/stats`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.stats = r });
  }

  loadSellers() {
    const qs = this.filterStatus ? `?status=${this.filterStatus}` : '';
    this.http.get<any>(`${environementDev.api}/api/admin/marketplace/sellers${qs}`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.sellers = r.items || [] });
  }

  loadPayouts() {
    const qs = this.payoutFilter ? `?status=${this.payoutFilter}` : '';
    this.http.get<any>(`${environementDev.api}/api/admin/marketplace/payouts${qs}`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.payouts = r.items || [] });
  }

  approve(s: any) {
    const cmd = prompt('Commission % (par défaut 15) :', '15');
    if (cmd === null) return;
    this.http.post(`${environementDev.api}/api/admin/marketplace/sellers/${s.id}/approve`, { commissionPct: Number(cmd) }, { headers: adminAuthHeaders() })
      .subscribe({ next: () => { this.show('Vendeur approuvé', 'ok'); this.loadStats(); this.loadSellers(); } });
  }

  reject(s: any) {
    const reason = prompt('Raison du rejet :') || 'rejet manuel';
    this.http.post(`${environementDev.api}/api/admin/marketplace/sellers/${s.id}/reject`, { reason }, { headers: adminAuthHeaders() })
      .subscribe({ next: () => { this.show('Vendeur rejeté', 'ok'); this.loadStats(); this.loadSellers(); } });
  }

  suspend(s: any) {
    const reason = prompt('Raison de la suspension :') || 'manuel';
    this.http.post(`${environementDev.api}/api/admin/marketplace/sellers/${s.id}/suspend`, { reason }, { headers: adminAuthHeaders() })
      .subscribe({ next: () => { this.show('Suspendu', 'ok'); this.loadSellers(); } });
  }

  computePayout(s: any) {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString();
    const end = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    this.http.post<any>(`${environementDev.api}/api/admin/marketplace/sellers/${s.id}/compute-payout`, { periodStart: start, periodEnd: end }, { headers: adminAuthHeaders() })
      .subscribe({
        next: r => { this.show(`Payout généré : ${r.net_payout} TND`, 'ok'); this.loadStats(); },
        error: () => this.show('Erreur', 'err')
      });
  }

  markPaid(p: any) {
    const ref = prompt('Référence du virement :') || `VIR-${Date.now().toString(36)}`;
    this.http.post(`${environementDev.api}/api/admin/marketplace/payouts/${p.id}/mark-paid`, { reference: ref }, { headers: adminAuthHeaders() })
      .subscribe({ next: () => { this.show('Marqué payé', 'ok'); this.loadPayouts(); } });
  }

  formatDate(d: string) { return d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : ''; }
  private show(m: string, k: 'ok'|'err') { this.toast = m; this.toastKind = k; setTimeout(() => this.toast = '', 3500); }
}
