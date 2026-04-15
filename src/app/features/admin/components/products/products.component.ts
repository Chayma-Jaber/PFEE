import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminProduct } from '../../services/admin.service';

interface ProductForm {
  sku: string;
  title: string;
  description: string;
  short_description: string;
  price: number;
  current_price: number;
  discount: boolean;
  discount_value: number;
  famille: string;
  ligne: string;
  is_active: boolean;
  is_new: boolean;
  is_featured: boolean;
  first_image_url: string;
  second_image_url: string;
}

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="admin-products">
      <div class="page-header">
        <h1>Gestion des produits</h1>
        <button class="btn-add" (click)="openCreateModal()">
          <i class="bi bi-plus-lg"></i> Ajouter un produit
        </button>
      </div>

      <div class="filters-bar">
        <div class="search-box">
          <i class="bi bi-search"></i>
          <input type="text" [(ngModel)]="searchQuery" placeholder="Rechercher..." (keyup.enter)="loadProducts()">
        </div>
        <select [(ngModel)]="familleFilter" (change)="loadProducts()">
          <option value="">Toutes les familles</option>
          <option value="WOMEN">Femme</option>
          <option value="MEN">Homme</option>
          <option value="KIDS">Enfant</option>
        </select>
        <label class="checkbox-filter">
          <input type="checkbox" [(ngModel)]="lowStockOnly" (change)="loadProducts()">
          Stock faible uniquement
        </label>
      </div>

      <div class="products-grid">
        <div class="product-card" *ngFor="let product of products">
          <div class="product-image">
            <img [src]="product.firstImageUrl || 'assets/images/placeholder.png'" [alt]="product.title">
            <span class="stock-badge" [class.low]="product.totalStock < 10" [class.out]="product.totalStock === 0">
              {{ product.totalStock === 0 ? 'Rupture' : product.totalStock + ' en stock' }}
            </span>
          </div>
          <div class="product-info">
            <h3>{{ product.title }}</h3>
            <p class="sku">SKU: {{ product.sku }}</p>
            <div class="price-row">
              <span class="price">{{ (product.currentPrice || 0).toFixed(3) }} TND</span>
              <span class="discount" *ngIf="product.discount">-{{ product.discountValue }}%</span>
            </div>
            <div class="status-row">
              <span class="status" [class.active]="product.isActive" [class.inactive]="!product.isActive">
                {{ product.isActive ? 'Actif' : 'Inactif' }}
              </span>
            </div>
          </div>
          <div class="product-actions">
            <button class="btn-icon btn-edit" (click)="openEditModal(product)" title="Modifier">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn-icon btn-toggle" (click)="toggleActive(product)" [title]="product.isActive ? 'Desactiver' : 'Activer'">
              <i class="bi" [class.bi-eye]="product.isActive" [class.bi-eye-slash]="!product.isActive"></i>
            </button>
            <button class="btn-icon btn-delete" (click)="confirmDelete(product)" title="Archiver">
              <i class="bi bi-archive"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="empty-state" *ngIf="products.length === 0 && !isLoading">
        <i class="bi bi-box-seam"></i>
        <p>Aucun produit trouve</p>
      </div>

      <div class="pagination" *ngIf="totalPages > 1">
        <button (click)="changePage(currentPage - 1)" [disabled]="currentPage === 1">
          <i class="bi bi-chevron-left"></i>
        </button>
        <span>{{ currentPage }} / {{ totalPages }}</span>
        <button (click)="changePage(currentPage + 1)" [disabled]="currentPage === totalPages">
          <i class="bi bi-chevron-right"></i>
        </button>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>{{ editingProduct ? 'Modifier le produit' : 'Nouveau produit' }}</h2>
          <button class="btn-close" (click)="closeModal()">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label>SKU *</label>
              <input type="text" [(ngModel)]="productForm.sku" placeholder="BRS-001" [disabled]="!!editingProduct">
            </div>
            <div class="form-group">
              <label>Titre *</label>
              <input type="text" [(ngModel)]="productForm.title" placeholder="Nom du produit">
            </div>
          </div>
          <div class="form-group">
            <label>Description courte</label>
            <input type="text" [(ngModel)]="productForm.short_description" placeholder="Description courte">
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea [(ngModel)]="productForm.description" placeholder="Description complete" rows="3"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Prix (TND) *</label>
              <input type="number" [(ngModel)]="productForm.price" step="0.001" min="0">
            </div>
            <div class="form-group">
              <label>Prix actuel (TND)</label>
              <input type="number" [(ngModel)]="productForm.current_price" step="0.001" min="0">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Famille</label>
              <select [(ngModel)]="productForm.famille">
                <option value="">Selectionner</option>
                <option value="WOMEN">Femme</option>
                <option value="MEN">Homme</option>
                <option value="KIDS">Enfant</option>
                <option value="TEEN WOMEN">Ado Femme</option>
                <option value="TEEN MEN">Ado Homme</option>
              </select>
            </div>
            <div class="form-group">
              <label>Ligne</label>
              <input type="text" [(ngModel)]="productForm.ligne" placeholder="Collection">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Remise (%)</label>
              <input type="number" [(ngModel)]="productForm.discount_value" min="0" max="100">
            </div>
            <div class="form-group checkbox-group">
              <label>
                <input type="checkbox" [(ngModel)]="productForm.discount"> En promotion
              </label>
              <label>
                <input type="checkbox" [(ngModel)]="productForm.is_new"> Nouveau
              </label>
              <label>
                <input type="checkbox" [(ngModel)]="productForm.is_featured"> Mise en avant
              </label>
              <label>
                <input type="checkbox" [(ngModel)]="productForm.is_active"> Actif
              </label>
            </div>
          </div>
          <div class="form-group">
            <label>Image principale (URL)</label>
            <input type="text" [(ngModel)]="productForm.first_image_url" placeholder="https://...">
          </div>
          <div class="form-group">
            <label>Image secondaire (URL)</label>
            <input type="text" [(ngModel)]="productForm.second_image_url" placeholder="https://...">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" (click)="closeModal()">Annuler</button>
          <button class="btn-save" (click)="saveProduct()" [disabled]="isSubmitting">
            {{ isSubmitting ? 'Enregistrement...' : (editingProduct ? 'Mettre a jour' : 'Creer') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal-overlay" *ngIf="showDeleteModal" (click)="showDeleteModal = false">
      <div class="modal-content modal-small" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Confirmer l'archivage</h2>
          <button class="btn-close" (click)="showDeleteModal = false">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="modal-body">
          <p>Etes-vous sur de vouloir archiver ce produit ?</p>
          <p class="product-name">{{ productToDelete?.title }}</p>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" (click)="showDeleteModal = false">Annuler</button>
          <button class="btn-delete" (click)="deleteProduct()">Archiver</button>
        </div>
      </div>
    </div>

    <!-- Success/Error Messages -->
    <div class="toast" *ngIf="successMessage" [class.show]="successMessage">
      <i class="bi bi-check-circle"></i> {{ successMessage }}
    </div>
    <div class="toast error" *ngIf="errorMessage" [class.show]="errorMessage">
      <i class="bi bi-exclamation-circle"></i> {{ errorMessage }}
    </div>
  `,
  styles: [`
    .admin-products { max-width: 1400px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 600; color: #1a1a2e; margin: 0; }
    .btn-add { display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: #1a1a2e; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; }
    .btn-add:hover { background: #2a2a4e; }
    .filters-bar { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; align-items: center; }
    .search-box { flex: 1; min-width: 200px; position: relative; }
    .search-box i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #888; }
    .search-box input { width: 100%; padding: 10px 12px 10px 38px; border: 1px solid #e0e0e0; border-radius: 8px; }
    select { padding: 10px 16px; border: 1px solid #e0e0e0; border-radius: 8px; background: #fff; }
    .checkbox-filter { display: flex; align-items: center; gap: 8px; font-size: 14px; }
    .products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
    .product-card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .product-image { position: relative; aspect-ratio: 3/4; background: #f5f5f5; }
    .product-image img { width: 100%; height: 100%; object-fit: cover; }
    .stock-badge { position: absolute; top: 10px; right: 10px; padding: 4px 10px; background: #27ae60; color: #fff; font-size: 11px; border-radius: 4px; }
    .stock-badge.low { background: #f39c12; }
    .stock-badge.out { background: #e74c3c; }
    .product-info { padding: 16px; }
    .product-info h3 { font-size: 14px; font-weight: 500; margin: 0 0 4px 0; color: #1a1a2e; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .product-info .sku { font-size: 12px; color: #888; margin: 0 0 8px 0; }
    .price-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .price-row .price { font-size: 16px; font-weight: 600; color: #1a1a2e; }
    .price-row .discount { font-size: 12px; color: #e74c3c; font-weight: 600; }
    .status { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .status.active { background: #d4edda; color: #155724; }
    .status.inactive { background: #f8d7da; color: #721c24; }
    .product-actions { padding: 0 16px 16px; display: flex; justify-content: flex-end; gap: 8px; }
    .btn-icon { padding: 8px 10px; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
    .btn-edit { background: #e3f2fd; color: #1976d2; }
    .btn-edit:hover { background: #bbdefb; }
    .btn-toggle { background: #f0f0f0; color: #666; }
    .btn-toggle:hover { background: #e0e0e0; }
    .btn-delete { background: #ffebee; color: #c62828; }
    .btn-delete:hover { background: #ffcdd2; }
    .empty-state { text-align: center; padding: 60px; color: #888; }
    .empty-state i { font-size: 40px; margin-bottom: 16px; opacity: 0.5; }
    .pagination { display: flex; justify-content: center; align-items: center; gap: 16px; padding: 24px; }
    .pagination button { padding: 8px 12px; border: 1px solid #e0e0e0; background: #fff; border-radius: 6px; cursor: pointer; }
    .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Modal Styles */
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: #fff; border-radius: 12px; width: 90%; max-width: 600px; max-height: 90vh; overflow-y: auto; }
    .modal-content.modal-small { max-width: 400px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid #eee; }
    .modal-header h2 { margin: 0; font-size: 18px; font-weight: 600; }
    .btn-close { background: none; border: none; font-size: 18px; cursor: pointer; color: #666; }
    .modal-body { padding: 24px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 13px; font-weight: 500; color: #555; margin-bottom: 6px; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; }
    .form-group textarea { resize: vertical; }
    .checkbox-group { display: flex; flex-wrap: wrap; gap: 16px; padding-top: 24px; }
    .checkbox-group label { display: flex; align-items: center; gap: 6px; font-size: 13px; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 24px; border-top: 1px solid #eee; }
    .btn-cancel { padding: 10px 20px; background: #f5f5f5; color: #666; border: none; border-radius: 8px; cursor: pointer; }
    .btn-save { padding: 10px 20px; background: #1a1a2e; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
    .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
    .modal-body .btn-delete { padding: 10px 20px; background: #e74c3c; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
    .product-name { font-weight: 600; color: #1a1a2e; margin-top: 8px; }

    /* Toast */
    .toast { position: fixed; bottom: 24px; right: 24px; padding: 16px 24px; background: #27ae60; color: #fff; border-radius: 8px; display: flex; align-items: center; gap: 12px; z-index: 1100; animation: slideIn 0.3s ease; }
    .toast.error { background: #e74c3c; }
    @keyframes slideIn { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  `]
})
export class AdminProductsComponent implements OnInit {
  products: AdminProduct[] = [];
  isLoading = false;
  isSubmitting = false;
  searchQuery = '';
  familleFilter = '';
  lowStockOnly = false;
  currentPage = 1;
  totalPages = 1;

  // Modal states
  showModal = false;
  showDeleteModal = false;
  editingProduct: AdminProduct | null = null;
  productToDelete: AdminProduct | null = null;

  // Form
  productForm: ProductForm = this.getEmptyForm();

  // Messages
  successMessage = '';
  errorMessage = '';

  constructor(private adminService: AdminService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.lowStockOnly = params['low_stock'] === 'true';
      this.loadProducts();
    });
  }

  getEmptyForm(): ProductForm {
    return {
      sku: '',
      title: '',
      description: '',
      short_description: '',
      price: 0,
      current_price: 0,
      discount: false,
      discount_value: 0,
      famille: '',
      ligne: '',
      is_active: true,
      is_new: false,
      is_featured: false,
      first_image_url: '',
      second_image_url: ''
    };
  }

  loadProducts(): void {
    this.isLoading = true;
    this.adminService.getProducts({
      page: this.currentPage,
      search: this.searchQuery || undefined,
      famille: this.familleFilter || undefined,
      low_stock: this.lowStockOnly || undefined
    }).subscribe({
      next: (response) => {
        this.products = response.items;
        this.totalPages = response.pages;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading products:', err);
        this.isLoading = false;
      }
    });
  }

  toggleActive(product: AdminProduct): void {
    this.adminService.updateProduct(product.id, { is_active: !product.isActive }).subscribe({
      next: () => {
        product.isActive = !product.isActive;
        this.showSuccess(product.isActive ? 'Produit active' : 'Produit desactive');
      },
      error: () => this.showError('Erreur lors de la mise a jour')
    });
  }

  openCreateModal(): void {
    this.editingProduct = null;
    this.productForm = this.getEmptyForm();
    this.showModal = true;
  }

  openEditModal(product: AdminProduct): void {
    this.editingProduct = product;
    this.productForm = {
      sku: product.sku,
      title: product.title,
      description: '',
      short_description: '',
      price: product.price,
      current_price: product.currentPrice,
      discount: product.discount,
      discount_value: product.discountValue,
      famille: '',
      ligne: '',
      is_active: product.isActive,
      is_new: false,
      is_featured: false,
      first_image_url: product.firstImageUrl || '',
      second_image_url: ''
    };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingProduct = null;
    this.productForm = this.getEmptyForm();
  }

  saveProduct(): void {
    if (!this.productForm.sku || !this.productForm.title) {
      this.showError('SKU et titre sont requis');
      return;
    }

    this.isSubmitting = true;

    if (this.editingProduct) {
      // Update existing product
      this.adminService.updateProduct(this.editingProduct.id, this.productForm).subscribe({
        next: () => {
          this.showSuccess('Produit mis a jour');
          this.closeModal();
          this.loadProducts();
          this.isSubmitting = false;
        },
        error: () => {
          this.showError('Erreur lors de la mise a jour');
          this.isSubmitting = false;
        }
      });
    } else {
      // Create new product
      this.adminService.createProduct(this.productForm).subscribe({
        next: () => {
          this.showSuccess('Produit cree avec succes');
          this.closeModal();
          this.loadProducts();
          this.isSubmitting = false;
        },
        error: () => {
          this.showError('Erreur lors de la creation');
          this.isSubmitting = false;
        }
      });
    }
  }

  confirmDelete(product: AdminProduct): void {
    this.productToDelete = product;
    this.showDeleteModal = true;
  }

  deleteProduct(): void {
    if (!this.productToDelete) return;

    this.adminService.deleteProduct(this.productToDelete.id).subscribe({
      next: () => {
        this.showSuccess('Produit archive');
        this.showDeleteModal = false;
        this.productToDelete = null;
        this.loadProducts();
      },
      error: () => this.showError('Erreur lors de l\'archivage')
    });
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadProducts();
    }
  }

  showSuccess(message: string): void {
    this.successMessage = message;
    setTimeout(() => this.successMessage = '', 3000);
  }

  showError(message: string): void {
    this.errorMessage = message;
    setTimeout(() => this.errorMessage = '', 4000);
  }
}
