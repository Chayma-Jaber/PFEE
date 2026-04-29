import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';
import { AdminModuleContextComponent } from '../_shared/admin-module-context.component';
import { ADMIN_PAGE_STYLES, adminAuthHeaders } from '../_shared/admin-page.styles';

@Component({
  selector: 'app-admin-erp',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminModuleContextComponent],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <div>
          <h1><i class="fas fa-file-invoice-dollar"></i> Export comptable / ERP</h1>
          <p>Lignes de facture pour SAP / Odoo / Sage. Résumé GL pour l'écriture comptable mensuelle.</p>
        </div>
      </div>
      <app-admin-module-context moduleKey="erp" />
      <div class="toast" [class.ok]="toastKind==='ok'" [class.err]="toastKind==='err'" *ngIf="toast">{{ toast }}</div>

      <div class="card">
        <h2><i class="fas fa-calendar-alt"></i> Période</h2>
        <div class="form-grid">
          <label>Début <input type="date" [(ngModel)]="start" /></label>
          <label>Fin <input type="date" [(ngModel)]="end" /></label>
        </div>
        <div class="actions">
          <button class="btn ghost" (click)="loadGL()">Résumé GL</button>
          <button class="btn ghost" (click)="loadLines()">Lignes (aperçu)</button>
          <button class="btn primary" (click)="downloadCsv()">Télécharger CSV</button>
          <button class="btn primary" (click)="downloadXml()">Télécharger XML</button>
        </div>
      </div>

      <div class="card" *ngIf="gl" style="margin-top:14px">
        <h2><i class="fas fa-balance-scale"></i> Résumé GL — {{ gl.periodStart?.slice(0,10) }} → {{ gl.periodEnd?.slice(0,10) }}</h2>
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-icon indigo"><i class="fas fa-receipt"></i></div><div><span class="stat-value">{{ gl.orderCount }}</span><span class="stat-label">Commandes</span></div></div>
          <div class="stat-card"><div class="stat-icon green"><i class="fas fa-users"></i></div><div><span class="stat-value">{{ gl.customerCount }}</span><span class="stat-label">Clients</span></div></div>
          <div class="stat-card"><div class="stat-icon teal"><i class="fas fa-coins"></i></div><div><span class="stat-value">{{ gl.grossInclTax | number:'1.0-0' }}</span><span class="stat-label">Brut TTC</span></div></div>
          <div class="stat-card"><div class="stat-icon pink"><i class="fas fa-percentage"></i></div><div><span class="stat-value">{{ gl.vatCollected | number:'1.0-0' }}</span><span class="stat-label">TVA collectée</span></div></div>
        </div>
        <h3 style="font-size:13px;margin:10px 0 8px">Écritures comptables proposées</h3>
        <table>
          <thead><tr><th>Compte</th><th style="text-align:right">Débit</th><th style="text-align:right">Crédit</th></tr></thead>
          <tbody>
            <tr *ngFor="let e of gl.proposedJournalEntries">
              <td>{{ e.account }}</td>
              <td style="text-align:right">{{ e.debit | number:'1.3-3' }}</td>
              <td style="text-align:right">{{ e.credit | number:'1.3-3' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card" *ngIf="lines.length > 0" style="margin-top:14px">
        <h2><i class="fas fa-list"></i> Lignes ({{ lines.length }})</h2>
        <div style="max-height:500px;overflow:auto">
          <table>
            <thead><tr><th>Facture</th><th>Date</th><th>Client</th><th>Produit</th><th>Qté</th><th>HT</th><th>TVA</th><th>TTC</th></tr></thead>
            <tbody>
              <tr *ngFor="let l of lines">
                <td class="mono">{{ l.invoiceNumber }}</td>
                <td class="small">{{ l.invoiceDate }}</td>
                <td class="small">{{ l.customerName }}</td>
                <td class="small">{{ l.productTitle }}</td>
                <td>{{ l.quantity }}</td>
                <td>{{ l.lineTotalExclTax | number:'1.3-3' }}</td>
                <td>{{ l.taxAmount | number:'1.3-3' }}</td>
                <td><strong>{{ l.lineTotalInclTax | number:'1.3-3' }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [ADMIN_PAGE_STYLES]
})
export class AdminErpComponent {
  start = new Date(Date.now() - 30*86400000).toISOString().slice(0,10);
  end = new Date().toISOString().slice(0,10);
  gl: any = null;
  lines: any[] = [];
  toast = ''; toastKind: 'ok'|'err' = 'ok';

  constructor(private http: HttpClient) {}

  loadGL() {
    this.http.get<any>(`${environementDev.api}/api/admin/erp/gl-summary?start=${this.start}&end=${this.end}`, { headers: adminAuthHeaders() })
      .subscribe({
        next: r => this.gl = r,
        error: () => this.show('Erreur', 'err')
      });
  }

  loadLines() {
    this.http.get<any>(`${environementDev.api}/api/admin/erp/invoices?start=${this.start}&end=${this.end}`, { headers: adminAuthHeaders() })
      .subscribe({
        next: r => { this.lines = r.items || []; this.show(`${this.lines.length} lignes`, 'ok'); },
        error: () => { this.lines = []; this.show('Erreur', 'err'); }
      });
  }

  downloadCsv() { window.open(`${environementDev.api}/api/admin/erp/invoices.csv?start=${this.start}&end=${this.end}`, '_blank'); }
  downloadXml() { window.open(`${environementDev.api}/api/admin/erp/invoices.xml?start=${this.start}&end=${this.end}`, '_blank'); }

  private show(m: string, k: 'ok'|'err') { this.toast = m; this.toastKind = k; setTimeout(() => this.toast = '', 3500); }
}
