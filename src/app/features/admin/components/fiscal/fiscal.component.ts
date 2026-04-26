import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';
import { ADMIN_PAGE_STYLES, adminAuthHeaders } from '../_shared/admin-page.styles';

@Component({
  selector: 'app-admin-fiscal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <div>
          <h1><i class="fas fa-stamp"></i> Conformité fiscale (Tunisia TTN)</h1>
          <p>Reçus fiscaux + tampon TTN. Mode {{ stats?.ttnEnabled ? 'production' : 'local-stamp (dev)' }}. Re-soumission auto toutes les 30 min.</p>
        </div>
        <button class="btn gradient" (click)="retry()" [disabled]="retrying">
          <i class="fas fa-redo"></i> {{ retrying ? '…' : 'Re-soumettre maintenant' }}
        </button>
      </div>
      <div class="toast" [class.ok]="toastKind==='ok'" [class.err]="toastKind==='err'" *ngIf="toast">{{ toast }}</div>

      <div class="stats-grid" *ngIf="stats">
        <div class="stat-card"><div class="stat-icon indigo"><i class="fas fa-list"></i></div><div><span class="stat-value">{{ stats.total }}</span><span class="stat-label">Total reçus</span></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="fas fa-check"></i></div><div><span class="stat-value">{{ stats.stamped }}</span><span class="stat-label">Tamponnés</span></div></div>
        <div class="stat-card"><div class="stat-icon amber"><i class="fas fa-hourglass"></i></div><div><span class="stat-value">{{ stats.pending }}</span><span class="stat-label">En attente</span></div></div>
        <div class="stat-card"><div class="stat-icon red"><i class="fas fa-times"></i></div><div><span class="stat-value">{{ stats.rejected }}</span><span class="stat-label">Rejetés</span></div></div>
      </div>

      <div class="card">
        <h2><i class="fas fa-percentage"></i> Déclaration TVA mensuelle</h2>
        <div class="form-grid">
          <label>Année <input type="number" [(ngModel)]="vatYear" /></label>
          <label>Mois <input type="number" [(ngModel)]="vatMonth" min="1" max="12" /></label>
        </div>
        <div class="actions">
          <button class="btn primary" (click)="loadVat()">Calculer</button>
        </div>
        <div *ngIf="vatReport" class="form-grid" style="margin-top:14px">
          <div><strong>Période :</strong> {{ vatReport.period }}</div>
          <div><strong>Reçus :</strong> {{ vatReport.receiptCount }}</div>
          <div><strong>Base HT :</strong> {{ vatReport.baseTax | number:'1.3-3' }} TND</div>
          <div><strong>TVA collectée :</strong> {{ vatReport.vatCollected | number:'1.3-3' }} TND ({{ vatReport.vatRate }}%)</div>
          <div><strong>Total TTC :</strong> {{ vatReport.grossInclTax | number:'1.3-3' }} TND</div>
        </div>
      </div>

      <div class="card" style="margin-top:14px">
        <h2><i class="fas fa-receipt"></i> Reçus récents</h2>
        <div class="filters">
          <select [(ngModel)]="filterStatus" (change)="load()">
            <option value="">Tous</option><option value="STAMPED">Tamponnés</option><option value="PENDING">En attente</option><option value="REJECTED">Rejetés</option>
          </select>
        </div>
        <table *ngIf="receipts.length > 0">
          <thead><tr><th>N° fiscal</th><th>Cmd.</th><th>Date</th><th>Client</th><th>HT</th><th>TVA</th><th>TTC</th><th>Statut</th><th>Tampon TTN</th></tr></thead>
          <tbody>
            <tr *ngFor="let r of receipts">
              <td class="mono"><strong>{{ r.fiscal_number }}</strong></td>
              <td class="small">{{ r.order_reference }}</td>
              <td class="small">{{ formatDate(r.fiscal_date) }}</td>
              <td class="small">{{ r.customer_name }}</td>
              <td>{{ r.total_excl_tax }}</td>
              <td>{{ r.total_tax }}</td>
              <td><strong>{{ r.total_incl_tax }}</strong></td>
              <td><span class="badge" [class.ok]="r.status==='STAMPED'" [class.warn]="r.status==='PENDING' || r.status==='SUBMITTED'" [class.err]="r.status==='REJECTED'">{{ r.status }}</span></td>
              <td class="mono">{{ r.ttn_stamp || '—' }}</td>
            </tr>
          </tbody>
        </table>
        <div class="empty" *ngIf="receipts.length === 0">Aucun reçu.</div>
      </div>
    </div>
  `,
  styles: [ADMIN_PAGE_STYLES]
})
export class AdminFiscalComponent implements OnInit {
  stats: any = null;
  receipts: any[] = [];
  filterStatus = '';
  retrying = false;
  toast = ''; toastKind: 'ok'|'err' = 'ok';
  vatYear = new Date().getFullYear();
  vatMonth = new Date().getMonth() + 1;
  vatReport: any = null;

  constructor(private http: HttpClient) {}
  ngOnInit() { this.loadStats(); this.load(); }

  loadStats() { this.http.get<any>(`${environementDev.api}/api/admin/fiscal/stats`, { headers: adminAuthHeaders() }).subscribe({ next: r => this.stats = r }); }

  load() {
    const qs = this.filterStatus ? `?status=${this.filterStatus}` : '';
    this.http.get<any>(`${environementDev.api}/api/admin/fiscal/receipts${qs}`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.receipts = r.items || [] });
  }

  retry() {
    this.retrying = true;
    this.http.post<any>(`${environementDev.api}/api/admin/fiscal/retry-pending`, { limit: 50 }, { headers: adminAuthHeaders() })
      .subscribe({
        next: r => { this.retrying = false; this.show(`${r.stamped} tamponnés, ${r.failed} échecs`, 'ok'); this.loadStats(); this.load(); },
        error: () => { this.retrying = false; this.show('Erreur', 'err'); }
      });
  }

  loadVat() {
    this.http.get<any>(`${environementDev.api}/api/admin/fiscal/vat-report?year=${this.vatYear}&month=${this.vatMonth}`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.vatReport = r });
  }

  formatDate(d: string) { return d ? new Date(d).toLocaleDateString('fr-FR') : ''; }
  private show(m: string, k: 'ok'|'err') { this.toast = m; this.toastKind = k; setTimeout(() => this.toast = '', 3500); }
}
