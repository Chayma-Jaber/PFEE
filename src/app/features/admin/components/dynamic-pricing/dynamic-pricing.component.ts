import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';
import { AdminModuleContextComponent } from '../_shared/admin-module-context.component';
import { ADMIN_PAGE_STYLES, adminAuthHeaders } from '../_shared/admin-page.styles';

@Component({
  selector: 'app-admin-dynamic-pricing',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminModuleContextComponent],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <div>
          <h1><i class="fas fa-chart-line"></i> Tarification dynamique</h1>
          <p>Règles automatiques (âge inventaire, conversion faible, demande élevée, déstockage). Sweep quotidien à 02:00.</p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn ghost" (click)="sweep(true)" [disabled]="sweeping">
            <i class="fas fa-search"></i> Simuler (dry-run)
          </button>
          <button class="btn gradient" (click)="sweep(false)" [disabled]="sweeping">
            <i class="fas fa-bolt"></i> {{ sweeping ? 'Sweep…' : 'Lancer le sweep' }}
          </button>
        </div>
      </div>
      <app-admin-module-context moduleKey="dynamicPricing" />
      <div class="toast" [class.ok]="toastKind==='ok'" [class.err]="toastKind==='err'" *ngIf="toast">{{ toast }}</div>

      <div class="layout two-col">
        <div class="card">
          <h2><i class="fas fa-plus-circle"></i> Nouvelle règle</h2>
          <div class="form-grid one">
            <label>Nom <input [(ngModel)]="form.name" /></label>
            <label>Stratégie
              <select [(ngModel)]="form.strategy">
                <option value="INVENTORY_AGE">Âge inventaire</option>
                <option value="LOW_CONVERSION">Conversion faible</option>
                <option value="HIGH_DEMAND">Demande forte (markup)</option>
                <option value="CLEARANCE">Déstockage</option>
              </select>
            </label>
            <label>Portée
              <select [(ngModel)]="form.scope">
                <option value="ALL">Tout le catalogue</option>
                <option value="PRODUCT">Un produit (id)</option>
                <option value="CATEGORY">Une catégorie</option>
                <option value="FAMILLE">Une famille</option>
              </select>
            </label>
            <label *ngIf="form.scope !== 'ALL'">Valeur (id ou nom)
              <input [(ngModel)]="form.scope_value" />
            </label>
            <label>Prix min (% du prix original)
              <input type="number" [(ngModel)]="form.min_price_pct" min="10" max="100" />
            </label>
            <label>Prix max (% du prix original)
              <input type="number" [(ngModel)]="form.max_price_pct" min="50" max="200" />
            </label>
            <label>Seuil auto-application (%)
              <input type="number" [(ngModel)]="form.auto_apply_threshold_pct" min="0" max="50" />
            </label>
            <label>Paramètres (JSON)
              <textarea [(ngModel)]="paramsRaw" rows="4" placeholder='{"startDays":30,"pctPerDay":0.5,"maxDiscountPct":30}'></textarea>
            </label>
          </div>
          <div class="actions">
            <button class="btn primary" (click)="createRule()" [disabled]="saving">{{ saving ? 'Création…' : 'Créer la règle' }}</button>
          </div>
        </div>

        <div class="card">
          <h2><i class="fas fa-list"></i> Règles actives</h2>
          <div class="row-list">
            <div class="row-item" *ngFor="let r of rules" [class.muted]="!r.is_active">
              <div class="grow">
                <strong>{{ r.name }}</strong>
                <span class="badge indigo">{{ r.strategy }}</span>
                <span class="badge idle">{{ r.scope }}{{ r.scope_value ? ':' + r.scope_value : '' }}</span>
                <div class="small">Prix [{{ r.min_price_pct }}% – {{ r.max_price_pct }}%], auto si Δ ≤ {{ r.auto_apply_threshold_pct }}%</div>
                <pre class="mono" style="margin:4px 0 0;white-space:pre-wrap">{{ r.params | json }}</pre>
              </div>
              <button class="btn ghost" style="padding:5px 10px;font-size:11px" (click)="toggleRule(r)">{{ r.is_active ? 'Désactiver' : 'Activer' }}</button>
              <button class="btn danger" style="padding:5px 10px;font-size:11px" (click)="deleteRule(r)">Supp.</button>
            </div>
            <div class="empty" *ngIf="rules.length === 0">Aucune règle. Créez-en une à gauche.</div>
          </div>

          <h2 style="margin-top:18px"><i class="fas fa-history"></i> Changements récents</h2>
          <table *ngIf="changes.length > 0">
            <thead><tr><th>Date</th><th>Produit</th><th>Stratégie</th><th>Prix</th><th>Δ%</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let c of changes">
                <td class="small">{{ formatDate(c.created_at) }}</td>
                <td>#{{ c.product_id }}</td>
                <td class="small">{{ c.strategy }}</td>
                <td>{{ c.old_price }} → {{ c.new_price }}</td>
                <td>{{ c.delta_pct }}%</td>
                <td><span class="badge" [class.ok]="c.status==='APPLIED'" [class.warn]="c.status==='PROPOSED'" [class.err]="c.status==='REJECTED'">{{ c.status }}</span></td>
                <td>
                  <button *ngIf="c.status==='PROPOSED'" class="btn primary" style="padding:3px 8px;font-size:11px" (click)="approveChange(c)">Approuver</button>
                  <button *ngIf="c.status==='PROPOSED'" class="btn danger" style="padding:3px 8px;font-size:11px" (click)="rejectChange(c)">Rejeter</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="empty" *ngIf="changes.length === 0">Aucun changement enregistré.</div>
        </div>
      </div>
    </div>
  `,
  styles: [ADMIN_PAGE_STYLES]
})
export class AdminDynamicPricingComponent implements OnInit {
  rules: any[] = [];
  changes: any[] = [];
  saving = false;
  sweeping = false;
  toast = '';
  toastKind: 'ok'|'err' = 'ok';

  paramsRaw = '{"startDays":30,"pctPerDay":0.5,"maxDiscountPct":30}';
  form: any = { name: '', strategy: 'INVENTORY_AGE', scope: 'ALL', scope_value: '', min_price_pct: 60, max_price_pct: 110, auto_apply_threshold_pct: 10, priority: 100 };

  constructor(private http: HttpClient) {}
  ngOnInit() { this.loadRules(); this.loadChanges(); }

  loadRules() {
    this.http.get<any>(`${environementDev.api}/api/admin/dynamic-pricing/rules`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.rules = r.items || [], error: () => this.rules = [] });
  }

  loadChanges() {
    this.http.get<any>(`${environementDev.api}/api/admin/dynamic-pricing/changes?limit=50`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.changes = r.items || [], error: () => this.changes = [] });
  }

  createRule() {
    let params: any = {};
    try { params = JSON.parse(this.paramsRaw); } catch { this.show('JSON paramètres invalide', 'err'); return; }
    this.saving = true;
    const body = { ...this.form, params };
    if (body.scope === 'ALL') body.scope_value = null;
    this.http.post(`${environementDev.api}/api/admin/dynamic-pricing/rules`, body, { headers: adminAuthHeaders() })
      .subscribe({
        next: () => { this.saving = false; this.show('Règle créée', 'ok'); this.loadRules(); },
        error: () => { this.saving = false; this.show('Erreur', 'err'); }
      });
  }

  toggleRule(r: any) {
    this.http.put(`${environementDev.api}/api/admin/dynamic-pricing/rules/${r.id}`, { is_active: !r.is_active }, { headers: adminAuthHeaders() })
      .subscribe({ next: () => this.loadRules() });
  }

  deleteRule(r: any) {
    if (!confirm(`Supprimer la règle "${r.name}" ?`)) return;
    this.http.delete(`${environementDev.api}/api/admin/dynamic-pricing/rules/${r.id}`, { headers: adminAuthHeaders() })
      .subscribe({ next: () => this.loadRules() });
  }

  sweep(dryRun: boolean) {
    this.sweeping = true;
    this.http.post<any>(`${environementDev.api}/api/admin/dynamic-pricing/sweep`, { dryRun }, { headers: adminAuthHeaders() })
      .subscribe({
        next: r => {
          this.sweeping = false;
          this.show(`Sweep : ${r.scanned} produits scannés, ${r.applied} appliqués, ${r.proposed} proposés`, 'ok');
          this.loadChanges();
        },
        error: () => { this.sweeping = false; this.show('Erreur sweep', 'err'); }
      });
  }

  approveChange(c: any) {
    this.http.post(`${environementDev.api}/api/admin/dynamic-pricing/changes/${c.id}/approve`, {}, { headers: adminAuthHeaders() })
      .subscribe({ next: () => { this.show('Changement appliqué', 'ok'); this.loadChanges(); } });
  }

  rejectChange(c: any) {
    this.http.post(`${environementDev.api}/api/admin/dynamic-pricing/changes/${c.id}/reject`, {}, { headers: adminAuthHeaders() })
      .subscribe({ next: () => { this.show('Changement rejeté', 'ok'); this.loadChanges(); } });
  }

  formatDate(d: string) { return d ? new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : ''; }
  private show(m: string, k: 'ok'|'err') { this.toast = m; this.toastKind = k; setTimeout(() => this.toast = '', 3500); }
}
