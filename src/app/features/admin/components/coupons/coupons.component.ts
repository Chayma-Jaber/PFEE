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
        <button class="btn-create" (click)="showCreateModal = true">
          <i class="fas fa-plus"></i> Nouveau coupon
        </button>
      </div>

      <div class="coupons-grid">
        <div class="coupon-card" *ngFor="let coupon of coupons">
          <div class="coupon-header">
            <span class="coupon-code">{{ coupon.code }}</span>
            <span class="coupon-status" [class.active]="coupon.isActive" [class.inactive]="!coupon.isActive">
              {{ coupon.isActive ? 'Actif' : 'Inactif' }}
            </span>
          </div>
          <div class="coupon-body">
            <h3>{{ coupon.name }}</h3>
            <div class="discount-value">
              {{ coupon.discountType === 'percentage' ? coupon.discountValue + '%' : coupon.discountValue?.toFixed(3) + ' TND' }}
            </div>
            <div class="coupon-meta">
              <span><i class="fas fa-chart-bar"></i> {{ coupon.usageCount }}/{{ coupon.usageLimit || '∞' }} utilisations</span>
              <span *ngIf="coupon.expiresAt"><i class="fas fa-clock"></i> Expire: {{ formatDate(coupon.expiresAt) }}</span>
            </div>
          </div>
          <div class="coupon-actions">
            <button class="btn-toggle" (click)="toggleCoupon(coupon)">
              <i class="fas" [class.fa-eye]="coupon.isActive" [class.fa-eye-slash]="!coupon.isActive"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="empty-state" *ngIf="coupons.length === 0 && !isLoading">
        <i class="fas fa-ticket-alt"></i>
        <p>Aucun coupon créé</p>
      </div>

      <!-- Create Modal -->
      <div class="modal-overlay" *ngIf="showCreateModal" (click)="showCreateModal = false">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h2>Créer un coupon</h2>
          <form (ngSubmit)="createCoupon()">
            <div class="form-group">
              <label>Code</label>
              <input type="text" [(ngModel)]="newCoupon.code" name="code" required placeholder="CODE20">
            </div>
            <div class="form-group">
              <label>Nom</label>
              <input type="text" [(ngModel)]="newCoupon.name" name="name" required placeholder="Réduction été 2024">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Type</label>
                <select [(ngModel)]="newCoupon.discountType" name="discountType">
                  <option value="percentage">Pourcentage</option>
                  <option value="fixed_amount">Montant fixe</option>
                </select>
              </div>
              <div class="form-group">
                <label>Valeur</label>
                <input type="number" [(ngModel)]="newCoupon.discountValue" name="discountValue" required>
              </div>
            </div>
            <div class="form-group">
              <label>Limite d'utilisation</label>
              <input type="number" [(ngModel)]="newCoupon.usageLimit" name="usageLimit" placeholder="Illimité">
            </div>
            <div class="form-actions">
              <button type="button" class="btn-cancel" (click)="showCreateModal = false">Annuler</button>
              <button type="submit" class="btn-submit">Créer</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-coupons { max-width: 1200px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 600; color: #1a1a2e; margin: 0; }
    .btn-create { padding: 10px 20px; background: #667eea; color: #fff; border: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; }
    .coupons-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
    .coupon-card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .coupon-header { display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #f8f9fa; }
    .coupon-code { font-family: monospace; font-size: 18px; font-weight: 700; color: #667eea; letter-spacing: 2px; }
    .coupon-status { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .coupon-status.active { background: #d4edda; color: #155724; }
    .coupon-status.inactive { background: #f8d7da; color: #721c24; }
    .coupon-body { padding: 16px; }
    .coupon-body h3 { font-size: 14px; font-weight: 500; margin: 0 0 12px 0; color: #1a1a2e; }
    .discount-value { font-size: 28px; font-weight: 700; color: #27ae60; margin-bottom: 12px; }
    .coupon-meta { font-size: 12px; color: #888; }
    .coupon-meta span { display: block; margin-bottom: 4px; }
    .coupon-meta i { width: 16px; }
    .coupon-actions { padding: 12px 16px; border-top: 1px solid #f0f0f0; display: flex; justify-content: flex-end; }
    .btn-toggle { padding: 8px 12px; background: #f0f0f0; border: none; border-radius: 6px; cursor: pointer; }
    .empty-state { text-align: center; padding: 60px; color: #888; }
    .empty-state i { font-size: 40px; margin-bottom: 16px; opacity: 0.5; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: #fff; padding: 24px; border-radius: 12px; width: 90%; max-width: 480px; }
    .modal-content h2 { margin: 0 0 20px 0; font-size: 20px; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; }
    .form-group input, .form-group select { width: 100%; padding: 10px 12px; border: 1px solid #e0e0e0; border-radius: 8px; }
    .form-row { display: flex; gap: 16px; }
    .form-row .form-group { flex: 1; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
    .btn-cancel { padding: 10px 20px; border: 1px solid #e0e0e0; background: #fff; border-radius: 8px; cursor: pointer; }
    .btn-submit { padding: 10px 20px; background: #667eea; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
  `]
})
export class AdminCouponsComponent implements OnInit {
  coupons: any[] = [];
  isLoading = false;
  showCreateModal = false;
  newCoupon: any = { code: '', name: '', discountType: 'percentage', discountValue: 10, usageLimit: null };

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadCoupons();
  }

  loadCoupons(): void {
    this.isLoading = true;
    this.adminService.getCoupons().subscribe(response => {
      this.coupons = response.items;
      this.isLoading = false;
    });
  }

  createCoupon(): void {
    this.adminService.createCoupon(this.newCoupon).subscribe(() => {
      this.showCreateModal = false;
      this.newCoupon = { code: '', name: '', discountType: 'percentage', discountValue: 10, usageLimit: null };
      this.loadCoupons();
    });
  }

  toggleCoupon(coupon: any): void {
    this.adminService.updateCoupon(coupon.id, { is_active: !coupon.isActive }).subscribe(() => {
      coupon.isActive = !coupon.isActive;
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-TN');
  }
}
