import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';

/**
 * Free-shipping progress bar for cart page.
 * Calls the backend /api/storefront/shipping/estimate endpoint and renders a progress bar.
 * Self-contained; drop into any cart/checkout template.
 */
@Component({
  selector: 'app-free-shipping-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fs-bar" *ngIf="!loading && estimate">
      <div class="fs-header">
        <i class="fas" [class.fa-truck]="!estimate.freeShipping" [class.fa-check-circle]="estimate.freeShipping"></i>
        <span *ngIf="!estimate.freeShipping">Plus que <strong>{{ estimate.remainingForFree | number:'1.0-2' }} TND</strong> pour la livraison gratuite !</span>
        <span *ngIf="estimate.freeShipping" class="unlocked">🎉 Livraison gratuite débloquée !</span>
      </div>
      <div class="fs-track">
        <div class="fs-fill" [style.width.%]="estimate.progressPct"></div>
      </div>
      <div class="fs-footer">
        <span>0 TND</span>
        <span>{{ estimate.threshold }} TND</span>
      </div>
    </div>
  `,
  styles: [`
    .fs-bar { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 16px; margin: 12px 0; }
    .fs-header { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #374151; margin-bottom: 8px; }
    .fs-header i { color: #6366f1; font-size: 16px; }
    .fs-header .unlocked { color: #10b981; font-weight: 600; }
    .fs-header strong { color: #ec4899; }
    .fs-track { height: 8px; background: #f3f4f6; border-radius: 4px; overflow: hidden; }
    .fs-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #ec4899); border-radius: 4px; transition: width 0.5s ease; }
    .fs-footer { display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; margin-top: 4px; }
  `]
})
export class FreeShippingBarComponent implements OnChanges {
  @Input() subtotal = 0;
  @Input() city = 'tunis';

  loading = false;
  estimate: any = null;

  constructor(private http: HttpClient) {}

  ngOnChanges(): void {
    if (this.subtotal == null) return;
    this.loading = true;
    this.http.get<any>(
      `${environementDev.api}/api/storefront/shipping/estimate?city=${encodeURIComponent(this.city || 'tunis')}&subtotal=${this.subtotal}`
    ).subscribe({
      next: (r) => { this.estimate = r; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }
}
