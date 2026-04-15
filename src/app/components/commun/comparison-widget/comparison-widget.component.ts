import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProductComparisonService, ComparisonProduct } from '../../../services/product-comparison.service';

@Component({
  selector: 'app-comparison-widget',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="comparison-widget" *ngIf="products.length > 0" [class.expanded]="isExpanded">
      <!-- Collapsed State -->
      <div class="widget-collapsed" *ngIf="!isExpanded" (click)="toggleExpand()">
        <div class="widget-badge">
          <i class="fas fa-balance-scale"></i>
          <span class="count">{{ products.length }}</span>
        </div>
        <span class="widget-text">Comparaison</span>
      </div>

      <!-- Expanded State -->
      <div class="widget-expanded" *ngIf="isExpanded">
        <div class="widget-header">
          <div class="header-left">
            <i class="fas fa-balance-scale"></i>
            <span>Comparaison ({{ products.length }}/{{ maxProducts }})</span>
          </div>
          <button class="btn-collapse" (click)="toggleExpand()" title="Reduire">
            <i class="fas fa-chevron-down"></i>
          </button>
        </div>

        <div class="widget-products">
          <div class="product-thumb" *ngFor="let product of products">
            <img [src]="product.image" [alt]="product.title" class="thumb-image">
            <button class="remove-thumb" (click)="removeProduct(product.id)" title="Retirer">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="empty-thumb" *ngFor="let _ of emptySlots">
            <i class="fas fa-plus"></i>
          </div>
        </div>

        <div class="widget-actions">
          <button class="btn-compare" routerLink="/compare" [disabled]="products.length < 2">
            <i class="fas fa-exchange-alt"></i>
            Comparer maintenant
          </button>
          <button class="btn-clear-widget" (click)="clearAll()">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .comparison-widget {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 1000;
      font-family: inherit;
    }

    /* Collapsed State */
    .widget-collapsed {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1.25rem;
      background-color: #000;
      color: #fff;
      border-radius: 50px;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .widget-collapsed:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
    }

    .widget-badge {
      position: relative;
      display: flex;
      align-items: center;
    }

    .widget-badge i {
      font-size: 1.1rem;
    }

    .widget-badge .count {
      position: absolute;
      top: -8px;
      right: -10px;
      min-width: 18px;
      height: 18px;
      background-color: #dc3545;
      color: #fff;
      font-size: 0.7rem;
      font-weight: 600;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .widget-text {
      font-size: 0.9rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Expanded State */
    .widget-expanded {
      background-color: #fff;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
      overflow: hidden;
      min-width: 320px;
    }

    .widget-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      background-color: #000;
      color: #fff;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .header-left i {
      font-size: 1rem;
    }

    .header-left span {
      font-size: 0.85rem;
      font-weight: 500;
    }

    .btn-collapse {
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      padding: 0.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s;
    }

    .btn-collapse:hover {
      opacity: 0.8;
    }

    /* Products Grid */
    .widget-products {
      display: flex;
      gap: 0.5rem;
      padding: 1rem;
      background-color: #f8f9fa;
    }

    .product-thumb {
      position: relative;
      width: 60px;
      height: 80px;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #dee2e6;
      background-color: #fff;
    }

    .thumb-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .remove-thumb {
      position: absolute;
      top: 2px;
      right: 2px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background-color: #dc3545;
      color: #fff;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.6rem;
      transition: background-color 0.2s;
    }

    .remove-thumb:hover {
      background-color: #c82333;
    }

    .empty-thumb {
      width: 60px;
      height: 80px;
      border-radius: 6px;
      border: 2px dashed #dee2e6;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #adb5bd;
    }

    .empty-thumb i {
      font-size: 1rem;
    }

    /* Actions */
    .widget-actions {
      display: flex;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-top: 1px solid #e9ecef;
    }

    .btn-compare {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.6rem 1rem;
      background-color: #000;
      color: #fff;
      border: none;
      font-size: 0.8rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      cursor: pointer;
      transition: background-color 0.2s;
      text-decoration: none;
    }

    .btn-compare:hover:not(:disabled) {
      background-color: #333;
    }

    .btn-compare:disabled {
      background-color: #6c757d;
      cursor: not-allowed;
    }

    .btn-clear-widget {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #dc3545;
      color: #fff;
      border: none;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .btn-clear-widget:hover {
      background-color: #c82333;
    }

    /* Mobile Responsive */
    @media (max-width: 576px) {
      .comparison-widget {
        bottom: 10px;
        right: 10px;
        left: 10px;
      }

      .widget-collapsed {
        width: auto;
        justify-content: center;
      }

      .widget-expanded {
        min-width: 100%;
      }

      .widget-products {
        justify-content: center;
      }

      .product-thumb, .empty-thumb {
        width: 50px;
        height: 65px;
      }
    }

    /* Animation */
    .comparison-widget.expanded {
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
  `]
})
export class ComparisonWidgetComponent implements OnInit, OnDestroy {
  products: ComparisonProduct[] = [];
  maxProducts: number = 4;
  emptySlots: number[] = [];
  isExpanded: boolean = false;

  private subscription: Subscription = new Subscription();

  constructor(private comparisonService: ProductComparisonService) {}

  ngOnInit(): void {
    this.maxProducts = this.comparisonService.getMaxProducts();

    this.subscription.add(
      this.comparisonService.comparedProducts$.subscribe(products => {
        this.products = products;
        this.updateEmptySlots();

        // Auto-expand when first product is added
        if (products.length === 1 && !this.isExpanded) {
          this.isExpanded = true;
        }

        // Auto-collapse when empty
        if (products.length === 0) {
          this.isExpanded = false;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private updateEmptySlots(): void {
    const remaining = this.maxProducts - this.products.length;
    this.emptySlots = remaining > 0 ? Array(remaining).fill(0) : [];
  }

  toggleExpand(): void {
    this.isExpanded = !this.isExpanded;
  }

  removeProduct(productId: number): void {
    this.comparisonService.removeFromComparison(productId);
  }

  clearAll(): void {
    this.comparisonService.clearComparison();
    this.isExpanded = false;
  }
}
