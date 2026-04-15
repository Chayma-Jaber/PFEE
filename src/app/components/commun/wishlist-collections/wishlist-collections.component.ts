/**
 * BARSHA WISHLIST COLLECTIONS COMPONENT
 * ======================================
 * Pinterest-style board navigation for organizing favorites.
 * Features:
 * - Collection sidebar with preview images
 * - Create/Edit/Delete collection modals
 * - Move items between collections
 * - Collection sharing with toggle and link copy
 * - Empty state for each collection
 */

import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  FavoritesService,
  WishlistCollection,
  WishlistItem,
  CollectionStats
} from '../../../services/favorites.service';

@Component({
  selector: 'app-wishlist-collections',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="wishlist-collections-container">
      <!-- Sidebar -->
      <aside class="collections-sidebar">
        <div class="sidebar-header">
          <h3>Mes Collections</h3>
          <button class="btn-create" (click)="openCreateModal()" title="Nouvelle collection">
            <i class="fa fa-plus"></i>
          </button>
        </div>

        <!-- Stats Summary -->
        <div class="collections-stats">
          <span class="stat-item">
            <strong>{{ stats.totalItems }}</strong> articles
          </span>
          <span class="stat-divider">|</span>
          <span class="stat-item">
            <strong>{{ stats.totalCollections }}</strong> collections
          </span>
        </div>

        <!-- Collections List -->
        <div class="collections-list">
          <!-- All Favorites -->
          <div
            class="collection-item"
            [class.active]="selectedCollectionId === null && !showUncategorized"
            (click)="selectCollection(null)"
          >
            <div class="collection-preview all-favorites">
              <i class="fa fa-heart"></i>
            </div>
            <div class="collection-info">
              <span class="collection-name">Tous les favoris</span>
              <span class="collection-count">{{ stats.totalItems }} articles</span>
            </div>
          </div>

          <!-- Uncategorized -->
          <div
            class="collection-item"
            [class.active]="showUncategorized"
            (click)="selectUncategorized()"
          >
            <div class="collection-preview uncategorized">
              <i class="fa fa-inbox"></i>
            </div>
            <div class="collection-info">
              <span class="collection-name">Non classes</span>
              <span class="collection-count">{{ stats.uncategorizedCount }} articles</span>
            </div>
          </div>

          <!-- User Collections -->
          <div
            *ngFor="let collection of collections"
            class="collection-item"
            [class.active]="selectedCollectionId === collection.id"
            (click)="selectCollection(collection.id)"
          >
            <div class="collection-preview">
              <ng-container *ngIf="collection.previewImages?.length; else noPreview">
                <div class="preview-grid">
                  <img
                    *ngFor="let img of (collection.previewImages || []).slice(0, 4)"
                    [src]="img || 'assets/images/placeholder.jpg'"
                    alt=""
                  />
                </div>
              </ng-container>
              <ng-template #noPreview>
                <i class="fa fa-folder"></i>
              </ng-template>
            </div>
            <div class="collection-info">
              <span class="collection-name">{{ collection.name }}</span>
              <span class="collection-count">{{ collection.itemCount }} articles</span>
            </div>
            <div class="collection-actions">
              <button
                class="btn-action"
                (click)="openEditModal(collection, $event)"
                title="Modifier"
              >
                <i class="fa fa-pencil"></i>
              </button>
              <button
                *ngIf="!collection.isDefault"
                class="btn-action btn-delete"
                (click)="openDeleteModal(collection, $event)"
                title="Supprimer"
              >
                <i class="fa fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="collections-content">
        <!-- Header -->
        <div class="content-header">
          <div class="header-info">
            <h2>{{ getCurrentTitle() }}</h2>
            <p *ngIf="selectedCollection?.description">{{ selectedCollection?.description }}</p>
          </div>
          <div class="header-actions" *ngIf="selectedCollection">
            <button
              class="btn-share"
              [class.active]="selectedCollection.isPublic"
              (click)="toggleSharing()"
              [disabled]="isTogglingShare"
            >
              <i class="fa" [ngClass]="selectedCollection.isPublic ? 'fa-lock-open' : 'fa-lock'"></i>
              {{ selectedCollection.isPublic ? 'Partage actif' : 'Partager' }}
            </button>
            <button
              *ngIf="selectedCollection.isPublic && selectedCollection.shareToken"
              class="btn-copy"
              (click)="copyShareLink()"
              [disabled]="isCopying"
            >
              <i class="fa" [ngClass]="copySuccess ? 'fa-check' : 'fa-copy'"></i>
              {{ copySuccess ? 'Copie !' : 'Copier le lien' }}
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading-state">
          <div class="spinner"></div>
          <p>Chargement...</p>
        </div>

        <!-- Empty State -->
        <div *ngIf="!isLoading && items.length === 0" class="empty-state">
          <div class="empty-icon">
            <i class="fa fa-heart-o"></i>
          </div>
          <h3>Cette collection est vide</h3>
          <p>Ajoutez des articles a vos favoris pour les voir apparaitre ici.</p>
          <a routerLink="/" class="btn-explore">Decouvrir nos produits</a>
        </div>

        <!-- Items Grid -->
        <div *ngIf="!isLoading && items.length > 0" class="items-grid">
          <div *ngFor="let item of items" class="item-card">
            <div class="item-image">
              <a [routerLink]="['/produit', item.productId]">
                <img
                  [src]="item.product?.firstImg?.url || 'assets/images/placeholder.jpg'"
                  [alt]="item.product?.title"
                />
              </a>
              <div class="item-overlay">
                <button
                  class="btn-move"
                  (click)="openMoveModal(item)"
                  title="Deplacer vers"
                >
                  <i class="fa fa-folder-open"></i>
                </button>
                <button
                  class="btn-notes"
                  (click)="openNotesModal(item)"
                  title="Ajouter une note"
                >
                  <i class="fa fa-sticky-note"></i>
                </button>
              </div>
            </div>
            <div class="item-info">
              <h4 class="item-title">{{ item.product?.title }}</h4>
              <div class="item-price">
                <span class="current-price">{{ item.product?.currentPrice | number:'1.3-3' }} TND</span>
                <span *ngIf="item.product?.discount" class="original-price">
                  {{ item.product?.price | number:'1.3-3' }} TND
                </span>
              </div>
              <p *ngIf="item.notes" class="item-notes">
                <i class="fa fa-sticky-note"></i> {{ item.notes }}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- Create/Edit Collection Modal -->
    <div class="modal-overlay" *ngIf="showCollectionModal" (click)="closeCollectionModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h4>{{ isEditing ? 'Modifier la collection' : 'Nouvelle collection' }}</h4>
          <button class="btn-close" (click)="closeCollectionModal()">
            <i class="fa fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="collectionName">Nom de la collection *</label>
            <input
              type="text"
              id="collectionName"
              [(ngModel)]="collectionForm.name"
              maxlength="100"
              placeholder="Ex: Idees cadeaux, Wishlist ete..."
            />
          </div>
          <div class="form-group">
            <label for="collectionDesc">Description (optionnel)</label>
            <textarea
              id="collectionDesc"
              [(ngModel)]="collectionForm.description"
              maxlength="500"
              rows="3"
              placeholder="Decrivez cette collection..."
            ></textarea>
          </div>
          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" [(ngModel)]="collectionForm.isPublic" />
              <span>Rendre cette collection publique</span>
            </label>
            <small>Les collections publiques peuvent etre partagees avec un lien</small>
          </div>
          <div *ngIf="collectionError" class="error-message">
            {{ collectionError }}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" (click)="closeCollectionModal()">Annuler</button>
          <button
            class="btn-submit"
            (click)="saveCollection()"
            [disabled]="!collectionForm.name.trim() || isSaving"
          >
            <span *ngIf="isSaving" class="spinner-small"></span>
            {{ isEditing ? 'Enregistrer' : 'Creer' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Collection Modal -->
    <div class="modal-overlay" *ngIf="showDeleteModal" (click)="closeDeleteModal()">
      <div class="modal-content modal-delete" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h4>Supprimer la collection</h4>
          <button class="btn-close" (click)="closeDeleteModal()">
            <i class="fa fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="delete-warning">
            <i class="fa fa-exclamation-triangle"></i>
            <p>
              Etes-vous sur de vouloir supprimer la collection
              <strong>"{{ collectionToDelete?.name }}"</strong> ?
            </p>
          </div>
          <div class="form-group" *ngIf="collectionToDelete && collectionToDelete.itemCount > 0">
            <label>Que faire avec les {{ collectionToDelete.itemCount }} articles ?</label>
            <select [(ngModel)]="deleteAction">
              <option value="uncategorize">Deplacer vers "Non classes"</option>
              <option *ngFor="let c of getOtherCollections()" [value]="c.id">
                Deplacer vers "{{ c.name }}"
              </option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" (click)="closeDeleteModal()">Annuler</button>
          <button class="btn-delete" (click)="confirmDelete()" [disabled]="isDeleting">
            <span *ngIf="isDeleting" class="spinner-small"></span>
            Supprimer
          </button>
        </div>
      </div>
    </div>

    <!-- Move Item Modal -->
    <div class="modal-overlay" *ngIf="showMoveModal" (click)="closeMoveModal()">
      <div class="modal-content modal-move" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h4>Deplacer vers</h4>
          <button class="btn-close" (click)="closeMoveModal()">
            <i class="fa fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="move-options">
            <button
              class="move-option"
              [class.selected]="moveTargetId === null"
              (click)="selectMoveTarget(null)"
            >
              <i class="fa fa-inbox"></i>
              <span>Non classes</span>
            </button>
            <button
              *ngFor="let c of collections"
              class="move-option"
              [class.selected]="moveTargetId === c.id"
              [class.disabled]="itemToMove?.collectionId === c.id"
              (click)="selectMoveTarget(c.id)"
              [disabled]="itemToMove?.collectionId === c.id"
            >
              <i class="fa fa-folder"></i>
              <span>{{ c.name }}</span>
              <small *ngIf="itemToMove?.collectionId === c.id">(actuel)</small>
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" (click)="closeMoveModal()">Annuler</button>
          <button
            class="btn-submit"
            (click)="confirmMove()"
            [disabled]="isMoving || moveTargetId === itemToMove?.collectionId"
          >
            <span *ngIf="isMoving" class="spinner-small"></span>
            Deplacer
          </button>
        </div>
      </div>
    </div>

    <!-- Notes Modal -->
    <div class="modal-overlay" *ngIf="showNotesModal" (click)="closeNotesModal()">
      <div class="modal-content modal-notes" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h4>Ajouter une note</h4>
          <button class="btn-close" (click)="closeNotesModal()">
            <i class="fa fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="notes-product-info" *ngIf="itemToEdit">
            <img
              [src]="itemToEdit.product?.firstImg?.url || 'assets/images/placeholder.jpg'"
              [alt]="itemToEdit.product?.title"
            />
            <span>{{ itemToEdit.product?.title }}</span>
          </div>
          <div class="form-group">
            <textarea
              [(ngModel)]="itemNotes"
              maxlength="1000"
              rows="4"
              placeholder="Ajoutez une note personnelle (taille, couleur souhaitee, occasion...)"
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" (click)="closeNotesModal()">Annuler</button>
          <button class="btn-submit" (click)="saveNotes()" [disabled]="isSavingNotes">
            <span *ngIf="isSavingNotes" class="spinner-small"></span>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .wishlist-collections-container {
      display: flex;
      min-height: 500px;
      gap: 24px;
      padding: 20px;
      background: #fafafa;
    }

    /* Sidebar Styles */
    .collections-sidebar {
      width: 280px;
      min-width: 280px;
      background: #fff;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      height: fit-content;
      position: sticky;
      top: 20px;
    }

    .sidebar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .sidebar-header h3 {
      font-size: 1.1rem;
      font-weight: 600;
      color: #222;
      margin: 0;
    }

    .btn-create {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: #222;
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .btn-create:hover {
      background: #444;
      transform: scale(1.05);
    }

    .collections-stats {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 0.85rem;
      color: #666;
    }

    .stat-divider {
      color: #ddd;
    }

    .collections-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .collection-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
    }

    .collection-item:hover {
      background: #f5f5f5;
    }

    .collection-item.active {
      background: #f0f0f0;
      border-left: 3px solid #222;
    }

    .collection-preview {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      background: #eee;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }

    .collection-preview i {
      font-size: 1.2rem;
      color: #999;
    }

    .collection-preview.all-favorites {
      background: #ffe0e0;
    }

    .collection-preview.all-favorites i {
      color: #e74c3c;
    }

    .collection-preview.uncategorized {
      background: #e8e8e8;
    }

    .preview-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1px;
      width: 100%;
      height: 100%;
    }

    .preview-grid img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .collection-info {
      flex: 1;
      min-width: 0;
    }

    .collection-name {
      display: block;
      font-size: 0.9rem;
      font-weight: 500;
      color: #222;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .collection-count {
      display: block;
      font-size: 0.75rem;
      color: #888;
      margin-top: 2px;
    }

    .collection-actions {
      display: none;
      gap: 4px;
    }

    .collection-item:hover .collection-actions {
      display: flex;
    }

    .btn-action {
      width: 28px;
      height: 28px;
      border: none;
      background: #f0f0f0;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .btn-action i {
      font-size: 0.75rem;
      color: #666;
    }

    .btn-action:hover {
      background: #e0e0e0;
    }

    .btn-action.btn-delete:hover {
      background: #ffe0e0;
    }

    .btn-action.btn-delete:hover i {
      color: #e74c3c;
    }

    /* Main Content Styles */
    .collections-content {
      flex: 1;
      background: #fff;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }

    .content-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #eee;
    }

    .header-info h2 {
      font-size: 1.3rem;
      font-weight: 600;
      color: #222;
      margin: 0 0 4px 0;
    }

    .header-info p {
      font-size: 0.9rem;
      color: #666;
      margin: 0;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .btn-share, .btn-copy {
      padding: 8px 16px;
      border: 1px solid #ddd;
      background: #fff;
      border-radius: 6px;
      font-size: 0.85rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }

    .btn-share:hover, .btn-copy:hover {
      border-color: #222;
    }

    .btn-share.active {
      background: #222;
      color: #fff;
      border-color: #222;
    }

    .btn-copy {
      background: #222;
      color: #fff;
      border-color: #222;
    }

    /* Loading State */
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: #888;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #eee;
      border-top-color: #222;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      text-align: center;
    }

    .empty-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }

    .empty-icon i {
      font-size: 2rem;
      color: #ccc;
    }

    .empty-state h3 {
      font-size: 1.1rem;
      color: #222;
      margin: 0 0 8px 0;
    }

    .empty-state p {
      font-size: 0.9rem;
      color: #888;
      margin: 0 0 20px 0;
    }

    .btn-explore {
      padding: 10px 24px;
      background: #222;
      color: #fff;
      text-decoration: none;
      border-radius: 6px;
      font-size: 0.9rem;
      transition: all 0.2s;
    }

    .btn-explore:hover {
      background: #444;
    }

    /* Items Grid */
    .items-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 20px;
    }

    .item-card {
      background: #fff;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #eee;
      transition: all 0.2s;
    }

    .item-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .item-image {
      position: relative;
      aspect-ratio: 3/4;
      overflow: hidden;
    }

    .item-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s;
    }

    .item-card:hover .item-image img {
      transform: scale(1.05);
    }

    .item-overlay {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .item-card:hover .item-overlay {
      opacity: 1;
    }

    .btn-move, .btn-notes {
      width: 32px;
      height: 32px;
      border: none;
      background: rgba(255,255,255,0.95);
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
      transition: all 0.2s;
    }

    .btn-move:hover, .btn-notes:hover {
      background: #222;
      color: #fff;
    }

    .item-info {
      padding: 12px;
    }

    .item-title {
      font-size: 0.85rem;
      font-weight: 500;
      color: #222;
      margin: 0 0 6px 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .item-price {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .current-price {
      font-size: 0.9rem;
      font-weight: 600;
      color: #222;
    }

    .original-price {
      font-size: 0.8rem;
      color: #999;
      text-decoration: line-through;
    }

    .item-notes {
      font-size: 0.75rem;
      color: #888;
      margin: 8px 0 0 0;
      padding: 6px 8px;
      background: #f9f9f9;
      border-radius: 4px;
      display: flex;
      align-items: flex-start;
      gap: 6px;
    }

    .item-notes i {
      color: #ffc107;
      margin-top: 2px;
    }

    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }

    .modal-content {
      background: #fff;
      border-radius: 12px;
      width: 100%;
      max-width: 440px;
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #eee;
    }

    .modal-header h4 {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0;
    }

    .btn-close {
      width: 32px;
      height: 32px;
      border: none;
      background: #f5f5f5;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .btn-close:hover {
      background: #e0e0e0;
    }

    .modal-body {
      padding: 20px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      font-size: 0.85rem;
      font-weight: 500;
      color: #222;
      margin-bottom: 8px;
    }

    .form-group input[type="text"],
    .form-group textarea,
    .form-group select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 0.9rem;
      transition: border-color 0.2s;
    }

    .form-group input:focus,
    .form-group textarea:focus,
    .form-group select:focus {
      outline: none;
      border-color: #222;
    }

    .checkbox-group label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }

    .checkbox-group input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }

    .checkbox-group small {
      display: block;
      margin-top: 4px;
      margin-left: 26px;
      font-size: 0.75rem;
      color: #888;
    }

    .error-message {
      padding: 10px;
      background: #ffe0e0;
      color: #c00;
      border-radius: 6px;
      font-size: 0.85rem;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 20px;
      border-top: 1px solid #eee;
    }

    .btn-cancel {
      padding: 10px 20px;
      border: 1px solid #ddd;
      background: #fff;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s;
    }

    .btn-cancel:hover {
      background: #f5f5f5;
    }

    .btn-submit {
      padding: 10px 20px;
      border: none;
      background: #222;
      color: #fff;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }

    .btn-submit:hover:not(:disabled) {
      background: #444;
    }

    .btn-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-delete {
      padding: 10px 20px;
      border: none;
      background: #e74c3c;
      color: #fff;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }

    .btn-delete:hover:not(:disabled) {
      background: #c0392b;
    }

    .spinner-small {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    /* Delete Modal */
    .delete-warning {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: #fff3cd;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .delete-warning i {
      color: #856404;
      font-size: 1.2rem;
      margin-top: 2px;
    }

    .delete-warning p {
      margin: 0;
      color: #856404;
      font-size: 0.9rem;
    }

    /* Move Modal */
    .move-options {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .move-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border: 1px solid #eee;
      background: #fff;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: left;
      width: 100%;
    }

    .move-option:hover:not(.disabled) {
      border-color: #222;
      background: #fafafa;
    }

    .move-option.selected {
      border-color: #222;
      background: #f0f0f0;
    }

    .move-option.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .move-option i {
      font-size: 1rem;
      color: #666;
    }

    .move-option span {
      flex: 1;
      font-size: 0.9rem;
    }

    .move-option small {
      font-size: 0.75rem;
      color: #888;
    }

    /* Notes Modal */
    .notes-product-info {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: #f9f9f9;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .notes-product-info img {
      width: 50px;
      height: 50px;
      object-fit: cover;
      border-radius: 6px;
    }

    .notes-product-info span {
      font-size: 0.9rem;
      font-weight: 500;
      color: #222;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .wishlist-collections-container {
        flex-direction: column;
      }

      .collections-sidebar {
        width: 100%;
        min-width: 100%;
        position: static;
      }

      .collections-list {
        flex-direction: row;
        overflow-x: auto;
        gap: 12px;
        padding-bottom: 8px;
      }

      .collection-item {
        flex-direction: column;
        min-width: 100px;
        text-align: center;
        padding: 12px 8px;
      }

      .collection-actions {
        display: none !important;
      }

      .items-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }

      .content-header {
        flex-direction: column;
        gap: 12px;
      }

      .header-actions {
        width: 100%;
      }

      .btn-share, .btn-copy {
        flex: 1;
        justify-content: center;
      }
    }
  `]
})
export class WishlistCollectionsComponent implements OnInit, OnDestroy {
  @Input() embedded: boolean = false;
  @Output() collectionSelected = new EventEmitter<number | null>();

  // State
  collections: WishlistCollection[] = [];
  items: WishlistItem[] = [];
  stats: CollectionStats = { totalCollections: 0, totalItems: 0, uncategorizedCount: 0 };

  selectedCollectionId: number | null = null;
  selectedCollection: WishlistCollection | null = null;
  showUncategorized: boolean = false;

  isLoading: boolean = false;
  isTogglingShare: boolean = false;
  isCopying: boolean = false;
  copySuccess: boolean = false;

  // Create/Edit Modal
  showCollectionModal: boolean = false;
  isEditing: boolean = false;
  isSaving: boolean = false;
  collectionError: string = '';
  collectionForm = {
    name: '',
    description: '',
    isPublic: false
  };
  editingCollectionId: number | null = null;

  // Delete Modal
  showDeleteModal: boolean = false;
  collectionToDelete: WishlistCollection | null = null;
  deleteAction: string = 'uncategorize';
  isDeleting: boolean = false;

  // Move Modal
  showMoveModal: boolean = false;
  itemToMove: WishlistItem | null = null;
  moveTargetId: number | null = null;
  isMoving: boolean = false;

  // Notes Modal
  showNotesModal: boolean = false;
  itemToEdit: WishlistItem | null = null;
  itemNotes: string = '';
  isSavingNotes: boolean = false;

  private subscriptions: Subscription[] = [];

  constructor(private favoritesService: FavoritesService) {}

  ngOnInit(): void {
    this.loadCollections();

    // Subscribe to collections updates
    this.subscriptions.push(
      this.favoritesService.collections$.subscribe(collections => {
        this.collections = collections;
      }),
      this.favoritesService.stats$.subscribe(stats => {
        this.stats = stats;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ========================
  // Data Loading
  // ========================

  loadCollections(): void {
    this.isLoading = true;
    this.favoritesService.getCollections(true).subscribe({
      next: () => {
        this.loadItems();
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  loadItems(): void {
    let observable;

    if (this.showUncategorized) {
      observable = this.favoritesService.getCollectionItems(undefined, true);
    } else if (this.selectedCollectionId !== null) {
      observable = this.favoritesService.getCollectionItems(this.selectedCollectionId);
    } else {
      // All items
      observable = this.favoritesService.getCollectionItems();
    }

    observable.subscribe({
      next: (items) => {
        this.items = items;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  // ========================
  // Collection Selection
  // ========================

  selectCollection(collectionId: number | null): void {
    this.selectedCollectionId = collectionId;
    this.showUncategorized = false;
    this.selectedCollection = collectionId
      ? this.collections.find(c => c.id === collectionId) || null
      : null;
    this.collectionSelected.emit(collectionId);
    this.loadItems();
  }

  selectUncategorized(): void {
    this.selectedCollectionId = null;
    this.showUncategorized = true;
    this.selectedCollection = null;
    this.loadItems();
  }

  getCurrentTitle(): string {
    if (this.showUncategorized) {
      return 'Non classes';
    }
    if (this.selectedCollection) {
      return this.selectedCollection.name;
    }
    return 'Tous les favoris';
  }

  // ========================
  // Create/Edit Collection
  // ========================

  openCreateModal(): void {
    this.isEditing = false;
    this.editingCollectionId = null;
    this.collectionForm = { name: '', description: '', isPublic: false };
    this.collectionError = '';
    this.showCollectionModal = true;
  }

  openEditModal(collection: WishlistCollection, event: Event): void {
    event.stopPropagation();
    this.isEditing = true;
    this.editingCollectionId = collection.id;
    this.collectionForm = {
      name: collection.name,
      description: collection.description || '',
      isPublic: collection.isPublic
    };
    this.collectionError = '';
    this.showCollectionModal = true;
  }

  closeCollectionModal(): void {
    this.showCollectionModal = false;
  }

  saveCollection(): void {
    if (!this.collectionForm.name.trim()) return;

    this.isSaving = true;
    this.collectionError = '';

    if (this.isEditing && this.editingCollectionId) {
      this.favoritesService.updateCollection(this.editingCollectionId, {
        name: this.collectionForm.name.trim(),
        description: this.collectionForm.description.trim() || undefined,
        isPublic: this.collectionForm.isPublic
      }).subscribe({
        next: (result) => {
          this.isSaving = false;
          if (result) {
            this.closeCollectionModal();
            if (this.selectedCollectionId === this.editingCollectionId) {
              this.selectedCollection = result;
            }
          } else {
            this.collectionError = 'Erreur lors de la mise a jour';
          }
        },
        error: () => {
          this.isSaving = false;
          this.collectionError = 'Erreur lors de la mise a jour';
        }
      });
    } else {
      this.favoritesService.createCollection(
        this.collectionForm.name.trim(),
        this.collectionForm.description.trim() || undefined,
        this.collectionForm.isPublic
      ).subscribe({
        next: (result) => {
          this.isSaving = false;
          if (result) {
            this.closeCollectionModal();
          } else {
            this.collectionError = 'Erreur lors de la creation';
          }
        },
        error: () => {
          this.isSaving = false;
          this.collectionError = 'Erreur lors de la creation';
        }
      });
    }
  }

  // ========================
  // Delete Collection
  // ========================

  openDeleteModal(collection: WishlistCollection, event: Event): void {
    event.stopPropagation();
    this.collectionToDelete = collection;
    this.deleteAction = 'uncategorize';
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.collectionToDelete = null;
  }

  getOtherCollections(): WishlistCollection[] {
    return this.collections.filter(c => c.id !== this.collectionToDelete?.id);
  }

  confirmDelete(): void {
    if (!this.collectionToDelete) return;

    this.isDeleting = true;
    const moveToId = this.deleteAction === 'uncategorize' ? null : parseInt(this.deleteAction);

    this.favoritesService.deleteCollection(this.collectionToDelete.id, moveToId).subscribe({
      next: (success) => {
        this.isDeleting = false;
        if (success) {
          if (this.selectedCollectionId === this.collectionToDelete?.id) {
            this.selectCollection(null);
          }
          this.closeDeleteModal();
        }
      },
      error: () => {
        this.isDeleting = false;
      }
    });
  }

  // ========================
  // Move Item
  // ========================

  openMoveModal(item: WishlistItem): void {
    this.itemToMove = item;
    this.moveTargetId = item.collectionId || null;
    this.showMoveModal = true;
  }

  closeMoveModal(): void {
    this.showMoveModal = false;
    this.itemToMove = null;
  }

  selectMoveTarget(collectionId: number | null): void {
    this.moveTargetId = collectionId;
  }

  confirmMove(): void {
    if (!this.itemToMove || this.moveTargetId === this.itemToMove.collectionId) return;

    this.isMoving = true;

    this.favoritesService.moveToCollection(this.itemToMove.productId, this.moveTargetId).subscribe({
      next: (result) => {
        this.isMoving = false;
        if (result) {
          this.closeMoveModal();
          this.loadItems();
        }
      },
      error: () => {
        this.isMoving = false;
      }
    });
  }

  // ========================
  // Item Notes
  // ========================

  openNotesModal(item: WishlistItem): void {
    this.itemToEdit = item;
    this.itemNotes = item.notes || '';
    this.showNotesModal = true;
  }

  closeNotesModal(): void {
    this.showNotesModal = false;
    this.itemToEdit = null;
  }

  saveNotes(): void {
    if (!this.itemToEdit) return;

    this.isSavingNotes = true;

    this.favoritesService.updateItemNotes(this.itemToEdit.productId, this.itemNotes.trim() || null).subscribe({
      next: (result) => {
        this.isSavingNotes = false;
        if (result) {
          // Update local item
          const index = this.items.findIndex(i => i.productId === this.itemToEdit?.productId);
          if (index >= 0) {
            this.items[index] = result;
          }
          this.closeNotesModal();
        }
      },
      error: () => {
        this.isSavingNotes = false;
      }
    });
  }

  // ========================
  // Sharing
  // ========================

  toggleSharing(): void {
    if (!this.selectedCollection) return;

    this.isTogglingShare = true;

    this.favoritesService.toggleCollectionSharing(this.selectedCollection.id).subscribe({
      next: (result) => {
        this.isTogglingShare = false;
        if (result && this.selectedCollection) {
          this.selectedCollection = {
            ...this.selectedCollection,
            isPublic: result.isPublic,
            shareToken: result.shareToken
          };
        }
      },
      error: () => {
        this.isTogglingShare = false;
      }
    });
  }

  copyShareLink(): void {
    if (!this.selectedCollection?.shareToken) return;

    this.isCopying = true;

    this.favoritesService.copyShareUrl(this.selectedCollection.shareToken).then(success => {
      this.isCopying = false;
      if (success) {
        this.copySuccess = true;
        setTimeout(() => {
          this.copySuccess = false;
        }, 2000);
      }
    });
  }
}
