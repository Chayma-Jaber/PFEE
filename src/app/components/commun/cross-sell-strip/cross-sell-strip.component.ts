import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';

/**
 * Wave 3 — Cross-sell strip.
 * Call with productIds (from cart/checkout). Renders "Fréquemment achetés ensemble".
 * Silent when no co-occurrence items.
 */
@Component({
  selector: 'app-cross-sell-strip',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="cs-wrap" *ngIf="items.length > 0">
      <h3><i class="fas fa-thumbs-up"></i> Fréquemment achetés ensemble</h3>
      <p class="cs-sub">Les clients ayant acheté ces articles ont aussi pris :</p>
      <div class="cs-list">
        <a *ngFor="let p of items" class="cs-card" [routerLink]="['/detail-produit', p.id]">
          <img *ngIf="p.firstImageUrl" [src]="p.firstImageUrl" [alt]="p.title" />
          <div class="cs-body">
            <div class="cs-title">{{ p.title }}</div>
            <div class="cs-price">{{ p.currentPrice | number:'1.2-2' }} TND</div>
          </div>
        </a>
      </div>
    </div>
  `,
  styles: [`
    .cs-wrap {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      padding: 18px 20px;
      margin: 20px 0;
    }
    .cs-wrap h3 {
      font-size: 16px;
      margin: 0 0 4px;
      color: #111827;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .cs-wrap h3 i { color: #10b981; }
    .cs-sub { font-size: 13px; color: #6b7280; margin: 0 0 14px; }
    .cs-list {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      padding-bottom: 6px;
    }
    .cs-card {
      flex: 0 0 160px;
      background: #f9fafb;
      border-radius: 10px;
      overflow: hidden;
      text-decoration: none;
      color: inherit;
      transition: transform .15s;
      border: 1px solid #f3f4f6;
    }
    .cs-card:hover { transform: translateY(-2px); border-color: #6366f1; }
    .cs-card img { width: 100%; height: 160px; object-fit: cover; background: #fff; }
    .cs-body { padding: 8px 10px; }
    .cs-title { font-size: 12px; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
    .cs-price { color: #10b981; font-weight: 700; font-size: 13px; margin-top: 3px; }
  `]
})
export class CrossSellStripComponent implements OnChanges {
  @Input() productIds: number[] = [];
  @Input() limit: number = 4;
  items: any[] = [];

  constructor(private http: HttpClient) {}

  ngOnChanges(ch: SimpleChanges): void {
    if (!this.productIds || this.productIds.length === 0) { this.items = []; return; }
    this.http.post<{ items: any[] }>(
      `${environementDev.api}/api/storefront/w3/cross-sell`,
      { productIds: this.productIds, limit: this.limit }
    ).subscribe({
      next: (r) => { this.items = r.items || []; },
      error: () => { this.items = []; }
    });
  }
}
