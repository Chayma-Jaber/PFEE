/**
 * BARSHA PRODUCT Q&A COMPONENT
 * =============================
 * Displays product questions and answers with interactive features.
 * Premium UX with search, pagination, and helpful votes.
 */
import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  ProductQAService,
  ProductQuestion,
  ProductAnswer
} from '../../../services/product-qa.service';

@Component({
  selector: 'app-product-qa',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <section class="product-qa" *ngIf="productId">
      <!-- Section Header -->
      <div class="qa-header">
        <h2 class="section-title">
          <i class="fas fa-comments"></i>
          Questions & Reponses
          <span class="qa-count" *ngIf="totalQuestions > 0">({{ totalQuestions }})</span>
        </h2>
      </div>

      <!-- Loading State -->
      <div class="loading-skeleton" *ngIf="isLoading">
        <div class="skeleton-item" *ngFor="let i of [1,2]"></div>
      </div>

      <!-- Content -->
      <div class="qa-content" *ngIf="!isLoading">
        <!-- Search & Ask Button -->
        <div class="qa-actions">
          <div class="search-box" *ngIf="totalQuestions > 3">
            <i class="fas fa-search"></i>
            <input type="text"
                   [(ngModel)]="searchQuery"
                   (ngModelChange)="onSearchChange()"
                   placeholder="Rechercher une question..."
                   class="search-input">
            <button class="clear-search" *ngIf="searchQuery" (click)="clearSearch()">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <button class="btn-ask-question" (click)="openQuestionForm()" *ngIf="!showQuestionForm">
            <i class="fas fa-plus"></i>
            Poser une question
          </button>
        </div>

        <!-- Question Form -->
        <div class="question-form-container" *ngIf="showQuestionForm">
          <div class="form-header">
            <h3>Poser une question</h3>
            <button class="btn-close" (click)="closeQuestionForm()">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <form (ngSubmit)="submitQuestion()">
            <div class="form-group">
              <textarea
                [(ngModel)]="newQuestionText"
                name="questionText"
                placeholder="Posez votre question sur ce produit..."
                rows="3"
                required
                minlength="10"
                maxlength="1000"
                class="question-textarea"></textarea>
              <span class="char-count">{{ newQuestionText.length }}/1000</span>
            </div>
            <div class="form-actions">
              <button type="button" class="btn-cancel" (click)="closeQuestionForm()">Annuler</button>
              <button type="submit" class="btn-submit" [disabled]="newQuestionText.length < 10 || isSubmitting">
                <span *ngIf="!isSubmitting">
                  <i class="fas fa-paper-plane"></i>
                  Soumettre
                </span>
                <span *ngIf="isSubmitting">
                  <i class="fas fa-spinner fa-spin"></i>
                  Envoi...
                </span>
              </button>
            </div>
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

        <!-- Empty State -->
        <div class="empty-qa" *ngIf="questions.length === 0 && !searchQuery">
          <div class="empty-icon">
            <i class="far fa-question-circle"></i>
          </div>
          <h3>Pas encore de questions</h3>
          <p>Soyez le premier a poser une question sur ce produit!</p>
        </div>

        <!-- No Results -->
        <div class="no-results" *ngIf="questions.length === 0 && searchQuery">
          <i class="fas fa-search"></i>
          <p>Aucune question ne correspond a votre recherche</p>
          <button class="btn-clear-search" (click)="clearSearch()">Effacer la recherche</button>
        </div>

        <!-- Questions List -->
        <div class="questions-list" *ngIf="questions.length > 0">
          <div class="question-card" *ngFor="let question of questions" [class.expanded]="expandedQuestions.has(question.id)">
            <!-- Question Header -->
            <div class="question-header" (click)="toggleQuestion(question.id)">
              <div class="question-icon">
                <i class="fas fa-question"></i>
              </div>
              <div class="question-content">
                <p class="question-text">{{ question.questionText }}</p>
                <div class="question-meta">
                  <span class="question-author" *ngIf="question.user">
                    {{ question.user.firstName }} {{ question.user.lastInitial }}.
                  </span>
                  <span class="question-date">{{ qaService.formatTimeAgo(question.createdAt) }}</span>
                  <span class="answer-count" *ngIf="question.answerCount > 0">
                    <i class="fas fa-comment"></i>
                    {{ question.answerCount }} reponse{{ question.answerCount > 1 ? 's' : '' }}
                  </span>
                </div>
              </div>
              <div class="expand-icon">
                <i class="fas" [class.fa-chevron-down]="!expandedQuestions.has(question.id)" [class.fa-chevron-up]="expandedQuestions.has(question.id)"></i>
              </div>
            </div>

            <!-- Answers Section (Expandable) -->
            <div class="answers-section" *ngIf="expandedQuestions.has(question.id)">
              <!-- Answers List -->
              <div class="answers-list" *ngIf="question.answers && question.answers.length > 0">
                <div class="answer-card" *ngFor="let answer of question.answers" [class.staff-answer]="answer.isStaff">
                  <div class="answer-icon" [class.staff]="answer.isStaff">
                    <i class="fas" [class.fa-store]="answer.isStaff" [class.fa-user]="!answer.isStaff"></i>
                  </div>
                  <div class="answer-content">
                    <div class="answer-header">
                      <span class="answer-author" *ngIf="answer.user">
                        {{ answer.user.firstName }} {{ answer.user.lastInitial }}
                        <span class="staff-badge" *ngIf="answer.isStaff">Reponse officielle</span>
                      </span>
                      <span class="answer-date">{{ qaService.formatTimeAgo(answer.createdAt) }}</span>
                    </div>
                    <p class="answer-text">{{ answer.answerText }}</p>
                    <div class="answer-actions">
                      <button class="btn-helpful" [class.voted]="answer.hasVoted" (click)="voteHelpful(answer)" [disabled]="!isLoggedIn">
                        <i class="fas fa-thumbs-up"></i>
                        Utile ({{ answer.helpfulCount }})
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- No Answers -->
              <div class="no-answers" *ngIf="!question.answers || question.answers.length === 0">
                <p>Aucune reponse pour le moment</p>
              </div>

              <!-- Answer Form -->
              <div class="answer-form" *ngIf="!answeringQuestion || answeringQuestion !== question.id">
                <button class="btn-answer" (click)="startAnswering(question.id)">
                  <i class="fas fa-reply"></i>
                  Repondre a cette question
                </button>
              </div>

              <div class="answer-form-container" *ngIf="answeringQuestion === question.id">
                <form (ngSubmit)="submitAnswer(question.id)">
                  <div class="form-group">
                    <textarea
                      [(ngModel)]="newAnswerText"
                      name="answerText"
                      placeholder="Ecrivez votre reponse..."
                      rows="3"
                      required
                      minlength="5"
                      maxlength="2000"
                      class="answer-textarea"></textarea>
                    <span class="char-count">{{ newAnswerText.length }}/2000</span>
                  </div>
                  <div class="form-actions">
                    <button type="button" class="btn-cancel" (click)="cancelAnswering()">Annuler</button>
                    <button type="submit" class="btn-submit" [disabled]="newAnswerText.length < 5 || isSubmittingAnswer">
                      <span *ngIf="!isSubmittingAnswer">
                        <i class="fas fa-paper-plane"></i>
                        Repondre
                      </span>
                      <span *ngIf="isSubmittingAnswer">
                        <i class="fas fa-spinner fa-spin"></i>
                        Envoi...
                      </span>
                    </button>
                  </div>
                  <div class="form-message success" *ngIf="answerMessage && answerSuccess">
                    <i class="fas fa-check-circle"></i>
                    {{ answerMessage }}
                  </div>
                  <div class="form-message error" *ngIf="answerMessage && !answerSuccess">
                    <i class="fas fa-exclamation-circle"></i>
                    {{ answerMessage }}
                  </div>
                </form>
              </div>
            </div>
          </div>
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
    .product-qa {
      margin: 40px 0;
      padding: 30px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.05);
    }

    .qa-header {
      margin-bottom: 25px;
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
      color: #667eea;
    }

    .qa-count {
      font-weight: 400;
      color: #888;
      font-size: 18px;
    }

    /* Loading */
    .loading-skeleton {
      animation: pulse 1.5s infinite;
    }

    .skeleton-item {
      height: 120px;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      border-radius: 12px;
      margin-bottom: 15px;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* Actions */
    .qa-actions {
      display: flex;
      gap: 16px;
      margin-bottom: 25px;
      flex-wrap: wrap;
      align-items: center;
    }

    .search-box {
      flex: 1;
      min-width: 200px;
      max-width: 400px;
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-box i {
      position: absolute;
      left: 14px;
      color: #888;
    }

    .search-input {
      width: 100%;
      padding: 12px 40px 12px 40px;
      border: 1px solid #e0e0e0;
      border-radius: 25px;
      font-size: 14px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .search-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .clear-search {
      position: absolute;
      right: 14px;
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      padding: 4px;
    }

    .btn-ask-question {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      border: none;
      padding: 12px 24px;
      border-radius: 25px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.3s ease;
      white-space: nowrap;
    }

    .btn-ask-question:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }

    /* Question Form */
    .question-form-container {
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
      font-size: 18px;
    }

    .btn-close {
      background: none;
      border: none;
      font-size: 20px;
      color: #888;
      cursor: pointer;
      padding: 4px;
    }

    .form-group {
      margin-bottom: 15px;
    }

    .question-textarea,
    .answer-textarea {
      width: 100%;
      padding: 14px 16px;
      border: 1px solid #ddd;
      border-radius: 10px;
      font-size: 14px;
      resize: vertical;
      font-family: inherit;
      transition: border-color 0.2s;
    }

    .question-textarea:focus,
    .answer-textarea:focus {
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

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .btn-cancel {
      background: #fff;
      border: 1px solid #ddd;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-cancel:hover {
      background: #f5f5f5;
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
      transition: background 0.2s;
    }

    .btn-submit:hover:not(:disabled) {
      background: #2d2d4a;
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
      font-size: 14px;
    }

    .form-message.success {
      background: #d4edda;
      color: #155724;
    }

    .form-message.error {
      background: #f8d7da;
      color: #721c24;
    }

    /* Empty State */
    .empty-qa, .no-results {
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

    .empty-qa h3, .no-results p {
      color: #1a1a2e;
      margin-bottom: 8px;
    }

    .empty-qa p {
      color: #888;
    }

    .no-results i {
      font-size: 48px;
      color: #ccc;
      margin-bottom: 16px;
    }

    .btn-clear-search {
      background: #f0f0f0;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      color: #666;
      cursor: pointer;
      margin-top: 10px;
    }

    /* Questions List */
    .questions-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .question-card {
      background: #fff;
      border: 1px solid #eee;
      border-radius: 12px;
      overflow: hidden;
      transition: box-shadow 0.2s;
    }

    .question-card:hover {
      box-shadow: 0 4px 15px rgba(0,0,0,0.08);
    }

    .question-card.expanded {
      border-color: #667eea;
    }

    .question-header {
      display: flex;
      align-items: flex-start;
      gap: 15px;
      padding: 20px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .question-header:hover {
      background: #fafafa;
    }

    .question-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .question-icon i {
      color: #fff;
      font-size: 16px;
    }

    .question-content {
      flex: 1;
      min-width: 0;
    }

    .question-text {
      font-size: 15px;
      color: #1a1a2e;
      margin: 0 0 8px;
      line-height: 1.5;
    }

    .question-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      font-size: 13px;
      color: #888;
    }

    .question-author {
      font-weight: 500;
      color: #555;
    }

    .answer-count {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #667eea;
    }

    .expand-icon {
      color: #888;
      font-size: 14px;
      padding: 8px;
    }

    /* Answers Section */
    .answers-section {
      border-top: 1px solid #eee;
      padding: 20px;
      background: #fafafa;
    }

    .answers-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 20px;
    }

    .answer-card {
      display: flex;
      gap: 12px;
      padding: 16px;
      background: #fff;
      border-radius: 10px;
      border-left: 3px solid #e0e0e0;
    }

    .answer-card.staff-answer {
      border-left-color: #667eea;
      background: linear-gradient(135deg, rgba(102,126,234,0.03) 0%, #fff 100%);
    }

    .answer-icon {
      width: 32px;
      height: 32px;
      background: #f0f0f0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .answer-icon.staff {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .answer-icon i {
      font-size: 14px;
      color: #888;
    }

    .answer-icon.staff i {
      color: #fff;
    }

    .answer-content {
      flex: 1;
      min-width: 0;
    }

    .answer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      flex-wrap: wrap;
      gap: 8px;
    }

    .answer-author {
      font-weight: 600;
      color: #1a1a2e;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .staff-badge {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 500;
    }

    .answer-date {
      font-size: 12px;
      color: #888;
    }

    .answer-text {
      font-size: 14px;
      color: #555;
      line-height: 1.6;
      margin: 0 0 12px;
    }

    .answer-actions {
      display: flex;
      gap: 10px;
    }

    .btn-helpful {
      background: none;
      border: 1px solid #ddd;
      padding: 6px 12px;
      border-radius: 15px;
      font-size: 12px;
      color: #666;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }

    .btn-helpful:hover:not(:disabled) {
      background: #f5f5f5;
    }

    .btn-helpful.voted {
      background: #667eea;
      color: #fff;
      border-color: #667eea;
    }

    .btn-helpful:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* No Answers */
    .no-answers {
      text-align: center;
      padding: 20px;
      color: #888;
      font-size: 14px;
    }

    /* Answer Form */
    .answer-form {
      margin-top: 15px;
    }

    .btn-answer {
      background: #fff;
      border: 1px dashed #667eea;
      padding: 10px 20px;
      border-radius: 8px;
      color: #667eea;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }

    .btn-answer:hover {
      background: rgba(102, 126, 234, 0.05);
    }

    .answer-form-container {
      background: #fff;
      border-radius: 10px;
      padding: 20px;
      margin-top: 15px;
      border: 1px solid #e0e0e0;
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
      display: flex;
      align-items: center;
      justify-content: center;
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
      .product-qa {
        padding: 20px;
        margin: 30px 0;
      }

      .qa-actions {
        flex-direction: column;
        align-items: stretch;
      }

      .search-box {
        max-width: none;
      }

      .btn-ask-question {
        justify-content: center;
      }

      .question-header {
        padding: 15px;
      }

      .question-icon {
        width: 36px;
        height: 36px;
      }

      .question-meta {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }

      .answers-section {
        padding: 15px;
      }

      .answer-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .form-actions {
        flex-direction: column;
      }

      .btn-cancel, .btn-submit {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class ProductQAComponent implements OnInit, OnChanges {
  @Input() productId!: number | string;

  questions: ProductQuestion[] = [];
  expandedQuestions = new Set<number>();
  totalQuestions = 0;
  totalPages = 1;
  currentPage = 1;
  pageSize = 5;

  isLoading = true;
  isLoggedIn = false;

  // Search
  searchQuery = '';
  private searchTimeout: any;

  // Question form
  showQuestionForm = false;
  newQuestionText = '';
  isSubmitting = false;
  submitMessage = '';
  submitSuccess = false;

  // Answer form
  answeringQuestion: number | null = null;
  newAnswerText = '';
  isSubmittingAnswer = false;
  answerMessage = '';
  answerSuccess = false;

  constructor(public qaService: ProductQAService) {}

  ngOnInit(): void {
    this.isLoggedIn = !!localStorage.getItem('jwt');
    this.loadQuestions();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productId'] && !changes['productId'].firstChange) {
      this.currentPage = 1;
      this.searchQuery = '';
      this.loadQuestions();
    }
  }

  loadQuestions(): void {
    if (!this.productId) return;

    this.isLoading = true;

    this.qaService.getQuestions(this.productId, {
      page: this.currentPage,
      limit: this.pageSize,
      search: this.searchQuery || undefined
    }).subscribe(response => {
      this.questions = response.questions;
      this.totalQuestions = response.pagination.total;
      this.totalPages = response.pagination.pages;
      this.isLoading = false;

      // Auto-expand the first question if there are any
      if (this.questions.length > 0 && this.expandedQuestions.size === 0) {
        this.expandedQuestions.add(this.questions[0].id);
      }
    });
  }

  toggleQuestion(questionId: number): void {
    if (this.expandedQuestions.has(questionId)) {
      this.expandedQuestions.delete(questionId);
    } else {
      this.expandedQuestions.add(questionId);
    }
  }

  onSearchChange(): void {
    // Debounce search
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage = 1;
      this.loadQuestions();
    }, 300);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.currentPage = 1;
    this.loadQuestions();
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.expandedQuestions.clear();
      this.loadQuestions();
    }
  }

  // Question Form
  openQuestionForm(): void {
    if (!this.isLoggedIn) {
      window.location.href = '/login';
      return;
    }
    this.showQuestionForm = true;
    this.resetQuestionForm();
  }

  closeQuestionForm(): void {
    this.showQuestionForm = false;
    this.resetQuestionForm();
  }

  resetQuestionForm(): void {
    this.newQuestionText = '';
    this.submitMessage = '';
    this.submitSuccess = false;
  }

  submitQuestion(): void {
    if (this.newQuestionText.length < 10) return;

    this.isSubmitting = true;
    this.submitMessage = '';

    this.qaService.askQuestion(this.productId, this.newQuestionText).subscribe(result => {
      this.isSubmitting = false;
      this.submitMessage = result.message;
      this.submitSuccess = result.success;

      if (result.success) {
        setTimeout(() => {
          this.closeQuestionForm();
          // Note: Question won't appear immediately as it needs moderation
        }, 2000);
      }
    });
  }

  // Answer Form
  startAnswering(questionId: number): void {
    if (!this.isLoggedIn) {
      window.location.href = '/login';
      return;
    }
    this.answeringQuestion = questionId;
    this.newAnswerText = '';
    this.answerMessage = '';
    this.answerSuccess = false;
  }

  cancelAnswering(): void {
    this.answeringQuestion = null;
    this.newAnswerText = '';
    this.answerMessage = '';
  }

  submitAnswer(questionId: number): void {
    if (this.newAnswerText.length < 5) return;

    this.isSubmittingAnswer = true;
    this.answerMessage = '';

    this.qaService.answerQuestion(questionId, this.newAnswerText).subscribe(result => {
      this.isSubmittingAnswer = false;
      this.answerMessage = result.message;
      this.answerSuccess = result.success;

      if (result.success) {
        setTimeout(() => {
          this.cancelAnswering();
          // Note: Answer won't appear immediately as it needs moderation
        }, 2000);
      }
    });
  }

  // Helpful Vote
  voteHelpful(answer: ProductAnswer): void {
    if (!this.isLoggedIn) return;

    this.qaService.markHelpful(answer.id).subscribe(result => {
      if (result.success) {
        answer.helpfulCount = result.helpfulCount;
        answer.hasVoted = result.hasVoted;
      }
    });
  }
}
