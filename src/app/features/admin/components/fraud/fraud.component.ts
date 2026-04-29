import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';
import { AdminModuleContextComponent } from '../_shared/admin-module-context.component';
import { ADMIN_PAGE_STYLES, adminAuthHeaders } from '../_shared/admin-page.styles';

@Component({
  selector: 'app-admin-fraud',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminModuleContextComponent],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <div>
          <h1><i class="fas fa-shield-alt"></i> Fraude &amp; suspicion</h1>
          <p>Commandes en attente de revue après scoring automatique. Le seuil de blocage est 70/100.</p>
        </div>
      </div>
      <app-admin-module-context moduleKey="fraud" />
      <div class="toast" [class.ok]="toastKind==='ok'" [class.err]="toastKind==='err'" *ngIf="toast">{{ toast }}</div>

      <div class="stats-grid" *ngIf="stats">
        <div class="stat-card"><div class="stat-icon indigo"><i class="fas fa-list"></i></div><div><span class="stat-value">{{ stats.total }}</span><span class="stat-label">Total</span></div></div>
        <div class="stat-card"><div class="stat-icon red"><i class="fas fa-lock"></i></div><div><span class="stat-value">{{ stats.held }}</span><span class="stat-label">Bloquées</span></div></div>
        <div class="stat-card"><div class="stat-icon amber"><i class="fas fa-eye"></i></div><div><span class="stat-value">{{ stats.review }}</span><span class="stat-label">À revoir</span></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="fas fa-check"></i></div><div><span class="stat-value">{{ stats.approved }}</span><span class="stat-label">Approuvées</span></div></div>
        <div class="stat-card"><div class="stat-icon red"><i class="fas fa-ban"></i></div><div><span class="stat-value">{{ stats.rejected }}</span><span class="stat-label">Rejetées</span></div></div>
      </div>

      <div class="filters">
        <select [(ngModel)]="filterStatus" (change)="load()">
          <option value="">À traiter (HELD + REVIEW)</option>
          <option value="HELD">Bloquées</option>
          <option value="REVIEW">À revoir</option>
          <option value="APPROVED">Approuvées</option>
          <option value="REJECTED">Rejetées</option>
        </select>
        <button class="btn ghost" (click)="load()" [disabled]="loading"><i class="fas fa-sync-alt" [class.spinning]="loading"></i></button>
      </div>

      <div class="card">
        <div class="row-list" *ngIf="!loading">
          <div *ngIf="items.length === 0" class="empty">Aucun signal à traiter.</div>
          <div class="row-item" *ngFor="let s of items">
            <div class="grow">
              <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">
                <span class="badge" [class.err]="s.status==='HELD'" [class.warn]="s.status==='REVIEW'" [class.ok]="s.status==='APPROVED'">{{ s.status }}</span>
                <strong>Commande #{{ s.order_id }}</strong>
                <span class="badge indigo">Score {{ s.score }}/100</span>
                <span class="small">{{ formatDate(s.created_at) }}</span>
              </div>
              <div class="small">Règles : {{ (s.rules_triggered || []).join(', ') || 'aucune' }}</div>
              <pre class="mono" style="margin:4px 0 0;white-space:pre-wrap">{{ s.details | json }}</pre>
              <div *ngIf="s.review_note" class="small" style="margin-top:4px;color:#374151">Note : {{ s.review_note }}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px" *ngIf="s.status==='HELD' || s.status==='REVIEW'">
              <input type="text" [(ngModel)]="notes[s.id]" placeholder="Note (optionnelle)" style="padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;width:200px" />
              <button class="btn primary" style="padding:6px 10px;font-size:12px" (click)="approve(s)">Approuver</button>
              <button class="btn danger" style="padding:6px 10px;font-size:12px" (click)="reject(s)">Rejeter</button>
            </div>
          </div>
        </div>
        <div class="loading" *ngIf="loading">Chargement…</div>
      </div>
    </div>
  `,
  styles: [ADMIN_PAGE_STYLES + ` .spinning { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`]
})
export class AdminFraudComponent implements OnInit {
  stats: any = null;
  items: any[] = [];
  loading = false;
  filterStatus = '';
  notes: Record<number, string> = {};
  toast = '';
  toastKind: 'ok' | 'err' = 'ok';

  constructor(private http: HttpClient) {}

  ngOnInit() { this.loadStats(); this.load(); }

  loadStats() {
    this.http.get<any>(`${environementDev.api}/api/admin/fraud/stats`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.stats = r, error: () => this.stats = null });
  }

  load() {
    this.loading = true;
    const qs = this.filterStatus ? `?status=${this.filterStatus}` : '';
    this.http.get<any>(`${environementDev.api}/api/admin/fraud/queue${qs}`, { headers: adminAuthHeaders() })
      .subscribe({
        next: r => { this.items = r.items || []; this.loading = false; },
        error: () => { this.items = []; this.loading = false; }
      });
  }

  approve(s: any) {
    this.http.post(`${environementDev.api}/api/admin/fraud/${s.id}/approve`, { note: this.notes[s.id] || '' }, { headers: adminAuthHeaders() })
      .subscribe({
        next: () => { this.show('Approuvée — commande débloquée', 'ok'); this.loadStats(); this.load(); },
        error: () => this.show('Erreur', 'err')
      });
  }

  reject(s: any) {
    this.http.post(`${environementDev.api}/api/admin/fraud/${s.id}/reject`, { note: this.notes[s.id] || '' }, { headers: adminAuthHeaders() })
      .subscribe({
        next: () => { this.show('Commande rejetée', 'ok'); this.loadStats(); this.load(); },
        error: () => this.show('Erreur', 'err')
      });
  }

  formatDate(d: string) { return d ? new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : ''; }
  private show(m: string, k: 'ok'|'err') { this.toast = m; this.toastKind = k; setTimeout(() => this.toast = '', 3500); }
}
