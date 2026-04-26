import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';

interface PriceAlert {
  productId: number;
  title: string;
  originalPrice: number;
  currentPrice: number;
  discountPct: number;
  firstImageUrl: string;
}

/**
 * Wave 2 — Wishlist price-drop alerts banner.
 * Calls /api/storefront/wishlist/price-alerts and renders a horizontal card strip.
 * Shows nothing when there are no drops (silent failure by design).
 */
@Component({
  selector: 'app-wishlist-price-alerts',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="wpa" *ngIf="alerts.length > 0">
      <div class="wpa-head">
        <i class="fas fa-tags"></i>
        <div>
          <h3>🎉 Prix en baisse sur vos favoris !</h3>
          <p>{{ alerts.length }} article{{ alerts.length > 1 ? 's' : '' }} de votre liste ont baissé de prix. Profitez-en avant la rupture.</p>
        </div>
      </div>
      <div class="wpa-items">
        <a *ngFor="let a of alerts" class="wpa-card" [routerLink]="['/detail-produit', a.productId]">
          <div class="wpa-img">
            <img *ngIf="a.firstImageUrl" [src]="a.firstImageUrl" [alt]="a.title" />
            <div *ngIf="!a.firstImageUrl" class="ph"><i class="fas fa-tshirt"></i></div>
            <span class="drop-badge">-{{ a.discountPct }}%</span>
          </div>
          <div class="wpa-body">
            <div class="wpa-title">{{ a.title }}</div>
            <div class="wpa-prices">
              <span class="old">{{ a.originalPrice | number:'1.2-2' }} TND</span>
              <span class="new">{{ a.currentPrice | number:'1.2-2' }} TND</span>
            </div>
          </div>
        </a>
      </div>
    </div>
  `,
  styles: [`
    .wpa {
      background: linear-gradient(135deg, #fff1f2 0%, #fce7f3 100%);
      border: 1px solid rgba(236, 72, 153, 0.25);
      border-radius: 16px;
      padding: 18px 20px;
      margin-bottom: 20px;
    }
    .wpa-head {
      display: flex;
      gap: 14px;
      align-items: center;
      margin-bottom: 14px;
      i { font-size: 28px; color: #ec4899; }
      h3 { margin: 0 0 2px; font-size: 16px; font-weight: 700; color: #9d174d; }
      p { margin: 0; font-size: 13px; color: #831843; }
    }
    .wpa-items {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      padding-bottom: 4px;
      &::-webkit-scrollbar { height: 6px; }
      &::-webkit-scrollbar-thumb { background: rgba(236, 72, 153, 0.4); border-radius: 3px; }
    }
    .wpa-card {
      flex: 0 0 180px;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      text-decoration: none;
      color: inherit;
      transition: transform 0.2s;
      box-shadow: 0 2px 6px rgba(0,0,0,0.04);
      &:hover { transform: translateY(-3px); }
    }
    .wpa-img {
      position: relative;
      width: 100%;
      height: 140px;
      background: #f9fafb;
      img { width: 100%; height: 100%; object-fit: cover; }
      .ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 32px; color: #d1d5db; }
      .drop-badge {
        position: absolute; top: 8px; right: 8px;
        background: #ef4444; color: #fff; padding: 3px 9px;
        border-radius: 10px; font-weight: 700; font-size: 12px;
      }
    }
    .wpa-body { padding: 10px 12px; }
    .wpa-title { font-size: 13px; font-weight: 500; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wpa-prices { margin-top: 4px; font-size: 13px; }
    .old { text-decoration: line-through; color: #9ca3af; margin-right: 6px; }
    .new { color: #10b981; font-weight: 700; }
  `]
})
export class WishlistPriceAlertsComponent implements OnInit {
  alerts: PriceAlert[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    const token = localStorage.getItem('jwt') || localStorage.getItem('admin_jwt');
    if (!token) return;
    this.http.get<{ alerts: PriceAlert[] }>(
      `${environementDev.api}/api/storefront/wishlist/price-alerts`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).subscribe({
      next: (r) => { this.alerts = r?.alerts || []; },
      error: () => {},
    });
  }
}
