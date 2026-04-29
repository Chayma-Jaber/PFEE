import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';
import { AdminModuleContextComponent } from '../_shared/admin-module-context.component';
import { ADMIN_PAGE_STYLES, adminAuthHeaders } from '../_shared/admin-page.styles';

@Component({
  selector: 'app-admin-cms',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminModuleContextComponent],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <div>
          <h1><i class="fas fa-newspaper"></i> Headless CMS — pages</h1>
          <p>Pages composites multilingues (fr/ar/en), versionnées, programmables, avec retour en arrière.</p>
        </div>
      </div>
      <app-admin-module-context moduleKey="cms" />
      <div class="toast" [class.ok]="toastKind==='ok'" [class.err]="toastKind==='err'" *ngIf="toast">{{ toast }}</div>

      <div class="layout two-col">
        <div class="card">
          <h2><i class="fas fa-edit"></i> {{ editing?.id ? 'Modifier — v' + editing.version : 'Nouvelle page' }}</h2>
          <div class="form-grid one">
            <label>Slug <input [(ngModel)]="form.slug" placeholder="about-us" /></label>
            <label>Titre <input [(ngModel)]="form.title" /></label>
            <label>Locale
              <select [(ngModel)]="form.locale">
                <option value="fr">Français</option><option value="ar">العربية</option><option value="en">English</option>
              </select>
            </label>
            <label>Description (SEO) <textarea [(ngModel)]="form.meta_description" rows="2" maxlength="400"></textarea></label>
            <label>Image cover (URL) <input [(ngModel)]="form.cover_image" /></label>
            <label class="wide">Blocs JSON
              <textarea [(ngModel)]="blocksRaw" rows="8" placeholder='[{"type":"hero","props":{"title":"Soldes d&apos;été","ctaUrl":"/shop"}},{"type":"text","props":{"html":"&lt;p&gt;Bienvenue&lt;/p&gt;"}}]'></textarea>
            </label>
            <label>Statut
              <select [(ngModel)]="form.status">
                <option value="DRAFT">Brouillon</option><option value="PUBLISHED">Publiée</option><option value="SCHEDULED">Programmée</option><option value="ARCHIVED">Archivée</option>
              </select>
            </label>
            <label>Note de modification <input [(ngModel)]="form.changeNote" /></label>
          </div>
          <div class="actions">
            <button class="btn primary" (click)="save()" [disabled]="saving">{{ saving ? '…' : (editing?.id ? 'Enregistrer (nouvelle version)' : 'Créer') }}</button>
            <button *ngIf="editing?.id" class="btn ghost" (click)="reset()">Nouvelle page</button>
            <button *ngIf="editing?.id && editing.status !== 'PUBLISHED'" class="btn gradient" (click)="publish()">Publier</button>
          </div>

          <!-- Inactive / missing product reference warning -->
          <div *ngIf="editing?.id && refs" class="ref-panel"
               [class.warn]="refs.inactiveCount > 0 || refs.missingCount > 0"
               [class.ok]="refs.totalReferences > 0 && refs.inactiveCount === 0 && refs.missingCount === 0">
            <div *ngIf="refs.totalReferences === 0" class="small muted">
              <i class="fas fa-info-circle"></i> Aucun bloc <span class="mono">product-list</span> dans cette page.
            </div>
            <div *ngIf="refs.totalReferences > 0 && refs.inactiveCount === 0 && refs.missingCount === 0">
              <i class="fas fa-check-circle"></i>
              {{ refs.totalReferences }} produit(s) référencé(s) — tous actifs ✓
            </div>
            <div *ngIf="refs.inactiveCount > 0 || refs.missingCount > 0">
              <strong><i class="fas fa-exclamation-triangle"></i>
                {{ refs.inactiveCount + refs.missingCount }} produit(s) problématique(s) sur {{ refs.totalReferences }}
              </strong>
              <ul class="ref-list">
                <li *ngFor="let p of refs.problematic">
                  Bloc #{{ p.blockIndex + 1 }} · ID {{ p.productId }}<span *ngIf="p.title"> — {{ p.title }}</span>
                  <span class="badge" [class.err]="p.status==='MISSING'" [class.warn]="p.status==='INACTIVE'">
                    {{ p.status === 'MISSING' ? 'Introuvable' : 'Désactivé' }}
                  </span>
                </li>
              </ul>
              <div class="small muted">
                Ces produits ne s'afficheront pas sur la page publiée. Retirez leurs IDs des blocs ou réactivez-les.
              </div>
              <div class="actions" style="margin-top:8px">
                <button class="btn primary" style="padding:6px 12px;font-size:12px"
                        (click)="cleanupRefs()" [disabled]="cleaningRefs">
                  <i class="fas fa-broom"></i>
                  {{ cleaningRefs ? 'Nettoyage…' : 'Nettoyer automatiquement (' + (refs.inactiveCount + refs.missingCount) + ')' }}
                </button>
                <span class="small muted">— une nouvelle version sera créée, restaurable depuis l'historique.</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <h2><i class="fas fa-list"></i> Pages</h2>
          <div class="filters">
            <select [(ngModel)]="filterLocale" (change)="load()">
              <option value="">Toutes locales</option><option value="fr">FR</option><option value="ar">AR</option><option value="en">EN</option>
            </select>
            <select [(ngModel)]="filterStatus" (change)="load()">
              <option value="">Tous statuts</option><option value="PUBLISHED">Publiées</option><option value="DRAFT">Brouillons</option>
            </select>
          </div>
          <div class="row-list">
            <div class="row-item" *ngFor="let p of pages">
              <div class="grow">
                <strong>{{ p.title }}</strong>
                <span class="badge indigo">{{ p.locale }}</span>
                <span class="badge" [class.ok]="p.status==='PUBLISHED'" [class.warn]="p.status==='SCHEDULED'" [class.idle]="p.status==='DRAFT'">{{ p.status }}</span>
                <span class="badge idle">v{{ p.version }}</span>
                <div class="small">/{{ p.slug }} · MàJ {{ formatDate(p.updated_at) }}</div>
              </div>
              <button class="btn ghost" style="padding:4px 8px;font-size:11px" (click)="edit(p)">Modifier</button>
              <button class="btn ghost" style="padding:4px 8px;font-size:11px" (click)="loadRevs(p)">Versions</button>
            </div>
            <div class="empty" *ngIf="pages.length === 0">Aucune page.</div>
          </div>
          <div *ngIf="revisions.length > 0" style="margin-top:14px">
            <h2><i class="fas fa-history"></i> Versions ({{ revisions[0]?.page_id }})</h2>
            <table>
              <tr><th>Version</th><th>Date</th><th>Note</th><th></th></tr>
              <tr *ngFor="let r of revisions">
                <td>v{{ r.version }}</td>
                <td class="small">{{ formatDate(r.created_at) }}</td>
                <td class="small">{{ r.change_note || '—' }}</td>
                <td><button class="btn ghost" style="padding:3px 8px;font-size:11px" (click)="revert(r)">Restaurer</button></td>
              </tr>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [ADMIN_PAGE_STYLES + `
    .ref-panel { margin-top: 14px; padding: 12px 14px; border-radius: 9px; font-size: 13px;
                 background: #f9fafb; border: 1px solid #e5e7eb; }
    .ref-panel.ok { background: #d1fae5; border-color: #86efac; color: #065f46; }
    .ref-panel.warn { background: #fef3c7; border-color: #fcd34d; color: #92400e; }
    .ref-panel strong i { margin-right: 6px; }
    .ref-panel .small { margin-top: 6px; }
    .ref-list { margin: 8px 0 4px; padding-left: 18px; max-height: 180px; overflow-y: auto; font-size: 12px; }
    .ref-list li { margin-bottom: 3px; }
    .ref-list .badge { margin-left: 6px; font-size: 9px; padding: 2px 6px; border-radius: 7px; }
  `]
})
export class AdminCmsComponent implements OnInit {
  pages: any[] = [];
  revisions: any[] = [];
  editing: any = null;
  saving = false;
  toast = ''; toastKind: 'ok'|'err' = 'ok';
  filterLocale = '';
  filterStatus = '';
  form: any = { slug: '', title: '', locale: 'fr', meta_description: '', cover_image: '', status: 'DRAFT', changeNote: '' };
  blocksRaw = '[]';

  // Inactive / missing product references reported by the backend after an edit() load.
  refs: { totalReferences: number; missingCount: number; inactiveCount: number;
          problematic: Array<{ blockIndex: number; productId: number; status: 'MISSING'|'INACTIVE'; title?: string }> } | null = null;
  cleaningRefs = false;

  constructor(private http: HttpClient) {}
  ngOnInit() { this.load(); }

  load() {
    const qs = new URLSearchParams();
    if (this.filterLocale) qs.set('locale', this.filterLocale);
    if (this.filterStatus) qs.set('status', this.filterStatus);
    this.http.get<any>(`${environementDev.api}/api/admin/cms?${qs}`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.pages = r.items || [] });
  }

  edit(p: any) {
    this.editing = p;
    this.form = { ...p, changeNote: '' };
    this.blocksRaw = JSON.stringify(p.blocks || [], null, 2);
    this.revisions = [];
    this.loadRefs(p.id);
  }

  reset() {
    this.editing = null;
    this.form = { slug: '', title: '', locale: 'fr', meta_description: '', cover_image: '', status: 'DRAFT', changeNote: '' };
    this.blocksRaw = '[]';
    this.revisions = [];
    this.refs = null;
  }

  // Refresh the inactive-references panel — called after edit() and after every save().
  // Errors are silently swallowed: the warning panel just won't appear, no admin block.
  private loadRefs(pageId: number) {
    this.http.get<any>(`${environementDev.api}/api/admin/cms/${pageId}/inactive-references`, { headers: adminAuthHeaders() })
      .subscribe({
        next: r => this.refs = r,
        error: () => this.refs = null,
      });
  }

  // One-click cleanup — strips problematic productIds from product-list blocks
  // and saves a new revision. Auto-reloads the editor so the admin sees the cleaned blocks.
  cleanupRefs() {
    if (!this.editing?.id || !this.refs || this.cleaningRefs) return;
    const total = this.refs.inactiveCount + this.refs.missingCount;
    if (total === 0) return;
    if (!confirm(`Supprimer ${total} référence(s) inactive(s) ou manquante(s) des blocs product-list ?\n\nUne nouvelle version sera créée — vous pourrez la restaurer depuis l'historique.`)) return;
    this.cleaningRefs = true;
    this.http.post<any>(`${environementDev.api}/api/admin/cms/${this.editing.id}/cleanup-inactive-references`, {}, { headers: adminAuthHeaders() })
      .subscribe({
        next: r => {
          this.cleaningRefs = false;
          this.show(r?.message || `${r?.removed || 0} référence(s) supprimée(s)`, 'ok');
          // Re-fetch the page so the blocks textarea + ref panel both reflect the cleanup.
          if (this.editing?.id) {
            this.http.get<any>(`${environementDev.api}/api/admin/cms/${this.editing.id}`, { headers: adminAuthHeaders() })
              .subscribe({
                next: page => {
                  this.editing = page;
                  this.form = { ...page, changeNote: '' };
                  this.blocksRaw = JSON.stringify(page.blocks || [], null, 2);
                  this.loadRefs(page.id);
                  this.load(); // refresh the page list versions in case version changed
                }
              });
          }
        },
        error: e => { this.cleaningRefs = false; this.show(e?.error?.message || 'Erreur nettoyage', 'err'); }
      });
  }

  save() {
    let blocks: any;
    try { blocks = JSON.parse(this.blocksRaw); } catch { this.show('JSON blocs invalide', 'err'); return; }
    this.saving = true;
    const body = { ...this.form, blocks };
    const req = this.editing?.id
      ? this.http.put(`${environementDev.api}/api/admin/cms/${this.editing.id}`, body, { headers: adminAuthHeaders() })
      : this.http.post(`${environementDev.api}/api/admin/cms`, body, { headers: adminAuthHeaders() });
    req.subscribe({
      next: () => { this.saving = false; this.show('Enregistré', 'ok'); this.reset(); this.load(); },
      error: () => { this.saving = false; this.show('Erreur', 'err'); }
    });
  }

  publish() {
    if (!this.editing?.id) return;
    this.http.post(`${environementDev.api}/api/admin/cms/${this.editing.id}/publish`, {}, { headers: adminAuthHeaders() })
      .subscribe({ next: () => { this.show('Publiée', 'ok'); this.load(); } });
  }

  loadRevs(p: any) {
    this.http.get<any>(`${environementDev.api}/api/admin/cms/${p.id}/revisions`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.revisions = r.items || [] });
  }

  revert(r: any) {
    if (!confirm(`Restaurer v${r.version} ?`)) return;
    this.http.post(`${environementDev.api}/api/admin/cms/${r.page_id}/revert/${r.version}`, {}, { headers: adminAuthHeaders() })
      .subscribe({ next: () => { this.show('Restaurée', 'ok'); this.load(); this.revisions = []; } });
  }

  formatDate(d: string) { return d ? new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : ''; }
  private show(m: string, k: 'ok'|'err') { this.toast = m; this.toastKind = k; setTimeout(() => this.toast = '', 3500); }
}
