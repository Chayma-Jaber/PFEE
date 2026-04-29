import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin-bundles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-bundles">
      <div class="page-header">
        <div>
          <h1>Lots & Packs</h1>
          <p>Créez des offres groupées de produits à prix réduit</p>
        </div>
        <button class="btn-primary" (click)="openModal()">
          <i class="fas fa-plus"></i> Nouveau lot
        </button>
      </div>

      <div class="alert alert-success" *ngIf="successMessage"><i class="fas fa-check"></i> {{ successMessage }}</div>
      <div class="alert alert-error" *ngIf="errorMessage"><i class="fas fa-exclamation"></i> {{ errorMessage }}</div>

      <div class="loading" *ngIf="isLoading">Chargement...</div>

      <div class="bundles-grid" *ngIf="!isLoading">
        <div class="bundle-card" *ngFor="let bundle of bundles">
          <div class="bundle-image">
            <img *ngIf="bundle.imageUrl" [src]="bundle.imageUrl" [alt]="bundle.name" />
            <div *ngIf="!bundle.imageUrl" class="image-placeholder"><i class="fas fa-box-open"></i></div>
            <span class="discount-badge" *ngIf="bundle.discountPercentage > 0">-{{ bundle.discountPercentage }}%</span>
          </div>
          <div class="bundle-content">
            <div class="bundle-header">
              <h3>{{ bundle.name }}</h3>
              <span class="status" [class.active]="bundle.isActive" [class.inactive]="!bundle.isActive">
                {{ bundle.isActive ? 'Actif' : 'Inactif' }}
              </span>
            </div>
            <p class="bundle-description">{{ bundle.description || 'Pas de description' }}</p>
            <div class="bundle-pricing">
              <span class="original-price">{{ bundle.originalPrice?.toFixed(3) }} TND</span>
              <span class="bundle-price">{{ bundle.bundlePrice?.toFixed(3) }} TND</span>
              <span class="savings" *ngIf="bundle.savingsAmount > 0">Économie: {{ bundle.savingsAmount?.toFixed(3) }} TND</span>
            </div>
            <div class="bundle-stats">
              <span><i class="fas fa-boxes"></i> {{ bundle.itemCount || 0 }} produits</span>
              <span><i class="fas fa-shopping-cart"></i> {{ bundle.purchaseCount || 0 }} ventes</span>
            </div>
            <div class="bundle-actions">
              <button class="btn-edit" (click)="openModal(bundle)"><i class="fas fa-pencil"></i></button>
              <button class="btn-toggle" (click)="toggle(bundle)"><i class="fas" [class.fa-eye]="bundle.isActive" [class.fa-eye-slash]="!bundle.isActive"></i></button>
              <button class="btn-delete" (click)="remove(bundle)"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        </div>

        <div class="empty-state" *ngIf="bundles.length === 0">
          <i class="fas fa-box-open"></i>
          <p>Aucun lot créé</p>
          <button class="btn-primary" (click)="openModal()">Créer un lot</button>
        </div>
      </div>

      <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div class="bundle-modal" (click)="$event.stopPropagation()">
          <h2>{{ editing ? 'Modifier le lot' : 'Nouveau lot' }}</h2>
          <div class="form-group">
            <label>Nom *</label>
            <input type="text" [(ngModel)]="form.name" placeholder="Ex: Pack Été - T-shirt + Short" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea [(ngModel)]="form.description" rows="2"></textarea>
          </div>
          <div class="form-group">
            <label>URL Image</label>
            <input type="text" [(ngModel)]="form.imageUrl" placeholder="https://..." />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Prix du lot *</label>
              <input type="number" step="0.001" [(ngModel)]="form.bundlePrice" min="0" />
            </div>
            <div class="form-group">
              <label>Prix original</label>
              <input type="number" step="0.001" [(ngModel)]="form.originalPrice" min="0" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Valide du</label>
              <input type="date" [(ngModel)]="form.validFrom" />
            </div>
            <div class="form-group">
              <label>Valide jusqu'au</label>
              <input type="date" [(ngModel)]="form.validTo" />
            </div>
          </div>
          <div class="form-group">
            <label>Limite d'achat</label>
            <input type="number" [(ngModel)]="form.maxPurchases" min="0" placeholder="Illimité" />
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="form.isActive" /> Lot actif
            </label>
          </div>
          <div class="form-group" *ngIf="!editing">
            <label>IDs produits (séparés par virgule)</label>
            <input type="text" [(ngModel)]="productIdsRaw" placeholder="Ex: 1, 5, 12" />
            <span class="hint">Les produits seront ajoutés avec quantité 1</span>
          </div>
          <div class="modal-actions">
            <button class="btn-cancel" (click)="closeModal()" [disabled]="isSaving">Annuler</button>
            <button class="btn-primary" (click)="save()" [disabled]="isSaving">{{ isSaving ? 'Enregistrement...' : (editing ? 'Mettre à jour' : 'Créer') }}</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-bundles { padding: 24px; max-width: 1400px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 16px; }
    .page-header h1 { font-size: 24px; font-weight: 600; color: #111827; margin: 0 0 4px 0; }
    .page-header p { color: #6b7280; margin: 0; font-size: 14px; }
    .btn-primary { padding: 10px 20px; background: #111; color: #fff; border: none; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
    .btn-primary:hover { background: #333; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; display: flex; gap: 8px; }
    .alert-success { background: #d1fae5; color: #065f46; }
    .alert-error { background: #fee2e2; color: #991b1b; }
    .loading { text-align: center; padding: 60px; color: #6b7280; }
    .bundles-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
    .bundle-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; transition: all 0.2s; }
    .bundle-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .bundle-image { position: relative; width: 100%; height: 180px; background: #f9fafb; }
    .bundle-image img { width: 100%; height: 100%; object-fit: cover; }
    .image-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 48px; color: #d1d5db; }
    .discount-badge { position: absolute; top: 12px; right: 12px; background: #ef4444; color: #fff; padding: 6px 12px; border-radius: 20px; font-weight: 700; font-size: 14px; }
    .bundle-content { padding: 16px; }
    .bundle-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 8px; }
    .bundle-header h3 { font-size: 16px; font-weight: 600; color: #111827; margin: 0; flex: 1; }
    .status { padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; }
    .status.active { background: #d1fae5; color: #065f46; }
    .status.inactive { background: #f3f4f6; color: #6b7280; }
    .bundle-description { font-size: 13px; color: #6b7280; margin: 0 0 12px 0; min-height: 40px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .bundle-pricing { margin-bottom: 12px; }
    .original-price { text-decoration: line-through; color: #9ca3af; font-size: 13px; margin-right: 8px; }
    .bundle-price { font-size: 20px; font-weight: 700; color: #10b981; }
    .savings { display: block; font-size: 12px; color: #059669; margin-top: 4px; }
    .bundle-stats { display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; margin-bottom: 12px; padding-top: 12px; border-top: 1px solid #f3f4f6; }
    .bundle-actions { display: flex; gap: 6px; justify-content: flex-end; }
    .btn-edit, .btn-toggle, .btn-delete { padding: 8px 10px; background: #f3f4f6; border: none; border-radius: 6px; cursor: pointer; color: #6b7280; }
    .btn-edit:hover, .btn-toggle:hover { background: #e5e7eb; color: #111827; }
    .btn-delete:hover { background: #fee2e2; color: #dc2626; }
    .empty-state { grid-column: 1 / -1; text-align: center; padding: 60px; color: #6b7280; }
    .empty-state i { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
    .empty-state p { margin-bottom: 20px; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .bundle-modal { background: #fff; border-radius: 12px; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; padding: 24px; display: block; position: relative; z-index: 1001; }
    .bundle-modal h2 { margin: 0 0 20px 0; font-size: 20px; color: #111827; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; color: #374151; }
    .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .checkbox-label input { width: 18px; height: 18px; }
    .hint { font-size: 12px; color: #9ca3af; margin-top: 4px; display: block; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
    .btn-cancel { padding: 10px 20px; border: 1px solid #e5e7eb; background: #fff; border-radius: 8px; cursor: pointer; }
  `]
})
export class AdminBundlesComponent implements OnInit {
  bundles: any[] = [];
  isLoading = false;
  isSaving = false;
  showModal = false;
  editing: any = null;
  form: any = this.emptyForm();
  productIdsRaw = '';
  successMessage = '';
  errorMessage = '';

  constructor(private adminService: AdminService) {}

  ngOnInit() { this.load(); }

  emptyForm() {
    return {
      name: '', description: '', imageUrl: '',
      bundlePrice: 0, originalPrice: 0,
      validFrom: '', validTo: '', maxPurchases: null,
      isActive: true
    };
  }

  load() {
    this.isLoading = true;
    this.adminService.getBundles().subscribe({
      next: (res) => { this.bundles = res.items || []; this.isLoading = false; },
      error: () => { this.isLoading = false; this.showError('Erreur lors du chargement'); }
    });
  }

  openModal(bundle?: any) {
    if (bundle) {
      this.editing = bundle;
      this.form = {
        name: bundle.name, description: bundle.description || '',
        imageUrl: bundle.imageUrl || '',
        bundlePrice: bundle.bundlePrice, originalPrice: bundle.originalPrice,
        validFrom: this.toDate(bundle.validFrom), validTo: this.toDate(bundle.validTo),
        maxPurchases: bundle.maxPurchases, isActive: bundle.isActive
      };
    } else {
      this.editing = null;
      this.form = this.emptyForm();
      this.productIdsRaw = '';
    }
    this.showModal = true;
  }

  closeModal() { this.showModal = false; this.editing = null; this.form = this.emptyForm(); }

  save() {
    if (!this.form.name?.trim()) { this.showError('Le nom est requis'); return; }
    if (!this.form.bundlePrice || this.form.bundlePrice <= 0) { this.showError('Prix du lot requis'); return; }

    const payload: any = { ...this.form };
    if (!this.editing && this.productIdsRaw.trim()) {
      payload.items = this.productIdsRaw.split(',').map(s => s.trim()).filter(Boolean).map(id => ({ productId: Number(id), quantity: 1 }));
    }

    this.isSaving = true;
    const req = this.editing ? this.adminService.updateBundle(this.editing.id, payload) : this.adminService.createBundle(payload);
    req.subscribe({
      next: () => {
        this.showSuccess(this.editing ? 'Lot mis à jour' : 'Lot créé');
        this.closeModal(); this.load(); this.isSaving = false;
      },
      error: (err) => {
        this.showError(err?.error?.message || 'Erreur lors de l\'enregistrement'); this.isSaving = false;
      }
    });
  }

  toggle(bundle: any) {
    this.adminService.toggleBundle(bundle.id).subscribe({
      next: (res) => { bundle.isActive = res.isActive; this.showSuccess(bundle.isActive ? 'Lot activé' : 'Lot désactivé'); },
      error: () => this.showError('Erreur')
    });
  }

  remove(bundle: any) {
    if (!confirm(`Supprimer le lot "${bundle.name}" ?`)) return;
    this.adminService.deleteBundle(bundle.id).subscribe({
      next: () => { this.showSuccess('Lot supprimé'); this.load(); },
      error: () => this.showError('Erreur lors de la suppression')
    });
  }

  toDate(d: any): string { return d ? new Date(d).toISOString().slice(0, 10) : ''; }
  showSuccess(m: string) { this.successMessage = m; this.errorMessage = ''; setTimeout(() => this.successMessage = '', 3000); }
  showError(m: string) { this.errorMessage = m; this.successMessage = ''; setTimeout(() => this.errorMessage = '', 5000); }
}
