/**
 * BARSHA PRODUCT REVIEWS COMPONENT
 * =================================
 * Displays product reviews with rating summary, filters, and review form.
 * Premium UX with animations and social proof elements.
 */
import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  ProductReviewService,
  ProductReview,
  ProductRatingStats,
  CreateReviewRequest
} from '../../../services/product-review.service';

@Component({
  selector: 'app-product-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <section class="product-reviews" *ngIf="productId">
      <!-- Section Header -->
      <div class="reviews-header">
        <h2 class="section-title">
          <i class="fas fa-star"></i>
          Avis clients
          <span class="review-count" *ngIf="stats">({{ stats.totalReviews }})</span>
        </h2>
      </div>

      <!-- Loading State -->
      <div class="loading-skeleton" *ngIf="isLoadingStats">
        <div class="skeleton-summary"></div>
        <div class="skeleton-review" *ngFor="let i of [1,2]"></div>
      </div>

      <!-- Content -->
      <div class="reviews-content" *ngIf="!isLoadingStats">
        <!-- Rating Summary -->
        <div class="rating-summary" *ngIf="stats">
          <div class="average-rating">
            <div class="rating-value">{{ reviewService.formatRating(stats.averageRating) }}</div>
            <div class="stars-display">
              <span class="star" *ngFor="let star of [1,2,3,4,5]"
                    [class.filled]="star <= Math.round(stats.averageRating)"
                    [class.half]="star === Math.ceil(stats.averageRating) && stats.averageRating % 1 >= 0.5">
                <i class="fas fa-star"></i>
              </span>
            </div>
            <div class="rating-label">{{ reviewService.getRatingLabel(stats.averageRating) }}</div>
            <div class="total-reviews">Base sur {{ stats.totalReviews }} avis</div>
          </div>

          <div class="rating-breakdown">
            <div class="rating-bar" *ngFor="let rating of [5,4,3,2,1]">
              <span class="rating-label">{{ rating }} <i class="fas fa-star"></i></span>
              <div class="bar-container">
                <div class="bar-fill" [style.width.%]="getRatingPercentage(rating)"></div>
              </div>
              <span class="rating-count">{{ getRatingCount(rating) }}</span>
            </div>
          </div>

          <div class="extra-stats">
            <div class="stat-item" *ngIf="stats.recommendationRate > 0">
              <i class="fas fa-thumbs-up"></i>
              <span>{{ stats.recommendationRate }}% recommandent</span>
            </div>
            <div class="stat-item" *ngIf="stats.verifiedReviews > 0">
              <i class="fas fa-check-circle"></i>
              <span>{{ stats.verifiedReviews }} achats verifies</span>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div class="empty-reviews" *ngIf="stats && stats.totalReviews === 0 && !showReviewForm">
          <div class="empty-icon">
            <i class="far fa-comment-dots"></i>
          </div>
          <h3>Aucun avis pour le moment</h3>
          <p>Soyez le premier a donner votre avis sur ce produit!</p>
          <button class="btn-write-review" (click)="openReviewForm()" *ngIf="canReview">
            <i class="fas fa-pen"></i>
            Ecrire un avis
          </button>
        </div>

        <!-- Write Review Button -->
        <div class="write-review-cta" *ngIf="canReview && stats && stats.totalReviews > 0 && !showReviewForm">
          <button class="btn-write-review" (click)="openReviewForm()">
            <i class="fas fa-pen"></i>
            Ecrire un avis
          </button>
        </div>

        <!-- Review Form -->
        <div class="review-form-container" *ngIf="showReviewForm">
          <div class="form-header">
            <h3>Partagez votre avis</h3>
            <button class="btn-close-form" (click)="closeReviewForm()">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <form (ngSubmit)="submitReview()" #reviewForm="ngForm">
            <!-- Rating -->
            <div class="form-group">
              <label>Votre note *</label>
              <div class="star-rating-input">
                <span class="star-input" *ngFor="let star of [1,2,3,4,5]"
                      (click)="setRating(star)"
                      (mouseenter)="hoverRating = star"
                      (mouseleave)="hoverRating = 0"
                      [class.active]="star <= (hoverRating || newReview.rating)">
                  <i class="fas fa-star"></i>
                </span>
                <span class="rating-text" *ngIf="newReview.rating">
                  {{ getRatingText(newReview.rating) }}
                </span>
              </div>
            </div>

            <!-- Title -->
            <div class="form-group">
              <label>Titre de l'avis</label>
              <input type="text" [(ngModel)]="newReview.title" name="title"
                     placeholder="Resumez votre experience" maxlength="100">
            </div>

            <!-- Comment -->
            <div class="form-group">
              <label>Votre avis *</label>
              <textarea [(ngModel)]="newReview.comment" name="comment"
                        placeholder="Decrivez votre experience avec ce produit..."
                        rows="4" required minlength="10" maxlength="2000"></textarea>
              <span class="char-count">{{ (newReview.comment || '').length }}/2000</span>
            </div>

            <!-- Fit Rating (for clothing) -->
            <div class="form-group" *ngIf="showFitRating">
              <label>Comment taille ce produit?</label>
              <div class="fit-options">
                <label class="fit-option" *ngFor="let fit of fitOptions"
                       [class.selected]="newReview.fitRating === fit.value">
                  <input type="radio" [(ngModel)]="newReview.fitRating" name="fitRating" [value]="fit.value">
                  <span class="fit-label">{{ fit.label }}</span>
                </label>
              </div>
            </div>

            <!-- Recommend -->
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="newReview.isRecommended" name="isRecommended">
                <span>Je recommande ce produit</span>
              </label>
            </div>

            <!-- Submit -->
            <div class="form-actions">
              <button type="button" class="btn-cancel" (click)="closeReviewForm()">Annuler</button>
              <button type="submit" class="btn-submit"
                      [disabled]="!newReview.rating || !newReview.comment || isSubmitting">
                <span *ngIf="!isSubmitting">
                  <i class="fas fa-paper-plane"></i>
                  Publier mon avis
                </span>
                <span *ngIf="isSubmitting">
                  <i class="fas fa-spinner fa-spin"></i>
                  Publication...
                </span>
              </button>
            </div>

            <!-- Success/Error Message -->
            <div class="form-message success" *ngIf="submitMessage && submitSuccess">
              <i class="fas fa-check-circle"></i>
              {{ submitMessage }}
            </div>
            <div class="form-message error" *ngIf="submitMessage && !submitSuccess">
              <i class="fas fa-exclamation-circle"></i>
              {{ submitMessage }}
            </div>
          </form>
        </div>

        <!-- Filters & Sort -->
        <div class="reviews-filters" *ngIf="stats && stats.totalReviews > 0">
          <div class="filter-group">
            <select [(ngModel)]="sortBy" (ngModelChange)="loadReviews()">
              <option value="recent">Plus recents</option>
              <option value="helpful">Plus utiles</option>
              <option value="highest">Meilleures notes</option>
              <option value="lowest">Notes les plus basses</option>
            </select>
          </div>
          <div class="filter-group">
            <select [(ngModel)]="filterRating" (ngModelChange)="loadReviews()">
              <option [ngValue]="null">Toutes les notes</option>
              <option [ngValue]="5">5 etoiles</option>
              <option [ngValue]="4">4 etoiles</option>
              <option [ngValue]="3">3 etoiles</option>
              <option [ngValue]="2">2 etoiles</option>
              <option [ngValue]="1">1 etoile</option>
            </select>
          </div>
          <label class="filter-checkbox">
            <input type="checkbox" [(ngModel)]="verifiedOnly" (ngModelChange)="loadReviews()">
            Achats verifies uniquement
          </label>
        </div>

        <!-- Reviews List -->
        <div class="reviews-list" *ngIf="reviews && reviews.length > 0">
          <div class="review-card" *ngFor="let review of reviews" [class.featured]="review.isFeatured">
            <div class="review-header">
              <div class="reviewer-info">
                <span class="reviewer-name">{{ review.user?.firstName }} {{ review.user?.lastInitial }}.</span>
                <span class="verified-badge" *ngIf="review.isVerifiedPurchase">
                  <i class="fas fa-check-circle"></i>
                  Achat verifie
                </span>
              </div>
              <div class="review-date">{{ reviewService.formatDate(review.createdAt) }}</div>
            </div>

            <div class="review-rating">
              <span class="star filled" *ngFor="let s of [1,2,3,4,5].slice(0, review.rating)">
                <i class="fas fa-star"></i>
              </span>
              <span class="star" *ngFor="let s of [1,2,3,4,5].slice(review.rating)">
                <i class="far fa-star"></i>
              </span>
            </div>

            <h4 class="review-title" *ngIf="review.title">{{ review.title }}</h4>
            <p class="review-comment">{{ review.comment }}</p>

            <div class="review-meta">
              <span class="fit-info" *ngIf="review.fitRating">
                <i class="fas fa-ruler"></i>
                {{ reviewService.getFitRatingLabel(review.fitRating) }}
              </span>
              <span class="recommend-info" *ngIf="review.isRecommended">
                <i class="fas fa-thumbs-up"></i>
                Recommande ce produit
              </span>
            </div>

            <!-- Admin Response -->
            <div class="admin-response" *ngIf="review.adminResponse">
              <div class="response-header">
                <i class="fas fa-store"></i>
                Reponse de Barsha
              </div>
              <p>{{ review.adminResponse }}</p>
            </div>

            <!-- Helpful Votes -->
            <div class="review-actions">
              <span class="helpful-text">Cet avis vous a-t-il ete utile?</span>
              <button class="btn-vote" [class.active]="review.userVote === true"
                      (click)="voteReview(review, true)" [disabled]="!isLoggedIn">
                <i class="fas fa-thumbs-up"></i>
                Oui ({{ review.helpfulCount }})
              </button>
              <button class="btn-vote" [class.active]="review.userVote === false"
                      (click)="voteReview(review, false)" [disabled]="!isLoggedIn">
                <i class="fas fa-thumbs-down"></i>
                Non ({{ review.notHelpfulCount }})
              </button>
            </div>
          </div>
        </div>

        <!-- Loading Reviews -->
        <div class="loading-reviews" *ngIf="isLoadingReviews">
          <i class="fas fa-spinner fa-spin"></i>
          Chargement des avis...
        </div>

        <!-- Pagination -->
        <div class="pagination" *ngIf="totalPages > 1">
          <button class="btn-page" (click)="changePage(currentPage - 1)" [disabled]="currentPage === 1">
            <i class="fas fa-chevron-left"></i>
          </button>
          <span class="page-info">Page {{ currentPage }} sur {{ totalPages }}</span>
          <button class="btn-page" (click)="changePage(currentPage + 1)" [disabled]="currentPage === totalPages">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .product-reviews {
      margin: 40px 0;
      padding: 30px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.05);
    }

    .reviews-header {
      margin-bottom: 30px;
    }

    .section-title {
      font-size: 22px;
      font-weight: 700;
      color: #1a1a2e;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .section-title i {
      color: #ffc107;
    }

    .review-count {
      font-weight: 400;
      color: #888;
      font-size: 18px;
    }

    /* Loading */
    .loading-skeleton {
      animation: pulse 1.5s infinite;
    }

    .skeleton-summary {
      height: 200px;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      border-radius: 12px;
      margin-bottom: 20px;
    }

    .skeleton-review {
      height: 150px;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      border-radius: 12px;
      margin-bottom: 15px;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* Rating Summary */
    .rating-summary {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 30px;
      padding: 25px;
      background: linear-gradient(135deg, #f8f9fa 0%, #fff 100%);
      border-radius: 12px;
      margin-bottom: 25px;
      align-items: center;
    }

    .average-rating {
      text-align: center;
    }

    .rating-value {
      font-size: 48px;
      font-weight: 700;
      color: #1a1a2e;
      line-height: 1;
    }

    .stars-display {
      display: flex;
      gap: 4px;
      justify-content: center;
      margin: 8px 0;
    }

    .stars-display .star {
      color: #e0e0e0;
      font-size: 18px;
    }

    .stars-display .star.filled {
      color: #ffc107;
    }

    .rating-label {
      font-size: 14px;
      font-weight: 600;
      color: #667eea;
      margin-bottom: 4px;
    }

    .total-reviews {
      font-size: 12px;
      color: #888;
    }

    .rating-breakdown {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .rating-bar {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .rating-bar .rating-label {
      width: 50px;
      font-size: 13px;
      color: #666;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .rating-bar .rating-label i {
      color: #ffc107;
      font-size: 11px;
    }

    .bar-container {
      flex: 1;
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #ffc107, #ffab00);
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .rating-bar .rating-count {
      width: 30px;
      text-align: right;
      font-size: 13px;
      color: #888;
    }

    .extra-stats {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #666;
    }

    .stat-item i {
      color: #27ae60;
    }

    /* Empty State */
    .empty-reviews {
      text-align: center;
      padding: 50px 20px;
    }

    .empty-icon {
      width: 80px;
      height: 80px;
      background: #f5f5f5;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }

    .empty-icon i {
      font-size: 36px;
      color: #ccc;
    }

    .empty-reviews h3 {
      color: #1a1a2e;
      margin-bottom: 8px;
    }

    .empty-reviews p {
      color: #888;
      margin-bottom: 20px;
    }

    /* Write Review Button */
    .write-review-cta {
      text-align: center;
      margin-bottom: 25px;
    }

    .btn-write-review {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      border: none;
      padding: 12px 28px;
      border-radius: 25px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.3s ease;
    }

    .btn-write-review:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }

    /* Review Form */
    .review-form-container {
      background: #f8f9fa;
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 25px;
    }

    .form-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .form-header h3 {
      color: #1a1a2e;
      margin: 0;
    }

    .btn-close-form {
      background: none;
      border: none;
      font-size: 20px;
      color: #888;
      cursor: pointer;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
    }

    .form-group input[type="text"],
    .form-group textarea,
    .form-group select {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.2s;
    }

    .form-group input:focus,
    .form-group textarea:focus,
    .form-group select:focus {
      outline: none;
      border-color: #667eea;
    }

    .char-count {
      display: block;
      text-align: right;
      font-size: 12px;
      color: #888;
      margin-top: 4px;
    }

    .star-rating-input {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .star-input {
      font-size: 28px;
      color: #e0e0e0;
      cursor: pointer;
      transition: color 0.15s, transform 0.15s;
    }

    .star-input:hover,
    .star-input.active {
      color: #ffc107;
      transform: scale(1.1);
    }

    .rating-text {
      font-size: 14px;
      color: #667eea;
      font-weight: 500;
      margin-left: 10px;
    }

    .fit-options {
      display: flex;
      gap: 12px;
    }

    .fit-option {
      flex: 1;
      padding: 12px;
      background: #fff;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .fit-option input {
      display: none;
    }

    .fit-option.selected {
      border-color: #667eea;
      background: rgba(102, 126, 234, 0.1);
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
    }

    .checkbox-label input {
      width: 18px;
      height: 18px;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 20px;
    }

    .btn-cancel {
      background: #fff;
      border: 1px solid #ddd;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
    }

    .btn-submit {
      background: #1a1a2e;
      color: #fff;
      border: none;
      padding: 10px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .form-message {
      margin-top: 15px;
      padding: 12px 16px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .form-message.success {
      background: #d4edda;
      color: #155724;
    }

    .form-message.error {
      background: #f8d7da;
      color: #721c24;
    }

    /* Filters */
    .reviews-filters {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .filter-group select {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 13px;
      background: #fff;
    }

    .filter-checkbox {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #666;
      cursor: pointer;
    }

    /* Reviews List */
    .reviews-list {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .review-card {
      padding: 20px;
      background: #fff;
      border: 1px solid #eee;
      border-radius: 12px;
      transition: box-shadow 0.2s;
    }

    .review-card:hover {
      box-shadow: 0 4px 15px rgba(0,0,0,0.08);
    }

    .review-card.featured {
      border-color: #667eea;
      background: linear-gradient(135deg, rgba(102,126,234,0.03) 0%, #fff 100%);
    }

    .review-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .reviewer-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .reviewer-name {
      font-weight: 600;
      color: #1a1a2e;
    }

    .verified-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      background: #d4edda;
      color: #155724;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }

    .review-date {
      font-size: 12px;
      color: #888;
    }

    .review-rating {
      display: flex;
      gap: 2px;
      margin-bottom: 10px;
    }

    .review-rating .star {
      color: #e0e0e0;
      font-size: 14px;
    }

    .review-rating .star.filled {
      color: #ffc107;
    }

    .review-title {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a2e;
      margin: 0 0 8px;
    }

    .review-comment {
      color: #555;
      line-height: 1.6;
      margin: 0 0 12px;
    }

    .review-meta {
      display: flex;
      gap: 16px;
      margin-bottom: 12px;
    }

    .review-meta span {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #666;
    }

    .review-meta i {
      color: #999;
    }

    .admin-response {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 12px;
      border-left: 3px solid #667eea;
    }

    .response-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: #667eea;
      margin-bottom: 8px;
      font-size: 13px;
    }

    .admin-response p {
      margin: 0;
      font-size: 14px;
      color: #555;
    }

    .review-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-top: 12px;
      border-top: 1px solid #eee;
    }

    .helpful-text {
      font-size: 12px;
      color: #888;
    }

    .btn-vote {
      background: none;
      border: 1px solid #ddd;
      padding: 6px 12px;
      border-radius: 15px;
      font-size: 12px;
      color: #666;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.2s;
    }

    .btn-vote:hover:not(:disabled) {
      background: #f5f5f5;
    }

    .btn-vote.active {
      background: #667eea;
      color: #fff;
      border-color: #667eea;
    }

    .btn-vote:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Loading Reviews */
    .loading-reviews {
      text-align: center;
      padding: 30px;
      color: #888;
    }

    /* Pagination */
    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;
      margin-top: 25px;
    }

    .btn-page {
      background: #fff;
      border: 1px solid #ddd;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-page:hover:not(:disabled) {
      background: #f5f5f5;
    }

    .btn-page:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .page-info {
      font-size: 14px;
      color: #666;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .product-reviews {
        padding: 20px;
        margin: 30px 0;
      }

      .rating-summary {
        grid-template-columns: 1fr;
        text-align: center;
      }

      .rating-breakdown {
        padding: 15px 0;
      }

      .extra-stats {
        flex-direction: row;
        justify-content: center;
        padding-top: 15px;
        border-top: 1px solid #eee;
      }

      .reviews-filters {
        flex-direction: column;
        align-items: stretch;
      }

      .fit-options {
        flex-direction: column;
      }

      .review-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }

      .review-actions {
        flex-wrap: wrap;
      }
    }
  `]
})
export class ProductReviewsComponent implements OnInit, OnChanges {
  @Input() productId!: number;
  @Input() productFamily?: string;

  Math = Math;

  stats: ProductRatingStats | null = null;
  reviews: ProductReview[] = [];

  isLoadingStats = true;
  isLoadingReviews = false;
  isSubmitting = false;

  canReview = false;
  showReviewForm = false;
  isLoggedIn = false;

  // Filters
  sortBy: 'recent' | 'helpful' | 'highest' | 'lowest' = 'recent';
  filterRating: number | null = null;
  verifiedOnly = false;

  // Pagination
  currentPage = 1;
  totalPages = 1;
  pageSize = 5;

  // Review form
  newReview: CreateReviewRequest = {
    productId: 0,
    rating: 0,
    title: '',
    comment: '',
    isRecommended: true,
    fitRating: undefined
  };
  hoverRating = 0;
  submitMessage = '';
  submitSuccess = false;

  showFitRating = false;

  fitOptions = [
    { value: 'small', label: 'Taille petit' },
    { value: 'true_to_size', label: 'Taille normalement' },
    { value: 'large', label: 'Taille grand' }
  ];

  constructor(public reviewService: ProductReviewService) {}

  ngOnInit(): void {
    this.isLoggedIn = !!localStorage.getItem('jwt');
    this.showFitRating = this.isClothingProduct();
    this.loadData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productId'] && !changes['productId'].firstChange) {
      this.loadData();
    }
  }

  private loadData(): void {
    if (!this.productId) return;

    this.newReview.productId = this.productId;
    this.isLoadingStats = true;

    // Load stats
    this.reviewService.getProductStats(this.productId).subscribe({
      next: (stats) => {
        this.stats = stats || { productId: 0, averageRating: 0, totalReviews: 0, ratingDistribution: {}, recommendationRate: 0, verifiedReviews: 0, fitDistribution: {} } as any;
        this.isLoadingStats = false;
        this.loadReviews();
      },
      error: () => {
        this.stats = { productId: 0, averageRating: 0, totalReviews: 0, ratingDistribution: {}, recommendationRate: 0, verifiedReviews: 0, fitDistribution: {} } as any;
        this.isLoadingStats = false;
      }
    });

    // Check if user can review
    if (this.isLoggedIn) {
      this.reviewService.canReviewProduct(this.productId).subscribe(result => {
        this.canReview = result.canReview;
      });
    }
  }

  loadReviews(): void {
    if (!this.productId) return;

    this.isLoadingReviews = true;

    this.reviewService.getProductReviews(this.productId, {
      page: this.currentPage,
      limit: this.pageSize,
      sort: this.sortBy,
      rating: this.filterRating || undefined,
      verifiedOnly: this.verifiedOnly
    }).subscribe(response => {
      this.reviews = response.reviews || [];
      this.totalPages = response.pagination.pages;
      this.isLoadingReviews = false;
    });
  }

  getRatingPercentage(rating: number): number {
    if (!this.stats || this.stats.totalReviews === 0) return 0;
    const count = this.getRatingCount(rating);
    return (count / this.stats.totalReviews) * 100;
  }

  getRatingCount(rating: number): number {
    if (!this.stats) return 0;
    return this.stats.ratingDistribution[rating.toString() as keyof typeof this.stats.ratingDistribution] || 0;
  }

  getRatingText(rating: number): string {
    switch (rating) {
      case 5: return 'Excellent';
      case 4: return 'Tres bien';
      case 3: return 'Bien';
      case 2: return 'Moyen';
      case 1: return 'Decevant';
      default: return '';
    }
  }

  openReviewForm(): void {
    if (!this.isLoggedIn) {
      // Redirect to login
      window.location.href = '/login';
      return;
    }
    this.showReviewForm = true;
    this.resetForm();
  }

  closeReviewForm(): void {
    this.showReviewForm = false;
    this.resetForm();
  }

  private resetForm(): void {
    this.newReview = {
      productId: this.productId,
      rating: 0,
      title: '',
      comment: '',
      isRecommended: true,
      fitRating: undefined
    };
    this.hoverRating = 0;
    this.submitMessage = '';
  }

  setRating(rating: number): void {
    this.newReview.rating = rating;
  }

  submitReview(): void {
    if (!this.newReview.rating || !this.newReview.comment) return;

    this.isSubmitting = true;
    this.submitMessage = '';

    this.reviewService.createReview(this.newReview).subscribe(result => {
      this.isSubmitting = false;
      this.submitMessage = result.message;
      this.submitSuccess = result.success;

      if (result.success) {
        this.canReview = false;
        setTimeout(() => {
          this.showReviewForm = false;
          // Refresh stats
          this.reviewService.getProductStats(this.productId, true).subscribe(stats => {
            this.stats = stats;
          });
        }, 2000);
      }
    });
  }

  voteReview(review: ProductReview, isHelpful: boolean): void {
    if (!this.isLoggedIn) return;

    this.reviewService.voteOnReview(review.id, isHelpful).subscribe(result => {
      if (result.success) {
        review.helpfulCount = result.helpfulCount;
        review.notHelpfulCount = result.notHelpfulCount;
        review.userVote = isHelpful;
      }
    });
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadReviews();
    }
  }

  private isClothingProduct(): boolean {
    // Check if product is clothing based on family
    const clothingFamilies = ['WOMEN', 'MEN', 'KIDS', 'TEEN WOMEN', 'TEEN MEN'];
    return this.productFamily ? clothingFamilies.includes(this.productFamily.toUpperCase()) : true;
  }
}
