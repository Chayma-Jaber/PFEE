import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonLoaderComponent } from '../skeleton-loader/skeleton-loader.component';

@Component({
  selector: 'app-product-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonLoaderComponent],
  template: `
    <div class="skeleton-container" [ngClass]="viewMode">
      <div class="skeleton-card" *ngFor="let item of [].constructor(count)">
        <app-skeleton-loader type="product-image"></app-skeleton-loader>
        <div class="skeleton-content">
          <app-skeleton-loader type="product-title"></app-skeleton-loader>
          <app-skeleton-loader type="product-price"></app-skeleton-loader>
          <div class="skeleton-colors">
            <app-skeleton-loader type="color-circle" *ngFor="let color of [].constructor(4)"></app-skeleton-loader>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .skeleton-container {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      padding: 0 15px;
    }

    .skeleton-card {
      background-color: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: transform 0.3s ease;
      padding: 10px;
    }

    .skeleton-content {
      padding: 10px;
    }

    .skeleton-colors {
      display: flex;
      gap: 5px;
      margin-top: 10px;
    }

    /* View modes */
    .single .skeleton-card {
      width: 100%;
    }

    .double .skeleton-card {
      width: calc(50% - 10px);
    }

    .triple .skeleton-card {
      width: calc(33.333% - 14px);
    }

    .grid .skeleton-card {
      width: calc(33.333% - 14px);
    }

    /* Responsive */
    @media (max-width: 992px) {
      .grid .skeleton-card {
        width: calc(50% - 10px);
      }
    }

    @media (max-width: 576px) {
      .single .skeleton-card {
        width: 100%;
      }
      .double .skeleton-card {
        width: calc(50% - 10px);
      }
      .triple .skeleton-card {
        width: calc(33.333% - 14px);
      }
      .grid .skeleton-card {
        width: 100%;
      }
    }
  `]
})
export class ProductSkeletonComponent {
  @Input() count: number = 6;
  @Input() viewMode: 'single' | 'double' | 'grid' | 'triple' = 'grid';
}
