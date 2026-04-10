import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonLoaderComponent } from '../skeleton-loader/skeleton-loader.component';

@Component({
  selector: 'app-filter-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonLoaderComponent],
  template: `
    <div class="filter-skeleton-container">
      <div class="filter-buttons-wrapper">
        <div class="filter-buttons-scroll">
          <app-skeleton-loader type="filter-button" *ngFor="let item of [].constructor(count)"></app-skeleton-loader>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .filter-skeleton-container {
      display: flex;
      overflow-x: hidden;
      padding: 10px 15px;
      position: relative;
    }

    .filter-buttons-wrapper {
      flex: 1;
      overflow: hidden;
    }

    .filter-buttons-scroll {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
      padding-bottom: 5px;
    }

    .filter-buttons-scroll::-webkit-scrollbar {
      display: none;
    }
  `]
})
export class FilterSkeletonComponent {
  @Input() count: number = 7;
}
