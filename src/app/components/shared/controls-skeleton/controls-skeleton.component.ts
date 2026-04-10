import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-controls-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="controls-skeleton-container d-flex justify-content-between align-items-center mb-3 px-3">
      <div class="filter-section-skeleton">
        <div class="skeleton-filter"></div>
      </div>
      <div class="view-modes-skeleton d-flex">
        <div class="skeleton-view-mode"></div>
        <div class="skeleton-view-mode d-none d-sm-block"></div>
        <div class="skeleton-view-mode d-none d-md-block"></div>
      </div>
    </div>
  `,
  styles: [`
    .controls-skeleton-container {
      width: 100%;
      height: 50px;
    }

    .filter-section-skeleton {
      width: 120px;
      height: 40px;
    }

    .skeleton-filter {
      width: 100%;
      height: 100%;
      background-color: #f0f0f0;
      border-radius: 4px;
      position: relative;
      overflow: hidden;
    }

    .view-modes-skeleton {
      display: flex;
      gap: 10px;
    }

    .skeleton-view-mode {
      width: 40px;
      height: 40px;
      background-color: #f0f0f0;
      border-radius: 4px;
      position: relative;
      overflow: hidden;
    }

    .skeleton-filter::after,
    .skeleton-view-mode::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5), transparent);
      animation: shimmer 1.5s infinite;
    }

    @keyframes shimmer {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(100%);
      }
    }
  `]
})
export class ControlsSkeletonComponent {}
