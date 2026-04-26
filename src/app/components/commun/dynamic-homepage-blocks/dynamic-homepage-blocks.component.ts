import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';

interface Block {
  id: number;
  key: string;
  title: string;
  type: 'banner' | 'products_carousel' | 'category_grid' | 'bundles' | 'outfits' | string;
  config: any;
  position: number;
}

/**
 * Renders the admin-configured homepage blocks in order.
 * Each block type maps to a small inline renderer.
 * Gracefully falls back to empty when endpoint fails.
 */
@Component({
  selector: 'app-dynamic-homepage-blocks',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="dhb" *ngIf="blocks.length > 0">
      <div *ngFor="let b of blocks" class="block">
        <!-- BANNER -->
        <div class="banner" *ngIf="b.type === 'banner'" [style.backgroundImage]="'url(' + (b.config?.imageUrl || '/assets/images/hero-banner.jpg') + ')'">
          <div class="banner-inner">
            <h2>{{ b.title }}</h2>
            <a *ngIf="b.config?.ctaUrl" [routerLink]="b.config.ctaUrl" class="btn-cta">
              {{ b.config?.ctaLabel || 'Découvrir' }}
            </a>
          </div>
        </div>

        <!-- PRODUCTS CAROUSEL -->
        <div class="pcar" *ngIf="b.type === 'products_carousel'">
          <div class="section-head">
            <h2>{{ b.title }}</h2>
          </div>
          <div class="carousel">
            <a *ngFor="let p of blockData[b.id] || []" class="pcard" [routerLink]="['/detail-produit', p.id]">
              <img *ngIf="p.firstImageUrl" [src]="p.firstImageUrl" [alt]="p.title" />
              <div class="pcard-body">
                <div class="t">{{ p.title }}</div>
                <div class="price">{{ p.currentPrice | number:'1.2-2' }} TND</div>
              </div>
            </a>
          </div>
        </div>

        <!-- CATEGORY GRID -->
        <div class="cgrid" *ngIf="b.type === 'category_grid'">
          <div class="section-head">
            <h2>{{ b.title }}</h2>
          </div>
          <div class="grid">
            <a *ngFor="let c of blockData[b.id] || []" class="ctile" [routerLink]="['/tn', c.slug]">
              <img *ngIf="c.bannerUrl || c.imageUrl" [src]="c.bannerUrl || c.imageUrl" [alt]="c.name" />
              <div class="ctile-body">
                <strong>{{ c.name }}</strong>
                <span>Découvrir →</span>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dhb { padding: 0 16px; max-width: 1400px; margin: 0 auto; }
    .block { margin: 40px 0; }

    .banner { height: 280px; border-radius: 16px; background-size: cover; background-position: center; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
    .banner::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(99,102,241,0.5), rgba(236,72,153,0.5)); }
    .banner-inner { position: relative; text-align: center; color: #fff; }
    .banner-inner h2 { font-size: 38px; margin: 0 0 16px; text-shadow: 0 2px 10px rgba(0,0,0,0.3); }
    .btn-cta { display: inline-block; background: #fff; color: #111; padding: 12px 32px; border-radius: 30px; font-weight: 600; text-decoration: none; }

    .section-head { margin-bottom: 20px; }
    .section-head h2 { font-size: 26px; font-weight: 700; color: #111827; margin: 0; }

    .carousel { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 8px; }
    .carousel::-webkit-scrollbar { height: 6px; }
    .carousel::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
    .pcard { flex: 0 0 200px; background: #fff; border-radius: 12px; overflow: hidden; text-decoration: none; color: inherit; box-shadow: 0 2px 6px rgba(0,0,0,0.04); transition: transform .2s; }
    .pcard:hover { transform: translateY(-3px); }
    .pcard img { width: 100%; height: 240px; object-fit: cover; background: #f3f4f6; }
    .pcard-body { padding: 10px 12px; }
    .pcard .t { font-size: 13px; color: #111827; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pcard .price { color: #10b981; font-weight: 700; font-size: 14px; margin-top: 4px; }

    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
    .ctile { position: relative; border-radius: 14px; overflow: hidden; text-decoration: none; color: #fff; aspect-ratio: 4/3; background: #111; }
    .ctile img { width: 100%; height: 100%; object-fit: cover; opacity: 0.85; }
    .ctile-body { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; padding: 14px; background: linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.65) 100%); }
    .ctile strong { font-size: 18px; }
    .ctile span { font-size: 12px; opacity: 0.9; }
  `]
})
export class DynamicHomepageBlocksComponent implements OnInit {
  blocks: Block[] = [];
  blockData: Record<number, any[]> = {};

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<{ items: Block[] }>(`${environementDev.api}/api/storefront/w3/homepage-blocks`)
      .subscribe({
        next: (r) => {
          this.blocks = (r?.items || []).sort((a, b) => a.position - b.position);
          this.blocks.forEach((b) => this.hydrateBlock(b));
        },
        error: () => { this.blocks = []; }
      });
  }

  private hydrateBlock(b: Block): void {
    if (b.type === 'products_carousel') {
      const limit = Number(b.config?.limit) || 6;
      const ids: number[] | undefined = b.config?.productIds;
      const url = ids && ids.length > 0
        ? `${environementDev.api}/api/products?limit=${limit}`
        : `${environementDev.api}/api/products?limit=${limit}&isFeatured=true`;
      this.http.get<any>(url).subscribe({
        next: (r) => {
          let items = r?.items || [];
          if (ids && ids.length > 0) items = items.filter((p: any) => ids.includes(p.id));
          this.blockData[b.id] = items.slice(0, limit);
        },
        error: () => { this.blockData[b.id] = []; }
      });
    } else if (b.type === 'category_grid') {
      const slugs: string[] = b.config?.categorySlugs || [];
      this.http.get<any[]>(`${environementDev.api}/api/categories`).subscribe({
        next: (r) => {
          const all = Array.isArray(r) ? r : [];
          const items = slugs.length > 0 ? all.filter((c) => slugs.includes(c.slug)) : all.slice(0, 4);
          this.blockData[b.id] = items;
        },
        error: () => { this.blockData[b.id] = []; }
      });
    }
  }
}
