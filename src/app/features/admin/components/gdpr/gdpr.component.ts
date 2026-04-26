import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';
import { ADMIN_PAGE_STYLES, adminAuthHeaders } from '../_shared/admin-page.styles';

@Component({
  selector: 'app-admin-gdpr',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <div>
          <h1><i class="fas fa-user-shield"></i> Demandes GDPR</h1>
          <p>Demandes d'export, d'effacement et de rectification. Les commandes sont conservées 10 ans (obligation fiscale) avec PII anonymisées.</p>
        </div>
      </div>
      <div class="toast" [class.ok]="toastKind==='ok'" [class.err]="toastKind==='err'" *ngIf="toast">{{ toast }}</div>

      <div class="stats-grid" *ngIf="stats">
        <div class="stat-card"><div class="stat-icon indigo"><i class="fas fa-list"></i></div><div><span class="stat-value">{{ stats.total }}</span><span class="stat-label">Total</span></div></div>
        <div class="stat-card"><div class="stat-icon amber"><i class="fas fa-inbox"></i></div><div><span class="stat-value">{{ stats.received }}</span><span class="stat-label">Reçues</span></div></div>
        <div class="stat-card"><div class="stat-icon teal"><i class="fas fa-cog"></i></div><div><span class="stat-value">{{ stats.inProgress }}</span><span class="stat-label">En cours</span></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="fas fa-check"></i></div><div><span class="stat-value">{{ stats.completed }}</span><span class="stat-label">Terminées</span></div></div>
      </div>

      <div class="filters">
        <select [(ngModel)]="filterType" (change)="load()">
          <option value="">Tous types</option><option value="EXPORT">Export</option><option value="ERASURE">Effacement</option><option value="RECTIFICATION">Rectification</option>
        </select>
        <select [(ngModel)]="filterStatus" (change)="load()">
          <option value="">Tous statuts</option><option value="RECEIVED">Reçues</option><option value="IN_PROGRESS">En cours</option><option value="COMPLETED">Terminées</option><option value="REJECTED">Rejetées</option>
        </select>
      </div>

      <div class="card">
        <table *ngIf="items.length > 0">
          <thead><tr><th>ID</th><th>User</th><th>Type</th><th>Statut</th><th>Vérifié ?</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>
            <tr *ngFor="let r of items">
              <td>#{{ r.id }}</td>
              <td>{{ r.user_id }}</td>
              <td><span class="badge indigo">{{ r.type }}</span></td>
              <td><span class="badge" [class.ok]="r.status==='COMPLETED'" [class.warn]="r.status==='IN_PROGRESS'" [class.err]="r.status==='REJECTED'" [class.idle]="r.status==='RECEIVED'">{{ r.status }}</span></td>
              <td>{{ r.verified_at ? '✓' : '⏳' }}</td>
              <td class="small">{{ formatDate(r.created_at) }}</td>
              <td>
                <button *ngIf="r.type==='EXPORT' && r.status!=='COMPLETED'" class="btn primary" style="padding:3px 8px;font-size:11px" (click)="runExport(r)">Exécuter export</button>
                <button *ngIf="r.type==='ERASURE' && r.status!=='COMPLETED'" class="btn danger" style="padding:3px 8px;font-size:11px" (click)="runErasure(r)">Effacer</button>
                <button *ngIf="r.status!=='COMPLETED' && r.status!=='REJECTED'" class="btn ghost" style="padding:3px 8px;font-size:11px" (click)="reject(r)">Rejeter</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="empty" *ngIf="items.length === 0">Aucune demande.</div>
      </div>
    </div>
  `,
  styles: [ADMIN_PAGE_STYLES]
})
export class AdminGdprComponent implements OnInit {
  stats: any = null;
  items: any[] = [];
  filterType = '';
  filterStatus = '';
  toast = ''; toastKind: 'ok'|'err' = 'ok';

  constructor(private http: HttpClient) {}
  ngOnInit() { this.loadStats(); this.load(); }

  loadStats() { this.http.get<any>(`${environementDev.api}/api/admin/gdpr/stats`, { headers: adminAuthHeaders() }).subscribe({ next: r => this.stats = r }); }

  load() {
    const qs = new URLSearchParams();
    if (this.filterType) qs.set('type', this.filterType);
    if (this.filterStatus) qs.set('status', this.filterStatus);
    this.http.get<any>(`${environementDev.api}/api/admin/gdpr/requests?${qs}`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.items = r.items || [] });
  }

  runExport(r: any) {
    this.http.post(`${environementDev.api}/api/admin/gdpr/requests/${r.id}/run-export`, {}, { headers: adminAuthHeaders() })
      .subscribe({ next: () => { this.show('Export généré', 'ok'); this.loadStats(); this.load(); } });
  }

  runErasure(r: any) {
    if (!confirm('Effacement DÉFINITIF des PII pour cet utilisateur. Confirmer ?')) return;
    this.http.post(`${environementDev.api}/api/admin/gdpr/requests/${r.id}/run-erasure`, {}, { headers: adminAuthHeaders() })
      .subscribe({ next: () => { this.show('Effacement complet', 'ok'); this.loadStats(); this.load(); } });
  }

  reject(r: any) {
    const reason = prompt('Raison du rejet :') || 'rejet admin';
    this.http.post(`${environementDev.api}/api/admin/gdpr/requests/${r.id}/reject`, { reason }, { headers: adminAuthHeaders() })
      .subscribe({ next: () => { this.show('Rejetée', 'ok'); this.loadStats(); this.load(); } });
  }

  formatDate(d: string) { return d ? new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : ''; }
  private show(m: string, k: 'ok'|'err') { this.toast = m; this.toastKind = k; setTimeout(() => this.toast = '', 3500); }
}
