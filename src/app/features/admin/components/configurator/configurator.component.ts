import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';
import { AdminModuleContextComponent } from '../_shared/admin-module-context.component';
import { ADMIN_PAGE_STYLES, adminAuthHeaders } from '../_shared/admin-page.styles';

@Component({
  selector: 'app-admin-configurator',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminModuleContextComponent],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <div>
          <h1><i class="fas fa-puzzle-piece"></i> Configurateurs (gift box / outfit)</h1>
          <p>Définissez des coffrets cadeaux ou tenues construits par le client à partir d'une sélection.</p>
        </div>
      </div>
      <app-admin-module-context moduleKey="configurator" />
      <div class="toast" [class.ok]="toastKind==='ok'" [class.err]="toastKind==='err'" *ngIf="toast">{{ toast }}</div>

      <div class="layout two-col">
        <div class="card">
          <h2><i class="fas fa-plus-circle"></i> Nouveau configurateur</h2>
          <div class="form-grid one">
            <label>Slug (URL) <input [(ngModel)]="form.slug" placeholder="coffret-saint-valentin" /></label>
            <label>Titre <input [(ngModel)]="form.title" /></label>
            <label>Type
              <select [(ngModel)]="form.kind">
                <option value="GIFT_BOX">Coffret cadeau</option>
                <option value="OUTFIT">Tenue complète</option>
                <option value="STARTER_KIT">Kit découverte</option>
              </select>
            </label>
            <label>Remise bundle (%)
              <input type="number" [(ngModel)]="form.bundle_discount_pct" min="0" max="50" />
            </label>
            <label>Description <textarea [(ngModel)]="form.description" rows="2"></textarea></label>
            <label>Image cover (URL) <input [(ngModel)]="form.cover_image" /></label>
          </div>
          <div class="actions">
            <button class="btn primary" (click)="create()" [disabled]="saving">{{ saving ? '…' : 'Créer' }}</button>
          </div>

          <div *ngIf="selected" style="margin-top:20px;border-top:1px solid #f3f4f6;padding-top:16px">
            <h2><i class="fas fa-th-large"></i> Slots — {{ selected.title }}</h2>
            <div class="row-list">
              <div class="row-item" *ngFor="let s of slots">
                <div class="grow">
                  <strong>{{ s.position }}. {{ s.name }}</strong>
                  <span class="badge" [class.indigo]="s.required" [class.idle]="!s.required">{{ s.required ? 'requis' : 'optionnel' }}</span>
                  <span class="badge idle">max {{ s.max_items }}</span>
                  <div class="small" *ngIf="s.allowed_product_ids?.length">Pool : {{ s.allowed_product_ids.length }} produit(s)</div>
                  <div class="small" *ngIf="s.filter_famille">Famille : {{ s.filter_famille }}</div>
                </div>
                <button class="btn danger" style="padding:4px 8px;font-size:11px" (click)="removeSlot(s)">Supp.</button>
              </div>
              <div class="empty" *ngIf="slots.length === 0">Aucun slot.</div>
            </div>

            <div class="form-grid one" style="margin-top:12px">
              <label>Nom du slot <input [(ngModel)]="newSlot.name" /></label>
              <label>Position <input type="number" [(ngModel)]="newSlot.position" /></label>
              <label>Max items <input type="number" [(ngModel)]="newSlot.max_items" min="1" /></label>
              <label>Produits autorisés (IDs séparés par virgule)
                <input [(ngModel)]="poolRaw" placeholder="123,456,789" />
              </label>
              <label>OU famille
                <input [(ngModel)]="newSlot.filter_famille" placeholder="Vêtements" />
              </label>
            </div>
            <div class="actions">
              <button class="btn primary" (click)="addSlot()">Ajouter le slot</button>
            </div>
          </div>
        </div>

        <div class="card">
          <h2><i class="fas fa-list"></i> Configurateurs ({{ items.length }})</h2>
          <div class="row-list">
            <div class="row-item" *ngFor="let c of items" [class.muted]="!c.is_active">
              <div class="grow">
                <strong>{{ c.title }}</strong>
                <span class="badge indigo">{{ c.kind }}</span>
                <span class="badge" [class.ok]="c.is_active" [class.idle]="!c.is_active">{{ c.is_active ? 'Actif' : 'Désactivé' }}</span>
                <div class="small">/{{ c.slug }} · remise {{ c.bundle_discount_pct }}%</div>
              </div>
              <button class="btn ghost" style="padding:4px 8px;font-size:11px" (click)="select(c)">Slots</button>
            </div>
            <div class="empty" *ngIf="items.length === 0">Aucun.</div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [ADMIN_PAGE_STYLES]
})
export class AdminConfiguratorComponent implements OnInit {
  items: any[] = [];
  selected: any = null;
  slots: any[] = [];
  saving = false;
  toast = ''; toastKind: 'ok'|'err' = 'ok';
  form: any = { slug: '', title: '', kind: 'GIFT_BOX', bundle_discount_pct: 10, description: '', cover_image: '' };
  newSlot: any = { name: '', position: 1, max_items: 1, filter_famille: '' };
  poolRaw = '';

  constructor(private http: HttpClient) {}
  ngOnInit() { this.load(); }

  load() {
    this.http.get<any>(`${environementDev.api}/api/admin/configurator`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.items = r.items || [] });
  }

  create() {
    if (!this.form.slug || !this.form.title) { this.show('Slug + titre requis', 'err'); return; }
    this.saving = true;
    this.http.post(`${environementDev.api}/api/admin/configurator`, this.form, { headers: adminAuthHeaders() })
      .subscribe({
        next: () => { this.saving = false; this.show('Créé', 'ok'); this.load(); },
        error: () => { this.saving = false; this.show('Erreur', 'err'); }
      });
  }

  select(c: any) {
    this.selected = c;
    this.http.get<any>(`${environementDev.api}/api/admin/configurator/${c.id}/slots`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.slots = r.items || [] });
  }

  addSlot() {
    if (!this.selected || !this.newSlot.name) return;
    const body: any = { ...this.newSlot };
    if (this.poolRaw.trim()) body.allowed_product_ids = this.poolRaw.split(',').map(x => Number(x.trim())).filter(Boolean);
    this.http.post(`${environementDev.api}/api/admin/configurator/${this.selected.id}/slots`, body, { headers: adminAuthHeaders() })
      .subscribe({
        next: () => { this.newSlot = { name: '', position: this.slots.length + 1, max_items: 1, filter_famille: '' }; this.poolRaw = ''; this.select(this.selected); }
      });
  }

  removeSlot(s: any) {
    this.http.delete(`${environementDev.api}/api/admin/configurator/slots/${s.id}`, { headers: adminAuthHeaders() })
      .subscribe({ next: () => this.select(this.selected) });
  }

  private show(m: string, k: 'ok'|'err') { this.toast = m; this.toastKind = k; setTimeout(() => this.toast = '', 3500); }
}
