import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-reviews">
      <div class="page-header">
        <div>
          <h1>Modération des avis</h1>
          <p>Gérez, approuvez ou rejetez les avis produits laissés par les clients</p>
        </div>
      </div>

      <div class="alert alert-success" *ngIf="successMessage">
        <i class="fas fa-check-circle"></i> {{ successMessage }}
      </div>
      <div class="alert alert-error" *ngIf="errorMessage">
        <i class="fas fa-exclamation-circle"></i> {{ errorMessage }}
      </div>

      <!-- Stats -->
      <div class="stats-grid" *ngIf="stats">
        <div class="stat-card">
          <div class="stat-icon total"><i class="fas fa-star"></i></div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.total }}</span>
            <span class="stat-label">Total avis</span>
          </div>
        </div>
        <div class="stat-card" (click)="filterStatus('approved')">
          <div class="stat-icon approved"><i class="fas fa-check-circle"></i></div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.approved }}</span>
            <span class="stat-label">Approuvés</span>
          </div>
        </div>
        <div class="stat-card" (click)="filterStatus('pending')">
          <div class="stat-icon pending"><i class="fas fa-clock"></i></div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.pending }}</span>
            <span class="stat-label">En attente</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon rating"><i class="fas fa-chart-line"></i></div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.averageRating }}/5</span>
            <span class="stat-label">Note moyenne</span>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="toolbar">
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input type="text" [(ngModel)]="searchQuery" (keyup.enter)="applyFilters()" placeholder="Rechercher dans titre ou commentaire..." />
        </div>
        <select [(ngModel)]="statusFilter" (change)="applyFilters()">
          <option value="">Tous statuts</option>
          <option value="approved">Approuvés</option>
          <option value="pending">En attente</option>
        </select>
        <select [(ngModel)]="ratingFilter" (change)="applyFilters()">
          <option value="">Toutes notes</option>
          <option value="5">5 étoiles</option>
          <option value="4">4 étoiles</option>
          <option value="3">3 étoiles</option>
          <option value="2">2 étoiles</option>
          <option value="1">1 étoile</option>
        </select>
        <button class="btn-refresh" (click)="loadReviews()"><i class="fas fa-sync"></i> Actualiser</button>
      </div>

      <div class="loading" *ngIf="isLoading">Chargement...</div>

      <!-- Reviews list -->
      <div class="reviews-list" *ngIf="!isLoading">
        <div class="review-card" *ngFor="let review of reviews">
          <div class="review-header">
            <div class="review-author">
              <div class="author-avatar">{{ getInitial(review.userName) }}</div>
              <div class="author-info">
                <strong>{{ review.userName || 'Client anonyme' }}</strong>
                <span class="email">{{ review.userEmail }}</span>
                <span class="date">{{ formatDate(review.createdAt) }}</span>
              </div>
            </div>
            <div class="review-meta">
              <div class="rating">
                <i *ngFor="let s of getStars(review.rating)" class="fas fa-star" [class.filled]="s"></i>
              </div>
              <span class="status-badge" [class.approved]="review.isApproved" [class.pending]="!review.isApproved">
                <i class="fas" [class.fa-check-circle]="review.isApproved" [class.fa-clock]="!review.isApproved"></i>
                {{ review.isApproved ? 'Approuvé' : 'En attente' }}
              </span>
              <span class="verified-badge" *ngIf="review.isVerifiedPurchase">
                <i class="fas fa-shield-check"></i> Achat vérifié
              </span>
            </div>
          </div>
          <div class="review-body">
            <h3>{{ review.title }}</h3>
            <p>{{ review.comment }}</p>
            <div class="review-stats">
              <span><i class="fas fa-thumbs-up"></i> {{ review.helpfulCount }}</span>
              <span><i class="fas fa-thumbs-down"></i> {{ review.notHelpfulCount }}</span>
              <span class="product-link">Produit #{{ review.productId }}</span>
            </div>
          </div>
          <div class="review-actions">
            <button class="btn-approve" *ngIf="!review.isApproved" (click)="approve(review)">
              <i class="fas fa-check"></i> Approuver
            </button>
            <button class="btn-reject" *ngIf="review.isApproved" (click)="reject(review)">
              <i class="fas fa-times"></i> Rejeter
            </button>
            <button class="btn-delete" (click)="remove(review)">
              <i class="fas fa-trash"></i> Supprimer
            </button>
          </div>
        </div>

        <div class="empty-state" *ngIf="reviews.length === 0">
          <i class="fas fa-star"></i>
          <p>Aucun avis trouvé</p>
        </div>
      </div>

      <!-- Pagination -->
      <div class="pagination" *ngIf="pages > 1">
        <button (click)="goToPage(page - 1)" [disabled]="page === 1"><i class="fas fa-chevron-left"></i></button>
        <span>Page {{ page }} / {{ pages }}</span>
        <button (click)="goToPage(page + 1)" [disabled]="page === pages"><i class="fas fa-chevron-right"></i></button>
      </div>
    </div>
  `,
  styles: [`
    .admin-reviews { padding: 24px; max-width: 1400px; }
    .page-header { margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 600; color: #111827; margin: 0 0 4px 0; }
    .page-header p { font-size: 14px; color: #6b7280; margin: 0; }
    .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; font-size: 14px; }
    .alert-success { background: #d1fae5; color: #065f46; }
    .alert-error { background: #fee2e2; color: #991b1b; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; display: flex; align-items: center; gap: 14px; cursor: pointer; transition: all 0.2s; }
    .stat-card:hover { border-color: #6366f1; transform: translateY(-2px); }
    .stat-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
    .stat-icon.total { background: #eef2ff; color: #6366f1; }
    .stat-icon.approved { background: #d1fae5; color: #10b981; }
    .stat-icon.pending { background: #fef3c7; color: #f59e0b; }
    .stat-icon.rating { background: #fce7f3; color: #ec4899; }
    .stat-info { display: flex; flex-direction: column; }
    .stat-value { font-size: 22px; font-weight: 700; color: #111827; }
    .stat-label { font-size: 13px; color: #6b7280; }
    .toolbar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
    .search-box { position: relative; flex: 1; min-width: 240px; }
    .search-box i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #9ca3af; }
    .search-box input { width: 100%; padding: 9px 12px 9px 36px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
    .toolbar select { padding: 9px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; background: #fff; }
    .btn-refresh { padding: 9px 16px; background: #f3f4f6; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; color: #374151; }
    .btn-refresh:hover { background: #e5e7eb; }
    .loading { text-align: center; padding: 60px; color: #6b7280; }
    .reviews-list { display: flex; flex-direction: column; gap: 16px; }
    .review-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
    .review-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
    .review-author { display: flex; gap: 12px; align-items: center; }
    .author-avatar { width: 44px; height: 44px; border-radius: 50%; background: #6366f1; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; }
    .author-info { display: flex; flex-direction: column; }
    .author-info strong { color: #111827; font-size: 14px; }
    .author-info .email { font-size: 12px; color: #6b7280; }
    .author-info .date { font-size: 12px; color: #9ca3af; }
    .review-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
    .rating i { color: #e5e7eb; margin-right: 2px; }
    .rating i.filled { color: #f59e0b; }
    .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
    .status-badge.approved { background: #d1fae5; color: #065f46; }
    .status-badge.pending { background: #fef3c7; color: #92400e; }
    .verified-badge { background: #dbeafe; color: #1e40af; padding: 3px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; }
    .review-body h3 { font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 8px 0; }
    .review-body p { font-size: 14px; color: #374151; line-height: 1.5; margin: 0 0 12px 0; }
    .review-stats { display: flex; gap: 16px; font-size: 12px; color: #6b7280; }
    .product-link { color: #6366f1; cursor: pointer; }
    .review-actions { display: flex; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #f3f4f6; }
    .btn-approve, .btn-reject, .btn-delete { padding: 8px 14px; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; }
    .btn-approve { background: #d1fae5; color: #065f46; }
    .btn-approve:hover { background: #a7f3d0; }
    .btn-reject { background: #fef3c7; color: #92400e; }
    .btn-reject:hover { background: #fde68a; }
    .btn-delete { background: #fee2e2; color: #991b1b; }
    .btn-delete:hover { background: #fecaca; }
    .empty-state { text-align: center; padding: 60px; color: #6b7280; }
    .empty-state i { font-size: 40px; margin-bottom: 16px; opacity: 0.3; display: block; }
    .pagination { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 24px; }
    .pagination button { padding: 8px 14px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; cursor: pointer; }
    .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
  `]
})
export class AdminReviewsComponent implements OnInit {
  reviews: any[] = [];
  stats: any = null;
  isLoading = false;
  page = 1;
  limit = 10;
  total = 0;
  pages = 0;
  statusFilter = '';
  ratingFilter = '';
  searchQuery = '';
  successMessage = '';
  errorMessage = '';

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadReviews();
  }

  loadStats(): void {
    this.adminService.getReviewStats().subscribe(s => this.stats = s);
  }

  loadReviews(): void {
    this.isLoading = true;
    this.adminService.getReviews({
      page: this.page,
      limit: this.limit,
      status: this.statusFilter,
      rating: this.ratingFilter,
      search: this.searchQuery
    }).subscribe({
      next: (resp) => {
        this.reviews = resp.items || [];
        this.total = resp.total || 0;
        this.pages = resp.pages || 0;
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; this.showError('Erreur lors du chargement'); }
    });
  }

  filterStatus(status: string): void {
    this.statusFilter = status;
    this.applyFilters();
  }

  applyFilters(): void {
    this.page = 1;
    this.loadReviews();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.pages) return;
    this.page = p;
    this.loadReviews();
  }

  approve(review: any): void {
    this.adminService.approveReview(review.id).subscribe({
      next: () => { review.isApproved = true; this.showSuccess('Avis approuvé'); this.loadStats(); },
      error: () => this.showError('Erreur lors de l\'approbation')
    });
  }

  reject(review: any): void {
    this.adminService.rejectReview(review.id).subscribe({
      next: () => { review.isApproved = false; this.showSuccess('Avis rejeté'); this.loadStats(); },
      error: () => this.showError('Erreur lors du rejet')
    });
  }

  remove(review: any): void {
    if (!confirm('Supprimer définitivement cet avis ?')) return;
    this.adminService.deleteReview(review.id).subscribe({
      next: () => { this.showSuccess('Avis supprimé'); this.loadReviews(); this.loadStats(); },
      error: () => this.showError('Erreur lors de la suppression')
    });
  }

  getStars(rating: number): boolean[] {
    return [1,2,3,4,5].map(i => i <= rating);
  }

  getInitial(name: string): string {
    return (name || '?').charAt(0).toUpperCase();
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  showSuccess(msg: string) { this.successMessage = msg; this.errorMessage = ''; setTimeout(() => this.successMessage = '', 3000); }
  showError(msg: string) { this.errorMessage = msg; this.successMessage = ''; setTimeout(() => this.errorMessage = '', 5000); }
}
