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
        <button class="btn-create" (click)="openCreateModal()">Nouveau coupon</button>
      </div>

      <div class="alert alert-success" *ngIf="successMessage">{{ successMessage }}</div>
      <div class="alert alert-error" *ngIf="errorMessage">{{ errorMessage }}</div>

      <div class="loading" *ngIf="isLoading">Chargement...</div>

      <div class="coupons-grid" *ngIf="!isLoading && coupons.length > 0">
        <div class="coupon-card" *ngFor="let coupon of coupons">
          <div class="coupon-header">
            <strong>{{ coupon.code }}</strong>
            <span>{{ coupon.isActive ? 'Actif' : 'Inactif' }}</span>
          </div>
          <div class="coupon-body">
            <div>{{ coupon.name || coupon.description || '-' }}</div>
            <div>{{ coupon.discountType === 'percentage' ? coupon.discountValue + '%' : (coupon.discountValue || 0).toFixed(3) + ' TND' }}</div>
          </div>
          <div class="coupon-actions">
            <button type="button" (click)="openEditModal(coupon)">Modifier</button>
            <button type="button" (click)="toggleCoupon(coupon)">{{ coupon.isActive ? 'Desactiver' : 'Activer' }}</button>
            <button type="button" (click)="deleteCoupon(coupon)">Supprimer</button>
          </div>
        </div>
      </div>

      <div class="empty-state" *ngIf="!isLoading && coupons.length === 0">Aucun coupon cree.</div>

      <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h2>{{ editing ? 'Modifier le coupon' : 'Creer un coupon' }}</h2>
          <form (ngSubmit)="save()">
            <label>Code</label>
            <input type="text" [(ngModel)]="form.code" name="code" required />

            <label>Nom</label>
            <input type="text" [(ngModel)]="form.name" name="name" />

            <label>Description</label>
            <textarea [(ngModel)]="form.description" name="description"></textarea>

            <label>Type</label>
            <select [(ngModel)]="form.discountType" name="discountType">
              <option value="percentage">Pourcentage</option>
              <option value="fixed_amount">Montant fixe</option>
            </select>

            <label>Valeur</label>
            <input type="number" [(ngModel)]="form.discountValue" name="discountValue" min="0" step="0.01" required />

            <label>Limite totale</label>
            <input type="number" [(ngModel)]="form.usageLimit" name="usageLimit" min="0" />

            <label>Actif</label>
            <input type="checkbox" [(ngModel)]="form.isActive" name="isActive" />

            <div class="form-actions">
              <button type="button" (click)="closeModal()">Annuler</button>
              <button type="submit" [disabled]="isSaving">{{ isSaving ? 'Enregistrement...' : 'Enregistrer' }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-coupons { max-width: 1100px; padding: 24px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .coupons-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .coupon-card { border: 1px solid #ddd; border-radius: 10px; padding: 16px; background: #fff; }
    .coupon-header, .coupon-actions, .form-actions { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .coupon-body { margin: 12px 0; display: grid; gap: 8px; }
    .alert { padding: 10px 12px; border-radius: 8px; margin-bottom: 16px; }
    .alert-success { background: #d1fae5; }
    .alert-error { background: #fee2e2; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; padding: 20px; }
    .modal-content { width: min(520px, 100%); background: #fff; border-radius: 12px; padding: 20px; display: grid; gap: 10px; }
    input, textarea, select, button { font: inherit; }
    input, textarea, select { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 8px; }
    button { padding: 10px 14px; border: 0; border-radius: 8px; cursor: pointer; }
  `]
})
export class AdminCouponsComponent implements OnInit {
  coupons: any[] = [];
  isLoading = false;
  isSaving = false;
  showModal = false;
  editing: any = null;
  successMessage = '';
  errorMessage = '';
  form: any = this.emptyForm();

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadCoupons();
  }

  emptyForm() {
    return {
      code: '',
      name: '',
      description: '',
      discountType: 'percentage',
      discountValue: 10,
      usageLimit: null,
      isActive: true
    };
  }

  loadCoupons(): void {
    this.isLoading = true;
    this.adminService.getCoupons().subscribe({
      next: (response) => {
        this.coupons = (response.items || []).map((coupon: any) => this.mapCouponForView(coupon));
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.showError('Erreur lors du chargement');
      }
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
      usageLimit: coupon.usageLimit ?? null,
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
    if (!this.form.code?.trim()) {
      this.showError('Le code est requis');
      return;
    }

    this.isSaving = true;
    const payload = {
      code: this.form.code.trim().toUpperCase(),
      name: this.form.name?.trim() || null,
      description: this.form.description?.trim() || null,
      discount_type: this.form.discountType,
      discount_value: Number(this.form.discountValue || 0),
      usage_limit: this.form.usageLimit ? Number(this.form.usageLimit) : null,
      is_active: this.form.isActive !== false
    };

    const request = this.editing
      ? this.adminService.updateCoupon(this.editing.id, payload)
      : this.adminService.createCoupon(payload);

    request.subscribe({
      next: () => {
        this.isSaving = false;
        this.closeModal();
        this.showSuccess(this.editing ? 'Coupon mis a jour' : 'Coupon cree');
        this.loadCoupons();
      },
      error: (err) => {
        this.isSaving = false;
        this.showError(err?.error?.message || 'Erreur lors de l\'enregistrement');
      }
    });
  }

  toggleCoupon(coupon: any): void {
    this.adminService.updateCoupon(coupon.id, { is_active: !coupon.isActive }).subscribe({
      next: () => {
        coupon.isActive = !coupon.isActive;
        this.showSuccess(coupon.isActive ? 'Coupon active' : 'Coupon desactive');
      },
      error: () => this.showError('Erreur lors du changement de statut')
    });
  }

  deleteCoupon(coupon: any): void {
    if (!confirm(`Supprimer le coupon "${coupon.code}" ?`)) return;
    this.adminService.deleteCoupon(coupon.id).subscribe({
      next: () => {
        this.showSuccess('Coupon supprime');
        this.loadCoupons();
      },
      error: (err) => this.showError(err?.error?.message || 'Erreur lors de la suppression')
    });
  }

  private mapCouponForView(coupon: any): any {
    return {
      ...coupon,
      name: coupon.name || coupon.description || coupon.code,
      description: coupon.description || coupon.name || '',
      discountType: String(coupon.discountType || coupon.discount_type || 'percentage').toLowerCase(),
      discountValue: Number(coupon.discountValue ?? coupon.discount_value ?? 0),
      usageLimit: coupon.usageLimit ?? coupon.usage_limit ?? null,
      isActive: coupon.isActive ?? coupon.is_active ?? false
    };
  }

  private showSuccess(message: string): void {
    this.successMessage = message;
    this.errorMessage = '';
    setTimeout(() => this.successMessage = '', 3000);
  }

  private showError(message: string): void {
    this.errorMessage = message;
    this.successMessage = '';
    setTimeout(() => this.errorMessage = '', 5000);
  }
}
