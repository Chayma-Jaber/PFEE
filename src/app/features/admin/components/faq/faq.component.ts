import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FAQService, FAQCategory, FAQ } from '../../../../services/faq.service';

@Component({
  selector: 'app-admin-faq',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './faq.component.html',
  styleUrls: ['./faq.component.scss']
})
export class AdminFAQComponent implements OnInit {
  // View state
  activeTab: 'categories' | 'faqs' = 'categories';

  // Data
  categories: FAQCategory[] = [];
  faqs: FAQ[] = [];
  selectedCategoryId: number | null = null;

  // Loading states
  isLoading = false;
  isSaving = false;

  // Modal state
  showCategoryModal = false;
  showFAQModal = false;
  editingCategory: Partial<FAQCategory> | null = null;
  editingFAQ: any = null;

  // Form data
  categoryForm: Partial<FAQCategory> = this.getEmptyCategoryForm();
  faqForm: any = this.getEmptyFAQForm();

  // Messages
  successMessage = '';
  errorMessage = '';

  constructor(private faqService: FAQService) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  // ==================== Categories ====================

  loadCategories(): void {
    this.isLoading = true;
    this.faqService.adminGetCategories().subscribe({
      next: (response) => {
        this.categories = response.categories || [];
        this.isLoading = false;
      },
      error: () => {
        this.categories = [];
        this.isLoading = false;
      }
    });
  }

  openCategoryModal(category?: FAQCategory): void {
    if (category) {
      this.editingCategory = category;
      this.categoryForm = { ...category };
    } else {
      this.editingCategory = null;
      this.categoryForm = this.getEmptyCategoryForm();
    }
    this.showCategoryModal = true;
  }

  closeCategoryModal(): void {
    this.showCategoryModal = false;
    this.editingCategory = null;
    this.categoryForm = this.getEmptyCategoryForm();
  }

  saveCategory(): void {
    if (!this.categoryForm.name?.trim()) {
      this.showError('Le nom de la catégorie est requis');
      return;
    }

    this.isSaving = true;

    if (this.editingCategory?.id) {
      this.faqService.adminUpdateCategory(this.editingCategory.id, this.categoryForm).subscribe({
        next: () => {
          this.showSuccess('Catégorie mise à jour');
          this.closeCategoryModal();
          this.loadCategories();
          this.isSaving = false;
        },
        error: () => {
          this.showError('Erreur lors de la mise à jour');
          this.isSaving = false;
        }
      });
    } else {
      this.faqService.adminCreateCategory(this.categoryForm).subscribe({
        next: () => {
          this.showSuccess('Catégorie créée');
          this.closeCategoryModal();
          this.loadCategories();
          this.isSaving = false;
        },
        error: () => {
          this.showError('Erreur lors de la création');
          this.isSaving = false;
        }
      });
    }
  }

  deleteCategory(category: FAQCategory): void {
    if (!confirm(`Supprimer la catégorie "${category.name}" et toutes ses FAQs ?`)) {
      return;
    }

    this.faqService.adminDeleteCategory(category.id).subscribe({
      next: () => {
        this.showSuccess('Catégorie supprimée');
        this.loadCategories();
      },
      error: () => {
        this.showError('Erreur lors de la suppression');
      }
    });
  }

  toggleCategoryStatus(category: FAQCategory): void {
    this.faqService.adminToggleCategory(category.id).subscribe({
      next: () => {
        category.isActive = !category.isActive;
        this.showSuccess(category.isActive ? 'Catégorie activée' : 'Catégorie désactivée');
      },
      error: () => {
        this.showError('Erreur lors du changement de statut');
      }
    });
  }

  // ==================== FAQs ====================

  loadFAQs(): void {
    this.isLoading = true;
    this.faqService.adminGetFAQs(this.selectedCategoryId || undefined).subscribe({
      next: (response) => {
        this.faqs = response.faqs || [];
        this.isLoading = false;
      },
      error: () => {
        this.faqs = [];
        this.isLoading = false;
      }
    });
  }

  selectCategory(categoryId: number | null): void {
    this.selectedCategoryId = categoryId;
    this.loadFAQs();
  }

  openFAQModal(faq?: FAQ): void {
    if (!this.categories.length) {
      this.showError('Veuillez d\'abord créer une catégorie');
      return;
    }

    if (faq) {
      this.editingFAQ = faq;
      this.faqForm = {
        categoryId: faq.categoryId,
        question: faq.question,
        questionEn: faq.questionEn || '',
        answer: faq.answer,
        answerEn: faq.answerEn || '',
        order: faq.order,
        isFeatured: faq.isFeatured,
        keywords: faq.keywords?.join(', ') || ''
      };
    } else {
      this.editingFAQ = null;
      this.faqForm = this.getEmptyFAQForm();
      if (this.selectedCategoryId) {
        this.faqForm.categoryId = this.selectedCategoryId;
      }
    }
    this.showFAQModal = true;
  }

  closeFAQModal(): void {
    this.showFAQModal = false;
    this.editingFAQ = null;
    this.faqForm = this.getEmptyFAQForm();
  }

  saveFAQ(): void {
    if (!this.faqForm.question?.trim() || !this.faqForm.answer?.trim()) {
      this.showError('La question et la réponse sont requises');
      return;
    }

    if (!this.faqForm.categoryId) {
      this.showError('Veuillez sélectionner une catégorie');
      return;
    }

    this.isSaving = true;

    const data = {
      category_id: this.faqForm.categoryId,
      question: this.faqForm.question,
      question_en: this.faqForm.questionEn || null,
      answer: this.faqForm.answer,
      answer_en: this.faqForm.answerEn || null,
      order: this.faqForm.order || 0,
      is_featured: this.faqForm.isFeatured || false,
      keywords: this.faqForm.keywords ? this.faqForm.keywords.split(',').map((k: string) => k.trim()).filter((k: string) => k) : []
    };

    if (this.editingFAQ?.id) {
      this.faqService.adminUpdateFAQ(this.editingFAQ.id, data).subscribe({
        next: () => {
          this.showSuccess('FAQ mise à jour');
          this.closeFAQModal();
          this.loadFAQs();
          this.isSaving = false;
        },
        error: () => {
          this.showError('Erreur lors de la mise à jour');
          this.isSaving = false;
        }
      });
    } else {
      this.faqService.adminCreateFAQ(data).subscribe({
        next: () => {
          this.showSuccess('FAQ créée');
          this.closeFAQModal();
          this.loadFAQs();
          this.loadCategories(); // Refresh counts
          this.isSaving = false;
        },
        error: () => {
          this.showError('Erreur lors de la création');
          this.isSaving = false;
        }
      });
    }
  }

  deleteFAQ(faq: FAQ): void {
    if (!confirm('Supprimer cette FAQ ?')) {
      return;
    }

    this.faqService.adminDeleteFAQ(faq.id).subscribe({
      next: () => {
        this.showSuccess('FAQ supprimée');
        this.loadFAQs();
        this.loadCategories(); // Refresh counts
      },
      error: () => {
        this.showError('Erreur lors de la suppression');
      }
    });
  }

  toggleFAQStatus(faq: FAQ): void {
    this.faqService.adminToggleFAQ(faq.id).subscribe({
      next: () => {
        faq.isActive = !faq.isActive;
        this.showSuccess(faq.isActive ? 'FAQ activée' : 'FAQ désactivée');
      },
      error: () => {
        this.showError('Erreur lors du changement de statut');
      }
    });
  }

  toggleFeatured(faq: FAQ): void {
    this.faqService.adminToggleFeatured(faq.id).subscribe({
      next: () => {
        faq.isFeatured = !faq.isFeatured;
        this.showSuccess(faq.isFeatured ? 'FAQ mise en avant' : 'FAQ retirée de la mise en avant');
      },
      error: () => {
        this.showError('Erreur lors du changement');
      }
    });
  }

  // ==================== Helpers ====================

  getEmptyCategoryForm(): Partial<FAQCategory> {
    return {
      name: '',
      nameEn: '',
      description: '',
      icon: 'bi-question-circle',
      order: 0,
      isActive: true
    };
  }

  getEmptyFAQForm(): any {
    return {
      categoryId: null,
      question: '',
      questionEn: '',
      answer: '',
      answerEn: '',
      order: 0,
      isFeatured: false,
      keywords: ''
    };
  }

  getCategoryName(categoryId: number): string {
    return this.categories.find(c => c.id === categoryId)?.name || 'Inconnue';
  }

  showSuccess(message: string): void {
    this.successMessage = message;
    this.errorMessage = '';
    setTimeout(() => this.successMessage = '', 3000);
  }

  showError(message: string): void {
    this.errorMessage = message;
    this.successMessage = '';
    setTimeout(() => this.errorMessage = '', 5000);
  }

  switchTab(tab: 'categories' | 'faqs'): void {
    this.activeTab = tab;
    if (tab === 'faqs' && !this.faqs.length) {
      this.loadFAQs();
    }
  }
}
