/**
 * Referral Dashboard Component
 * ============================
 * Displays user's referral code, statistics, history, and rewards.
 */
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  ReferralService,
  ReferralCode,
  ReferralStats,
  ReferralHistoryItem,
  ReferralReward
} from '../../../services/referral.service';

@Component({
  selector: 'app-referral-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="referral-dashboard">
      <!-- Loading State -->
      <div class="loading-state" *ngIf="isLoading">
        <div class="spinner"></div>
        <p>Chargement du programme de parrainage...</p>
      </div>

      <!-- Main Content -->
      <div class="dashboard-content" *ngIf="!isLoading">
        <!-- Header Section -->
        <div class="header-section">
          <h2>Programme de Parrainage</h2>
          <p class="subtitle">Parrainez vos amis et gagnez des recompenses!</p>
        </div>

        <!-- Referral Code Card -->
        <div class="referral-code-card" *ngIf="referralCode">
          <div class="code-header">
            <h3>Mon code de parrainage</h3>
            <span class="code-badge" [class.active]="referralCode.isActive">
              {{ referralCode.isActive ? 'Actif' : 'Inactif' }}
            </span>
          </div>

          <div class="code-display">
            <span class="code-value">{{ referralCode.code }}</span>
            <button class="copy-btn" (click)="copyCode()" [class.copied]="codeCopied">
              <i class="fas" [ngClass]="codeCopied ? 'fa-check' : 'fa-copy'"></i>
              {{ codeCopied ? 'Copie!' : 'Copier' }}
            </button>
          </div>

          <div class="share-section">
            <p class="share-label">Partager via:</p>
            <div class="share-buttons">
              <button class="share-btn whatsapp" (click)="shareWhatsApp()" title="WhatsApp">
                <i class="fab fa-whatsapp"></i>
              </button>
              <button class="share-btn facebook" (click)="shareFacebook()" title="Facebook">
                <i class="fab fa-facebook-f"></i>
              </button>
              <button class="share-btn twitter" (click)="shareTwitter()" title="Twitter">
                <i class="fab fa-twitter"></i>
              </button>
              <button class="share-btn email" (click)="shareEmail()" title="Email">
                <i class="fas fa-envelope"></i>
              </button>
              <button class="share-btn link" (click)="copyLink()" [class.copied]="linkCopied" title="Copier le lien">
                <i class="fas" [ngClass]="linkCopied ? 'fa-check' : 'fa-link'"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Statistics Cards -->
        <div class="stats-grid" *ngIf="stats">
          <div class="stat-card">
            <div class="stat-icon total">
              <i class="fas fa-users"></i>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ stats.totalReferred }}</span>
              <span class="stat-label">Total parraine</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon pending">
              <i class="fas fa-hourglass-half"></i>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ stats.pendingReferrals }}</span>
              <span class="stat-label">En attente</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon completed">
              <i class="fas fa-check-circle"></i>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ stats.completedReferrals }}</span>
              <span class="stat-label">Completes</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon earnings">
              <i class="fas fa-coins"></i>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ referralService.formatPoints(stats.totalPointsEarned) }}</span>
              <span class="stat-label">Points gagnes</span>
            </div>
          </div>
        </div>

        <!-- Pending Rewards Section -->
        <div class="rewards-section" *ngIf="pendingRewards.length > 0">
          <h3>Recompenses a reclamer</h3>
          <div class="rewards-list">
            <div class="reward-card" *ngFor="let reward of pendingRewards">
              <div class="reward-icon">
                <i class="fas" [ngClass]="getRewardIcon(reward.rewardType)"></i>
              </div>
              <div class="reward-info">
                <span class="reward-value">
                  {{ reward.rewardType === 'loyalty_points' ? reward.rewardValue + ' points' : reward.rewardValue + '%' }}
                </span>
                <span class="reward-description">{{ reward.rewardDescription }}</span>
                <span class="reward-expiry" *ngIf="reward.expiresAt">
                  Expire le {{ reward.expiresAt | date:'dd/MM/yyyy' }}
                </span>
              </div>
              <button
                class="claim-btn"
                (click)="claimReward(reward)"
                [disabled]="claimingRewardId === reward.id">
                <span *ngIf="claimingRewardId !== reward.id">Reclamer</span>
                <i *ngIf="claimingRewardId === reward.id" class="fas fa-spinner fa-spin"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Referral History -->
        <div class="history-section">
          <h3>Historique des parrainages</h3>

          <div class="history-empty" *ngIf="history.length === 0">
            <i class="fas fa-user-friends"></i>
            <p>Aucun parrainage pour le moment</p>
            <p class="hint">Partagez votre code pour commencer a parrainer!</p>
          </div>

          <div class="history-table" *ngIf="history.length > 0">
            <div class="table-header">
              <span class="col-user">Utilisateur</span>
              <span class="col-status">Statut</span>
              <span class="col-reward">Recompense</span>
              <span class="col-date">Date</span>
            </div>
            <div class="table-row" *ngFor="let item of history">
              <div class="col-user">
                <div class="user-avatar">{{ item.refereeFirstName.charAt(0).toUpperCase() }}</div>
                <div class="user-info">
                  <span class="user-name">{{ item.refereeFirstName }}</span>
                  <span class="user-email">{{ item.refereeEmail }}</span>
                </div>
              </div>
              <div class="col-status">
                <span class="status-badge" [ngClass]="referralService.getStatusBadgeClass(item.status)">
                  {{ referralService.getStatusLabel(item.status) }}
                </span>
              </div>
              <div class="col-reward">
                <span *ngIf="item.rewardEarned" class="reward-earned">
                  +{{ item.rewardEarned }} pts
                </span>
                <span *ngIf="!item.rewardEarned" class="no-reward">-</span>
              </div>
              <div class="col-date">
                {{ item.createdAt | date:'dd/MM/yyyy' }}
              </div>
            </div>
          </div>

          <!-- Load More Button -->
          <button
            class="load-more-btn"
            *ngIf="hasMoreHistory"
            (click)="loadMoreHistory()"
            [disabled]="loadingMoreHistory">
            <span *ngIf="!loadingMoreHistory">Voir plus</span>
            <i *ngIf="loadingMoreHistory" class="fas fa-spinner fa-spin"></i>
          </button>
        </div>

        <!-- How It Works Section -->
        <div class="how-it-works">
          <h3>Comment ca marche?</h3>
          <div class="steps-grid">
            <div class="step-card">
              <div class="step-number">1</div>
              <div class="step-icon">
                <i class="fas fa-share-alt"></i>
              </div>
              <h4>Partagez votre code</h4>
              <p>Envoyez votre code de parrainage a vos amis et famille</p>
            </div>

            <div class="step-card">
              <div class="step-number">2</div>
              <div class="step-icon">
                <i class="fas fa-user-plus"></i>
              </div>
              <h4>Ils s'inscrivent</h4>
              <p>Vos filleuls s'inscrivent avec votre code et recoivent 10% de reduction</p>
            </div>

            <div class="step-card">
              <div class="step-number">3</div>
              <div class="step-icon">
                <i class="fas fa-shopping-bag"></i>
              </div>
              <h4>Ils commandent</h4>
              <p>Quand ils passent leur premiere commande, le parrainage est valide</p>
            </div>

            <div class="step-card">
              <div class="step-number">4</div>
              <div class="step-icon">
                <i class="fas fa-gift"></i>
              </div>
              <h4>Vous gagnez!</h4>
              <p>Recevez 100 points de fidelite pour chaque parrainage reussi</p>
            </div>
          </div>

          <div class="rewards-summary">
            <div class="reward-item">
              <i class="fas fa-user"></i>
              <div>
                <strong>Pour vous (parrain)</strong>
                <span>100 points de fidelite par parrainage</span>
              </div>
            </div>
            <div class="reward-item">
              <i class="fas fa-user-friends"></i>
              <div>
                <strong>Pour votre filleul</strong>
                <span>10% de reduction sur la premiere commande</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Success/Error Messages -->
        <div class="message success-message" *ngIf="successMessage">
          <i class="fas fa-check-circle"></i>
          {{ successMessage }}
        </div>
        <div class="message error-message" *ngIf="errorMessage">
          <i class="fas fa-exclamation-circle"></i>
          {{ errorMessage }}
        </div>
      </div>

      <!-- Not Logged In -->
      <div class="not-logged-in" *ngIf="!isLoading && !isLoggedIn">
        <i class="fas fa-user-friends"></i>
        <h3>Rejoignez notre programme de parrainage</h3>
        <p>Connectez-vous pour obtenir votre code et commencer a parrainer vos amis</p>
        <a routerLink="/login" class="login-btn">Se connecter</a>
      </div>
    </div>
  `,
  styles: [`
    .referral-dashboard {
      padding: 1.5rem;
      max-width: 900px;
      margin: 0 auto;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      color: #666;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #f0f0f0;
      border-top-color: #000;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Header Section */
    .header-section {
      text-align: center;
      margin-bottom: 2rem;
    }

    .header-section h2 {
      font-size: 1.75rem;
      font-weight: 700;
      margin: 0 0 0.5rem 0;
      color: #000;
    }

    .subtitle {
      color: #666;
      font-size: 1rem;
      margin: 0;
    }

    /* Referral Code Card */
    .referral-code-card {
      background: linear-gradient(135deg, #000 0%, #333 100%);
      border-radius: 16px;
      padding: 2rem;
      color: #fff;
      margin-bottom: 2rem;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
    }

    .code-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .code-header h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 500;
      opacity: 0.9;
    }

    .code-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.2);
    }

    .code-badge.active {
      background: #28a745;
    }

    .code-display {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .code-value {
      font-size: 2.5rem;
      font-weight: 700;
      letter-spacing: 0.2em;
      font-family: monospace;
    }

    .copy-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 8px;
      color: #fff;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .copy-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .copy-btn.copied {
      background: #28a745;
      border-color: #28a745;
    }

    .share-section {
      text-align: center;
    }

    .share-label {
      font-size: 0.9rem;
      opacity: 0.8;
      margin-bottom: 1rem;
    }

    .share-buttons {
      display: flex;
      justify-content: center;
      gap: 0.75rem;
    }

    .share-btn {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 1.25rem;
      color: #fff;
    }

    .share-btn:hover {
      transform: scale(1.1);
    }

    .share-btn.whatsapp { background: #25D366; }
    .share-btn.facebook { background: #1877F2; }
    .share-btn.twitter { background: #1DA1F2; }
    .share-btn.email { background: #EA4335; }
    .share-btn.link { background: #666; }
    .share-btn.link.copied { background: #28a745; }

    /* Statistics Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: #fff;
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    }

    .stat-icon {
      width: 50px;
      height: 50px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      color: #fff;
    }

    .stat-icon.total { background: linear-gradient(135deg, #667eea, #764ba2); }
    .stat-icon.pending { background: linear-gradient(135deg, #f093fb, #f5576c); }
    .stat-icon.completed { background: linear-gradient(135deg, #4facfe, #00f2fe); }
    .stat-icon.earnings { background: linear-gradient(135deg, #43e97b, #38f9d7); }

    .stat-info {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #000;
    }

    .stat-label {
      font-size: 0.8rem;
      color: #666;
    }

    /* Rewards Section */
    .rewards-section {
      background: #fff;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    }

    .rewards-section h3 {
      margin: 0 0 1rem 0;
      font-size: 1.1rem;
    }

    .rewards-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .reward-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: linear-gradient(135deg, #fff9e6 0%, #fff3cc 100%);
      border: 1px solid #ffd966;
      border-radius: 12px;
    }

    .reward-icon {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: #ffd966;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      color: #856404;
    }

    .reward-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .reward-value {
      font-weight: 700;
      font-size: 1.1rem;
      color: #856404;
    }

    .reward-description {
      font-size: 0.85rem;
      color: #666;
    }

    .reward-expiry {
      font-size: 0.75rem;
      color: #dc3545;
    }

    .claim-btn {
      padding: 0.75rem 1.5rem;
      background: #000;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .claim-btn:hover:not(:disabled) {
      background: #333;
    }

    .claim-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    /* History Section */
    .history-section {
      background: #fff;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    }

    .history-section h3 {
      margin: 0 0 1rem 0;
      font-size: 1.1rem;
    }

    .history-empty {
      text-align: center;
      padding: 2rem;
      color: #999;
    }

    .history-empty i {
      font-size: 3rem;
      margin-bottom: 1rem;
      opacity: 0.5;
    }

    .history-empty p {
      margin: 0.5rem 0;
    }

    .history-empty .hint {
      font-size: 0.85rem;
    }

    .history-table {
      border: 1px solid #eee;
      border-radius: 8px;
      overflow: hidden;
    }

    .table-header {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      background: #f8f8f8;
      padding: 0.75rem 1rem;
      font-weight: 600;
      font-size: 0.85rem;
      color: #666;
    }

    .table-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      padding: 1rem;
      border-top: 1px solid #eee;
      align-items: center;
    }

    .table-row:hover {
      background: #fafafa;
    }

    .col-user {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
    }

    .user-info {
      display: flex;
      flex-direction: column;
    }

    .user-name {
      font-weight: 500;
    }

    .user-email {
      font-size: 0.75rem;
      color: #999;
    }

    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .badge-warning {
      background: #fff3cd;
      color: #856404;
    }

    .badge-success {
      background: #d4edda;
      color: #155724;
    }

    .badge-primary {
      background: #cce5ff;
      color: #004085;
    }

    .reward-earned {
      color: #28a745;
      font-weight: 600;
    }

    .no-reward {
      color: #999;
    }

    .col-date {
      font-size: 0.85rem;
      color: #666;
    }

    .load-more-btn {
      width: 100%;
      padding: 0.75rem;
      background: #f0f0f0;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      margin-top: 1rem;
      font-weight: 500;
      transition: background 0.2s ease;
    }

    .load-more-btn:hover:not(:disabled) {
      background: #e0e0e0;
    }

    .load-more-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    /* How It Works Section */
    .how-it-works {
      margin-bottom: 2rem;
    }

    .how-it-works h3 {
      text-align: center;
      margin: 0 0 1.5rem 0;
      font-size: 1.25rem;
    }

    .steps-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .step-card {
      background: #fff;
      border-radius: 12px;
      padding: 1.5rem;
      text-align: center;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      position: relative;
    }

    .step-number {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      width: 24px;
      height: 24px;
      background: #000;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .step-icon {
      width: 60px;
      height: 60px;
      margin: 0.5rem auto 1rem;
      border-radius: 50%;
      background: linear-gradient(135deg, #f0f0f0, #e0e0e0);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      color: #333;
    }

    .step-card h4 {
      margin: 0 0 0.5rem 0;
      font-size: 1rem;
    }

    .step-card p {
      margin: 0;
      font-size: 0.85rem;
      color: #666;
    }

    .rewards-summary {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border-radius: 12px;
      padding: 1.5rem;
    }

    .reward-item {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .reward-item i {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #000;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .reward-item div {
      display: flex;
      flex-direction: column;
    }

    .reward-item strong {
      font-size: 0.9rem;
    }

    .reward-item span {
      font-size: 0.85rem;
      color: #666;
    }

    /* Messages */
    .message {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 500;
      z-index: 1000;
      animation: slideIn 0.3s ease;
    }

    @keyframes slideIn {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .success-message {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }

    .error-message {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }

    /* Not Logged In */
    .not-logged-in {
      text-align: center;
      padding: 3rem;
      background: #f8f8f8;
      border-radius: 16px;
    }

    .not-logged-in i {
      font-size: 4rem;
      color: #ccc;
      margin-bottom: 1rem;
    }

    .not-logged-in h3 {
      margin: 0 0 0.5rem 0;
    }

    .not-logged-in p {
      color: #666;
      margin-bottom: 1.5rem;
    }

    .login-btn {
      display: inline-block;
      padding: 0.75rem 2rem;
      background: #000;
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
      transition: background 0.2s ease;
    }

    .login-btn:hover {
      background: #333;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .referral-dashboard {
        padding: 1rem;
      }

      .code-value {
        font-size: 1.75rem;
        letter-spacing: 0.1em;
      }

      .code-display {
        flex-direction: column;
      }

      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .steps-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .table-header,
      .table-row {
        grid-template-columns: 1.5fr 1fr 1fr;
      }

      .col-date {
        display: none;
      }

      .rewards-summary {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 480px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }

      .steps-grid {
        grid-template-columns: 1fr;
      }

      .share-buttons {
        flex-wrap: wrap;
      }
    }
  `]
})
export class ReferralDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // State
  isLoading = true;
  isLoggedIn = false;

  // Data
  referralCode: ReferralCode | null = null;
  stats: ReferralStats | null = null;
  history: ReferralHistoryItem[] = [];
  pendingRewards: ReferralReward[] = [];

  // UI State
  codeCopied = false;
  linkCopied = false;
  claimingRewardId: number | null = null;
  loadingMoreHistory = false;
  hasMoreHistory = false;
  currentPage = 1;

  // Messages
  successMessage = '';
  errorMessage = '';

  constructor(public referralService: ReferralService) {}

  ngOnInit(): void {
    this.isLoggedIn = !!localStorage.getItem('jwt');

    if (this.isLoggedIn) {
      this.loadData();
    } else {
      this.isLoading = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadData(): void {
    // Load referral code
    this.referralService.getMyCode()
      .pipe(takeUntil(this.destroy$))
      .subscribe(code => {
        this.referralCode = code;
      });

    // Load stats
    this.referralService.getStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe(stats => {
        this.stats = stats;
        this.isLoading = false;
      });

    // Load history
    this.loadHistory();

    // Load pending rewards
    this.loadRewards();
  }

  private loadHistory(): void {
    this.referralService.getHistory(this.currentPage, 10)
      .pipe(takeUntil(this.destroy$))
      .subscribe(response => {
        this.history = response?.items || [];
        this.hasMoreHistory = !!response?.hasMore;
      });
  }

  private loadRewards(): void {
    this.referralService.getRewards(false)
      .pipe(takeUntil(this.destroy$))
      .subscribe(response => {
        this.pendingRewards = response?.rewards || [];
      });
  }

  loadMoreHistory(): void {
    if (this.loadingMoreHistory) return;

    this.loadingMoreHistory = true;
    this.currentPage++;

    this.referralService.getHistory(this.currentPage, 10)
      .pipe(takeUntil(this.destroy$))
      .subscribe(response => {
        this.history = [...this.history, ...(response?.items || [])];
        this.hasMoreHistory = !!response?.hasMore;
        this.loadingMoreHistory = false;
      });
  }

  async copyCode(): Promise<void> {
    if (!this.referralCode) return;

    const success = await this.referralService.copyToClipboard(this.referralCode.code);
    if (success) {
      this.codeCopied = true;
      setTimeout(() => this.codeCopied = false, 2000);
    }
  }

  async copyLink(): Promise<void> {
    if (!this.referralCode) return;

    const link = this.referralService.getShareUrl(this.referralCode.code);
    const success = await this.referralService.copyToClipboard(link);
    if (success) {
      this.linkCopied = true;
      setTimeout(() => this.linkCopied = false, 2000);
    }
  }

  shareWhatsApp(): void {
    if (!this.referralCode) return;
    window.open(this.referralService.getWhatsAppShareLink(this.referralCode.code), '_blank');
  }

  shareFacebook(): void {
    if (!this.referralCode) return;
    window.open(this.referralService.getFacebookShareLink(this.referralCode.code), '_blank');
  }

  shareTwitter(): void {
    if (!this.referralCode) return;
    window.open(this.referralService.getTwitterShareLink(this.referralCode.code), '_blank');
  }

  shareEmail(): void {
    if (!this.referralCode) return;
    window.location.href = this.referralService.getEmailShareLink(this.referralCode.code);
  }

  claimReward(reward: ReferralReward): void {
    if (this.claimingRewardId) return;

    this.claimingRewardId = reward.id;

    this.referralService.claimReward(reward.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.claimingRewardId = null;

        if (result.success) {
          this.showSuccess(result.message);
          // Remove claimed reward from list
          this.pendingRewards = this.pendingRewards.filter(r => r.id !== reward.id);
          // Refresh stats
          this.referralService.getStats().subscribe(stats => this.stats = stats);
        } else {
          this.showError(result.message);
        }
      });
  }

  getRewardIcon(type: string): string {
    switch (type) {
      case 'loyalty_points':
        return 'fa-coins';
      case 'discount_code':
        return 'fa-tag';
      case 'credit':
        return 'fa-wallet';
      default:
        return 'fa-gift';
    }
  }

  private showSuccess(message: string): void {
    this.successMessage = message;
    setTimeout(() => this.successMessage = '', 5000);
  }

  private showError(message: string): void {
    this.errorMessage = message;
    setTimeout(() => this.errorMessage = '', 5000);
  }
}
