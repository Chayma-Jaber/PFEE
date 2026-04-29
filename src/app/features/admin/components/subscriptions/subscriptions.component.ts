import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';
import { AdminModuleContextComponent } from '../_shared/admin-module-context.component';
import { ADMIN_PAGE_STYLES, adminAuthHeaders } from '../_shared/admin-page.styles';

@Component({
  selector: 'app-admin-subscriptions',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminModuleContextComponent],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <div>
          <h1><i class="fas fa-redo-alt"></i> Abonnements récurrents</h1>
          <p>Subscribe-and-save : MRR estimée, abonnements actifs, dunning. Le cron les facture toutes les 15 min.</p>
        </div>
        <button class="btn gradient" (click)="processNow()" [disabled]="processing">
          <i class="fas fa-play"></i> {{ processing ? 'Traitement…' : 'Traiter manuellement' }}
        </button>
      </div>
      <app-admin-module-context moduleKey="subscriptions" />
      <div class="toast" [class.ok]="toastKind==='ok'" [class.err]="toastKind==='err'" *ngIf="toast">{{ toast }}</div>

      <div class="stats-grid" *ngIf="stats">
        <div class="stat-card"><div class="stat-icon indigo"><i class="fas fa-list"></i></div><div><span class="stat-value">{{ stats.total }}</span><span class="stat-label">Total</span></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="fas fa-check"></i></div><div><span class="stat-value">{{ stats.active }}</span><span class="stat-label">Actifs</span></div></div>
        <div class="stat-card"><div class="stat-icon amber"><i class="fas fa-pause"></i></div><div><span class="stat-value">{{ stats.paused }}</span><span class="stat-label">En pause</span></div></div>
        <div class="stat-card"><div class="stat-icon red"><i class="fas fa-times"></i></div><div><span class="stat-value">{{ stats.pastDue }}</span><span class="stat-label">Échec paiement</span></div></div>
        <div class="stat-card"><div class="stat-icon teal"><i class="fas fa-coins"></i></div><div><span class="stat-value">{{ stats.estimatedMRR }} TND</span><span class="stat-label">MRR estimée</span></div></div>
      </div>

      <div class="filters">
        <select [(ngModel)]="filterStatus" (change)="load()">
          <option value="">Tous</option>
          <option value="ACTIVE">Actifs</option>
          <option value="PAUSED">En pause</option>
          <option value="PAST_DUE">Échec</option>
          <option value="CANCELLED">Annulés</option>
        </select>
        <button class="btn ghost" (click)="load()" [disabled]="loading"><i class="fas fa-sync-alt"></i></button>
      </div>

      <div class="card">
        <table *ngIf="!loading && items.length > 0">
          <thead><tr><th>ID</th><th>User</th><th>Produit</th><th>Qté</th><th>Fréquence</th><th>Statut</th><th>Cycles</th><th>Prochaine</th><th>Erreurs</th></tr></thead>
          <tbody>
            <tr *ngFor="let s of items">
              <td>#{{ s.id }}</td>
              <td>{{ s.user_id }}</td>
              <td>{{ s.product_id }}</td>
              <td>{{ s.quantity }}</td>
              <td>{{ s.frequency_days }} jours</td>
              <td>
                <span class="badge" [class.ok]="s.status==='ACTIVE'" [class.warn]="s.status==='PAUSED'" [class.err]="s.status==='PAST_DUE' || s.status==='CANCELLED'">{{ s.status }}</span>
              </td>
              <td>{{ s.total_cycles }}</td>
              <td class="small">{{ formatDate(s.next_charge_at) }}</td>
              <td class="small">{{ s.failed_attempts || 0 }}<span *ngIf="s.last_error" title="{{ s.last_error }}"> ⚠</span></td>
            </tr>
          </tbody>
        </table>
        <div class="empty" *ngIf="!loading && items.length === 0">Aucun abonnement.</div>
        <div class="loading" *ngIf="loading">Chargement…</div>
      </div>
    </div>
  `,
  styles: [ADMIN_PAGE_STYLES]
})
export class AdminSubscriptionsComponent implements OnInit {
  stats: any = null;
  items: any[] = [];
  loading = false;
  processing = false;
  filterStatus = '';
  toast = '';
  toastKind: 'ok'|'err' = 'ok';

  constructor(private http: HttpClient) {}
  ngOnInit() { this.loadStats(); this.load(); }

  loadStats() {
    this.http.get<any>(`${environementDev.api}/api/admin/subscriptions/stats`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.stats = r, error: () => this.stats = null });
  }

  load() {
    this.loading = true;
    const qs = this.filterStatus ? `?status=${this.filterStatus}` : '';
    this.http.get<any>(`${environementDev.api}/api/admin/subscriptions${qs}`, { headers: adminAuthHeaders() })
      .subscribe({
        next: r => { this.items = r.items || []; this.loading = false; },
        error: () => { this.items = []; this.loading = false; }
      });
  }

  processNow() {
    this.processing = true;
    this.http.post<any>(`${environementDev.api}/api/admin/subscriptions/process-due`, { limit: 100 }, { headers: adminAuthHeaders() })
      .subscribe({
        next: r => { this.processing = false; this.show(`Traité : ${r.processed} succès, ${r.failed} échecs`, 'ok'); this.loadStats(); this.load(); },
        error: () => { this.processing = false; this.show('Erreur', 'err'); }
      });
  }

  formatDate(d: string) { return d ? new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : ''; }
  private show(m: string, k: 'ok'|'err') { this.toast = m; this.toastKind = k; setTimeout(() => this.toast = '', 3500); }
}
