import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { QuickViewService, QuickViewState } from '../../../services/quick-view.service';
import { CartService, CartItem } from '../../../services/cart.service';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/Product';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-quick-view-modal',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ToastModule],
  providers: [MessageService],
  template: `
    <!-- Quick View Modal Overlay -->
    <div class="quick-view-overlay"
         *ngIf="state.isOpen"
         (click)="onOverlayClick($event)"
>

      <!-- Modal Container -->
      <div class="quick-view-modal" (click)="$event.stopPropagation()">

        <!-- Close Button -->
        <button class="close-btn" (click)="closeModal()" aria-label="Fermer">
          <i class="fas fa-times"></i>
        </button>

        <!-- Loading State -->
        <div class="loading-container" *ngIf="state.isLoading">
          <div class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i>
          </div>
          <p>Chargement...</p>
        </div>

        <!-- Product Content -->
        <div class="modal-content" *ngIf="!state.isLoading && state.product">

          <!-- Left Side: Images -->
          <div class="images-section">
            <!-- Main Image -->
            <div class="main-image-container">
              <img [src]="getCurrentMainImage()"
                   [alt]="state.product.title"
                   class="main-image"
                   (error)="onImageError($event)">

              <!-- Discount Badge -->
              <div class="discount-badge" *ngIf="state.product.discount && state.product.discountValue">
                -{{ state.product.discountValue }}%
              </div>
            </div>

            <!-- Thumbnails Gallery -->
            <div class="thumbnails-gallery" *ngIf="getCurrentImages().length > 1">
              <button class="thumbnail"
                      *ngFor="let img of getCurrentImages(); let i = index"
                      [class.active]="activeThumbnail === i"
                      (click)="setActiveThumbnail(i)">
                <img [src]="img" [alt]="'Image ' + (i + 1)">
              </button>
            </div>
          </div>

          <!-- Right Side: Details -->
          <div class="details-section">
            <!-- Product Title -->
            <h2 class="product-title">{{ state.product.title }}</h2>

            <!-- Price -->
            <div class="price-container">
              <span class="current-price">{{ state.product.currentPrice.toFixed(3) }} TND</span>
              <span class="original-price" *ngIf="state.product.discount">
                {{ state.product.price.toFixed(3) }} TND
              </span>
            </div>

            <!-- Stock Status -->
            <div class="stock-status" [class.in-stock]="hasStock()" [class.out-of-stock]="!hasStock()">
              <i class="fas" [class.fa-check-circle]="hasStock()" [class.fa-times-circle]="!hasStock()"></i>
              <span>{{ hasStock() ? 'En stock' : 'Rupture de stock' }}</span>
            </div>

            <!-- Short Description -->
            <p class="short-description" *ngIf="state.product.Ligne">
              {{ state.product.Ligne }}
            </p>

            <!-- Color Selector -->
            <div class="color-selector" *ngIf="state.product.colors && state.product.colors.length > 0">
              <label class="selector-label">Couleur :</label>
              <div class="color-options">
                <button class="color-option"
                        *ngFor="let color of state.product.colors; let i = index"
                        [class.selected]="state.product.selectedColorIndex === i"
                        [title]="color.name"
                        (click)="selectColor(i)">
                  <img *ngIf="color.textureImage" [src]="color.textureImage" [alt]="color.name">
                  <span *ngIf="!color.textureImage" class="color-circle"></span>
                </button>
              </div>
              <span class="selected-color-name">{{ getSelectedColorName() }}</span>
            </div>

            <!-- Size Selector -->
            <div class="size-selector" *ngIf="state.product.tailles && state.product.tailles.length > 0 && showSizeSelector()">
              <label class="selector-label">{{ getSizeLabel() }} :</label>
              <div class="size-options">
                <button class="size-option"
                        *ngFor="let taille of state.product.tailles"
                        [class.selected]="selectedSize === taille.size"
                        [class.out-of-stock]="taille.qte === 0"
                        [disabled]="taille.qte === 0"
                        (click)="selectSize(taille.size)">
                  {{ taille.size }}
                  <span class="low-stock-indicator" *ngIf="taille.qte > 0 && taille.qte <= 2">!</span>
                </button>
              </div>
            </div>

            <!-- Quantity Selector -->
            <div class="quantity-selector">
              <label class="selector-label">Quantite :</label>
              <div class="quantity-controls">
                <button class="qty-btn" (click)="decreaseQuantity()" [disabled]="quantity <= 1">
                  <i class="fas fa-minus"></i>
                </button>
                <input type="number"
                       [(ngModel)]="quantity"
                       min="1"
                       max="10"
                       class="qty-input"
                       (change)="validateQuantity()">
                <button class="qty-btn" (click)="increaseQuantity()" [disabled]="quantity >= 10">
                  <i class="fas fa-plus"></i>
                </button>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="action-buttons">
              <button class="btn-add-cart"
                      (click)="addToCart()"
                      [disabled]="!canAddToCart()">
                <i class="fas fa-shopping-bag"></i>
                Ajouter au panier
              </button>

              <button class="btn-wishlist"
                      (click)="toggleWishlist()"
                      [class.active]="state.product.isInWishlist">
                <i class="fa-heart" [class.fas]="state.product.isInWishlist" [class.far]="!state.product.isInWishlist"></i>
              </button>
            </div>

            <!-- View Full Details Link -->
            <a class="view-details-link"
               [routerLink]="getProductDetailUrl()"
               (click)="closeModal()">
              <i class="fas fa-expand-alt"></i>
              Voir les details complets
            </a>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Overlay */
    .quick-view-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: fadeIn 0.3s ease-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    /* Modal Container */
    .quick-view-modal {
      background: #ffffff;
      border-radius: 16px;
      max-width: 1000px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      position: relative;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Close Button */
    .close-btn {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: #f5f5f5;
      color: #333;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      transition: all 0.2s ease;
      z-index: 10;
    }

    .close-btn:hover {
      background: #e0e0e0;
      transform: rotate(90deg);
    }

    /* Loading State */
    .loading-container {
      padding: 80px 40px;
      text-align: center;
      color: #666;
    }

    .loading-spinner {
      font-size: 40px;
      color: #000;
      margin-bottom: 16px;
    }

    /* Modal Content */
    .modal-content {
      display: flex;
      padding: 32px;
      gap: 32px;
    }

    /* Images Section */
    .images-section {
      flex: 1;
      max-width: 450px;
    }

    .main-image-container {
      position: relative;
      width: 100%;
      aspect-ratio: 3/4;
      background: #f8f8f8;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 16px;
    }

    .main-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }

    .main-image-container:hover .main-image {
      transform: scale(1.02);
    }

    .discount-badge {
      position: absolute;
      top: 12px;
      left: 12px;
      background: #e53935;
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }

    /* Thumbnails Gallery */
    .thumbnails-gallery {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 8px;
    }

    .thumbnails-gallery::-webkit-scrollbar {
      height: 4px;
    }

    .thumbnails-gallery::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 2px;
    }

    .thumbnails-gallery::-webkit-scrollbar-thumb {
      background: #ccc;
      border-radius: 2px;
    }

    .thumbnail {
      flex-shrink: 0;
      width: 64px;
      height: 80px;
      border-radius: 8px;
      border: 2px solid transparent;
      overflow: hidden;
      cursor: pointer;
      padding: 0;
      background: #f8f8f8;
      transition: all 0.2s ease;
    }

    .thumbnail:hover {
      border-color: #999;
    }

    .thumbnail.active {
      border-color: #000;
    }

    .thumbnail img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* Details Section */
    .details-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .product-title {
      font-size: 24px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0;
      line-height: 1.3;
    }

    /* Price Container */
    .price-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .current-price {
      font-size: 22px;
      font-weight: 700;
      color: #000;
    }

    .original-price {
      font-size: 16px;
      color: #999;
      text-decoration: line-through;
    }

    /* Stock Status */
    .stock-status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 500;
    }

    .stock-status.in-stock {
      color: #2e7d32;
    }

    .stock-status.out-of-stock {
      color: #c62828;
    }

    /* Short Description */
    .short-description {
      font-size: 14px;
      color: #666;
      line-height: 1.5;
      margin: 0;
    }

    /* Selector Labels */
    .selector-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Color Selector */
    .color-selector {
      margin-bottom: 8px;
    }

    .color-options {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
    }

    .color-option {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 2px solid transparent;
      padding: 2px;
      cursor: pointer;
      background: #f8f8f8;
      overflow: hidden;
      transition: all 0.2s ease;
    }

    .color-option:hover {
      border-color: #999;
      transform: scale(1.1);
    }

    .color-option.selected {
      border-color: #000;
    }

    .color-option img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
    }

    .color-circle {
      display: block;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: linear-gradient(135deg, #ddd, #999);
    }

    .selected-color-name {
      font-size: 13px;
      color: #666;
    }

    /* Size Selector */
    .size-selector {
      margin-bottom: 8px;
    }

    .size-options {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .size-option {
      min-width: 44px;
      height: 44px;
      padding: 0 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: #fff;
      font-size: 14px;
      font-weight: 500;
      color: #333;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
    }

    .size-option:hover:not(:disabled) {
      border-color: #000;
    }

    .size-option.selected {
      background: #000;
      border-color: #000;
      color: #fff;
    }

    .size-option.out-of-stock {
      opacity: 0.4;
      text-decoration: line-through;
      cursor: not-allowed;
    }

    .low-stock-indicator {
      position: absolute;
      top: -4px;
      right: -4px;
      width: 16px;
      height: 16px;
      background: #ff9800;
      color: #fff;
      border-radius: 50%;
      font-size: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Quantity Selector */
    .quantity-selector {
      margin-bottom: 8px;
    }

    .quantity-controls {
      display: flex;
      align-items: center;
      gap: 0;
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
      width: fit-content;
    }

    .qty-btn {
      width: 44px;
      height: 44px;
      border: none;
      background: #f8f8f8;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      color: #333;
      transition: all 0.2s ease;
    }

    .qty-btn:hover:not(:disabled) {
      background: #e0e0e0;
    }

    .qty-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .qty-input {
      width: 60px;
      height: 44px;
      border: none;
      border-left: 1px solid #ddd;
      border-right: 1px solid #ddd;
      text-align: center;
      font-size: 16px;
      font-weight: 500;
      -moz-appearance: textfield;
    }

    .qty-input::-webkit-outer-spin-button,
    .qty-input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    /* Action Buttons */
    .action-buttons {
      display: flex;
      gap: 12px;
      margin-top: 8px;
    }

    .btn-add-cart {
      flex: 1;
      height: 52px;
      border: none;
      border-radius: 10px;
      background: #000;
      color: #fff;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: all 0.3s ease;
    }

    .btn-add-cart:hover:not(:disabled) {
      background: #333;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .btn-add-cart:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .btn-wishlist {
      width: 52px;
      height: 52px;
      border: 1px solid #ddd;
      border-radius: 10px;
      background: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      color: #999;
      transition: all 0.2s ease;
    }

    .btn-wishlist:hover {
      border-color: #e53935;
      color: #e53935;
    }

    .btn-wishlist.active {
      background: #fce4ec;
      border-color: #e53935;
      color: #e53935;
    }

    /* View Details Link */
    .view-details-link {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px 20px;
      border: 1px solid #ddd;
      border-radius: 10px;
      color: #333;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .view-details-link:hover {
      border-color: #000;
      background: #f8f8f8;
    }

    /* Mobile Responsive */
    @media (max-width: 768px) {
      .quick-view-overlay {
        padding: 0;
        align-items: flex-end;
      }

      .quick-view-modal {
        border-radius: 24px 24px 0 0;
        max-height: 95vh;
        animation: slideUpMobile 0.3s ease-out;
      }

      @keyframes slideUpMobile {
        from {
          transform: translateY(100%);
        }
        to {
          transform: translateY(0);
        }
      }

      .modal-content {
        flex-direction: column;
        padding: 24px 16px;
        gap: 24px;
      }

      .images-section {
        max-width: 100%;
      }

      .main-image-container {
        aspect-ratio: 1/1;
      }

      .product-title {
        font-size: 20px;
      }

      .current-price {
        font-size: 20px;
      }

      .close-btn {
        top: 12px;
        right: 12px;
      }

      .action-buttons {
        position: sticky;
        bottom: 0;
        background: #fff;
        padding: 16px 0;
        margin: 0 -16px;
        padding: 16px;
        box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
      }
    }

    @media (max-width: 480px) {
      .thumbnails-gallery {
        gap: 6px;
      }

      .thumbnail {
        width: 56px;
        height: 70px;
      }

      .size-option {
        min-width: 40px;
        height: 40px;
      }

      .qty-btn, .qty-input {
        height: 40px;
      }

      .btn-add-cart, .btn-wishlist {
        height: 48px;
      }

      .btn-wishlist {
        width: 48px;
      }
    }
  `]
})
export class QuickViewModalComponent implements OnInit, OnDestroy {
  state: QuickViewState = {
    isOpen: false,
    productId: null,
    product: null,
    isLoading: false
  };

  activeThumbnail: number = 0;
  selectedSize: string | null = null;
  quantity: number = 1;

  private subscription: Subscription | null = null;

  constructor(
    private quickViewService: QuickViewService,
    private cartService: CartService,
    private productService: ProductService,
    private router: Router,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.subscription = this.quickViewService.state$.subscribe(state => {
      this.state = state;

      // Reset local state when opening a new product
      if (state.isOpen && state.product) {
        this.activeThumbnail = 0;
        this.selectedSize = null;
        this.quantity = 1;

        // Auto-select size if only one available and it's TU or STD
        if (state.product.tailles && state.product.tailles.length === 1) {
          const singleSize = state.product.tailles[0];
          if ((singleSize.size.toUpperCase() === 'TU' || singleSize.size.toUpperCase() === 'STD') && singleSize.qte > 0) {
            this.selectedSize = singleSize.size;
          }
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.state.isOpen) {
      this.closeModal();
    }
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('quick-view-overlay')) {
      this.closeModal();
    }
  }

  closeModal(): void {
    this.quickViewService.closeQuickView();
  }

  // Image handling
  getCurrentMainImage(): string {
    if (!this.state.product) return '';

    const colorIndex = this.state.product.selectedColorIndex || 0;
    const images = this.state.product.declinaisons?.[colorIndex]?.images;

    if (images && images.length > 0) {
      return images[this.activeThumbnail]?.url || images[0]?.url || '';
    }

    return this.state.product.firstImg?.url || this.state.product.colors?.[0]?.mainImage || '';
  }

  getCurrentImages(): string[] {
    if (!this.state.product) return [];

    const colorIndex = this.state.product.selectedColorIndex || 0;
    const images = this.state.product.declinaisons?.[colorIndex]?.images;

    if (images && images.length > 0) {
      return images.map(img => img.url);
    }

    return [];
  }

  setActiveThumbnail(index: number): void {
    this.activeThumbnail = index;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/images/placeholder.png';
  }

  // Color selection
  selectColor(index: number): void {
    if (this.state.product) {
      this.activeThumbnail = 0;
      this.selectedSize = null;
      this.quickViewService.loadStockForColor(this.state.product, index);
    }
  }

  getSelectedColorName(): string {
    if (!this.state.product) return '';
    const index = this.state.product.selectedColorIndex || 0;
    return this.state.product.colors?.[index]?.name || '';
  }

  // Size selection
  showSizeSelector(): boolean {
    if (!this.state.product || !this.state.product.tailles) return false;

    const tailles = this.state.product.tailles;
    if (tailles.length === 1) {
      const size = tailles[0].size.toUpperCase();
      return size !== 'TU' && size !== 'STD';
    }

    return true;
  }

  getSizeLabel(): string {
    if (!this.state.product) return 'Taille';

    const shoeKeywords = ['CHAUSSURE', 'BOTTINE', 'BASKET', 'SANDALE', 'MULE', 'SABOT', 'ESCARPIN', 'MOCASSIN', 'DERBY', 'BALLERINE', 'BOOTS', 'CLAQUETTE', 'TONG'];
    const titleUpper = this.state.product.title?.toUpperCase() || '';

    const isShoe = shoeKeywords.some(keyword => titleUpper.includes(keyword));
    const isNumericSize = this.state.product.tailles?.[0]?.size && !isNaN(Number(this.state.product.tailles[0].size));

    if (isNumericSize && isShoe) {
      return 'Pointure';
    }

    return 'Taille';
  }

  selectSize(size: string): void {
    this.selectedSize = size;
  }

  // Quantity
  increaseQuantity(): void {
    if (this.quantity < 10) {
      this.quantity++;
    }
  }

  decreaseQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  validateQuantity(): void {
    if (this.quantity < 1) this.quantity = 1;
    if (this.quantity > 10) this.quantity = 10;
  }

  // Stock check
  hasStock(): boolean {
    if (!this.state.product || !this.state.product.tailles) return false;
    return this.state.product.tailles.some(taille => taille.qte > 0);
  }

  // Cart operations
  canAddToCart(): boolean {
    if (!this.state.product || !this.hasStock()) return false;

    // If size selection is required, check if a size is selected
    if (this.showSizeSelector()) {
      return this.selectedSize !== null;
    }

    // Auto-selected TU/STD
    return this.selectedSize !== null || (this.state.product.tailles?.length === 1);
  }

  addToCart(): void {
    if (!this.state.product || !this.canAddToCart()) return;

    // Get selected size (auto-select TU/STD if not already selected)
    let size = this.selectedSize;
    if (!size && this.state.product.tailles?.length === 1) {
      size = this.state.product.tailles[0].size;
    }

    if (!size) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Taille requise',
        detail: 'Veuillez selectionner une taille',
        life: 3000
      });
      return;
    }

    const selectedTaille = this.state.product.tailles?.find(t => t.size === size);
    if (!selectedTaille) return;

    const colorIndex = this.state.product.selectedColorIndex || 0;
    const selectedColor = this.state.product.colors?.[colorIndex]?.name || '';
    const currentImage = this.getCurrentMainImage();

    const cartItem: CartItem = {
      product: JSON.parse(JSON.stringify(this.state.product)),
      image: currentImage,
      quantity: this.quantity,
      selectedColor: selectedColor,
      selectedSize: size,
      ean13: selectedTaille.ean13
    };

    this.cartService.addToCart(cartItem).subscribe({
      next: (result) => {
        if (result.success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Ajoute au panier',
            detail: `${this.state.product?.title} a ete ajoute au panier`,
            life: 3000
          });

          // Reset quantity after adding
          this.quantity = 1;
        } else {
          this.messageService.add({
            severity: 'warn',
            summary: 'Stock insuffisant',
            detail: result.message || 'La quantite demandee depasse le stock disponible',
            life: 3000
          });
        }
      },
      error: (error) => {
        console.error('Error adding to cart:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Impossible d\'ajouter l\'article au panier',
          life: 3000
        });
      }
    });
  }

  // Wishlist
  toggleWishlist(): void {
    if (!this.state.product) return;

    const token = localStorage.getItem('jwt');
    if (!token) {
      this.closeModal();
      this.router.navigate(['/login']);
      return;
    }

    const wasInWishlist = this.state.product.isInWishlist;
    this.state.product.isInWishlist = !wasInWishlist;

    if (this.state.product.isInWishlist) {
      this.productService.addToWishList(this.state.product.id).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Ajoute aux favoris',
            detail: 'Le produit a ete ajoute a votre liste de souhaits',
            life: 3000
          });
        },
        error: () => {
          if (this.state.product) {
            this.state.product.isInWishlist = wasInWishlist;
          }
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Impossible d\'ajouter le produit aux favoris',
            life: 3000
          });
        }
      });
    } else {
      this.productService.removeFromWishList(this.state.product.id).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Retire des favoris',
            detail: 'Le produit a ete retire de votre liste de souhaits',
            life: 3000
          });
        },
        error: () => {
          if (this.state.product) {
            this.state.product.isInWishlist = wasInWishlist;
          }
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Impossible de retirer le produit des favoris',
            life: 3000
          });
        }
      });
    }
  }

  // Navigation
  getProductDetailUrl(): string {
    if (!this.state.product) return '/';
    return `/produit/${this.productService.generateProductSlug(this.state.product)}`;
  }
}
