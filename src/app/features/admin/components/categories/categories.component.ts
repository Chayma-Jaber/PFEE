import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';

export interface AdminCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  parentId?: number | null;
  parentName?: string | null;
  imageUrl?: string;
  bannerUrl?: string;
  position: number;
  isActive: boolean;
  isFeatured: boolean;
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string;
  productCount?: number;
}

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss']
})
export class AdminCategoriesComponent implements OnInit {
  categories: AdminCategory[] = [];
  parentFilter: number | null = null;
  searchQuery = '';

  isLoading = false;
  isSaving = false;

  showModal = false;
  editing: AdminCategory | null = null;
  form: Partial<AdminCategory> = this.getEmptyForm();

  successMessage = '';
  errorMessage = '';

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  get filteredCategories(): AdminCategory[] {
    let list = this.categories;
    if (this.parentFilter === -1) {
      list = list.filter(c => !c.parentId);
    } else if (this.parentFilter && this.parentFilter > 0) {
      list = list.filter(c => c.parentId === this.parentFilter);
    }
    const q = this.searchQuery?.trim().toLowerCase();
    if (q) {
      list = list.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.slug?.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  get parentCandidates(): AdminCategory[] {
    const editingId = this.editing?.id;
    return this.categories.filter(c => c.id !== editingId && !c.parentId);
  }

  loadCategories(): void {
    this.isLoading = true;
    this.adminService.getCategories().subscribe({
      next: (response) => {
        this.categories = (response?.categories || []) as AdminCategory[];
        this.isLoading = false;
      },
      error: () => {
        this.showError('Erreur lors du chargement des catégories');
        this.isLoading = false;
      }
    });
  }

  openModal(category?: AdminCategory): void {
    if (category) {
      this.editing = category;
      this.form = { ...category };
    } else {
      this.editing = null;
      this.form = this.getEmptyForm();
    }
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editing = null;
    this.form = this.getEmptyForm();
  }

  save(): void {
    if (!this.form.name?.trim()) {
      this.showError('Le nom de la catégorie est requis');
      return;
    }

    this.isSaving = true;
    const payload = {
      name: this.form.name?.trim(),
      slug: this.form.slug?.trim() || undefined,
      description: this.form.description || null,
      parentId: this.form.parentId || null,
      imageUrl: this.form.imageUrl || null,
      bannerUrl: this.form.bannerUrl || null,
      position: this.form.position != null ? Number(this.form.position) : 0,
      isActive: this.form.isActive !== false,
      isFeatured: !!this.form.isFeatured,
      metaTitle: this.form.metaTitle || null,
      metaDescription: this.form.metaDescription || null,
      keywords: this.form.keywords || null,
    };

    const request$ = this.editing?.id
      ? this.adminService.updateCategory(this.editing.id, payload)
      : this.adminService.createCategory(payload);

    request$.subscribe({
      next: () => {
        this.showSuccess(this.editing?.id ? 'Catégorie mise à jour' : 'Catégorie créée');
        this.closeModal();
        this.loadCategories();
        this.isSaving = false;
      },
      error: (err) => {
        const msg = err?.error?.message || (this.editing?.id ? 'Erreur lors de la mise à jour' : 'Erreur lors de la création');
        this.showError(Array.isArray(msg) ? msg.join(', ') : msg);
        this.isSaving = false;
      }
    });
  }

  remove(category: AdminCategory): void {
    if (!confirm(`Supprimer la catégorie "${category.name}" ?\n${category.productCount ? `${category.productCount} produit(s) seront détachés.` : ''}`)) {
      return;
    }
    this.adminService.deleteCategory(category.id).subscribe({
      next: () => {
        this.showSuccess('Catégorie supprimée');
        this.loadCategories();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Erreur lors de la suppression';
        this.showError(msg);
      }
    });
  }

  toggleStatus(category: AdminCategory): void {
    this.adminService.toggleCategory(category.id).subscribe({
      next: (res) => {
        category.isActive = res?.isActive ?? !category.isActive;
        this.showSuccess(category.isActive ? 'Catégorie activée' : 'Catégorie désactivée');
      },
      error: () => this.showError('Erreur lors du changement de statut')
    });
  }

  toggleFeatured(category: AdminCategory): void {
    const next = !category.isFeatured;
    this.adminService.updateCategory(category.id, { isFeatured: next }).subscribe({
      next: () => {
        category.isFeatured = next;
        this.showSuccess(next ? 'Catégorie mise en avant' : 'Mise en avant retirée');
      },
      error: () => this.showError('Erreur lors du changement')
    });
  }

  getEmptyForm(): Partial<AdminCategory> {
    return {
      name: '',
      slug: '',
      description: '',
      parentId: null,
      imageUrl: '',
      bannerUrl: '',
      position: 0,
      isActive: true,
      isFeatured: false,
      metaTitle: '',
      metaDescription: '',
      keywords: ''
    };
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
}
