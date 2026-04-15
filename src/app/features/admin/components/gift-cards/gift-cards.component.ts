import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';

interface GiftCard {
  id: number;
  code: string;
  initialValue: number;
  balance: number;
  status: 'active' | 'redeemed' | 'expired' | 'cancelled';
  isPromotional: boolean;
  recipientEmail?: string;
  purchasedAt: string;
  expiresAt: string;
  adminNotes?: string;
  transactions?: GiftCardTransaction[];
}

interface GiftCardTransaction {
  id: number;
  type: 'purchase' | 'redemption' | 'adjustment' | 'refund';
  amount: number;
  balanceAfter: number;
  description: string;
  orderId?: number;
  createdAt: string;
  createdBy?: string;
}

interface GiftCardStats {
  totalCards: number;
  totalValueOutstanding: number;
  byStatus: {
    active: number;
    redeemed: number;
    expired: number;
    cancelled: number;
  };
}

@Component({
  selector: 'app-admin-gift-cards',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-gift-cards">
      <div class="page-header">
        <h1>Gestion des cartes cadeaux</h1>
        <button class="btn-create" (click)="showCreateModal = true">
          <i class="fas fa-plus"></i> Nouvelle carte promotionnelle
        </button>
      </div>

      <!-- Statistics Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon blue">
            <i class="fas fa-gift"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ stats.totalCards }}</span>
            <span class="stat-label">Cartes emises</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">
            <i class="fas fa-wallet"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ stats.totalValueOutstanding.toFixed(3) }} TND</span>
            <span class="stat-label">Valeur en circulation</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple">
            <i class="fas fa-check-circle"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ stats.byStatus.active || 0 }}</span>
            <span class="stat-label">Cartes actives</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange">
            <i class="fas fa-shopping-cart"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ stats.byStatus.redeemed || 0 }}</span>
            <span class="stat-label">Entierement utilisees</span>
          </div>
        </div>
      </div>

      <!-- Filters Bar -->
      <div class="filters-bar">
        <div class="filter-group">
          <select [(ngModel)]="statusFilter" (change)="loadGiftCards()">
            <option value="">Tous les statuts</option>
            <option value="active">Actives</option>
            <option value="redeemed">Utilisees</option>
            <option value="expired">Expirees</option>
            <option value="cancelled">Annulees</option>
          </select>
        </div>
        <div class="filter-group">
          <select [(ngModel)]="typeFilter" (change)="loadGiftCards()">
            <option value="">Tous les types</option>
            <option value="promotional">Promotionnelles</option>
            <option value="purchased">Achetees</option>
          </select>
        </div>
        <div class="filter-group search">
          <i class="fas fa-search"></i>
          <input type="text"
                 [(ngModel)]="searchQuery"
                 placeholder="Rechercher par code..."
                 (keyup.enter)="loadGiftCards()">
        </div>
      </div>

      <!-- Gift Cards Table -->
      <div class="cards-table-container">
        <table class="cards-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Type</th>
              <th>Valeur initiale</th>
              <th>Solde</th>
              <th>Statut</th>
              <th>Date d'achat</th>
              <th>Expiration</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let card of giftCards" (click)="openDetailModal(card)" class="clickable-row">
              <td class="code-cell">
                <span class="gift-code">{{ card.code }}</span>
              </td>
              <td>
                <span class="type-badge" [class.promotional]="card.isPromotional" [class.purchased]="!card.isPromotional">
                  {{ card.isPromotional ? 'Promo' : 'Achat' }}
                </span>
              </td>
              <td>{{ card.initialValue.toFixed(3) }} TND</td>
              <td>
                <span class="balance" [class.low]="card.balance < card.initialValue * 0.2">
                  {{ card.balance.toFixed(3) }} TND
                </span>
              </td>
              <td>
                <span class="status-badge" [class]="getStatusClass(card.status)">
                  {{ getStatusLabel(card.status) }}
                </span>
              </td>
              <td>{{ formatDate(card.purchasedAt) }}</td>
              <td>
                <span [class.expiring-soon]="isExpiringSoon(card.expiresAt)">
                  {{ formatDate(card.expiresAt) }}
                </span>
              </td>
              <td class="actions-cell" (click)="$event.stopPropagation()">
                <button class="btn-action" title="Voir details" (click)="openDetailModal(card)">
                  <i class="fas fa-eye"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="empty-state" *ngIf="giftCards.length === 0 && !isLoading">
          <i class="fas fa-gift"></i>
          <p>Aucune carte cadeau trouvee</p>
        </div>

        <div class="loading-state" *ngIf="isLoading">
          <i class="fas fa-spinner fa-spin"></i>
          <p>Chargement...</p>
        </div>
      </div>

      <!-- Pagination -->
      <div class="pagination" *ngIf="totalPages > 1">
        <button class="btn-page" [disabled]="currentPage === 1" (click)="goToPage(currentPage - 1)">
          <i class="fas fa-chevron-left"></i>
        </button>
        <span class="page-info">Page {{ currentPage }} / {{ totalPages }}</span>
        <button class="btn-page" [disabled]="currentPage === totalPages" (click)="goToPage(currentPage + 1)">
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>

      <!-- Create Promotional Gift Card Modal -->
      <div class="modal-overlay" *ngIf="showCreateModal" (click)="showCreateModal = false">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Creer une carte cadeau promotionnelle</h2>
            <button class="btn-close" (click)="showCreateModal = false">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <form (ngSubmit)="createPromotionalCard()">
            <div class="form-group">
              <label>Montant (TND) *</label>
              <input type="number"
                     [(ngModel)]="newCard.amount"
                     name="amount"
                     required
                     min="1"
                     step="0.001"
                     placeholder="Ex: 50.000">
            </div>
            <div class="form-group">
              <label>Email du destinataire (optionnel)</label>
              <input type="email"
                     [(ngModel)]="newCard.recipientEmail"
                     name="recipientEmail"
                     placeholder="client@example.com">
              <span class="form-hint">Si renseigne, un email sera envoye au destinataire</span>
            </div>
            <div class="form-group">
              <label>Date d'expiration</label>
              <input type="date"
                     [(ngModel)]="newCard.expiresAt"
                     name="expiresAt">
              <span class="form-hint">Par defaut: 1 an a partir d'aujourd'hui</span>
            </div>
            <div class="form-group">
              <label>Notes admin</label>
              <textarea [(ngModel)]="newCard.adminNotes"
                        name="adminNotes"
                        rows="3"
                        placeholder="Notes internes (ex: raison de la promotion)"></textarea>
            </div>
            <div class="form-actions">
              <button type="button" class="btn-cancel" (click)="showCreateModal = false">Annuler</button>
              <button type="submit" class="btn-submit" [disabled]="!newCard.amount">
                <i class="fas fa-gift"></i> Creer la carte
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Gift Card Detail Modal -->
      <div class="modal-overlay" *ngIf="showDetailModal && selectedCard" (click)="closeDetailModal()">
        <div class="modal-content detail-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Details de la carte cadeau</h2>
            <button class="btn-close" (click)="closeDetailModal()">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <div class="detail-content">
            <!-- Card Info Section -->
            <div class="card-info-section">
              <div class="card-visual">
                <div class="gift-card-preview" [class]="selectedCard.isPromotional ? 'promo' : 'purchased'">
                  <div class="card-brand">BARSHA</div>
                  <div class="card-code-display">{{ selectedCard.code }}</div>
                  <div class="card-balance-display">{{ selectedCard.balance.toFixed(3) }} TND</div>
                </div>
              </div>

              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Code</span>
                  <span class="info-value code">{{ selectedCard.code }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Type</span>
                  <span class="info-value">{{ selectedCard.isPromotional ? 'Promotionnelle' : 'Achetee' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Valeur initiale</span>
                  <span class="info-value">{{ selectedCard.initialValue.toFixed(3) }} TND</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Solde actuel</span>
                  <span class="info-value highlight">{{ selectedCard.balance.toFixed(3) }} TND</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Statut</span>
                  <span class="info-value">
                    <span class="status-badge" [class]="getStatusClass(selectedCard.status)">
                      {{ getStatusLabel(selectedCard.status) }}
                    </span>
                  </span>
                </div>
                <div class="info-item">
                  <span class="info-label">Date d'emission</span>
                  <span class="info-value">{{ formatDateTime(selectedCard.purchasedAt) }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Expiration</span>
                  <span class="info-value" [class.expiring-soon]="isExpiringSoon(selectedCard.expiresAt)">
                    {{ formatDateTime(selectedCard.expiresAt) }}
                  </span>
                </div>
                <div class="info-item" *ngIf="selectedCard.recipientEmail">
                  <span class="info-label">Email destinataire</span>
                  <span class="info-value">{{ selectedCard.recipientEmail }}</span>
                </div>
                <div class="info-item full-width" *ngIf="selectedCard.adminNotes">
                  <span class="info-label">Notes admin</span>
                  <span class="info-value">{{ selectedCard.adminNotes }}</span>
                </div>
              </div>
            </div>

            <!-- Transaction History Section -->
            <div class="transactions-section">
              <h3><i class="fas fa-history"></i> Historique des transactions</h3>
              <div class="transactions-list" *ngIf="selectedCard.transactions && selectedCard.transactions.length > 0">
                <div class="transaction-item" *ngFor="let tx of selectedCard.transactions">
                  <div class="tx-icon" [class]="getTxTypeClass(tx.type)">
                    <i [class]="getTxTypeIcon(tx.type)"></i>
                  </div>
                  <div class="tx-details">
                    <span class="tx-description">{{ tx.description }}</span>
                    <span class="tx-date">{{ formatDateTime(tx.createdAt) }}</span>
                    <span class="tx-by" *ngIf="tx.createdBy">par {{ tx.createdBy }}</span>
                  </div>
                  <div class="tx-amount" [class.positive]="tx.amount > 0" [class.negative]="tx.amount < 0">
                    {{ tx.amount > 0 ? '+' : '' }}{{ tx.amount.toFixed(3) }} TND
                  </div>
                  <div class="tx-balance">
                    Solde: {{ tx.balanceAfter.toFixed(3) }} TND
                  </div>
                </div>
              </div>
              <div class="no-transactions" *ngIf="!selectedCard.transactions || selectedCard.transactions.length === 0">
                <p>Aucune transaction enregistree</p>
              </div>
            </div>

            <!-- Actions Section -->
            <div class="actions-section" *ngIf="selectedCard.status === 'active'">
              <h3><i class="fas fa-tools"></i> Actions</h3>

              <!-- Balance Adjustment Form -->
              <div class="action-card">
                <h4>Ajuster le solde</h4>
                <div class="adjustment-form">
                  <div class="form-row">
                    <div class="form-group">
                      <label>Type d'ajustement</label>
                      <select [(ngModel)]="adjustment.type">
                        <option value="add">Ajouter</option>
                        <option value="subtract">Deduire</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label>Montant (TND)</label>
                      <input type="number" [(ngModel)]="adjustment.amount" min="0.001" step="0.001">
                    </div>
                  </div>
                  <div class="form-group">
                    <label>Raison</label>
                    <input type="text" [(ngModel)]="adjustment.reason" placeholder="Raison de l'ajustement">
                  </div>
                  <button class="btn-action-submit" (click)="adjustBalance()" [disabled]="!adjustment.amount || !adjustment.reason">
                    <i class="fas fa-balance-scale"></i> Appliquer l'ajustement
                  </button>
                </div>
              </div>

              <!-- Status Change Actions -->
              <div class="action-card">
                <h4>Modifier le statut</h4>
                <div class="status-actions">
                  <button class="btn-extend" (click)="showExtendModal = true">
                    <i class="fas fa-calendar-plus"></i> Prolonger l'expiration
                  </button>
                  <button class="btn-cancel-card" (click)="cancelCard()">
                    <i class="fas fa-ban"></i> Annuler la carte
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Extend Expiry Modal -->
      <div class="modal-overlay sub-modal" *ngIf="showExtendModal" (click)="showExtendModal = false">
        <div class="modal-content small" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Prolonger l'expiration</h2>
            <button class="btn-close" (click)="showExtendModal = false">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="form-group">
            <label>Nouvelle date d'expiration</label>
            <input type="date" [(ngModel)]="newExpiryDate" [min]="getMinExpiryDate()">
          </div>
          <div class="form-actions">
            <button type="button" class="btn-cancel" (click)="showExtendModal = false">Annuler</button>
            <button type="button" class="btn-submit" (click)="extendExpiry()" [disabled]="!newExpiryDate">
              <i class="fas fa-calendar-check"></i> Confirmer
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-gift-cards { max-width: 1400px; }

    /* Page Header */
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 600; color: #1a1a2e; margin: 0; }
    .btn-create { padding: 10px 20px; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; border: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 500; transition: transform 0.2s, box-shadow 0.2s; }
    .btn-create:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); }

    /* Statistics Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 24px; }
    .stat-card { background: #fff; border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
    .stat-icon.blue { background: #e3f2fd; color: #1976d2; }
    .stat-icon.green { background: #e8f5e9; color: #388e3c; }
    .stat-icon.purple { background: #f3e5f5; color: #7b1fa2; }
    .stat-icon.orange { background: #fff3e0; color: #f57c00; }
    .stat-content { display: flex; flex-direction: column; }
    .stat-value { font-size: 24px; font-weight: 700; color: #1a1a2e; }
    .stat-label { font-size: 13px; color: #888; }

    /* Filters Bar */
    .filters-bar { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .filter-group select { padding: 10px 16px; border: 1px solid #e0e0e0; border-radius: 8px; background: #fff; font-size: 14px; min-width: 160px; }
    .filter-group.search { position: relative; flex: 1; min-width: 200px; }
    .filter-group.search i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #888; }
    .filter-group.search input { width: 100%; padding: 10px 16px 10px 36px; border: 1px solid #e0e0e0; border-radius: 8px; }

    /* Table */
    .cards-table-container { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .cards-table { width: 100%; border-collapse: collapse; }
    .cards-table th { padding: 14px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #888; text-transform: uppercase; background: #f8f9fa; border-bottom: 1px solid #e0e0e0; }
    .cards-table td { padding: 14px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
    .clickable-row { cursor: pointer; transition: background 0.2s; }
    .clickable-row:hover { background: #f8f9fa; }
    .code-cell .gift-code { font-family: monospace; font-weight: 600; color: #667eea; letter-spacing: 1px; }
    .type-badge { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .type-badge.promotional { background: #f3e5f5; color: #7b1fa2; }
    .type-badge.purchased { background: #e3f2fd; color: #1976d2; }
    .balance { font-weight: 600; }
    .balance.low { color: #f57c00; }
    .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .status-badge.active { background: #d4edda; color: #155724; }
    .status-badge.redeemed { background: #d1ecf1; color: #0c5460; }
    .status-badge.expired { background: #f8d7da; color: #721c24; }
    .status-badge.cancelled { background: #e2e3e5; color: #383d41; }
    .expiring-soon { color: #f57c00; font-weight: 500; }
    .actions-cell { text-align: center; }
    .btn-action { padding: 8px 12px; background: #f0f0f0; border: none; border-radius: 6px; cursor: pointer; transition: background 0.2s; }
    .btn-action:hover { background: #e0e0e0; }

    /* Empty & Loading States */
    .empty-state, .loading-state { text-align: center; padding: 60px; color: #888; }
    .empty-state i, .loading-state i { font-size: 40px; margin-bottom: 16px; opacity: 0.5; }

    /* Pagination */
    .pagination { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 24px; }
    .btn-page { padding: 8px 16px; border: 1px solid #e0e0e0; background: #fff; border-radius: 6px; cursor: pointer; }
    .btn-page:disabled { opacity: 0.5; cursor: not-allowed; }
    .page-info { font-size: 14px; color: #666; }

    /* Modals */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-overlay.sub-modal { z-index: 1100; }
    .modal-content { background: #fff; border-radius: 12px; width: 90%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
    .modal-content.detail-modal { max-width: 800px; }
    .modal-content.small { max-width: 400px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid #f0f0f0; }
    .modal-header h2 { margin: 0; font-size: 18px; font-weight: 600; }
    .btn-close { background: none; border: none; font-size: 18px; color: #888; cursor: pointer; }

    /* Form Styles */
    .form-group { padding: 0 24px; margin-bottom: 16px; }
    .form-group label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; color: #555; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px 12px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box; }
    .form-group textarea { resize: vertical; }
    .form-hint { display: block; margin-top: 4px; font-size: 12px; color: #888; }
    .form-row { display: flex; gap: 16px; padding: 0 24px; margin-bottom: 16px; }
    .form-row .form-group { flex: 1; padding: 0; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; padding: 20px 24px; border-top: 1px solid #f0f0f0; }
    .btn-cancel { padding: 10px 20px; border: 1px solid #e0e0e0; background: #fff; border-radius: 8px; cursor: pointer; font-size: 14px; }
    .btn-submit { padding: 10px 20px; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 8px; }
    .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Detail Modal Content */
    .detail-content { padding: 24px; }
    .card-info-section { display: flex; gap: 24px; margin-bottom: 24px; flex-wrap: wrap; }
    .card-visual { flex: 0 0 280px; }
    .gift-card-preview { background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 16px; padding: 24px; color: #fff; aspect-ratio: 1.6; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3); }
    .gift-card-preview.promo { background: linear-gradient(135deg, #7b1fa2, #e91e63); }
    .gift-card-preview.purchased { background: linear-gradient(135deg, #1976d2, #00bcd4); }
    .card-brand { font-size: 20px; font-weight: 700; letter-spacing: 2px; }
    .card-code-display { font-family: monospace; font-size: 18px; letter-spacing: 3px; }
    .card-balance-display { font-size: 28px; font-weight: 700; }
    .info-grid { flex: 1; display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .info-item { display: flex; flex-direction: column; }
    .info-item.full-width { grid-column: span 2; }
    .info-label { font-size: 12px; color: #888; margin-bottom: 4px; }
    .info-value { font-size: 14px; color: #1a1a2e; }
    .info-value.code { font-family: monospace; font-weight: 600; color: #667eea; }
    .info-value.highlight { font-weight: 700; color: #27ae60; font-size: 16px; }

    /* Transactions Section */
    .transactions-section { margin-bottom: 24px; }
    .transactions-section h3 { font-size: 16px; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px; }
    .transactions-list { border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
    .transaction-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #f0f0f0; }
    .transaction-item:last-child { border-bottom: none; }
    .tx-icon { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; }
    .tx-icon.purchase { background: #e8f5e9; color: #388e3c; }
    .tx-icon.redemption { background: #fff3e0; color: #f57c00; }
    .tx-icon.adjustment { background: #e3f2fd; color: #1976d2; }
    .tx-icon.refund { background: #f3e5f5; color: #7b1fa2; }
    .tx-details { flex: 1; display: flex; flex-direction: column; }
    .tx-description { font-size: 14px; font-weight: 500; }
    .tx-date { font-size: 12px; color: #888; }
    .tx-by { font-size: 11px; color: #aaa; }
    .tx-amount { font-weight: 600; min-width: 80px; text-align: right; }
    .tx-amount.positive { color: #388e3c; }
    .tx-amount.negative { color: #e74c3c; }
    .tx-balance { font-size: 12px; color: #888; min-width: 100px; text-align: right; }
    .no-transactions { padding: 24px; text-align: center; color: #888; background: #f8f9fa; border-radius: 8px; }

    /* Actions Section */
    .actions-section h3 { font-size: 16px; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px; }
    .action-card { background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .action-card h4 { margin: 0 0 12px 0; font-size: 14px; color: #555; }
    .adjustment-form .form-row { padding: 0; }
    .adjustment-form .form-group { padding: 0; margin-bottom: 12px; }
    .btn-action-submit { padding: 10px 20px; background: #667eea; color: #fff; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .btn-action-submit:disabled { opacity: 0.5; cursor: not-allowed; }
    .status-actions { display: flex; gap: 12px; flex-wrap: wrap; }
    .btn-extend { padding: 10px 16px; background: #27ae60; color: #fff; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 13px; }
    .btn-cancel-card { padding: 10px 16px; background: #e74c3c; color: #fff; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 13px; }

    @media (max-width: 768px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .filters-bar { flex-direction: column; }
      .cards-table-container { overflow-x: auto; }
      .card-info-section { flex-direction: column; }
      .card-visual { flex: none; width: 100%; max-width: 300px; }
      .info-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class AdminGiftCardsComponent implements OnInit {
  giftCards: GiftCard[] = [];
  isLoading = false;

  // Filters
  statusFilter = '';
  typeFilter = '';
  searchQuery = '';

  // Pagination
  currentPage = 1;
  totalPages = 1;
  pageSize = 20;

  // Statistics
  stats: GiftCardStats = {
    totalCards: 0,
    totalValueOutstanding: 0,
    byStatus: { active: 0, redeemed: 0, expired: 0, cancelled: 0 }
  };

  // Modals
  showCreateModal = false;
  showDetailModal = false;
  showExtendModal = false;

  // Selected card for detail view
  selectedCard: GiftCard | null = null;

  // New promotional card form
  newCard = {
    amount: null as number | null,
    recipientEmail: '',
    expiresAt: '',
    adminNotes: ''
  };

  // Balance adjustment form
  adjustment = {
    type: 'add' as 'add' | 'subtract',
    amount: null as number | null,
    reason: ''
  };

  // Extend expiry
  newExpiryDate = '';

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadGiftCards();
    this.loadStats();
  }

  loadGiftCards(): void {
    this.isLoading = true;
    const params: any = {
      page: this.currentPage,
      limit: this.pageSize
    };

    if (this.statusFilter) params.status = this.statusFilter;
    if (this.typeFilter) params.type = this.typeFilter;
    if (this.searchQuery) params.search = this.searchQuery;

    this.adminService.getGiftCards(params).subscribe({
      next: (response) => {
        this.giftCards = response.items;
        this.totalPages = response.pages || 1;
        this.isLoading = false;
      },
      error: () => {
        this.giftCards = this.getMockGiftCards();
        this.isLoading = false;
      }
    });
  }

  loadStats(): void {
    this.adminService.getGiftCardStats().subscribe({
      next: (stats) => {
        this.stats = stats;
      },
      error: () => {
        this.stats = this.getMockStats();
      }
    });
  }

  createPromotionalCard(): void {
    if (!this.newCard.amount) return;

    this.adminService.createGiftCard({
      amount: this.newCard.amount,
      recipient_email: this.newCard.recipientEmail || undefined,
      expires_at: this.newCard.expiresAt || undefined,
      admin_notes: this.newCard.adminNotes || undefined,
      is_promotional: true
    }).subscribe({
      next: () => {
        this.showCreateModal = false;
        this.resetNewCard();
        this.loadGiftCards();
        this.loadStats();
      },
      error: (err) => {
        console.error('Error creating gift card:', err);
        alert('Erreur lors de la creation de la carte cadeau');
      }
    });
  }

  openDetailModal(card: GiftCard): void {
    this.selectedCard = card;
    this.showDetailModal = true;
    this.loadCardTransactions(card.id);
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedCard = null;
    this.resetAdjustment();
  }

  loadCardTransactions(cardId: number): void {
    this.adminService.getGiftCardTransactions(cardId).subscribe({
      next: (transactions) => {
        if (this.selectedCard) {
          this.selectedCard.transactions = transactions;
        }
      },
      error: () => {
        if (this.selectedCard) {
          this.selectedCard.transactions = this.getMockTransactions();
        }
      }
    });
  }

  adjustBalance(): void {
    if (!this.selectedCard || !this.adjustment.amount || !this.adjustment.reason) return;

    const amount = this.adjustment.type === 'subtract'
      ? -Math.abs(this.adjustment.amount)
      : Math.abs(this.adjustment.amount);

    this.adminService.adjustGiftCardBalance(this.selectedCard.id, {
      amount,
      reason: this.adjustment.reason
    }).subscribe({
      next: (updatedCard) => {
        if (this.selectedCard) {
          this.selectedCard.balance = updatedCard.balance;
          this.loadCardTransactions(this.selectedCard.id);
        }
        this.resetAdjustment();
        this.loadStats();
      },
      error: (err) => {
        console.error('Error adjusting balance:', err);
        alert('Erreur lors de l\'ajustement du solde');
      }
    });
  }

  extendExpiry(): void {
    if (!this.selectedCard || !this.newExpiryDate) return;

    this.adminService.updateGiftCard(this.selectedCard.id, {
      expires_at: this.newExpiryDate
    }).subscribe({
      next: (updatedCard) => {
        if (this.selectedCard) {
          this.selectedCard.expiresAt = updatedCard.expiresAt;
        }
        this.showExtendModal = false;
        this.newExpiryDate = '';
      },
      error: (err) => {
        console.error('Error extending expiry:', err);
        alert('Erreur lors de la prolongation');
      }
    });
  }

  cancelCard(): void {
    if (!this.selectedCard) return;

    if (!confirm('Etes-vous sur de vouloir annuler cette carte cadeau? Cette action est irreversible.')) {
      return;
    }

    this.adminService.updateGiftCard(this.selectedCard.id, {
      status: 'cancelled'
    }).subscribe({
      next: () => {
        if (this.selectedCard) {
          this.selectedCard.status = 'cancelled';
        }
        this.loadGiftCards();
        this.loadStats();
      },
      error: (err) => {
        console.error('Error cancelling card:', err);
        alert('Erreur lors de l\'annulation');
      }
    });
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.loadGiftCards();
  }

  // Helpers
  getStatusClass(status: string): string {
    return status;
  }

  getStatusLabel(status: string): string {
    const map: { [key: string]: string } = {
      'active': 'Active',
      'redeemed': 'Utilisee',
      'expired': 'Expiree',
      'cancelled': 'Annulee'
    };
    return map[status] || status;
  }

  getTxTypeClass(type: string): string {
    return type;
  }

  getTxTypeIcon(type: string): string {
    const map: { [key: string]: string } = {
      'purchase': 'fas fa-plus-circle',
      'redemption': 'fas fa-shopping-bag',
      'adjustment': 'fas fa-sliders-h',
      'refund': 'fas fa-undo'
    };
    return map[type] || 'fas fa-circle';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-TN');
  }

  formatDateTime(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('fr-TN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  isExpiringSoon(dateStr: string): boolean {
    if (!dateStr) return false;
    const expiryDate = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays > 0;
  }

  getMinExpiryDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  private resetNewCard(): void {
    this.newCard = {
      amount: null,
      recipientEmail: '',
      expiresAt: '',
      adminNotes: ''
    };
  }

  private resetAdjustment(): void {
    this.adjustment = {
      type: 'add',
      amount: null,
      reason: ''
    };
  }

  // Mock data for demo mode
  private getMockGiftCards(): GiftCard[] {
    return [
      {
        id: 1,
        code: 'BARSHA-GIFT-A1B2C3',
        initialValue: 100.000,
        balance: 75.500,
        status: 'active',
        isPromotional: false,
        purchasedAt: '2024-01-15T10:30:00',
        expiresAt: '2025-01-15T23:59:59',
        recipientEmail: 'client@example.com'
      },
      {
        id: 2,
        code: 'PROMO-SPRING-2024',
        initialValue: 50.000,
        balance: 50.000,
        status: 'active',
        isPromotional: true,
        purchasedAt: '2024-03-01T09:00:00',
        expiresAt: '2024-06-30T23:59:59',
        adminNotes: 'Promotion printemps 2024'
      },
      {
        id: 3,
        code: 'BARSHA-GIFT-D4E5F6',
        initialValue: 200.000,
        balance: 0,
        status: 'redeemed',
        isPromotional: false,
        purchasedAt: '2023-12-20T14:00:00',
        expiresAt: '2024-12-20T23:59:59'
      },
      {
        id: 4,
        code: 'BARSHA-GIFT-G7H8I9',
        initialValue: 75.000,
        balance: 75.000,
        status: 'expired',
        isPromotional: false,
        purchasedAt: '2023-01-10T11:00:00',
        expiresAt: '2024-01-10T23:59:59'
      }
    ];
  }

  private getMockStats(): GiftCardStats {
    return {
      totalCards: 156,
      totalValueOutstanding: 8750.500,
      byStatus: {
        active: 89,
        redeemed: 45,
        expired: 18,
        cancelled: 4
      }
    };
  }

  private getMockTransactions(): GiftCardTransaction[] {
    return [
      {
        id: 1,
        type: 'purchase',
        amount: 100.000,
        balanceAfter: 100.000,
        description: 'Achat de carte cadeau',
        createdAt: '2024-01-15T10:30:00'
      },
      {
        id: 2,
        type: 'redemption',
        amount: -24.500,
        balanceAfter: 75.500,
        description: 'Utilisation sur commande #ORD-2024-0125',
        orderId: 125,
        createdAt: '2024-02-01T15:45:00'
      }
    ];
  }
}
