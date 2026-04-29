import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { environementDev } from '../../../../../environements/environementDev';

@Component({
  selector: 'app-admin-returns',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-returns">
      <div class="page-header">
        <h1>Gestion des retours</h1>
      </div>

      <div class="filters-bar">
        <select [(ngModel)]="statusFilter" (change)="loadReturns()">
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="under_review">En révision</option>
          <option value="approved">Approuvé</option>
          <option value="rejected">Refusé</option>
          <option value="refunded">Remboursé</option>
        </select>
      </div>

      <div class="returns-list">
        <div class="return-card" *ngFor="let ret of returns">
          <div class="return-header">
            <span class="return-ref">{{ ret.reference }}</span>
            <span class="return-status" [class]="getStatusClass(ret.status)">
              {{ getStatusLabel(ret.status) }}
            </span>
          </div>
          <div class="return-body">
            <div class="return-info">
              <p><strong>Commande:</strong> {{ ret.orderReference }}</p>
              <p><strong>Motif:</strong> {{ getReasonLabel(ret.reason) }}</p>
              <p *ngIf="ret.reasonDetails"><strong>Détails:</strong> {{ ret.reasonDetails }}</p>
            </div>
            <div class="return-amount" *ngIf="ret.refundAmount">
              Montant: {{ ret.refundAmount?.toFixed(3) }} TND
            </div>
          </div>
          <div class="return-actions" *ngIf="ret.status === 'pending' || ret.status === 'under_review'">
            <button class="btn-approve" (click)="updateStatus(ret, 'approved')">
              <i class="fas fa-check"></i> Approuver
            </button>
            <button class="btn-reject" (click)="updateStatus(ret, 'rejected')">
              <i class="fas fa-times"></i> Refuser
            </button>
          </div>
        </div>
      </div>

      <div class="empty-state" *ngIf="returns.length === 0 && !isLoading">
        <i class="fas fa-undo"></i>
        <p>Aucune demande de retour</p>
      </div>
    </div>
  `,
  styles: [`
    .admin-returns { max-width: 900px; }
    .page-header { margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 600; color: #1a1a2e; margin: 0; }
    .filters-bar { margin-bottom: 24px; }
    .filters-bar select { padding: 10px 16px; border: 1px solid #e0e0e0; border-radius: 8px; background: #fff; }
    .returns-list { display: flex; flex-direction: column; gap: 16px; }
    .return-card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .return-header { display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #f8f9fa; }
    .return-ref { font-weight: 600; color: #667eea; }
    .return-status { padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .return-status.warning { background: #fef3cd; color: #856404; }
    .return-status.info { background: #d1ecf1; color: #0c5460; }
    .return-status.success { background: #d4edda; color: #155724; }
    .return-status.danger { background: #f8d7da; color: #721c24; }
    .return-body { padding: 16px; }
    .return-info p { margin: 4px 0; font-size: 14px; }
    .return-amount { margin-top: 12px; font-size: 16px; font-weight: 600; color: #27ae60; }
    .return-actions { padding: 12px 16px; border-top: 1px solid #f0f0f0; display: flex; gap: 12px; }
    .btn-approve { padding: 8px 16px; background: #27ae60; color: #fff; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; }
    .btn-reject { padding: 8px 16px; background: #e74c3c; color: #fff; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; }
    .empty-state { text-align: center; padding: 60px; color: #888; }
    .empty-state i { font-size: 40px; margin-bottom: 16px; opacity: 0.5; }
  `]
})
export class AdminReturnsComponent implements OnInit {
  private readonly useLocalMode = !!(environementDev as any).useLocalAuth;
  returns: any[] = [];
  isLoading = false;
  statusFilter = '';

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadReturns();
  }

  loadReturns(): void {
    this.isLoading = true;
    this.adminService.getReturns({ status: this.statusFilter || undefined }).subscribe(response => {
      this.returns = (response.items || []).map((ret: any) => this.normalizeReturn(ret));
      this.isLoading = false;
    });
  }

  updateStatus(ret: any, status: string): void {
    if (this.useLocalMode) {
      ret.status = status;
      return;
    }

    this.adminService.updateReturnStatus(ret.id, status).subscribe({
      next: () => {
        ret.status = status;
      }
    });
  }

  private normalizeReturn(ret: any): any {
    return {
      ...ret,
      id: Number(ret?.id || 0),
      reference: ret?.reference || ret?.ref || `RET-${ret?.id || ''}`,
      orderReference: ret?.orderReference || ret?.order_reference || ret?.orderRef || '-',
      reason: ret?.reason || 'unknown',
      reasonDetails: ret?.reasonDetails || ret?.reason_details || '',
      refundAmount: Number(ret?.refundAmount ?? ret?.refund_amount ?? 0),
      status: ret?.status || 'pending'
    };
  }

  getStatusClass(status: string): string {
    const map: { [key: string]: string } = {
      'pending': 'warning', 'under_review': 'info', 'approved': 'success',
      'rejected': 'danger', 'refunded': 'success'
    };
    return map[status] || 'secondary';
  }

  getStatusLabel(status: string): string {
    const map: { [key: string]: string } = {
      'pending': 'En attente', 'under_review': 'En révision', 'approved': 'Approuvé',
      'rejected': 'Refusé', 'refunded': 'Remboursé'
    };
    return map[status] || status;
  }

  getReasonLabel(reason: string): string {
    const map: { [key: string]: string } = {
      'wrong_size': 'Mauvaise taille', 'defective': 'Défectueux',
      'not_as_described': 'Non conforme', 'changed_mind': 'Changement d\'avis'
    };
    return map[reason] || reason;
  }
}
