import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';
import { ADMIN_PAGE_STYLES, adminAuthHeaders } from '../_shared/admin-page.styles';

@Component({
  selector: 'app-admin-propensity',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <div>
          <h1><i class="fas fa-brain"></i> Customer propensity</h1>
          <p>Score CLV, churn, propension d'achat, étape lifecycle. Recalcul quotidien à 04:00.</p>
        </div>
        <button class="btn gradient" (click)="scoreAll()" [disabled]="scoring">
          <i class="fas fa-bolt"></i> {{ scoring ? '…' : 'Recalculer maintenant' }}
        </button>
      </div>
      <div class="toast" [class.ok]="toastKind==='ok'" [class.err]="toastKind==='err'" *ngIf="toast">{{ toast }}</div>

      <div class="filters">
        <label>Métrique :
          <select [(ngModel)]="metric" (change)="loadTop()">
            <option value="clv">CLV (top valeur)</option>
            <option value="churnScore">Churn risk</option>
            <option value="vipUpgradeProbability">À promouvoir VIP</option>
            <option value="refundProbability">Risque remboursement</option>
          </select>
        </label>
        <label>Limite :
          <select [(ngModel)]="limit" (change)="loadTop()">
            <option [ngValue]="20">20</option><option [ngValue]="50">50</option><option [ngValue]="100">100</option>
          </select>
        </label>
        <button class="btn ghost" (click)="loadTop()" [disabled]="loading"><i class="fas fa-sync-alt"></i></button>
      </div>

      <div class="card">
        <table *ngIf="!loading && items.length > 0">
          <thead><tr><th>User</th><th>Email</th><th>CLV</th><th>Churn</th><th>Stage</th><th>Prochain achat</th><th>Catégorie prédite</th><th>VIP%</th><th>Refund%</th><th>Actions reco</th></tr></thead>
          <tbody>
            <tr *ngFor="let i of items">
              <td>#{{ i.userId }}</td>
              <td class="small">{{ i.name || i.email }}</td>
              <td><strong>{{ i.clv | number:'1.0-0' }}</strong></td>
              <td>
                <span class="badge" [class.err]="i.churnScore >= 70" [class.warn]="i.churnScore >= 40 && i.churnScore < 70" [class.ok]="i.churnScore < 40">{{ i.churnScore }}</span>
              </td>
              <td>
                <span class="badge" [class.indigo]="i.lifecycleStage==='LOYAL' || i.lifecycleStage==='GROWING'" [class.warn]="i.lifecycleStage==='AT_RISK'" [class.err]="i.lifecycleStage==='LAPSED'" [class.idle]="i.lifecycleStage==='NEW'">{{ i.lifecycleStage }}</span>
              </td>
              <td class="small">{{ i.nextPurchaseInDays != null ? i.nextPurchaseInDays + ' j' : '—' }}</td>
              <td class="small">{{ i.predictedNextCategory || '—' }}</td>
              <td>{{ (i.vipUpgradeProbability * 100) | number:'1.0-0' }}%</td>
              <td>{{ (i.refundProbability * 100) | number:'1.0-0' }}%</td>
              <td class="small">
                <span *ngFor="let a of i.recommendedActions" class="badge pink" style="margin-right:3px">{{ a }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="empty" *ngIf="!loading && items.length === 0">Cliquez sur Recalculer pour scorer les clients.</div>
        <div class="loading" *ngIf="loading">Calcul…</div>
      </div>
    </div>
  `,
  styles: [ADMIN_PAGE_STYLES]
})
export class AdminPropensityComponent implements OnInit {
  metric = 'clv';
  limit = 20;
  items: any[] = [];
  loading = false;
  scoring = false;
  toast = ''; toastKind: 'ok'|'err' = 'ok';

  constructor(private http: HttpClient) {}
  ngOnInit() { this.loadTop(); }

  loadTop() {
    this.loading = true;
    this.http.get<any>(`${environementDev.api}/api/admin/propensity/top?metric=${this.metric}&limit=${this.limit}`, { headers: adminAuthHeaders() })
      .subscribe({
        next: r => { this.items = r.items || []; this.loading = false; },
        error: () => { this.items = []; this.loading = false; }
      });
  }

  scoreAll() {
    this.scoring = true;
    this.http.post<any>(`${environementDev.api}/api/admin/propensity/score-all`, { limit: 1000 }, { headers: adminAuthHeaders() })
      .subscribe({
        next: r => { this.scoring = false; this.show(`${r.scored} clients scorés, ${r.churningEvents} en churn`, 'ok'); this.loadTop(); },
        error: () => { this.scoring = false; this.show('Erreur', 'err'); }
      });
  }

  private show(m: string, k: 'ok'|'err') { this.toast = m; this.toastKind = k; setTimeout(() => this.toast = '', 3500); }
}
