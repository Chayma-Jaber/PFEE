import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="skeleton-loader" [ngClass]="type">
      <div class="shimmer-wrapper">
        <div class="shimmer"></div>
      </div>
    </div>
  `,
  styles: [`
    .skeleton-loader {
      position: relative;
      overflow: hidden;
      background-color: #f0f0f0;
      border-radius: 4px;
      margin-bottom: 10px;
    }

    .shimmer-wrapper {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      animation: loading 2s infinite;
    }

    .shimmer {
      width: 50%;
      height: 100%;
      background: linear-gradient(to right, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.5) 50%, rgba(255, 255, 255, 0) 100%);
      transform: skewX(-20deg);
    }

    @keyframes loading {
      0% {
        transform: translateX(-150%);
      }
      50% {
        transform: translateX(-60%);
      }
      100% {
        transform: translateX(150%);
      }
    }

    /* Types */
    .product-card {
      height: 300px;
      width: 100%;
    }

    .product-image {
      height: 200px;
      width: 100%;
    }

    .product-title {
      height: 20px;
      width: 80%;
      margin: 10px 0;
    }

    .product-price {
      height: 20px;
      width: 40%;
    }

    .product-colors {
      display: flex;
      margin-top: 10px;
    }

    .color-circle {
      height: 20px;
      width: 20px;
      border-radius: 50%;
      margin-right: 5px;
    }

    .filter-button {
      height: 40px;
      width: 100px;
      margin-right: 10px;
    }

    .banner {
      height: 200px;
      width: 100%;
    }
  `]
})
export class SkeletonLoaderComponent {
  @Input() type: 'product-card' | 'product-image' | 'product-title' | 'product-price' | 'color-circle' | 'filter-button' | 'banner' = 'product-card';
}
