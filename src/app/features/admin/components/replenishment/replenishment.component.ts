import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';
import { ADMIN_PAGE_STYLES, adminAuthHeaders } from '../_shared/admin-page.styles';

@Component({
  selector: 'app-admin-replenishment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <div>
          <h1><i class="fas fa-truck-loading"></i> Réapprovisionnement &amp; auto-PO</h1>
          <p>Forecast 30 jours, génération automatique des bons de commande, suivi de réception.</p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn ghost" (click)="loadForecast()" [disabled]="forecasting">
            <i class="fas fa-chart-line"></i> Recalculer forecast
          </button>
          <button class="btn gradient" (click)="generatePOs()" [disabled]="generating">
            <i class="fas fa-magic"></i> {{ generating ? '…' : 'Générer PO drafts' }}
          </button>
        </div>
      </div>
      <div class="toast" [class.ok]="toastKind==='ok'" [class.err]="toastKind==='err'" *ngIf="toast">{{ toast }}</div>

      <div class="stats-grid" *ngIf="stats">
        <div class="stat-card"><div class="stat-icon indigo"><i class="fas fa-industry"></i></div><div><span class="stat-value">{{ stats.suppliers }}</span><span class="stat-label">Fournisseurs</span></div></div>
        <div class="stat-card"><div class="stat-icon amber"><i class="fas fa-edit"></i></div><div><span class="stat-value">{{ stats.draft }}</span><span class="stat-label">PO drafts</span></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="fas fa-check"></i></div><div><span class="stat-value">{{ stats.approved }}</span><span class="stat-label">Approuvés</span></div></div>
        <div class="stat-card"><div class="stat-icon teal"><i class="fas fa-paper-plane"></i></div><div><span class="stat-value">{{ stats.sent }}</span><span class="stat-label">Envoyés</span></div></div>
        <div class="stat-card"><div class="stat-icon pink"><i class="fas fa-box"></i></div><div><span class="stat-value">{{ stats.received }}</span><span class="stat-label">Reçus</span></div></div>
      </div>

      <div class="filters">
        <button class="btn ghost" [class.primary]="tab==='forecast'" (click)="tab='forecast'">Forecast</button>
        <button class="btn ghost" [class.primary]="tab==='pos'" (click)="tab='pos'; loadPOs()">PO ({{ pos.length }})</button>
        <button class="btn ghost" [class.primary]="tab==='suppliers'" (click)="tab='suppliers'; loadSuppliers()">Fournisseurs</button>
      </div>

      <div class="card" *ngIf="tab==='forecast'">
        <table *ngIf="forecast.length > 0">
          <thead><tr><th>Risque</th><th>Produit</th><th>Stock</th><th>Vendus 30j</th><th>Rythme/j</th><th>Jours restants</th><th>Réappro suggérée</th><th>Fournisseur</th></tr></thead>
          <tbody>
            <tr *ngFor="let f of forecast">
              <td><span class="badge" [class.err]="f.risk==='CRITICAL'" [class.warn]="f.risk==='HIGH'" [class.idle]="f.risk==='MEDIUM'">{{ f.risk }}</span></td>
              <td><strong>{{ f.title }}</strong> <span class="mono">{{ f.sku }}</span></td>
              <td>{{ f.currentStock }}</td>
              <td>{{ f.sold30d }}</td>
              <td>{{ f.dailyRate }}</td>
              <td>{{ f.daysLeft }} j</td>
              <td><strong>{{ f.reorderQty }}</strong></td>
              <td class="small">{{ f.supplierName || '— pas de fournisseur' }}</td>
            </tr>
          </tbody>
        </table>
        <div class="empty" *ngIf="forecast.length === 0 && !forecasting">Cliquez "Recalculer forecast" pour scanner.</div>
        <div class="loading" *ngIf="forecasting">Calcul…</div>
      </div>

      <div class="card" *ngIf="tab==='pos'">
        <table *ngIf="pos.length > 0">
          <thead><tr><th>Réf.</th><th>Fournisseur</th><th>Lignes</th><th>Total</th><th>Statut</th><th>Origine</th><th>Actions</th></tr></thead>
          <tbody>
            <tr *ngFor="let p of pos">
              <td class="mono">{{ p.reference }}</td>
              <td>#{{ p.supplier_id }}</td>
              <td>{{ p.items?.length }}</td>
              <td><strong>{{ p.total }} TND</strong></td>
              <td><span class="badge" [class.warn]="p.status==='DRAFT'" [class.indigo]="p.status==='APPROVED'" [class.ok]="p.status==='SENT' || p.status==='RECEIVED'" [class.err]="p.status==='CANCELLED'">{{ p.status }}</span></td>
              <td class="small">{{ p.origin }}</td>
              <td>
                <button *ngIf="p.status==='DRAFT'" class="btn primary" style="padding:3px 7px;font-size:11px" (click)="action(p,'approve')">Approuver</button>
                <button *ngIf="p.status==='APPROVED'" class="btn primary" style="padding:3px 7px;font-size:11px" (click)="action(p,'send')">Envoyer</button>
                <button *ngIf="p.status==='SENT' || p.status==='APPROVED'" class="btn primary" style="padding:3px 7px;font-size:11px" (click)="action(p,'receive')">Recevoir</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="empty" *ngIf="pos.length === 0">Aucun PO.</div>
      </div>

      <div class="card" *ngIf="tab==='suppliers'">
        <div class="form-grid">
          <label>Code <input [(ngModel)]="supForm.code" /></label>
          <label>Nom <input [(ngModel)]="supForm.name" /></label>
          <label>Email <input [(ngModel)]="supForm.contact_email" /></label>
          <label>Lead time (jours) <input type="number" [(ngModel)]="supForm.lead_time_days" /></label>
        </div>
        <div class="actions">
          <button class="btn primary" (click)="addSupplier()">Ajouter fournisseur</button>
        </div>
        <table *ngIf="suppliers.length > 0" style="margin-top:14px">
          <thead><tr><th>Code</th><th>Nom</th><th>Email</th><th>Lead time</th><th>Actif</th></tr></thead>
          <tbody>
            <tr *ngFor="let s of suppliers">
              <td><strong>{{ s.code }}</strong></td>
              <td>{{ s.name }}</td>
              <td class="small">{{ s.contact_email || '—' }}</td>
              <td>{{ s.lead_time_days }} j</td>
              <td><i class="fas" [class.fa-check]="s.is_active" [class.fa-times]="!s.is_active"></i></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [ADMIN_PAGE_STYLES]
})
export class AdminReplenishmentComponent implements OnInit {
  stats: any = null;
  tab: 'forecast'|'pos'|'suppliers' = 'forecast';
  forecast: any[] = [];
  pos: any[] = [];
  suppliers: any[] = [];
  forecasting = false;
  generating = false;
  toast = ''; toastKind: 'ok'|'err' = 'ok';
  supForm: any = { code: '', name: '', contact_email: '', lead_time_days: 14 };

  constructor(private http: HttpClient) {}
  ngOnInit() { this.loadStats(); }

  loadStats() { this.http.get<any>(`${environementDev.api}/api/admin/replenishment/stats`, { headers: adminAuthHeaders() }).subscribe({ next: r => this.stats = r }); }

  loadForecast() {
    this.forecasting = true;
    this.http.get<any>(`${environementDev.api}/api/admin/replenishment/forecast?leadDays=14`, { headers: adminAuthHeaders() })
      .subscribe({
        next: r => { this.forecast = r.items || []; this.forecasting = false; },
        error: () => { this.forecast = []; this.forecasting = false; }
      });
  }

  loadPOs() {
    this.http.get<any>(`${environementDev.api}/api/admin/replenishment/pos`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.pos = r.items || [] });
  }

  loadSuppliers() {
    this.http.get<any>(`${environementDev.api}/api/admin/replenishment/suppliers`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.suppliers = r.items || [] });
  }

  addSupplier() {
    if (!this.supForm.code || !this.supForm.name) return;
    this.http.post(`${environementDev.api}/api/admin/replenishment/suppliers`, this.supForm, { headers: adminAuthHeaders() })
      .subscribe({ next: () => { this.show('Ajouté', 'ok'); this.supForm = { code: '', name: '', contact_email: '', lead_time_days: 14 }; this.loadSuppliers(); this.loadStats(); } });
  }

  generatePOs() {
    this.generating = true;
    this.http.post<any>(`${environementDev.api}/api/admin/replenishment/generate-pos`, { leadDays: 14 }, { headers: adminAuthHeaders() })
      .subscribe({
        next: r => { this.generating = false; this.show(`${r.created} PO drafts générés`, 'ok'); this.loadStats(); this.tab = 'pos'; this.loadPOs(); },
        error: () => { this.generating = false; this.show('Erreur génération', 'err'); }
      });
  }

  action(p: any, what: 'approve'|'send'|'receive') {
    this.http.post(`${environementDev.api}/api/admin/replenishment/pos/${p.id}/${what}`, {}, { headers: adminAuthHeaders() })
      .subscribe({ next: () => { this.show(`PO ${what}`, 'ok'); this.loadStats(); this.loadPOs(); } });
  }

  private show(m: string, k: 'ok'|'err') { this.toast = m; this.toastKind = k; setTimeout(() => this.toast = '', 3500); }
}
