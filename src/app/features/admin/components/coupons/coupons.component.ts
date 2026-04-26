import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin-coupons',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-coupons">
      <div class="page-header">
        <h1>Gestion des coupons</h1>
        <button class="btn-create" (click)="openCreateModal()">
          <i class="fas fa-plus"></i> Nouveau coupon
        </button>
      </div>

      <div class="alert alert-success" *ngIf="successMessage">
        <i class="fas fa-check-circle"></i> {{ successMessage }}
      </div>
      <div class="alert alert-error" *ngIf="errorMessage">
        <i class="fas fa-exclamation-circle"></i> {{ errorMessage }}
      </div>

      <div class="coupons-grid" *ngIf="!isLoading">
        <div class="coupon-card" *ngFor="let coupon of coupons">
          <div class="coupon-header">
            <span class="coupon-code">{{ coupon.code }}</span>
            <span class="coupon-status" [class.active]="coupon.isActive" [class.inactive]="!coupon.isActive">
              {{ coupon.isActive ? 'Actif' : 'Inactif' }}
            </span>
          </div>
          <div class="coupon-body">
            <h3>{{ coupon.name || coupon.description || '—' }}</h3>
            <div class="discount-value">
              {{ coupon.discountType === 'percentage' ? coupon.discountValue + '%' : (coupon.discountValue || 0).toFixed(3) + ' TND' }}
            </div>
            <div class="coupon-meta">
              <span><i class="fas fa-chart-bar"></i> {{ coupon.usageCount || 0 }}/{{ coupon.usageLimit || '∞' }} utilisations</span>
              <span *ngIf="coupon.expiresAt || coupon.validTo">
                <i class="fas fa-clock"></i> Expire: {{ formatDate(coupon.expiresAt || coupon.validTo) }}
              </span>
              <span *ngIf="coupon.minPurchase">
                <i class="fas fa-shopping-cart"></i> Min: {{ coupon.minPurchase?.toFixed(3) }} TND
              </span>
            </div>
          </div>
          <div class="coupon-actions">
            <button class="btn-action edit" title="Modifier" (click)="openEditModal(coupon)">
              <i class="fas fa-pencil"></i>
            </button>
            <button class="btn-action toggle" [title]="coupon.isActive ? 'Désactiver' : 'Activer'" (click)="toggleCoupon(coupon)">
              <i class="fas" [class.fa-eye]="coupon.isActive" [class.fa-eye-slash]="!coupon.isActive"></i>
            </button>
            <button class="btn-action delete" title="Supprimer" (click)="deleteCoupon(coupon)">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="loading" *ngIf="isLoading">Chargement...</div>

      <div class="empty-state" *ngIf="coupons.length === 0 && !isLoading">
        <i class="fas fa-ticket-alt"></i>
        <p>Aucun coupon créé</p>
        <button class="btn-create" (click)="openCreateModal()">Créer un coupon</button>
      </div>

      <!-- Modal -->
      <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h2>{{ editing ? 'Modifier le coupon' : 'Créer un coupon' }}</h2>
          <form (ngSubmit)="save()">
            <div class="form-group">
              <label>Code *</label>
              <input type="text" [(ngModel)]="form.code" name="code" required placeholder="ETE2026" />
            </div>
            <div class="form-group">
              <label>Nom</label>
              <input type="text" [(ngModel)]="form.name" name="name" placeholder="Réduction été" />
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea [(ngModel)]="form.description" name="description" rows="2"></textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Type</label>
                <select [(ngModel)]="form.discountType" name="discountType">
                  <option value="percentage">Pourcentage</option>
                  <option value="fixed_amount">Montant fixe</option>
                </select>
              </div>
              <div class="form-group">
                <label>Valeur *</label>
                <input type="number" [(ngModel)]="form.discountValue" name="discountValue" required step="0.01" min="0" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Min. achat</label>
                <input type="number" [(ngModel)]="form.minPurchase" name="minPurchase" step="0.01" min="0" />
              </div>
              <div class="form-group">
                <label>Max. réduction</label>
                <input type="number" [(ngModel)]="form.maxDiscount" name="maxDiscount" step="0.01" min="0" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Limite totale</label>
                <input type="number" [(ngModel)]="form.usageLimit" name="usageLimit" min="0" placeholder="Illimité" />
              </div>
              <div class="form-group">
                <label>Limite par client</label>
                <input type="number" [(ngModel)]="form.perUserLimit" name="perUserLimit" min="0" placeholder="Illimité" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Valide du</label>
                <input type="date" [(ngModel)]="form.validFrom" name="validFrom" />
              </div>
              <div class="form-group">
                <label>Valide jusqu'au</label>
                <input type="date" [(ngModel)]="form.validTo" name="validTo" />
              </div>
            </div>
            <div class="form-group checkbox-group">
              <label>
                <input type="checkbox" [(ngModel)]="form.isActive" name="isActive" />
                Coupon actif
              </label>
            </div>
            <div class="form-actions">
              <button type="button" class="btn-cancel" (click)="closeModal()" [disabled]="isSaving">Annuler</button>
              <button type="submit" class="btn-submit" [disabled]="isSaving">
                <span *ngIf="isSaving">Enregistrement...</span>
                <span *ngIf="!isSaving">{{ editing ? 'Mettre à jour' : 'Créer' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-coupons { max-width: 1200px; padding: 24px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 600; color: #1a1a2e; margin: 0; }
    .btn-create { padding: 10px 20px; background: #111; color: #fff; border: none; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
    .btn-create:hover { background: #333; }
    .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; font-size: 14px; }
    .alert-success { background: #d1fae5; color: #065f46; }
    .alert-error { background: #fee2e2; color: #991b1b; }
    .coupons-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
    .coupon-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
    .coupon-header { display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #f8f9fa; }
    .coupon-code { font-family: monospace; font-size: 18px; font-weight: 700; color: #6366f1; letter-spacing: 2px; }
    .coupon-status { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .coupon-status.active { background: #d1fae5; color: #065f46; }
    .coupon-status.inactive { background: #f3f4f6; color: #6b7280; }
    .coupon-body { padding: 16px; }
    .coupon-body h3 { font-size: 14px; font-weight: 500; margin: 0 0 12px 0; color: #1a1a2e; }
    .discount-value { font-size: 28px; font-weight: 700; color: #10b981; margin-bottom: 12px; }
    .coupon-meta { font-size: 12px; color: #6b7280; }
    .coupon-meta span { display: block; margin-bottom: 4px; }
    .coupon-meta i { width: 16px; }
    .coupon-actions { padding: 12px 16px; border-top: 1px solid #f0f0f0; display: flex; justify-content: flex-end; gap: 6px; }
    .btn-action { padding: 8px 10px; background: #f3f4f6; border: none; border-radius: 6px; cursor: pointer; color: #6b7280; transition: all 0.2s; }
    .btn-action:hover { background: #e5e7eb; color: #111827; }
    .btn-action.delete:hover { background: #fee2e2; color: #dc2626; }
    .loading { text-align: center; padding: 60px; color: #6b7280; }
    .empty-state { text-align: center; padding: 60px; color: #6b7280; }
    .empty-state i { font-size: 40px; margin-bottom: 16px; opacity: 0.5; display: block; }
    .empty-state p { margin-bottom: 20px; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .modal-content { background: #fff; padding: 24px; border-radius: 12px; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; }
    .modal-content h2 { margin: 0 0 20px 0; font-size: 20px; color: #111827; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; color: #374151; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; border-color: #6366f1; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .checkbox-group label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .checkbox-group input { width: 18px; height: 18px; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
    .btn-cancel { padding: 10px 20px; border: 1px solid #e0e0e0; background: #fff; border-radius: 8px; cursor: pointer; }
    .btn-submit { padding: 10px 20px; background: #111; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
    .btn-submit:disabled, .btn-cancel:disabled { opacity: 0.6; cursor: not-allowed; }
  `]
})
export class AdminCouponsComponent implements OnInit {
  coupons: any[] = [];
  isLoading = false;
  isSaving = false;
  showModal = false;
  editing: any = null;
  form: any = this.emptyForm();
  successMessage = '';
  errorMessage = '';

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadCoupons();
  }

  emptyForm() {
    return {
      code: '', name: '', description: '',
      discountType: 'percentage', discountValue: 10,
      minPurchase: null, maxDiscount: null,
      usageLimit: null, perUserLimit: null,
      validFrom: '', validTo: '',
      isActive: true
    };
  }

  loadCoupons(): void {
    this.isLoading = true;
    this.adminService.getCoupons().subscribe({
      next: (response) => {
        this.coupons = response.items || [];
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; this.showError('Erreur lors du chargement'); }
    });
  }

  openCreateModal(): void {
    this.editing = null;
    this.form = this.emptyForm();
    this.showModal = true;
  }

  openEditModal(coupon: any): void {
    this.editing = coupon;
    this.form = {
      code: coupon.code || '',
      name: coupon.name || '',
      description: coupon.description || '',
      discountType: coupon.discountType || 'percentage',
      discountValue: coupon.discountValue || 0,
      minPurchase: coupon.minPurchase ?? null,
      maxDiscount: coupon.maxDiscount ?? null,
      usageLimit: coupon.usageLimit ?? null,
      perUserLimit: coupon.perUserLimit ?? null,
      validFrom: this.toDateInput(coupon.validFrom),
      validTo: this.toDateInput(coupon.validTo || coupon.expiresAt),
      isActive: coupon.isActive !== false
    };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editing = null;
    this.form = this.emptyForm();
  }

  save(): void {
    if (!this.form.code?.trim()) { this.showError('Le code est requis'); return; }
    if (!this.form.discountValue) { this.showError('La valeur de réduction est requise'); return; }

    this.isSaving = true;
    const payload: any = {
      code: this.form.code.trim().toUpperCase(),
      name: this.form.name?.trim() || null,
      description: this.form.description?.trim() || null,
      discount_type: this.form.discountType,
      discount_value: Number(this.form.discountValue),
      min_purchase: this.form.minPurchase ? Number(this.form.minPurchase) : null,
      max_discount: this.form.maxDiscount ? Number(this.form.maxDiscount) : null,
      usage_limit: this.form.usageLimit ? Number(this.form.usageLimit) : null,
      per_user_limit: this.form.perUserLimit ? Number(this.form.perUserLimit) : null,
      valid_from: this.form.validFrom || null,
      valid_to: this.form.validTo || null,
      is_active: this.form.isActive !== false
    };

    const request = this.editing
      ? this.adminService.updateCoupon(this.editing.id, payload)
      : this.adminService.createCoupon(payload);

    request.subscribe({
      next: () => {
        this.showSuccess(this.editing ? 'Coupon mis à jour' : 'Coupon créé');
        this.closeModal();
        this.loadCoupons();
        this.isSaving = false;
      },
      error: (err) => {
        const msg = err?.error?.message || 'Erreur lors de l\'enregistrement';
        this.showError(Array.isArray(msg) ? msg.join(', ') : msg);
        this.isSaving = false;
      }
    });
  }

  toggleCoupon(coupon: any): void {
    this.adminService.updateCoupon(coupon.id, { is_active: !coupon.isActive }).subscribe({
      next: () => {
        coupon.isActive = !coupon.isActive;
        this.showSuccess(coupon.isActive ? 'Coupon activé' : 'Coupon désactivé');
      },
      error: () => this.showError('Erreur lors du changement de statut')
    });
  }

  deleteCoupon(coupon: any): void {
    if (!confirm(`Supprimer le coupon "${coupon.code}" ?`)) return;
    this.adminService.deleteCoupon(coupon.id).subscribe({
      next: () => { this.showSuccess('Coupon supprimé'); this.loadCoupons(); },
      error: (err) => this.showError(err?.error?.message || 'Erreur lors de la suppression')
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-TN');
  }

  toDateInput(dateStr: any): string {
    if (!dateStr) return '';
    try { return new Date(dateStr).toISOString().slice(0, 10); } catch { return ''; }
  }

  showSuccess(msg: string) { this.successMessage = msg; this.errorMessage = ''; setTimeout(() => this.successMessage = '', 3000); }
  showError(msg: string) { this.errorMessage = msg; this.successMessage = ''; setTimeout(() => this.errorMessage = '', 5000); }
}
