import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpHeaders, HttpParams } from '@angular/common/http';
import { catchError, of, debounceTime, Subject } from 'rxjs';

export interface Outfit {
  id: number;
  title: string;
  description: string;
  occasion: string;
  season: string;
  family: string;
  coverImageUrl: string;
  styleTags: string[];
  products: OutfitProduct[];
  totalPrice: number;
  views: number;
  isFeatured: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OutfitProduct {
  id: number;
  productId: number;
  sku: string;
  title: string;
  price: number;
  imageUrl: string;
  position: number;
}

export interface ProductSearchResult {
  id: number;
  sku: string;
  title: string;
  price: number;
  currentPrice: number;
  imageUrl: string;
  famille: string;
}

interface OutfitForm {
  title: string;
  description: string;
  occasion: string;
  season: string;
  family: string;
  coverImageUrl: string;
  styleTags: string;
  products: OutfitProduct[];
  isFeatured: boolean;
  isActive: boolean;
}

@Component({
  selector: 'app-admin-outfits',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, HttpClientModule],
  template: `
    <div class="admin-outfits">
      <div class="page-header">
        <h1>Gestion des tenues</h1>
        <button class="btn-add" (click)="openCreateModal()">
          <i class="bi bi-plus-lg"></i> Creer une tenue
        </button>
      </div>

      <div class="filters-bar">
        <div class="search-box">
          <i class="bi bi-search"></i>
          <input type="text" [(ngModel)]="searchQuery" placeholder="Rechercher..." (keyup.enter)="loadOutfits()">
        </div>
        <select [(ngModel)]="familyFilter" (change)="loadOutfits()">
          <option value="">Toutes les familles</option>
          <option value="WOMEN">Femme</option>
          <option value="MEN">Homme</option>
          <option value="KIDS">Enfant</option>
        </select>
        <select [(ngModel)]="occasionFilter" (change)="loadOutfits()">
          <option value="">Toutes les occasions</option>
          <option value="casual">Casual</option>
          <option value="formal">Formel</option>
          <option value="sport">Sport</option>
          <option value="party">Soiree</option>
          <option value="work">Travail</option>
          <option value="beach">Plage</option>
        </select>
        <select [(ngModel)]="seasonFilter" (change)="loadOutfits()">
          <option value="">Toutes les saisons</option>
          <option value="spring">Printemps</option>
          <option value="summer">Ete</option>
          <option value="autumn">Automne</option>
          <option value="winter">Hiver</option>
          <option value="all-season">Toutes saisons</option>
        </select>
        <select [(ngModel)]="featuredFilter" (change)="loadOutfits()">
          <option value="">Tous les statuts</option>
          <option value="featured">Mise en avant</option>
          <option value="not-featured">Standard</option>
        </select>
      </div>

      <!-- Outfits Table -->
      <div class="table-container">
        <table class="outfits-table">
          <thead>
            <tr>
              <th class="col-image">Image</th>
              <th class="col-title">Titre</th>
              <th class="col-products">Produits</th>
              <th class="col-price">Prix total</th>
              <th class="col-views">Vues</th>
              <th class="col-occasion">Occasion</th>
              <th class="col-season">Saison</th>
              <th class="col-status">Statut</th>
              <th class="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let outfit of outfits" [class.inactive]="!outfit.isActive">
              <td class="col-image">
                <img [src]="outfit.coverImageUrl || 'assets/images/placeholder.png'" [alt]="outfit.title" class="outfit-thumb">
              </td>
              <td class="col-title">
                <div class="outfit-title">{{ outfit.title }}</div>
                <div class="outfit-family">{{ formatFamily(outfit.family) }}</div>
              </td>
              <td class="col-products">
                <span class="products-count">{{ (outfit.products || []).length }} articles</span>
              </td>
              <td class="col-price">{{ (outfit.totalPrice || 0).toFixed(3) }} TND</td>
              <td class="col-views">{{ outfit.views || 0 }}</td>
              <td class="col-occasion">{{ formatOccasion(outfit.occasion) }}</td>
              <td class="col-season">{{ formatSeason(outfit.season) }}</td>
              <td class="col-status">
                <span class="badge featured" *ngIf="outfit.isFeatured">
                  <i class="bi bi-star-fill"></i> Mise en avant
                </span>
                <span class="badge" [class.active]="outfit.isActive" [class.inactive]="!outfit.isActive">
                  {{ outfit.isActive ? 'Actif' : 'Inactif' }}
                </span>
              </td>
              <td class="col-actions">
                <button class="btn-icon btn-star" [class.starred]="outfit.isFeatured" (click)="toggleFeatured(outfit)" title="Mise en avant">
                  <i class="bi" [class.bi-star-fill]="outfit.isFeatured" [class.bi-star]="!outfit.isFeatured"></i>
                </button>
                <button class="btn-icon btn-edit" (click)="openEditModal(outfit)" title="Modifier">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn-icon btn-toggle" (click)="toggleActive(outfit)" [title]="outfit.isActive ? 'Desactiver' : 'Activer'">
                  <i class="bi" [class.bi-eye]="outfit.isActive" [class.bi-eye-slash]="!outfit.isActive"></i>
                </button>
                <button class="btn-icon btn-delete" (click)="confirmDelete(outfit)" title="Supprimer">
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="empty-state" *ngIf="outfits.length === 0 && !isLoading">
        <i class="bi bi-palette"></i>
        <p>Aucune tenue trouvee</p>
        <button class="btn-add" (click)="openCreateModal()">Creer votre premiere tenue</button>
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
      <div class="modal-content modal-large" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>{{ editingOutfit ? 'Modifier la tenue' : 'Nouvelle tenue' }}</h2>
          <button class="btn-close" (click)="closeModal()">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-section">
            <h3>Informations generales</h3>
            <div class="form-row">
              <div class="form-group">
                <label>Titre *</label>
                <input type="text" [(ngModel)]="outfitForm.title" placeholder="Ex: Look casual ete">
              </div>
              <div class="form-group">
                <label>Famille *</label>
                <select [(ngModel)]="outfitForm.family">
                  <option value="">Selectionner</option>
                  <option value="WOMEN">Femme</option>
                  <option value="MEN">Homme</option>
                  <option value="KIDS">Enfant</option>
                  <option value="TEEN WOMEN">Ado Femme</option>
                  <option value="TEEN MEN">Ado Homme</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea [(ngModel)]="outfitForm.description" placeholder="Description de la tenue" rows="3"></textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Occasion</label>
                <select [(ngModel)]="outfitForm.occasion">
                  <option value="">Selectionner</option>
                  <option value="casual">Casual</option>
                  <option value="formal">Formel</option>
                  <option value="sport">Sport</option>
                  <option value="party">Soiree</option>
                  <option value="work">Travail</option>
                  <option value="beach">Plage</option>
                </select>
              </div>
              <div class="form-group">
                <label>Saison</label>
                <select [(ngModel)]="outfitForm.season">
                  <option value="">Selectionner</option>
                  <option value="spring">Printemps</option>
                  <option value="summer">Ete</option>
                  <option value="autumn">Automne</option>
                  <option value="winter">Hiver</option>
                  <option value="all-season">Toutes saisons</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Image de couverture (URL)</label>
              <input type="text" [(ngModel)]="outfitForm.coverImageUrl" placeholder="https://...">
              <div class="image-preview" *ngIf="outfitForm.coverImageUrl">
                <img [src]="outfitForm.coverImageUrl" alt="Preview">
              </div>
            </div>
            <div class="form-group">
              <label>Tags de style (separes par des virgules)</label>
              <input type="text" [(ngModel)]="outfitForm.styleTags" placeholder="Ex: chic, decontracte, trendy">
            </div>
            <div class="form-row checkbox-row">
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="outfitForm.isFeatured"> Mise en avant
              </label>
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="outfitForm.isActive"> Actif
              </label>
            </div>
          </div>

          <div class="form-section">
            <h3>Produits de la tenue</h3>

            <!-- Product Search -->
            <div class="product-search">
              <div class="search-input-wrapper">
                <i class="bi bi-search"></i>
                <input
                  type="text"
                  [(ngModel)]="productSearchQuery"
                  (ngModelChange)="onProductSearch($event)"
                  placeholder="Rechercher un produit par nom ou SKU..."
                >
              </div>
              <div class="search-results" *ngIf="productSearchResults.length > 0 && productSearchQuery">
                <div
                  class="search-result-item"
                  *ngFor="let product of productSearchResults"
                  (click)="addProductToOutfit(product)"
                >
                  <img [src]="product.imageUrl || 'assets/images/placeholder.png'" [alt]="product.title">
                  <div class="result-info">
                    <span class="result-title">{{ product.title }}</span>
                    <span class="result-sku">{{ product.sku }} - {{ (product.currentPrice || 0).toFixed(3) }} TND</span>
                  </div>
                  <i class="bi bi-plus-circle"></i>
                </div>
              </div>
            </div>

            <!-- Selected Products -->
            <div class="selected-products">
              <div class="product-item" *ngFor="let product of outfitForm.products; let i = index" draggable="true"
                   (dragstart)="onDragStart($event, i)"
                   (dragover)="onDragOver($event)"
                   (drop)="onDrop($event, i)">
                <div class="drag-handle">
                  <i class="bi bi-grip-vertical"></i>
                </div>
                <img [src]="product.imageUrl || 'assets/images/placeholder.png'" [alt]="product.title">
                <div class="product-details">
                  <span class="product-title">{{ product.title }}</span>
                  <span class="product-sku">{{ product.sku }}</span>
                </div>
                <span class="product-price">{{ (product.price || 0).toFixed(3) }} TND</span>
                <button class="btn-remove" (click)="removeProductFromOutfit(i)">
                  <i class="bi bi-x-lg"></i>
                </button>
              </div>
              <div class="empty-products" *ngIf="outfitForm.products.length === 0">
                <i class="bi bi-bag-plus"></i>
                <p>Aucun produit ajoute. Recherchez et ajoutez des produits ci-dessus.</p>
              </div>
            </div>

            <div class="total-price" *ngIf="outfitForm.products.length > 0">
              <span>Prix total de la tenue:</span>
              <strong>{{ calculateTotalPrice().toFixed(3) }} TND</strong>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" (click)="closeModal()">Annuler</button>
          <button class="btn-save" (click)="saveOutfit()" [disabled]="isSubmitting">
            {{ isSubmitting ? 'Enregistrement...' : (editingOutfit ? 'Mettre a jour' : 'Creer') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal-overlay" *ngIf="showDeleteModal" (click)="showDeleteModal = false">
      <div class="modal-content modal-small" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Confirmer la suppression</h2>
          <button class="btn-close" (click)="showDeleteModal = false">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="modal-body">
          <p>Etes-vous sur de vouloir supprimer cette tenue ?</p>
          <p class="outfit-name">{{ outfitToDelete?.title }}</p>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" (click)="showDeleteModal = false">Annuler</button>
          <button class="btn-delete" (click)="deleteOutfit()">Supprimer</button>
        </div>
      </div>
    </div>

    <!-- Toast Messages -->
    <div class="toast" *ngIf="successMessage" [class.show]="successMessage">
      <i class="bi bi-check-circle"></i> {{ successMessage }}
    </div>
    <div class="toast error" *ngIf="errorMessage" [class.show]="errorMessage">
      <i class="bi bi-exclamation-circle"></i> {{ errorMessage }}
    </div>
  `,
  styles: [`
    .admin-outfits { max-width: 1400px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 600; color: #1a1a2e; margin: 0; }
    .btn-add { display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: #1a1a2e; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; }
    .btn-add:hover { background: #2a2a4e; }

    .filters-bar { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; align-items: center; }
    .search-box { flex: 1; min-width: 200px; position: relative; }
    .search-box i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #888; }
    .search-box input { width: 100%; padding: 10px 12px 10px 38px; border: 1px solid #e0e0e0; border-radius: 8px; }
    select { padding: 10px 16px; border: 1px solid #e0e0e0; border-radius: 8px; background: #fff; min-width: 150px; }

    /* Table Styles */
    .table-container { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .outfits-table { width: 100%; border-collapse: collapse; }
    .outfits-table th { background: #f8f9fa; padding: 14px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #eee; }
    .outfits-table td { padding: 14px 16px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
    .outfits-table tr:hover { background: #fafafa; }
    .outfits-table tr.inactive { opacity: 0.6; }

    .col-image { width: 70px; }
    .outfit-thumb { width: 50px; height: 50px; object-fit: cover; border-radius: 8px; background: #f5f5f5; }
    .col-title { min-width: 180px; }
    .outfit-title { font-weight: 500; color: #1a1a2e; margin-bottom: 2px; }
    .outfit-family { font-size: 12px; color: #888; }
    .col-products { width: 100px; }
    .products-count { background: #e3f2fd; color: #1976d2; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .col-price { width: 120px; font-weight: 600; color: #1a1a2e; }
    .col-views { width: 80px; color: #666; }
    .col-occasion, .col-season { width: 100px; }
    .col-status { width: 150px; }
    .col-actions { width: 160px; }

    .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; margin-right: 4px; }
    .badge.featured { background: #fff3cd; color: #856404; }
    .badge.featured i { font-size: 10px; margin-right: 2px; }
    .badge.active { background: #d4edda; color: #155724; }
    .badge.inactive { background: #f8d7da; color: #721c24; }

    .btn-icon { padding: 8px 10px; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s; margin-right: 4px; }
    .btn-star { background: #fff3cd; color: #856404; }
    .btn-star:hover, .btn-star.starred { background: #ffc107; color: #000; }
    .btn-edit { background: #e3f2fd; color: #1976d2; }
    .btn-edit:hover { background: #bbdefb; }
    .btn-toggle { background: #f0f0f0; color: #666; }
    .btn-toggle:hover { background: #e0e0e0; }
    .btn-delete { background: #ffebee; color: #c62828; }
    .btn-delete:hover { background: #ffcdd2; }

    .empty-state { text-align: center; padding: 60px; color: #888; background: #fff; border-radius: 12px; }
    .empty-state i { font-size: 48px; margin-bottom: 16px; opacity: 0.5; display: block; }
    .empty-state p { margin-bottom: 20px; }

    .pagination { display: flex; justify-content: center; align-items: center; gap: 16px; padding: 24px; }
    .pagination button { padding: 8px 12px; border: 1px solid #e0e0e0; background: #fff; border-radius: 6px; cursor: pointer; }
    .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Modal Styles */
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: #fff; border-radius: 12px; width: 90%; max-width: 600px; max-height: 90vh; overflow-y: auto; }
    .modal-content.modal-small { max-width: 400px; }
    .modal-content.modal-large { max-width: 800px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid #eee; position: sticky; top: 0; background: #fff; z-index: 10; }
    .modal-header h2 { margin: 0; font-size: 18px; font-weight: 600; }
    .btn-close { background: none; border: none; font-size: 18px; cursor: pointer; color: #666; }
    .modal-body { padding: 24px; }

    .form-section { margin-bottom: 32px; }
    .form-section h3 { font-size: 14px; font-weight: 600; color: #1a1a2e; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #1a1a2e; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 13px; font-weight: 500; color: #555; margin-bottom: 6px; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; box-sizing: border-box; }
    .form-group textarea { resize: vertical; }
    .checkbox-row { display: flex; gap: 24px; padding-top: 8px; }
    .checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; }

    .image-preview { margin-top: 12px; }
    .image-preview img { max-width: 200px; max-height: 150px; object-fit: cover; border-radius: 8px; border: 1px solid #eee; }

    /* Product Search */
    .product-search { margin-bottom: 20px; position: relative; }
    .search-input-wrapper { position: relative; }
    .search-input-wrapper i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #888; }
    .search-input-wrapper input { width: 100%; padding: 12px 12px 12px 40px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; box-sizing: border-box; }
    .search-results { position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #ddd; border-radius: 8px; margin-top: 4px; max-height: 300px; overflow-y: auto; z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .search-result-item { display: flex; align-items: center; gap: 12px; padding: 12px; cursor: pointer; border-bottom: 1px solid #f0f0f0; }
    .search-result-item:last-child { border-bottom: none; }
    .search-result-item:hover { background: #f8f9fa; }
    .search-result-item img { width: 40px; height: 40px; object-fit: cover; border-radius: 6px; }
    .result-info { flex: 1; display: flex; flex-direction: column; }
    .result-title { font-size: 14px; font-weight: 500; color: #1a1a2e; }
    .result-sku { font-size: 12px; color: #888; }
    .search-result-item i { color: #27ae60; font-size: 18px; }

    /* Selected Products */
    .selected-products { border: 1px solid #eee; border-radius: 8px; min-height: 100px; }
    .product-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #f0f0f0; cursor: grab; }
    .product-item:last-child { border-bottom: none; }
    .product-item:hover { background: #fafafa; }
    .drag-handle { color: #ccc; cursor: grab; }
    .drag-handle:active { cursor: grabbing; }
    .product-item img { width: 50px; height: 50px; object-fit: cover; border-radius: 6px; }
    .product-details { flex: 1; display: flex; flex-direction: column; }
    .product-title { font-size: 14px; font-weight: 500; color: #1a1a2e; }
    .product-sku { font-size: 12px; color: #888; }
    .product-price { font-weight: 600; color: #1a1a2e; }
    .btn-remove { background: #ffebee; color: #c62828; border: none; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
    .btn-remove:hover { background: #ffcdd2; }

    .empty-products { text-align: center; padding: 40px 20px; color: #888; }
    .empty-products i { font-size: 32px; display: block; margin-bottom: 12px; opacity: 0.5; }
    .empty-products p { margin: 0; font-size: 14px; }

    .total-price { display: flex; justify-content: flex-end; align-items: center; gap: 12px; padding: 16px; background: #f8f9fa; border-radius: 8px; margin-top: 16px; }
    .total-price span { font-size: 14px; color: #666; }
    .total-price strong { font-size: 18px; color: #1a1a2e; }

    .modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 24px; border-top: 1px solid #eee; position: sticky; bottom: 0; background: #fff; }
    .btn-cancel { padding: 10px 20px; background: #f5f5f5; color: #666; border: none; border-radius: 8px; cursor: pointer; }
    .btn-save { padding: 10px 20px; background: #1a1a2e; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
    .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
    .modal-body .btn-delete { padding: 10px 20px; background: #e74c3c; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
    .outfit-name { font-weight: 600; color: #1a1a2e; margin-top: 8px; }

    /* Toast */
    .toast { position: fixed; bottom: 24px; right: 24px; padding: 16px 24px; background: #27ae60; color: #fff; border-radius: 8px; display: flex; align-items: center; gap: 12px; z-index: 1100; animation: slideIn 0.3s ease; }
    .toast.error { background: #e74c3c; }
    @keyframes slideIn { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  `]
})
export class AdminOutfitsComponent implements OnInit {
  private apiUrl = 'http://localhost:8000/api';

  outfits: Outfit[] = [];
  isLoading = false;
  isSubmitting = false;

  // Filters
  searchQuery = '';
  familyFilter = '';
  occasionFilter = '';
  seasonFilter = '';
  featuredFilter = '';

  // Pagination
  currentPage = 1;
  totalPages = 1;

  // Modal states
  showModal = false;
  showDeleteModal = false;
  editingOutfit: Outfit | null = null;
  outfitToDelete: Outfit | null = null;

  // Product search
  productSearchQuery = '';
  productSearchResults: ProductSearchResult[] = [];
  private searchSubject = new Subject<string>();

  // Drag and drop
  private draggedIndex: number | null = null;

  // Form
  outfitForm: OutfitForm = this.getEmptyForm();

  // Messages
  successMessage = '';
  errorMessage = '';

  constructor(private http: HttpClient) {
    this.searchSubject.pipe(
      debounceTime(300)
    ).subscribe(query => {
      this.searchProducts(query);
    });
  }

  ngOnInit(): void {
    this.loadOutfits();
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('admin_jwt') || localStorage.getItem('jwt');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getEmptyForm(): OutfitForm {
    return {
      title: '',
      description: '',
      occasion: '',
      season: '',
      family: '',
      coverImageUrl: '',
      styleTags: '',
      products: [],
      isFeatured: false,
      isActive: true
    };
  }

  loadOutfits(): void {
    this.isLoading = true;

    let params = new HttpParams()
      .set('page', this.currentPage.toString());

    if (this.searchQuery) params = params.set('search', this.searchQuery);
    if (this.familyFilter) params = params.set('family', this.familyFilter);
    if (this.occasionFilter) params = params.set('occasion', this.occasionFilter);
    if (this.seasonFilter) params = params.set('season', this.seasonFilter);
    if (this.featuredFilter === 'featured') params = params.set('is_featured', 'true');
    if (this.featuredFilter === 'not-featured') params = params.set('is_featured', 'false');

    this.http.get<{ items: Outfit[]; total: number; pages: number }>(
      `${this.apiUrl}/admin/outfits`,
      { headers: this.getHeaders(), params }
    ).pipe(
      catchError(err => {
        console.error('Error loading outfits:', err);
        return of({ items: [], total: 0, pages: 0 });
      })
    ).subscribe(response => {
      this.outfits = response.items;
      this.totalPages = response.pages;
      this.isLoading = false;
    });
  }

  onProductSearch(query: string): void {
    if (query.length >= 2) {
      this.searchSubject.next(query);
    } else {
      this.productSearchResults = [];
    }
  }

  searchProducts(query: string): void {
    this.http.get<{ items: ProductSearchResult[] }>(
      `${this.apiUrl}/admin/products`,
      {
        headers: this.getHeaders(),
        params: new HttpParams().set('search', query).set('limit', '10')
      }
    ).pipe(
      catchError(() => of({ items: [] }))
    ).subscribe(response => {
      this.productSearchResults = response.items.map(p => ({
        id: p.id,
        sku: p.sku,
        title: p.title,
        price: p.currentPrice || p.price,
        currentPrice: p.currentPrice,
        imageUrl: (p as any).firstImageUrl || p.imageUrl,
        famille: p.famille
      }));
    });
  }

  addProductToOutfit(product: ProductSearchResult): void {
    // Check if product already exists
    if (this.outfitForm.products.some(p => p.productId === product.id)) {
      this.showError('Ce produit est deja dans la tenue');
      return;
    }

    this.outfitForm.products.push({
      id: 0,
      productId: product.id,
      sku: product.sku,
      title: product.title,
      price: product.currentPrice || product.price,
      imageUrl: product.imageUrl,
      position: this.outfitForm.products.length
    });

    this.productSearchQuery = '';
    this.productSearchResults = [];
  }

  removeProductFromOutfit(index: number): void {
    this.outfitForm.products.splice(index, 1);
    // Update positions
    this.outfitForm.products.forEach((p, i) => p.position = i);
  }

  // Drag and drop handlers
  onDragStart(event: DragEvent, index: number): void {
    this.draggedIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDrop(event: DragEvent, dropIndex: number): void {
    event.preventDefault();
    if (this.draggedIndex === null || this.draggedIndex === dropIndex) return;

    const products = this.outfitForm.products;
    const draggedProduct = products[this.draggedIndex];

    products.splice(this.draggedIndex, 1);
    products.splice(dropIndex, 0, draggedProduct);

    // Update positions
    products.forEach((p, i) => p.position = i);

    this.draggedIndex = null;
  }

  calculateTotalPrice(): number {
    return this.outfitForm.products.reduce((sum, p) => sum + (p.price || 0), 0);
  }

  toggleFeatured(outfit: Outfit): void {
    this.http.put(
      `${this.apiUrl}/admin/outfits/${outfit.id}`,
      { is_featured: !outfit.isFeatured },
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        outfit.isFeatured = !outfit.isFeatured;
        this.showSuccess(outfit.isFeatured ? 'Tenue mise en avant' : 'Mise en avant retiree');
      },
      error: () => this.showError('Erreur lors de la mise a jour')
    });
  }

  toggleActive(outfit: Outfit): void {
    this.http.put(
      `${this.apiUrl}/admin/outfits/${outfit.id}`,
      { is_active: !outfit.isActive },
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        outfit.isActive = !outfit.isActive;
        this.showSuccess(outfit.isActive ? 'Tenue activee' : 'Tenue desactivee');
      },
      error: () => this.showError('Erreur lors de la mise a jour')
    });
  }

  openCreateModal(): void {
    this.editingOutfit = null;
    this.outfitForm = this.getEmptyForm();
    this.productSearchQuery = '';
    this.productSearchResults = [];
    this.showModal = true;
  }

  openEditModal(outfit: Outfit): void {
    this.editingOutfit = outfit;
    this.outfitForm = {
      title: outfit.title,
      description: outfit.description || '',
      occasion: outfit.occasion || '',
      season: outfit.season || '',
      family: outfit.family || '',
      coverImageUrl: outfit.coverImageUrl || '',
      styleTags: outfit.styleTags?.join(', ') || '',
      products: outfit.products?.map(p => ({...p})) || [],
      isFeatured: outfit.isFeatured,
      isActive: outfit.isActive
    };
    this.productSearchQuery = '';
    this.productSearchResults = [];
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingOutfit = null;
    this.outfitForm = this.getEmptyForm();
  }

  saveOutfit(): void {
    if (!this.outfitForm.title || !this.outfitForm.family) {
      this.showError('Le titre et la famille sont requis');
      return;
    }

    if (this.outfitForm.products.length === 0) {
      this.showError('Ajoutez au moins un produit a la tenue');
      return;
    }

    this.isSubmitting = true;

    const payload = {
      title: this.outfitForm.title,
      description: this.outfitForm.description,
      occasion: this.outfitForm.occasion,
      season: this.outfitForm.season,
      family: this.outfitForm.family,
      cover_image_url: this.outfitForm.coverImageUrl,
      style_tags: this.outfitForm.styleTags.split(',').map(t => t.trim()).filter(t => t),
      product_ids: this.outfitForm.products.map(p => p.productId),
      is_featured: this.outfitForm.isFeatured,
      is_active: this.outfitForm.isActive
    };

    if (this.editingOutfit) {
      this.http.put(
        `${this.apiUrl}/admin/outfits/${this.editingOutfit.id}`,
        payload,
        { headers: this.getHeaders() }
      ).subscribe({
        next: () => {
          this.showSuccess('Tenue mise a jour');
          this.closeModal();
          this.loadOutfits();
          this.isSubmitting = false;
        },
        error: () => {
          this.showError('Erreur lors de la mise a jour');
          this.isSubmitting = false;
        }
      });
    } else {
      this.http.post(
        `${this.apiUrl}/admin/outfits`,
        payload,
        { headers: this.getHeaders() }
      ).subscribe({
        next: () => {
          this.showSuccess('Tenue creee avec succes');
          this.closeModal();
          this.loadOutfits();
          this.isSubmitting = false;
        },
        error: () => {
          this.showError('Erreur lors de la creation');
          this.isSubmitting = false;
        }
      });
    }
  }

  confirmDelete(outfit: Outfit): void {
    this.outfitToDelete = outfit;
    this.showDeleteModal = true;
  }

  deleteOutfit(): void {
    if (!this.outfitToDelete) return;

    this.http.delete(
      `${this.apiUrl}/admin/outfits/${this.outfitToDelete.id}`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.showSuccess('Tenue supprimee');
        this.showDeleteModal = false;
        this.outfitToDelete = null;
        this.loadOutfits();
      },
      error: () => this.showError('Erreur lors de la suppression')
    });
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadOutfits();
    }
  }

  formatFamily(family: string): string {
    const families: { [key: string]: string } = {
      'WOMEN': 'Femme',
      'MEN': 'Homme',
      'KIDS': 'Enfant',
      'TEEN WOMEN': 'Ado Femme',
      'TEEN MEN': 'Ado Homme'
    };
    return families[family] || family || '-';
  }

  formatOccasion(occasion: string): string {
    const occasions: { [key: string]: string } = {
      'casual': 'Casual',
      'formal': 'Formel',
      'sport': 'Sport',
      'party': 'Soiree',
      'work': 'Travail',
      'beach': 'Plage'
    };
    return occasions[occasion] || occasion || '-';
  }

  formatSeason(season: string): string {
    const seasons: { [key: string]: string } = {
      'spring': 'Printemps',
      'summer': 'Ete',
      'autumn': 'Automne',
      'winter': 'Hiver',
      'all-season': 'Toutes saisons'
    };
    return seasons[season] || season || '-';
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
