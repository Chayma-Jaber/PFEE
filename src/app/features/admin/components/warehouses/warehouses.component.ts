import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';
import { AdminModuleContextComponent } from '../_shared/admin-module-context.component';

interface Warehouse {
  id: number;
  code: string;
  name: string;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  priority: number;
  ships_orders: boolean;
  is_active: boolean;
  is_default: boolean;
}

interface Stats {
  activeWarehouses: number;
  stockLines: number;
  totalUnits: number;
  reservedUnits: number;
  lowStockLines: number;
}

interface LowStockRow {
  productId: number;
  warehouseId: number;
  sku: string;
  title: string;
  warehouseCode: string;
  warehouseName: string;
  quantity: number;
  reserved: number;
  safetyStock: number;
  available: number;
}

interface ProductStockSummary {
  productId: number;
  total: number;
  available: number;
  reserved: number;
  perWarehouse: Array<{
    warehouseId: number;
    warehouseCode: string;
    warehouseName: string;
    quantity: number;
    reserved: number;
    available: number;
    safetyStock: number;
    lowStock: boolean;
  }>;
}

@Component({
  selector: 'app-admin-warehouses',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminModuleContextComponent],
  template: `
    <div class="warehouses-page">
      <div class="page-header">
        <div>
          <h1><i class="fas fa-warehouse"></i> Entrepôts &amp; stock multi-site</h1>
          <p>Gérez plusieurs emplacements, les quantités par site et les seuils de rupture.</p>
        </div>
      </div>

      <app-admin-module-context moduleKey="warehouses" />

      <div class="alert alert-success" *ngIf="toast && toastKind==='ok'"><i class="fas fa-check"></i> {{ toast }}</div>
      <div class="alert alert-error" *ngIf="toast && toastKind==='err'"><i class="fas fa-exclamation"></i> {{ toast }}</div>

      <div class="stats-grid" *ngIf="stats">
        <div class="stat-card">
          <div class="stat-icon wh"><i class="fas fa-warehouse"></i></div>
          <div class="stat-info"><span class="stat-value">{{ stats.activeWarehouses }}</span><span class="stat-label">Entrepôts actifs</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon lines"><i class="fas fa-boxes"></i></div>
          <div class="stat-info"><span class="stat-value">{{ stats.stockLines }}</span><span class="stat-label">Lignes de stock</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon units"><i class="fas fa-cubes"></i></div>
          <div class="stat-info"><span class="stat-value">{{ stats.totalUnits }}</span><span class="stat-label">Unités en stock</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon reserved"><i class="fas fa-lock"></i></div>
          <div class="stat-info"><span class="stat-value">{{ stats.reservedUnits }}</span><span class="stat-label">Réservées</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon low"><i class="fas fa-exclamation-triangle"></i></div>
          <div class="stat-info"><span class="stat-value">{{ stats.lowStockLines }}</span><span class="stat-label">En alerte rupture</span></div>
        </div>
      </div>

      <div class="layout">
        <!-- LEFT: warehouse list + form -->
        <div class="card">
          <h2><i class="fas fa-list"></i> Entrepôts</h2>
          <table class="wh-table" *ngIf="warehouses.length > 0">
            <thead><tr><th>Code</th><th>Nom</th><th>Ville</th><th>Priorité</th><th>Actif</th><th>Déf.</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let w of warehouses" [class.row-inactive]="!w.is_active">
                <td><strong>{{ w.code }}</strong></td>
                <td>{{ w.name }}</td>
                <td>{{ w.city || '-' }}</td>
                <td>{{ w.priority }}</td>
                <td><i class="fas" [class.fa-check]="w.is_active" [class.fa-times]="!w.is_active"></i></td>
                <td>
                  <span *ngIf="w.is_default" class="badge-def">DÉFAUT</span>
                  <button *ngIf="!w.is_default" class="btn-ghost" (click)="setDefault(w)">définir</button>
                </td>
                <td><button class="btn-ghost" (click)="edit(w)"><i class="fas fa-edit"></i></button></td>
              </tr>
            </tbody>
          </table>

          <h3 class="subhead">{{ editing?.id ? 'Modifier' : 'Créer un entrepôt' }}</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>Code *</label>
              <input type="text" [(ngModel)]="form.code" placeholder="TUN" maxlength="16" />
            </div>
            <div class="form-group">
              <label>Nom *</label>
              <input type="text" [(ngModel)]="form.name" placeholder="Entrepôt Tunis Nord" />
            </div>
            <div class="form-group">
              <label>Ville</label>
              <input type="text" [(ngModel)]="form.city" />
            </div>
            <div class="form-group">
              <label>Téléphone</label>
              <input type="tel" [(ngModel)]="form.phone" />
            </div>
            <div class="form-group form-wide">
              <label>Adresse</label>
              <input type="text" [(ngModel)]="form.address" />
            </div>
            <div class="form-group">
              <label>Priorité</label>
              <input type="number" [(ngModel)]="form.priority" min="1" />
            </div>
            <div class="form-group form-check">
              <label><input type="checkbox" [(ngModel)]="form.ships_orders" /> Expédie les commandes</label>
              <label><input type="checkbox" [(ngModel)]="form.is_active" /> Actif</label>
            </div>
          </div>
          <div class="actions">
            <button class="btn-primary" (click)="save()" [disabled]="saving || !form.code || !form.name">
              <i class="fas fa-save"></i> {{ editing?.id ? 'Mettre à jour' : 'Créer' }}
            </button>
            <button *ngIf="editing?.id" class="btn-ghost" (click)="cancelEdit()">Annuler</button>
          </div>
        </div>

        <!-- RIGHT: low-stock + product lookup -->
        <div class="card">
          <h2><i class="fas fa-exclamation-triangle"></i> Alertes rupture</h2>
          <div *ngIf="loadingLow" class="loading">Chargement...</div>
          <div *ngIf="!loadingLow && lowStock.length === 0" class="empty">Aucun produit en alerte.</div>
          <div class="low-list" *ngIf="lowStock.length > 0">
            <div class="low-row" *ngFor="let r of lowStock">
              <div class="low-info">
                <strong>{{ r.title }}</strong>
                <small class="mono">{{ r.sku }}</small>
              </div>
              <div class="low-meta">
                <span class="wh-chip">{{ r.warehouseCode }}</span>
                <span class="qty-chip" [class.qty-zero]="r.quantity === 0">{{ r.quantity }} / seuil {{ r.safetyStock }}</span>
              </div>
              <button class="btn-ghost" (click)="openProduct(r.productId)"><i class="fas fa-search"></i></button>
            </div>
          </div>

          <h3 class="subhead">Consulter / ajuster un produit</h3>
          <div class="lookup-bar">
            <input type="number" [(ngModel)]="lookupProductId" placeholder="ID produit..." />
            <button class="btn-primary sm" (click)="loadProduct(lookupProductId!)" [disabled]="!lookupProductId">
              <i class="fas fa-search"></i> Charger
            </button>
          </div>
          <div class="product-stock" *ngIf="currentProduct">
            <h4>Produit #{{ currentProduct.productId }} — total {{ currentProduct.total }} (dispo {{ currentProduct.available }}, réservé {{ currentProduct.reserved }})</h4>
            <table class="ps-table">
              <thead><tr><th>Entrepôt</th><th>Qté</th><th>Réservé</th><th>Seuil</th><th>Ajuster</th></tr></thead>
              <tbody>
                <tr *ngFor="let p of currentProduct.perWarehouse" [class.low]="p.lowStock">
                  <td><strong>{{ p.warehouseCode }}</strong> <small>{{ p.warehouseName }}</small></td>
                  <td>{{ p.quantity }}</td>
                  <td>{{ p.reserved }}</td>
                  <td>{{ p.safetyStock }}</td>
                  <td class="adj-cell">
                    <input type="number" [(ngModel)]="adjustDelta[p.warehouseId]" placeholder="±" />
                    <button class="btn-ghost sm" (click)="adjustStock(p.warehouseId)"><i class="fas fa-plus-minus"></i></button>
                  </td>
                </tr>
                <tr *ngFor="let w of warehousesNotInProduct()">
                  <td><strong>{{ w.code }}</strong> <small>{{ w.name }}</small></td>
                  <td colspan="3"><em class="muted">Non stocké ici</em></td>
                  <td class="adj-cell">
                    <input type="number" [(ngModel)]="adjustDelta[w.id]" placeholder="Ajouter qté" min="0" />
                    <button class="btn-ghost sm" (click)="setStock(w.id)"><i class="fas fa-plus"></i></button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .warehouses-page { padding: 24px; max-width: 1400px; }
    .page-header h1 { font-size: 24px; font-weight: 600; margin: 0 0 4px; color: #111827; }
    .page-header h1 i { color: #6366f1; margin-right: 8px; }
    .page-header p { color: #6b7280; margin: 0 0 20px; font-size: 14px; }
    .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; display: flex; gap: 8px; font-size: 14px; }
    .alert-success { background: #d1fae5; color: #065f46; }
    .alert-error { background: #fee2e2; color: #991b1b; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 22px; }
    .stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; display: flex; gap: 12px; align-items: center; }
    .stat-icon { width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .stat-icon.wh { background: #eef2ff; color: #6366f1; }
    .stat-icon.lines { background: #d1fae5; color: #10b981; }
    .stat-icon.units { background: #fef3c7; color: #f59e0b; }
    .stat-icon.reserved { background: #e0e7ff; color: #4f46e5; }
    .stat-icon.low { background: #fee2e2; color: #ef4444; }
    .stat-value { display: block; font-size: 22px; font-weight: 700; color: #111827; }
    .stat-label { font-size: 12px; color: #6b7280; }
    .layout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
    .card h2 { font-size: 16px; font-weight: 600; margin: 0 0 14px; color: #111827; display: flex; align-items: center; gap: 8px; }
    .card h2 i { color: #6366f1; }
    .subhead { font-size: 14px; font-weight: 600; color: #374151; margin: 18px 0 10px; padding-top: 14px; border-top: 1px solid #f3f4f6; }
    .wh-table, .ps-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .wh-table th, .ps-table th { text-align: left; background: #f9fafb; padding: 8px; font-weight: 600; color: #374151; font-size: 12px; text-transform: uppercase; }
    .wh-table td, .ps-table td { padding: 10px 8px; border-bottom: 1px solid #f3f4f6; color: #111827; }
    .wh-table .row-inactive td { opacity: .55; }
    .ps-table tr.low td { background: #fef3c7; }
    .badge-def { background: #ccfbf1; color: #0d9488; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 8px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .form-group { display: flex; flex-direction: column; gap: 4px; }
    .form-group.form-wide { grid-column: 1 / -1; }
    .form-group.form-check { grid-column: 1 / -1; display: flex; flex-direction: row; gap: 20px; font-size: 13px; }
    .form-group label { font-size: 12px; font-weight: 500; color: #6b7280; }
    .form-group input { padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }
    .actions { display: flex; gap: 8px; margin-top: 12px; }
    .btn-primary { padding: 10px 16px; background: #111; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 13px; display: inline-flex; gap: 6px; align-items: center; }
    .btn-primary.sm { padding: 7px 12px; font-size: 12px; }
    .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
    .btn-ghost { background: transparent; border: 1px solid #e5e7eb; padding: 5px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; color: #6366f1; }
    .btn-ghost.sm { padding: 4px 8px; }
    .loading, .empty { text-align: center; padding: 30px 10px; color: #6b7280; font-size: 13px; }
    .low-list { display: flex; flex-direction: column; gap: 8px; max-height: 360px; overflow-y: auto; margin-bottom: 14px; }
    .low-row { display: grid; grid-template-columns: 1fr auto 40px; gap: 10px; align-items: center; padding: 10px; border: 1px solid #fef3c7; background: #fffbeb; border-radius: 8px; }
    .low-info strong { display: block; font-size: 13px; color: #111827; }
    .low-info .mono { font-family: 'Courier New', monospace; font-size: 11px; color: #6b7280; }
    .low-meta { display: flex; gap: 6px; align-items: center; }
    .wh-chip { font-size: 10px; background: #eef2ff; color: #4f46e5; padding: 2px 8px; border-radius: 8px; font-weight: 600; }
    .qty-chip { font-size: 12px; background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 8px; font-weight: 600; }
    .qty-chip.qty-zero { background: #fee2e2; color: #991b1b; }
    .lookup-bar { display: flex; gap: 8px; margin-bottom: 12px; }
    .lookup-bar input { flex: 1; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }
    .product-stock h4 { margin: 0 0 10px; font-size: 13px; color: #374151; font-weight: 500; }
    .adj-cell { display: flex; gap: 4px; align-items: center; }
    .adj-cell input { width: 70px; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 5px; font-size: 12px; }
    .muted { color: #9ca3af; font-style: italic; }
  `]
})
export class AdminWarehousesComponent implements OnInit {
  warehouses: Warehouse[] = [];
  stats: Stats | null = null;
  lowStock: LowStockRow[] = [];
  loadingLow = false;
  saving = false;

  editing: Warehouse | null = null;
  form: Partial<Warehouse> = this.emptyForm();

  lookupProductId: number | null = null;
  currentProduct: ProductStockSummary | null = null;
  adjustDelta: Record<number, number> = {};

  toast = '';
  toastKind: 'ok' | 'err' = 'ok';

  constructor(private http: HttpClient) {}

  ngOnInit() { this.loadAll(); }

  private emptyForm(): Partial<Warehouse> {
    return { code: '', name: '', city: '', address: '', phone: '', priority: 100, ships_orders: true, is_active: true };
  }

  private headers(): Record<string, string> {
    const t = localStorage.getItem('admin_jwt') || localStorage.getItem('jwt');
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  loadAll() { this.loadWarehouses(); this.loadStats(); this.loadLowStock(); }

  loadWarehouses() {
    this.http.get<{ items: Warehouse[] }>(
      `${environementDev.api}/api/admin/warehouses`,
      { headers: this.headers() }
    ).subscribe({
      next: (r) => this.warehouses = r.items || [],
      error: () => this.warehouses = []
    });
  }

  loadStats() {
    this.http.get<Stats>(`${environementDev.api}/api/admin/warehouses/stats`, { headers: this.headers() })
      .subscribe({ next: (r) => this.stats = r, error: () => this.stats = null });
  }

  loadLowStock() {
    this.loadingLow = true;
    this.http.get<{ items: LowStockRow[] }>(
      `${environementDev.api}/api/admin/warehouses/low-stock?limit=30`,
      { headers: this.headers() }
    ).subscribe({
      next: (r) => { this.lowStock = r.items || []; this.loadingLow = false; },
      error: () => { this.lowStock = []; this.loadingLow = false; }
    });
  }

  edit(w: Warehouse) { this.editing = w; this.form = { ...w }; }
  cancelEdit() { this.editing = null; this.form = this.emptyForm(); }

  save() {
    this.saving = true;
    const req = this.editing?.id
      ? this.http.put(`${environementDev.api}/api/admin/warehouses/${this.editing.id}`, this.form, { headers: this.headers() })
      : this.http.post(`${environementDev.api}/api/admin/warehouses`, this.form, { headers: this.headers() });
    req.subscribe({
      next: () => {
        this.saving = false;
        this.showToast(this.editing?.id ? 'Entrepôt mis à jour' : 'Entrepôt créé', 'ok');
        this.cancelEdit(); this.loadAll();
      },
      error: (err) => {
        this.saving = false;
        this.showToast(err?.error?.message || 'Erreur', 'err');
      }
    });
  }

  setDefault(w: Warehouse) {
    this.http.post(`${environementDev.api}/api/admin/warehouses/${w.id}/set-default`, {}, { headers: this.headers() })
      .subscribe({
        next: () => { this.showToast(`${w.code} défini par défaut`, 'ok'); this.loadWarehouses(); },
        error: () => this.showToast('Erreur', 'err')
      });
  }

  openProduct(id: number) { this.lookupProductId = id; this.loadProduct(id); }

  loadProduct(id: number) {
    this.http.get<ProductStockSummary>(
      `${environementDev.api}/api/admin/warehouses/products/${id}`,
      { headers: this.headers() }
    ).subscribe({
      next: (r) => { this.currentProduct = r; this.adjustDelta = {}; },
      error: () => { this.currentProduct = null; this.showToast('Produit introuvable', 'err'); }
    });
  }

  adjustStock(warehouseId: number) {
    if (!this.currentProduct) return;
    const delta = Number(this.adjustDelta[warehouseId]);
    if (!delta || isNaN(delta)) return;
    this.http.post(
      `${environementDev.api}/api/admin/warehouses/products/${this.currentProduct.productId}/adjust`,
      { warehouseId, delta },
      { headers: this.headers() }
    ).subscribe({
      next: () => { this.showToast(`Stock ajusté de ${delta > 0 ? '+' : ''}${delta}`, 'ok'); this.loadProduct(this.currentProduct!.productId); this.loadStats(); this.loadLowStock(); },
      error: () => this.showToast('Erreur ajustement', 'err')
    });
  }

  setStock(warehouseId: number) {
    if (!this.currentProduct) return;
    const qty = Number(this.adjustDelta[warehouseId]);
    if (qty == null || isNaN(qty) || qty < 0) return;
    this.http.post(
      `${environementDev.api}/api/admin/warehouses/products/${this.currentProduct.productId}/set`,
      { warehouseId, quantity: qty },
      { headers: this.headers() }
    ).subscribe({
      next: () => { this.showToast(`Quantité fixée à ${qty}`, 'ok'); this.loadProduct(this.currentProduct!.productId); this.loadStats(); this.loadLowStock(); },
      error: () => this.showToast('Erreur', 'err')
    });
  }

  warehousesNotInProduct(): Warehouse[] {
    if (!this.currentProduct) return [];
    const present = new Set(this.currentProduct.perWarehouse.map((p) => p.warehouseId));
    return this.warehouses.filter((w) => !present.has(w.id) && w.is_active);
  }

  private showToast(msg: string, kind: 'ok' | 'err') {
    this.toast = msg; this.toastKind = kind;
    setTimeout(() => this.toast = '', 3500);
  }
}
