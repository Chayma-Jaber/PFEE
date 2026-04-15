import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { catchError, of } from 'rxjs';

interface LoyaltyAccount {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  availablePoints: number;
  totalEarned: number;
  totalRedeemed: number;
  memberSince: string;
  lastActivity: string;
  isActive: boolean;
}

interface LoyaltyTransaction {
  id: number;
  type: 'earn' | 'redeem' | 'expire' | 'adjustment' | 'bonus';
  points: number;
  description: string;
  orderId?: number;
  createdAt: string;
  createdBy?: string;
}

interface LoyaltyStats {
  totalMembers: number;
  membersByTier: {
    Bronze: number;
    Silver: number;
    Gold: number;
    Platinum: number;
  };
  totalPointsIssued: number;
  totalPointsRedeemed: number;
  totalPointsExpired: number;
  activePointsBalance: number;
}

@Component({
  selector: 'app-admin-loyalty',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-loyalty">
      <div class="page-header">
        <div class="header-left">
          <h1>Programme de Fidelite</h1>
          <span class="subtitle">Gestion des comptes et points de fidelite</span>
        </div>
        <div class="header-actions">
          <button class="btn-export" (click)="exportLoyaltyData()">
            <i class="fas fa-download"></i> Exporter CSV
          </button>
          <button class="btn-refresh" (click)="loadAll()">
            <i class="fas fa-sync-alt" [class.spinning]="isLoading"></i>
          </button>
        </div>
      </div>

      <!-- Statistics Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon total">
            <i class="fas fa-users"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ stats?.totalMembers || 0 }}</span>
            <span class="stat-label">Total Membres</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon bronze">
            <i class="fas fa-medal"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ stats?.membersByTier?.Bronze || 0 }}</span>
            <span class="stat-label">Bronze</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon silver">
            <i class="fas fa-medal"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ stats?.membersByTier?.Silver || 0 }}</span>
            <span class="stat-label">Silver</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon gold">
            <i class="fas fa-medal"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ stats?.membersByTier?.Gold || 0 }}</span>
            <span class="stat-label">Gold</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon platinum">
            <i class="fas fa-gem"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ stats?.membersByTier?.Platinum || 0 }}</span>
            <span class="stat-label">Platinum</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon issued">
            <i class="fas fa-coins"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ formatNumber(stats?.totalPointsIssued || 0) }}</span>
            <span class="stat-label">Points Emis</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon redeemed">
            <i class="fas fa-gift"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ formatNumber(stats?.totalPointsRedeemed || 0) }}</span>
            <span class="stat-label">Points Utilises</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon active">
            <i class="fas fa-wallet"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ formatNumber(stats?.activePointsBalance || 0) }}</span>
            <span class="stat-label">Solde Actif</span>
          </div>
        </div>
      </div>

      <!-- Filters Bar -->
      <div class="filters-bar">
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input type="text"
                 [(ngModel)]="searchQuery"
                 placeholder="Rechercher par nom ou email..."
                 (keyup.enter)="loadAccounts()">
        </div>

        <select [(ngModel)]="tierFilter" (change)="loadAccounts()" class="filter-select">
          <option value="">Tous les niveaux</option>
          <option value="Bronze">Bronze</option>
          <option value="Silver">Silver</option>
          <option value="Gold">Gold</option>
          <option value="Platinum">Platinum</option>
        </select>

        <select [(ngModel)]="sortBy" (change)="loadAccounts()" class="filter-select">
          <option value="points_desc">Points (decroissant)</option>
          <option value="points_asc">Points (croissant)</option>
          <option value="recent">Plus recent</option>
          <option value="oldest">Plus ancien</option>
        </select>
      </div>

      <!-- Accounts Table -->
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Membre</th>
              <th>Email</th>
              <th>Niveau</th>
              <th>Points Disponibles</th>
              <th>Total Gagne</th>
              <th>Membre Depuis</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let account of accounts" (click)="openAccountDetails(account)">
              <td>
                <div class="member-info">
                  <div class="member-avatar" [class]="'tier-' + account.tier.toLowerCase()">
                    {{ getInitials(account.userName) }}
                  </div>
                  <span class="member-name">{{ account.userName }}</span>
                </div>
              </td>
              <td class="email">{{ account.userEmail }}</td>
              <td>
                <span class="tier-badge" [class]="'tier-' + account.tier.toLowerCase()">
                  <i class="fas" [class.fa-medal]="account.tier !== 'Platinum'" [class.fa-gem]="account.tier === 'Platinum'"></i>
                  {{ account.tier }}
                </span>
              </td>
              <td class="points">
                <span class="points-value">{{ formatNumber(account.availablePoints) }}</span>
                <span class="points-label">pts</span>
              </td>
              <td class="points">
                <span class="points-value total">{{ formatNumber(account.totalEarned) }}</span>
                <span class="points-label">pts</span>
              </td>
              <td class="date">{{ formatDate(account.memberSince) }}</td>
              <td class="actions" (click)="$event.stopPropagation()">
                <button class="btn-icon" (click)="openAccountDetails(account)" title="Voir details">
                  <i class="fas fa-eye"></i>
                </button>
                <button class="btn-icon adjust" (click)="openAdjustModal(account)" title="Ajuster points">
                  <i class="fas fa-edit"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="empty-state" *ngIf="accounts.length === 0 && !isLoading">
          <i class="fas fa-users-slash"></i>
          <p>Aucun compte de fidelite trouve</p>
        </div>

        <div class="loading-state" *ngIf="isLoading">
          <div class="spinner"></div>
          <p>Chargement...</p>
        </div>
      </div>

      <!-- Pagination -->
      <div class="pagination" *ngIf="totalPages > 1">
        <button (click)="changePage(currentPage - 1)" [disabled]="currentPage === 1">
          <i class="fas fa-chevron-left"></i>
        </button>
        <span class="page-info">Page {{ currentPage }} sur {{ totalPages }}</span>
        <button (click)="changePage(currentPage + 1)" [disabled]="currentPage === totalPages">
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>

      <!-- Account Details Modal -->
      <div class="modal-overlay" *ngIf="showDetailsModal" (click)="closeModals()">
        <div class="modal-content details-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Details du Compte Fidelite</h2>
            <button class="btn-close" (click)="closeModals()">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <div class="modal-body" *ngIf="selectedAccount">
            <!-- Account Info Section -->
            <div class="account-header">
              <div class="account-avatar" [class]="'tier-' + selectedAccount.tier.toLowerCase()">
                {{ getInitials(selectedAccount.userName) }}
              </div>
              <div class="account-info">
                <h3>{{ selectedAccount.userName }}</h3>
                <p>{{ selectedAccount.userEmail }}</p>
                <span class="tier-badge large" [class]="'tier-' + selectedAccount.tier.toLowerCase()">
                  <i class="fas" [class.fa-medal]="selectedAccount.tier !== 'Platinum'" [class.fa-gem]="selectedAccount.tier === 'Platinum'"></i>
                  {{ selectedAccount.tier }}
                </span>
              </div>
            </div>

            <div class="account-stats">
              <div class="stat-item">
                <span class="stat-number">{{ formatNumber(selectedAccount.availablePoints) }}</span>
                <span class="stat-text">Points Disponibles</span>
              </div>
              <div class="stat-item">
                <span class="stat-number">{{ formatNumber(selectedAccount.totalEarned) }}</span>
                <span class="stat-text">Total Gagne</span>
              </div>
              <div class="stat-item">
                <span class="stat-number">{{ formatNumber(selectedAccount.totalRedeemed) }}</span>
                <span class="stat-text">Total Utilise</span>
              </div>
            </div>

            <div class="account-meta">
              <div class="meta-item">
                <i class="fas fa-calendar-plus"></i>
                <span>Membre depuis: {{ formatDate(selectedAccount.memberSince) }}</span>
              </div>
              <div class="meta-item">
                <i class="fas fa-clock"></i>
                <span>Derniere activite: {{ formatDate(selectedAccount.lastActivity) }}</span>
              </div>
              <div class="meta-item">
                <i class="fas" [class.fa-check-circle]="selectedAccount.isActive" [class.fa-times-circle]="!selectedAccount.isActive"></i>
                <span>Statut: {{ selectedAccount.isActive ? 'Actif' : 'Inactif' }}</span>
              </div>
            </div>

            <!-- Transaction History -->
            <div class="transactions-section">
              <div class="section-header">
                <h4>Historique des Transactions</h4>
                <button class="btn-small" (click)="loadTransactions(selectedAccount.id)">
                  <i class="fas fa-sync-alt"></i> Actualiser
                </button>
              </div>

              <div class="transactions-list" *ngIf="transactions.length > 0">
                <div class="transaction-item" *ngFor="let tx of transactions" [class]="'type-' + tx.type">
                  <div class="tx-icon">
                    <i class="fas" [class]="getTransactionIcon(tx.type)"></i>
                  </div>
                  <div class="tx-details">
                    <span class="tx-description">{{ tx.description }}</span>
                    <span class="tx-date">{{ formatDateTime(tx.createdAt) }}</span>
                    <span class="tx-by" *ngIf="tx.createdBy">Par: {{ tx.createdBy }}</span>
                  </div>
                  <div class="tx-points" [class.positive]="tx.points > 0" [class.negative]="tx.points < 0">
                    {{ tx.points > 0 ? '+' : '' }}{{ formatNumber(tx.points) }} pts
                  </div>
                </div>
              </div>

              <div class="no-transactions" *ngIf="transactions.length === 0 && !isLoadingTransactions">
                <p>Aucune transaction trouvee</p>
              </div>

              <div class="loading-transactions" *ngIf="isLoadingTransactions">
                <div class="spinner small"></div>
              </div>
            </div>

            <!-- Quick Adjust Button -->
            <div class="modal-actions">
              <button class="btn-secondary" (click)="closeModals()">Fermer</button>
              <button class="btn-primary" (click)="openAdjustFromDetails()">
                <i class="fas fa-edit"></i> Ajuster les Points
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Points Adjustment Modal -->
      <div class="modal-overlay" *ngIf="showAdjustModal" (click)="closeModals()">
        <div class="modal-content adjust-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Ajustement Manuel des Points</h2>
            <button class="btn-close" (click)="closeModals()">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <div class="modal-body" *ngIf="selectedAccount">
            <div class="adjust-account-info">
              <span class="account-name">{{ selectedAccount.userName }}</span>
              <span class="account-balance">Solde actuel: <strong>{{ formatNumber(selectedAccount.availablePoints) }} pts</strong></span>
            </div>

            <form (ngSubmit)="submitAdjustment()">
              <div class="form-group">
                <label>Type d'Ajustement</label>
                <div class="adjust-type-buttons">
                  <button type="button"
                          class="type-btn add"
                          [class.active]="adjustmentForm.type === 'add'"
                          (click)="adjustmentForm.type = 'add'">
                    <i class="fas fa-plus-circle"></i> Ajouter
                  </button>
                  <button type="button"
                          class="type-btn remove"
                          [class.active]="adjustmentForm.type === 'remove'"
                          (click)="adjustmentForm.type = 'remove'">
                    <i class="fas fa-minus-circle"></i> Retirer
                  </button>
                </div>
              </div>

              <div class="form-group">
                <label for="adjustPoints">Nombre de Points</label>
                <input type="number"
                       id="adjustPoints"
                       [(ngModel)]="adjustmentForm.points"
                       name="points"
                       min="1"
                       required
                       placeholder="Ex: 500">
              </div>

              <div class="form-group">
                <label for="adjustReason">Raison de l'Ajustement</label>
                <textarea id="adjustReason"
                          [(ngModel)]="adjustmentForm.reason"
                          name="reason"
                          required
                          rows="3"
                          placeholder="Ex: Compensation pour probleme de livraison..."></textarea>
              </div>

              <div class="preview-box" *ngIf="adjustmentForm.points">
                <span class="preview-label">Nouveau Solde:</span>
                <span class="preview-value" [class.negative]="getNewBalance() < 0">
                  {{ formatNumber(getNewBalance()) }} pts
                </span>
              </div>

              <div class="form-actions">
                <button type="button" class="btn-cancel" (click)="closeModals()">Annuler</button>
                <button type="submit"
                        class="btn-submit"
                        [disabled]="!adjustmentForm.points || !adjustmentForm.reason || isSubmitting">
                  <span *ngIf="!isSubmitting">Confirmer l'Ajustement</span>
                  <span *ngIf="isSubmitting"><i class="fas fa-spinner fa-spin"></i> Traitement...</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Success/Error Toast -->
      <div class="toast" *ngIf="toastMessage" [class]="toastType">
        <i class="fas" [class.fa-check-circle]="toastType === 'success'" [class.fa-exclamation-circle]="toastType === 'error'"></i>
        {{ toastMessage }}
      </div>
    </div>
  `,
  styles: [`
    .admin-loyalty { max-width: 1400px; }

    /* Header */
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .header-left h1 { font-size: 24px; font-weight: 600; color: #1a1a2e; margin: 0 0 4px 0; }
    .header-left .subtitle { font-size: 14px; color: #666; }
    .header-actions { display: flex; gap: 12px; }
    .btn-export { padding: 10px 20px; background: #1a1a2e; color: #fff; border: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 14px; }
    .btn-export:hover { background: #2d2d4a; }
    .btn-refresh { padding: 10px 12px; background: #f0f0f0; border: none; border-radius: 8px; cursor: pointer; }
    .btn-refresh:hover { background: #e0e0e0; }
    .spinning { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    /* Stats Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: #fff; border-radius: 12px; padding: 16px; display: flex; align-items: center; gap: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .stat-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
    .stat-icon.total { background: #e8f4fd; color: #2196f3; }
    .stat-icon.bronze { background: #fff3e0; color: #cd7f32; }
    .stat-icon.silver { background: #f5f5f5; color: #9e9e9e; }
    .stat-icon.gold { background: #fff8e1; color: #ffc107; }
    .stat-icon.platinum { background: #ede7f6; color: #9c27b0; }
    .stat-icon.issued { background: #e3f2fd; color: #1976d2; }
    .stat-icon.redeemed { background: #fce4ec; color: #e91e63; }
    .stat-icon.active { background: #e8f5e9; color: #4caf50; }
    .stat-content { display: flex; flex-direction: column; }
    .stat-value { font-size: 20px; font-weight: 700; color: #1a1a2e; }
    .stat-label { font-size: 12px; color: #888; }

    /* Filters */
    .filters-bar { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .search-box { position: relative; flex: 1; min-width: 250px; }
    .search-box i { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #888; }
    .search-box input { width: 100%; padding: 12px 12px 12px 42px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; }
    .search-box input:focus { outline: none; border-color: #667eea; }
    .filter-select { padding: 12px 16px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; background: #fff; cursor: pointer; min-width: 180px; }
    .filter-select:focus { outline: none; border-color: #667eea; }

    /* Table */
    .table-container { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th, .data-table td { padding: 14px 16px; text-align: left; font-size: 13px; }
    .data-table th { background: #f8f9fa; font-weight: 600; color: #666; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
    .data-table tbody tr { cursor: pointer; transition: background 0.15s; }
    .data-table tbody tr:hover { background: #f8f9fa; }
    .data-table td { border-bottom: 1px solid #f0f0f0; }

    .member-info { display: flex; align-items: center; gap: 12px; }
    .member-avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 12px; color: #fff; }
    .member-avatar.tier-bronze { background: linear-gradient(135deg, #cd7f32, #b87333); }
    .member-avatar.tier-silver { background: linear-gradient(135deg, #c0c0c0, #a8a8a8); }
    .member-avatar.tier-gold { background: linear-gradient(135deg, #ffd700, #ffb700); }
    .member-avatar.tier-platinum { background: linear-gradient(135deg, #9c27b0, #7b1fa2); }
    .member-name { font-weight: 500; color: #1a1a2e; }

    .email { color: #666; font-size: 12px; }

    .tier-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .tier-badge.tier-bronze { background: #fff3e0; color: #cd7f32; }
    .tier-badge.tier-silver { background: #f5f5f5; color: #757575; }
    .tier-badge.tier-gold { background: #fff8e1; color: #f57c00; }
    .tier-badge.tier-platinum { background: #f3e5f5; color: #9c27b0; }
    .tier-badge.large { padding: 6px 16px; font-size: 13px; }

    .points { white-space: nowrap; }
    .points-value { font-weight: 700; color: #1a1a2e; font-size: 15px; }
    .points-value.total { color: #667eea; }
    .points-label { font-size: 11px; color: #888; margin-left: 4px; }

    .date { color: #666; font-size: 12px; }

    .actions { display: flex; gap: 8px; }
    .btn-icon { width: 32px; height: 32px; border: none; border-radius: 6px; cursor: pointer; background: #f0f0f0; color: #666; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
    .btn-icon:hover { background: #e0e0e0; color: #333; }
    .btn-icon.adjust { background: #e8f4fd; color: #2196f3; }
    .btn-icon.adjust:hover { background: #bbdefb; }

    /* Empty & Loading States */
    .empty-state, .loading-state { text-align: center; padding: 60px; color: #888; }
    .empty-state i, .loading-state i { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
    .spinner { width: 40px; height: 40px; border: 3px solid #f0f0f0; border-top-color: #667eea; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    .spinner.small { width: 24px; height: 24px; border-width: 2px; }

    /* Pagination */
    .pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 24px; padding: 16px; }
    .pagination button { padding: 10px 16px; border: 1px solid #e0e0e0; background: #fff; border-radius: 8px; cursor: pointer; }
    .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
    .pagination button:not(:disabled):hover { background: #f8f9fa; }
    .page-info { font-size: 14px; color: #666; }

    /* Modal Styles */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .modal-content { background: #fff; border-radius: 16px; width: 100%; max-height: 90vh; overflow-y: auto; }
    .details-modal { max-width: 700px; }
    .adjust-modal { max-width: 500px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid #f0f0f0; }
    .modal-header h2 { font-size: 18px; font-weight: 600; margin: 0; }
    .btn-close { width: 36px; height: 36px; border: none; background: #f0f0f0; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .btn-close:hover { background: #e0e0e0; }
    .modal-body { padding: 24px; }

    /* Account Details Modal */
    .account-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .account-avatar { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 20px; color: #fff; }
    .account-avatar.tier-bronze { background: linear-gradient(135deg, #cd7f32, #b87333); }
    .account-avatar.tier-silver { background: linear-gradient(135deg, #c0c0c0, #a8a8a8); }
    .account-avatar.tier-gold { background: linear-gradient(135deg, #ffd700, #ffb700); }
    .account-avatar.tier-platinum { background: linear-gradient(135deg, #9c27b0, #7b1fa2); }
    .account-info h3 { margin: 0 0 4px 0; font-size: 18px; }
    .account-info p { margin: 0 0 8px 0; color: #666; font-size: 14px; }

    .account-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .stat-item { background: #f8f9fa; border-radius: 10px; padding: 16px; text-align: center; }
    .stat-number { display: block; font-size: 24px; font-weight: 700; color: #1a1a2e; }
    .stat-text { display: block; font-size: 12px; color: #888; margin-top: 4px; }

    .account-meta { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; padding: 16px; background: #f8f9fa; border-radius: 10px; }
    .meta-item { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #666; }
    .meta-item i { width: 18px; color: #888; }
    .meta-item .fa-check-circle { color: #4caf50; }
    .meta-item .fa-times-circle { color: #f44336; }

    /* Transactions */
    .transactions-section { margin-bottom: 24px; }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .section-header h4 { margin: 0; font-size: 15px; font-weight: 600; }
    .btn-small { padding: 6px 12px; font-size: 12px; border: 1px solid #e0e0e0; background: #fff; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; }
    .btn-small:hover { background: #f8f9fa; }

    .transactions-list { max-height: 300px; overflow-y: auto; border: 1px solid #f0f0f0; border-radius: 10px; }
    .transaction-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #f0f0f0; }
    .transaction-item:last-child { border-bottom: none; }
    .tx-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
    .type-earn .tx-icon { background: #e8f5e9; color: #4caf50; }
    .type-redeem .tx-icon { background: #fce4ec; color: #e91e63; }
    .type-expire .tx-icon { background: #fff3e0; color: #ff9800; }
    .type-adjustment .tx-icon { background: #e3f2fd; color: #2196f3; }
    .type-bonus .tx-icon { background: #f3e5f5; color: #9c27b0; }
    .tx-details { flex: 1; }
    .tx-description { display: block; font-size: 13px; font-weight: 500; color: #1a1a2e; }
    .tx-date { display: block; font-size: 11px; color: #888; margin-top: 2px; }
    .tx-by { display: block; font-size: 11px; color: #667eea; margin-top: 2px; }
    .tx-points { font-weight: 700; font-size: 14px; }
    .tx-points.positive { color: #4caf50; }
    .tx-points.negative { color: #f44336; }

    .no-transactions, .loading-transactions { padding: 24px; text-align: center; color: #888; }

    .modal-actions { display: flex; justify-content: flex-end; gap: 12px; padding-top: 16px; border-top: 1px solid #f0f0f0; }
    .btn-secondary { padding: 10px 20px; border: 1px solid #e0e0e0; background: #fff; border-radius: 8px; cursor: pointer; font-size: 14px; }
    .btn-secondary:hover { background: #f8f9fa; }
    .btn-primary { padding: 10px 20px; background: #667eea; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 8px; }
    .btn-primary:hover { background: #5a6fd6; }

    /* Adjustment Modal */
    .adjust-account-info { background: #f8f9fa; padding: 16px; border-radius: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .account-name { font-weight: 600; color: #1a1a2e; }
    .account-balance { font-size: 13px; color: #666; }
    .account-balance strong { color: #667eea; }

    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; font-size: 13px; font-weight: 500; color: #333; }
    .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 12px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; }
    .form-group input:focus, .form-group textarea:focus { outline: none; border-color: #667eea; }
    .form-group textarea { resize: vertical; }

    .adjust-type-buttons { display: flex; gap: 12px; }
    .type-btn { flex: 1; padding: 14px; border: 2px solid #e0e0e0; background: #fff; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; font-weight: 500; transition: all 0.15s; }
    .type-btn.add { color: #4caf50; }
    .type-btn.add.active, .type-btn.add:hover { border-color: #4caf50; background: #e8f5e9; }
    .type-btn.remove { color: #f44336; }
    .type-btn.remove.active, .type-btn.remove:hover { border-color: #f44336; background: #ffebee; }

    .preview-box { background: #f0f4ff; border: 1px solid #667eea; border-radius: 10px; padding: 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .preview-label { font-size: 13px; color: #666; }
    .preview-value { font-size: 20px; font-weight: 700; color: #667eea; }
    .preview-value.negative { color: #f44336; }

    .form-actions { display: flex; justify-content: flex-end; gap: 12px; }
    .btn-cancel { padding: 12px 24px; border: 1px solid #e0e0e0; background: #fff; border-radius: 8px; cursor: pointer; font-size: 14px; }
    .btn-cancel:hover { background: #f8f9fa; }
    .btn-submit { padding: 12px 24px; background: #667eea; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
    .btn-submit:hover:not(:disabled) { background: #5a6fd6; }
    .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

    /* Toast */
    .toast { position: fixed; bottom: 24px; right: 24px; padding: 16px 24px; border-radius: 10px; display: flex; align-items: center; gap: 12px; font-size: 14px; font-weight: 500; z-index: 1100; animation: slideIn 0.3s ease; }
    .toast.success { background: #e8f5e9; color: #2e7d32; }
    .toast.error { background: #ffebee; color: #c62828; }
    @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

    /* Responsive */
    @media (max-width: 768px) {
      .page-header { flex-direction: column; gap: 16px; align-items: stretch; }
      .header-actions { justify-content: flex-end; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .filters-bar { flex-direction: column; }
      .filter-select { width: 100%; }
      .data-table th:nth-child(2), .data-table td:nth-child(2),
      .data-table th:nth-child(5), .data-table td:nth-child(5) { display: none; }
      .account-stats { grid-template-columns: 1fr; }
    }
  `]
})
export class AdminLoyaltyComponent implements OnInit {
  private apiUrl = 'http://localhost:8000/api';

  // Data
  accounts: LoyaltyAccount[] = [];
  stats: LoyaltyStats | null = null;
  transactions: LoyaltyTransaction[] = [];
  selectedAccount: LoyaltyAccount | null = null;

  // UI State
  isLoading = false;
  isLoadingTransactions = false;
  isSubmitting = false;
  showDetailsModal = false;
  showAdjustModal = false;

  // Filters & Pagination
  searchQuery = '';
  tierFilter = '';
  sortBy = 'points_desc';
  currentPage = 1;
  totalPages = 1;
  perPage = 15;

  // Adjustment Form
  adjustmentForm = {
    type: 'add' as 'add' | 'remove',
    points: null as number | null,
    reason: ''
  };

  // Toast
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadAll();
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('admin_jwt') || localStorage.getItem('jwt');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  loadAll(): void {
    this.loadStats();
    this.loadAccounts();
  }

  loadStats(): void {
    this.http.get<LoyaltyStats>(
      `${this.apiUrl}/admin/loyalty/stats`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(() => of(this.getMockStats()))
    ).subscribe(stats => {
      this.stats = stats;
    });
  }

  loadAccounts(): void {
    this.isLoading = true;

    let params = new HttpParams()
      .set('page', this.currentPage.toString())
      .set('per_page', this.perPage.toString())
      .set('sort', this.sortBy);

    if (this.searchQuery) {
      params = params.set('search', this.searchQuery);
    }
    if (this.tierFilter) {
      params = params.set('tier', this.tierFilter);
    }

    this.http.get<{ items: LoyaltyAccount[]; total: number; pages: number }>(
      `${this.apiUrl}/admin/loyalty/accounts`,
      { headers: this.getHeaders(), params }
    ).pipe(
      catchError(() => of({ items: this.getMockAccounts(), total: 5, pages: 1 }))
    ).subscribe(response => {
      this.accounts = response.items;
      this.totalPages = response.pages;
      this.isLoading = false;
    });
  }

  loadTransactions(accountId: number): void {
    this.isLoadingTransactions = true;

    this.http.get<LoyaltyTransaction[]>(
      `${this.apiUrl}/admin/loyalty/accounts/${accountId}/transactions`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(() => of(this.getMockTransactions()))
    ).subscribe(transactions => {
      this.transactions = transactions;
      this.isLoadingTransactions = false;
    });
  }

  openAccountDetails(account: LoyaltyAccount): void {
    this.selectedAccount = account;
    this.showDetailsModal = true;
    this.loadTransactions(account.id);
  }

  openAdjustModal(account: LoyaltyAccount): void {
    this.selectedAccount = account;
    this.adjustmentForm = { type: 'add', points: null, reason: '' };
    this.showAdjustModal = true;
  }

  openAdjustFromDetails(): void {
    this.showDetailsModal = false;
    setTimeout(() => {
      this.showAdjustModal = true;
      this.adjustmentForm = { type: 'add', points: null, reason: '' };
    }, 100);
  }

  closeModals(): void {
    this.showDetailsModal = false;
    this.showAdjustModal = false;
    this.transactions = [];
  }

  getNewBalance(): number {
    if (!this.selectedAccount || !this.adjustmentForm.points) return 0;
    const adjustment = this.adjustmentForm.type === 'add'
      ? this.adjustmentForm.points
      : -this.adjustmentForm.points;
    return this.selectedAccount.availablePoints + adjustment;
  }

  submitAdjustment(): void {
    if (!this.selectedAccount || !this.adjustmentForm.points || !this.adjustmentForm.reason) return;

    this.isSubmitting = true;
    const pointsValue = this.adjustmentForm.type === 'add'
      ? this.adjustmentForm.points
      : -this.adjustmentForm.points;

    this.http.post(
      `${this.apiUrl}/admin/loyalty/accounts/${this.selectedAccount.id}/adjust`,
      {
        points: pointsValue,
        reason: this.adjustmentForm.reason
      },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(err => {
        this.showToast('Erreur lors de l\'ajustement', 'error');
        this.isSubmitting = false;
        throw err;
      })
    ).subscribe(() => {
      this.showToast('Points ajustes avec succes', 'success');
      this.isSubmitting = false;
      this.closeModals();
      this.loadAll();
    });
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadAccounts();
    }
  }

  exportLoyaltyData(): void {
    window.open(`${this.apiUrl}/admin/loyalty/export/csv`, '_blank');
  }

  showToast(message: string, type: 'success' | 'error'): void {
    this.toastMessage = message;
    this.toastType = type;
    setTimeout(() => {
      this.toastMessage = '';
    }, 4000);
  }

  // Utility Functions
  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.split(' ');
    return parts.map(p => p.charAt(0)).slice(0, 2).join('').toUpperCase();
  }

  formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString('fr-FR');
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-TN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  formatDateTime(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-TN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getTransactionIcon(type: string): string {
    const icons: Record<string, string> = {
      'earn': 'fa-plus-circle',
      'redeem': 'fa-gift',
      'expire': 'fa-clock',
      'adjustment': 'fa-edit',
      'bonus': 'fa-star'
    };
    return icons[type] || 'fa-circle';
  }

  // Mock Data for Demo Mode
  private getMockStats(): LoyaltyStats {
    return {
      totalMembers: 3456,
      membersByTier: {
        Bronze: 2145,
        Silver: 892,
        Gold: 356,
        Platinum: 63
      },
      totalPointsIssued: 4567890,
      totalPointsRedeemed: 1234567,
      totalPointsExpired: 98765,
      activePointsBalance: 3234558
    };
  }

  private getMockAccounts(): LoyaltyAccount[] {
    return [
      { id: 1, userId: 101, userName: 'Sarra Ben Ali', userEmail: 'sarra.benali@email.com', tier: 'Platinum', availablePoints: 15420, totalEarned: 25800, totalRedeemed: 10380, memberSince: '2023-01-15', lastActivity: '2024-01-10', isActive: true },
      { id: 2, userId: 102, userName: 'Ahmed Khelifi', userEmail: 'ahmed.k@email.com', tier: 'Gold', availablePoints: 8750, totalEarned: 12500, totalRedeemed: 3750, memberSince: '2023-03-22', lastActivity: '2024-01-09', isActive: true },
      { id: 3, userId: 103, userName: 'Fatma Trabelsi', userEmail: 'fatma.t@email.com', tier: 'Gold', availablePoints: 6200, totalEarned: 9800, totalRedeemed: 3600, memberSince: '2023-05-10', lastActivity: '2024-01-08', isActive: true },
      { id: 4, userId: 104, userName: 'Mohamed Sassi', userEmail: 'med.sassi@email.com', tier: 'Silver', availablePoints: 3450, totalEarned: 5200, totalRedeemed: 1750, memberSince: '2023-06-18', lastActivity: '2024-01-05', isActive: true },
      { id: 5, userId: 105, userName: 'Nour Hammami', userEmail: 'nour.h@email.com', tier: 'Bronze', availablePoints: 850, totalEarned: 1200, totalRedeemed: 350, memberSince: '2023-11-02', lastActivity: '2024-01-03', isActive: true }
    ];
  }

  private getMockTransactions(): LoyaltyTransaction[] {
    return [
      { id: 1, type: 'earn', points: 500, description: 'Achat - Commande #12345', orderId: 12345, createdAt: '2024-01-10T14:30:00' },
      { id: 2, type: 'redeem', points: -200, description: 'Reduction appliquee sur commande #12340', orderId: 12340, createdAt: '2024-01-08T10:15:00' },
      { id: 3, type: 'bonus', points: 1000, description: 'Bonus anniversaire membre', createdAt: '2024-01-05T09:00:00' },
      { id: 4, type: 'adjustment', points: 250, description: 'Compensation service client', createdAt: '2024-01-03T16:45:00', createdBy: 'Admin' },
      { id: 5, type: 'earn', points: 320, description: 'Achat - Commande #12330', orderId: 12330, createdAt: '2024-01-01T11:20:00' }
    ];
  }
}
