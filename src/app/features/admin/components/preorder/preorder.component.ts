import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';
import { ADMIN_PAGE_STYLES, adminAuthHeaders } from '../_shared/admin-page.styles';

@Component({
  selector: 'app-admin-preorder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <div>
          <h1><i class="fas fa-rocket"></i> Pré-commandes &amp; drops limités</h1>
          <p>Programmez des drops avec capacité limitée, acompte requis, et liste d'attente automatique.</p>
        </div>
      </div>
      <div class="toast" [class.ok]="toastKind==='ok'" [class.err]="toastKind==='err'" *ngIf="toast">{{ toast }}</div>

      <div class="stats-grid" *ngIf="stats">
        <div class="stat-card"><div class="stat-icon indigo"><i class="fas fa-calendar"></i></div><div><span class="stat-value">{{ stats.drops }}</span><span class="stat-label">Drops totaux</span></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="fas fa-bolt"></i></div><div><span class="stat-value">{{ stats.active }}</span><span class="stat-label">Pré-commande ouverte</span></div></div>
        <div class="stat-card"><div class="stat-icon teal"><i class="fas fa-bookmark"></i></div><div><span class="stat-value">{{ stats.reservations }}</span><span class="stat-label">Réservations</span></div></div>
        <div class="stat-card"><div class="stat-icon amber"><i class="fas fa-list-ol"></i></div><div><span class="stat-value">{{ stats.waitlisted }}</span><span class="stat-label">En liste d'attente</span></div></div>
      </div>

      <div class="layout two-col">
        <div class="card">
          <h2><i class="fas fa-plus-circle"></i> Créer un drop</h2>
          <div class="form-grid one">
            <label>Produit ID <input type="number" [(ngModel)]="form.productId" /></label>
            <label>Capacité <input type="number" [(ngModel)]="form.capacity" min="1" /></label>
            <label>Acompte (% du prix)
              <input type="number" [(ngModel)]="form.depositPct" min="0" max="100" />
            </label>
            <label>Début pré-commande <input type="datetime-local" [(ngModel)]="form.preorderStart" /></label>
            <label>Fin pré-commande <input type="datetime-local" [(ngModel)]="form.preorderEnd" /></label>
            <label>Date d'expédition prévue <input type="datetime-local" [(ngModel)]="form.expectedShipDate" /></label>
            <label>Titre commercial <input [(ngModel)]="form.headline" /></label>
            <label>Liste d'attente
              <select [(ngModel)]="form.allowWaitlist">
                <option [ngValue]="true">Activée (au-delà capacité)</option>
                <option [ngValue]="false">Désactivée (refus si plein)</option>
              </select>
            </label>
          </div>
          <div class="actions">
            <button class="btn primary" (click)="create()" [disabled]="saving">{{ saving ? 'Création…' : 'Créer le drop' }}</button>
          </div>
        </div>

        <div class="card">
          <h2><i class="fas fa-list"></i> Drops</h2>
          <div class="row-list">
            <div class="row-item" *ngFor="let d of drops">
              <div class="grow">
                <div style="display:flex;gap:8px;align-items:center">
                  <strong>Drop #{{ d.id }}</strong>
                  <span class="badge" [class.ok]="d.status==='LIVE' || d.status==='PREORDER_OPEN'" [class.warn]="d.status==='WAITLIST' || d.status==='SCHEDULED'" [class.err]="d.status==='SOLD_OUT' || d.status==='CLOSED'">{{ d.status }}</span>
                  <span class="badge indigo">{{ d.reserved_count }}/{{ d.capacity }}</span>
                </div>
                <div class="small">{{ d.headline || ('Produit #' + d.product_id) }}</div>
                <div class="small">{{ formatDate(d.preorder_start) }} → {{ formatDate(d.preorder_end) }} · acompte {{ d.deposit_pct }}%</div>
              </div>
              <div style="display:flex;flex-direction:column;gap:3px">
                <button *ngIf="d.status !== 'LIVE' && d.status !== 'CLOSED'" class="btn primary" style="padding:4px 8px;font-size:11px" (click)="goLive(d)">Mettre LIVE</button>
                <button *ngIf="d.status !== 'CLOSED'" class="btn danger" style="padding:4px 8px;font-size:11px" (click)="close(d)">Clôturer</button>
              </div>
            </div>
            <div class="empty" *ngIf="drops.length === 0">Aucun drop.</div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [ADMIN_PAGE_STYLES]
})
export class AdminPreorderComponent implements OnInit {
  stats: any = null;
  drops: any[] = [];
  saving = false;
  toast = ''; toastKind: 'ok'|'err' = 'ok';
  form: any = { productId: null, capacity: 50, depositPct: 20, preorderStart: '', preorderEnd: '', expectedShipDate: '', headline: '', allowWaitlist: true };

  constructor(private http: HttpClient) {}
  ngOnInit() { this.loadStats(); this.load(); }

  loadStats() {
    this.http.get<any>(`${environementDev.api}/api/admin/preorder/stats`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.stats = r });
  }

  load() {
    this.http.get<any>(`${environementDev.api}/api/admin/preorder/drops`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.drops = r.items || [] });
  }

  create() {
    if (!this.form.productId || !this.form.preorderStart || !this.form.preorderEnd) { this.show('Produit + dates obligatoires', 'err'); return; }
    this.saving = true;
    this.http.post(`${environementDev.api}/api/admin/preorder/drops`, this.form, { headers: adminAuthHeaders() })
      .subscribe({
        next: () => { this.saving = false; this.show('Drop créé', 'ok'); this.loadStats(); this.load(); },
        error: () => { this.saving = false; this.show('Erreur', 'err'); }
      });
  }

  goLive(d: any) {
    this.http.post(`${environementDev.api}/api/admin/preorder/drops/${d.id}/go-live`, {}, { headers: adminAuthHeaders() })
      .subscribe({ next: () => { this.show('Drop LIVE — clients notifiés', 'ok'); this.load(); } });
  }

  close(d: any) {
    if (!confirm(`Clôturer le drop #${d.id} ?`)) return;
    this.http.post(`${environementDev.api}/api/admin/preorder/drops/${d.id}/close`, {}, { headers: adminAuthHeaders() })
      .subscribe({ next: () => { this.show('Clôturé', 'ok'); this.load(); } });
  }

  formatDate(d: string) { return d ? new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : ''; }
  private show(m: string, k: 'ok'|'err') { this.toast = m; this.toastKind = k; setTimeout(() => this.toast = '', 3500); }
}
