import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';

@Component({
  selector: 'app-daily-deal-banner',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="dd-banner" *ngIf="deal && product">
      <div class="dd-left">
        <img [src]="product.firstImageUrl" [alt]="product.title" *ngIf="product.firstImageUrl" />
      </div>
      <div class="dd-middle">
        <div class="flash-tag">⚡ DEAL DU JOUR</div>
        <h2>{{ deal.headline || product.title }}</h2>
        <div class="prices">
          <span class="old">{{ product.originalPrice | number:'1.2-2' }} TND</span>
          <span class="new">{{ deal.specialPrice | number:'1.2-2' }} TND</span>
          <span class="discount" *ngIf="discountPct > 0">-{{ discountPct }}%</span>
        </div>
        <a [routerLink]="['/detail-produit', product.id]" class="cta">Je profite maintenant →</a>
      </div>
      <div class="dd-right">
        <div class="countdown-label">Fin de l'offre dans</div>
        <div class="countdown">
          <div class="cd-part"><span class="val">{{ countdown.h }}</span><small>h</small></div>
          <div class="cd-part"><span class="val">{{ countdown.m }}</span><small>min</small></div>
          <div class="cd-part"><span class="val">{{ countdown.s }}</span><small>sec</small></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dd-banner { display:grid; grid-template-columns:140px 1fr 200px; gap:20px; align-items:center; background:linear-gradient(135deg,#fbbf24 0%,#ef4444 100%); border-radius:20px; padding:20px 24px; margin:20px 0; color:#fff; box-shadow:0 12px 30px rgba(239,68,68,.25); }
    .dd-left img { width:140px; height:140px; object-fit:cover; border-radius:16px; box-shadow:0 6px 16px rgba(0,0,0,.2); }
    .flash-tag { display:inline-block; background:rgba(255,255,255,.3); padding:4px 12px; border-radius:16px; font-weight:700; font-size:12px; letter-spacing:1px; margin-bottom:8px; }
    .dd-middle h2 { margin:0 0 10px; font-size:24px; text-shadow:0 2px 6px rgba(0,0,0,.2); }
    .prices { display:flex; gap:12px; align-items:center; margin-bottom:14px; }
    .old { text-decoration:line-through; opacity:.8; font-size:14px; }
    .new { font-size:28px; font-weight:800; }
    .discount { background:#fff; color:#ef4444; font-weight:800; padding:3px 10px; border-radius:10px; font-size:14px; }
    .cta { display:inline-block; background:#fff; color:#111; padding:10px 22px; border-radius:24px; font-weight:700; text-decoration:none; transition:transform .2s; }
    .cta:hover { transform:translateY(-2px); }
    .countdown-label { font-size:12px; opacity:.9; margin-bottom:6px; letter-spacing:1px; }
    .countdown { display:flex; gap:6px; }
    .cd-part { background:rgba(0,0,0,.25); border-radius:8px; padding:6px 8px; text-align:center; min-width:50px; }
    .cd-part .val { display:block; font-size:22px; font-weight:800; }
    .cd-part small { font-size:10px; opacity:.8; }
    @media (max-width:800px) { .dd-banner { grid-template-columns:1fr; } .dd-left img { width:100%; height:180px; } }
  `]
})
export class DailyDealBannerComponent implements OnInit, OnDestroy {
  deal: any = null;
  product: any = null;
  discountPct = 0;
  countdown = { h: 0, m: 0, s: 0 };
  private interval: any;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<any>(`${environementDev.api}/api/storefront/w4/daily-deal/current`).subscribe({
      next: (r) => {
        if (r?.active) {
          this.deal = r.deal; this.product = r.product;
          const op = Number(this.product.originalPrice) || 0;
          const sp = Number(this.deal.specialPrice) || 0;
          this.discountPct = op > 0 ? Math.round(((op - sp) / op) * 100) : 0;
          this.interval = setInterval(() => this.updateCountdown(), 1000);
          this.updateCountdown();
        }
      }, error: () => {}
    });
  }

  ngOnDestroy() { if (this.interval) clearInterval(this.interval); }

  private updateCountdown() {
    if (!this.deal?.endAt) return;
    const diff = new Date(this.deal.endAt).getTime() - Date.now();
    if (diff <= 0) { this.countdown = { h: 0, m: 0, s: 0 }; return; }
    this.countdown = {
      h: Math.floor(diff / 3600000),
      m: Math.floor((diff % 3600000) / 60000),
      s: Math.floor((diff % 60000) / 1000),
    };
  }
}
