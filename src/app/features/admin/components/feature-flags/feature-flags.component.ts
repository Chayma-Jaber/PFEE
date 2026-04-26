import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';
import { ADMIN_PAGE_STYLES, adminAuthHeaders } from '../_shared/admin-page.styles';

@Component({
  selector: 'app-admin-feature-flags',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <div>
          <h1><i class="fas fa-flag"></i> Feature flags &amp; A/B</h1>
          <p>Activez progressivement des fonctionnalités, lancez des tests A/B avec des variantes pondérées.</p>
        </div>
      </div>
      <div class="toast" [class.ok]="toastKind==='ok'" [class.err]="toastKind==='err'" *ngIf="toast">{{ toast }}</div>

      <div class="layout two-col">
        <div class="card">
          <h2><i class="fas fa-plus-circle"></i> Créer / mettre à jour</h2>
          <div class="form-grid one">
            <label>Clé technique <input [(ngModel)]="form.key" placeholder="new_checkout_v2" /></label>
            <label>Nom affiché <input [(ngModel)]="form.name" /></label>
            <label>Description <textarea [(ngModel)]="form.description" rows="2"></textarea></label>
            <label>Activé globalement
              <select [(ngModel)]="form.is_enabled">
                <option [ngValue]="true">Oui</option>
                <option [ngValue]="false">Non</option>
              </select>
            </label>
            <label>% de rollout (0–100)
              <input type="number" [(ngModel)]="form.rollout_pct" min="0" max="100" />
            </label>
            <label>Segments autorisés (CSV, vide = tous)
              <input [(ngModel)]="segmentsRaw" placeholder="VIP,BETA" />
            </label>
            <label>Variantes JSON (vide = flag booléen)
              <textarea [(ngModel)]="variantsRaw" rows="3" placeholder='[{"name":"A","weight":50},{"name":"B","weight":50}]'></textarea>
            </label>
          </div>
          <div class="actions">
            <button class="btn primary" (click)="upsert()" [disabled]="saving">{{ saving ? 'Enregistrement…' : 'Enregistrer' }}</button>
          </div>
        </div>

        <div class="card">
          <h2><i class="fas fa-list"></i> Flags ({{ flags.length }})</h2>
          <div class="row-list">
            <div class="row-item" *ngFor="let f of flags" [class.muted]="!f.is_enabled">
              <div class="grow">
                <div style="display:flex;gap:8px;align-items:center">
                  <strong>{{ f.name }}</strong>
                  <span class="badge" [class.ok]="f.is_enabled" [class.idle]="!f.is_enabled">{{ f.is_enabled ? 'ON' : 'OFF' }}</span>
                  <span class="badge indigo">{{ f.rollout_pct }}%</span>
                  <span class="mono">{{ f.key }}</span>
                </div>
                <div class="small" *ngIf="f.description">{{ f.description }}</div>
                <div class="small" *ngIf="f.segments?.length">Segments : {{ f.segments.join(', ') }}</div>
                <div class="small" *ngIf="f.variants?.length">A/B : {{ formatVariants(f.variants) }}</div>
              </div>
              <div style="display:flex;flex-direction:column;gap:4px">
                <button class="btn ghost" style="padding:5px 10px;font-size:11px" (click)="toggle(f)">{{ f.is_enabled ? 'Désactiver' : 'Activer' }}</button>
                <button class="btn ghost" style="padding:5px 10px;font-size:11px" (click)="loadResults(f)">Stats A/B</button>
                <button class="btn danger" style="padding:5px 10px;font-size:11px" (click)="remove(f)">Supp.</button>
              </div>
            </div>
            <div class="empty" *ngIf="flags.length === 0">Aucun flag.</div>
          </div>

          <div *ngIf="results && results.key">
            <h2 style="margin-top:18px"><i class="fas fa-vial"></i> Résultats — {{ results.key }}</h2>
            <table>
              <thead><tr><th>Variante</th><th>Expositions</th><th>Conversions</th><th>Taux</th></tr></thead>
              <tbody>
                <tr *ngFor="let r of results.items">
                  <td><strong>{{ r.variant }}</strong></td>
                  <td>{{ r.exposures }}</td>
                  <td>{{ r.conversions }}</td>
                  <td><span class="badge" [class.ok]="r.rate > 0">{{ r.rate }}%</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [ADMIN_PAGE_STYLES]
})
export class AdminFeatureFlagsComponent implements OnInit {
  flags: any[] = [];
  results: any = null;
  saving = false;
  toast = ''; toastKind: 'ok'|'err' = 'ok';
  form: any = { key: '', name: '', description: '', is_enabled: false, rollout_pct: 100 };
  segmentsRaw = '';
  variantsRaw = '';

  constructor(private http: HttpClient) {}
  ngOnInit() { this.load(); }

  load() {
    this.http.get<any>(`${environementDev.api}/api/admin/feature-flags`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.flags = r.items || [], error: () => this.flags = [] });
  }

  upsert() {
    this.saving = true;
    const segments = this.segmentsRaw.split(',').map(s => s.trim()).filter(Boolean);
    let variants: any = null;
    if (this.variantsRaw.trim()) {
      try { variants = JSON.parse(this.variantsRaw); }
      catch { this.saving = false; this.show('JSON variantes invalide', 'err'); return; }
    }
    const body = { ...this.form, segments: segments.length ? segments : null, variants };
    this.http.post(`${environementDev.api}/api/admin/feature-flags`, body, { headers: adminAuthHeaders() })
      .subscribe({
        next: () => { this.saving = false; this.show('Flag enregistré', 'ok'); this.load(); },
        error: () => { this.saving = false; this.show('Erreur', 'err'); }
      });
  }

  toggle(f: any) {
    this.http.put(`${environementDev.api}/api/admin/feature-flags/${f.id}/toggle`, {}, { headers: adminAuthHeaders() })
      .subscribe({ next: () => this.load() });
  }

  remove(f: any) {
    if (!confirm(`Supprimer "${f.key}" ?`)) return;
    this.http.delete(`${environementDev.api}/api/admin/feature-flags/${f.id}`, { headers: adminAuthHeaders() })
      .subscribe({ next: () => this.load() });
  }

  loadResults(f: any) {
    this.http.get<any>(`${environementDev.api}/api/admin/feature-flags/${f.key}/results`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.results = { key: f.key, items: r.items || [] } });
  }

  formatVariants(v: any[]) { return v.map(x => `${x.name}:${x.weight}%`).join(' / '); }
  private show(m: string, k: 'ok'|'err') { this.toast = m; this.toastKind = k; setTimeout(() => this.toast = '', 3500); }
}
