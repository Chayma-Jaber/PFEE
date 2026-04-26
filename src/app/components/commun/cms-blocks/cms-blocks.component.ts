import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { environementDev } from '../../../../environements/environementDev';

// Block contract — every block has { type, props }. Unknown types render an empty
// `<!-- unsupported block -->` so a malformed page never blows up the storefront.
//
// Supported types (keep this list in sync with the admin block library):
//   hero          { title, subtitle?, image?, ctaLabel?, ctaUrl?, theme? }
//   banner        { image, title?, subtitle?, ctaLabel?, ctaUrl?, alignment? }
//   text          { html?, markdown? }
//   image         { src, alt?, link? }
//   cta           { label, url, theme? }
//   grid          { columns: [{ title?, image?, html?, ctaUrl? }, ...] }
//   product-list  { title?, productIds: number[], limit? }
//   spacer        { height: 'sm'|'md'|'lg' }
//   divider       {}

interface ProductLite {
  id: number; title: string; currentPrice?: number; price?: number;
  firstImageUrl?: string; slug?: string;
}

@Component({
  selector: 'app-cms-blocks',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <ng-container *ngFor="let b of blocks; let i = index">
      <!-- HERO -->
      <section *ngIf="b.type === 'hero'" class="cms-hero" [class.dark]="b.props?.theme === 'dark'"
               [style.background-image]="b.props?.image ? 'url(' + b.props.image + ')' : null">
        <div class="cms-hero-inner">
          <h1 *ngIf="b.props?.title">{{ b.props.title }}</h1>
          <p *ngIf="b.props?.subtitle">{{ b.props.subtitle }}</p>
          <a *ngIf="b.props?.ctaUrl && b.props?.ctaLabel" [routerLink]="b.props.ctaUrl" class="cms-btn">
            {{ b.props.ctaLabel }}
          </a>
        </div>
      </section>

      <!-- BANNER -->
      <section *ngIf="b.type === 'banner'" class="cms-banner" [class]="'align-' + (b.props?.alignment || 'left')">
        <img *ngIf="b.props?.image" [src]="b.props.image" [alt]="b.props?.title || ''" />
        <div class="cms-banner-text">
          <h2 *ngIf="b.props?.title">{{ b.props.title }}</h2>
          <p *ngIf="b.props?.subtitle">{{ b.props.subtitle }}</p>
          <a *ngIf="b.props?.ctaUrl && b.props?.ctaLabel" [routerLink]="b.props.ctaUrl" class="cms-btn ghost">
            {{ b.props.ctaLabel }}
          </a>
        </div>
      </section>

      <!-- TEXT -->
      <section *ngIf="b.type === 'text'" class="cms-text">
        <div *ngIf="b.props?.html" [innerHTML]="renderedHtml(b.props.html)"></div>
        <div *ngIf="!b.props?.html && b.props?.markdown" class="md">{{ b.props.markdown }}</div>
      </section>

      <!-- IMAGE -->
      <figure *ngIf="b.type === 'image' && b.props?.src" class="cms-image">
        <a *ngIf="b.props?.link" [routerLink]="b.props.link"><img [src]="b.props.src" [alt]="b.props?.alt || ''"/></a>
        <img *ngIf="!b.props?.link" [src]="b.props.src" [alt]="b.props?.alt || ''" />
      </figure>

      <!-- CTA standalone -->
      <div *ngIf="b.type === 'cta' && b.props?.url && b.props?.label" class="cms-cta-wrap">
        <a [routerLink]="b.props.url" class="cms-btn" [class.ghost]="b.props?.theme === 'ghost'">{{ b.props.label }}</a>
      </div>

      <!-- GRID — N columns of mini-cards -->
      <section *ngIf="b.type === 'grid' && (b.props?.columns?.length || 0) > 0" class="cms-grid"
               [style.grid-template-columns]="'repeat(' + Math.min(b.props.columns.length, 4) + ', 1fr)'">
        <a *ngFor="let col of b.props.columns" class="cms-grid-cell" [routerLink]="col.ctaUrl || null">
          <img *ngIf="col.image" [src]="col.image" [alt]="col.title || ''" />
          <h3 *ngIf="col.title">{{ col.title }}</h3>
          <div *ngIf="col.html" [innerHTML]="renderedHtml(col.html)"></div>
        </a>
      </section>

      <!-- PRODUCT-LIST — fetched lazily on first render -->
      <section *ngIf="b.type === 'product-list'" class="cms-product-list">
        <h2 *ngIf="b.props?.title">{{ b.props.title }}</h2>
        <div class="cms-products" *ngIf="productsByBlockIndex[i]?.length">
          <a *ngFor="let p of productsByBlockIndex[i]" [routerLink]="['/detail-produit', p.id]" class="cms-prod">
            <img *ngIf="p.firstImageUrl" [src]="p.firstImageUrl" [alt]="p.title" />
            <strong>{{ p.title }}</strong>
            <span class="price">{{ p.currentPrice ?? p.price }} TND</span>
          </a>
        </div>
        <div class="cms-loading" *ngIf="!productsByBlockIndex[i] && (b.props?.productIds?.length || 0) > 0">Chargement…</div>
      </section>

      <!-- SPACER -->
      <div *ngIf="b.type === 'spacer'" class="cms-spacer" [class.lg]="b.props?.height === 'lg'" [class.md]="b.props?.height === 'md'"></div>

      <!-- DIVIDER -->
      <hr *ngIf="b.type === 'divider'" class="cms-divider" />
    </ng-container>
  `,
  styles: [`
    :host { display: block; }
    .cms-hero { padding: 70px 24px; background-size: cover; background-position: center; color: #111827;
                text-align: center; border-radius: 14px; margin: 12px 0; }
    .cms-hero.dark { color: #fff; background-color: #111827; }
    .cms-hero-inner { max-width: 720px; margin: 0 auto; }
    .cms-hero h1 { font-size: 38px; font-weight: 700; margin: 0 0 12px; }
    .cms-hero p { font-size: 17px; line-height: 1.6; margin: 0 0 22px; opacity: .92; }
    .cms-banner { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: center; margin: 14px 0; padding: 0; }
    .cms-banner.align-right { grid-template-columns: 1fr 1fr; direction: rtl; }
    .cms-banner.align-right > * { direction: ltr; }
    .cms-banner img { width: 100%; height: 100%; max-height: 360px; object-fit: cover; border-radius: 14px; }
    .cms-banner-text h2 { font-size: 24px; margin: 0 0 8px; color: #111827; }
    .cms-banner-text p { color: #4b5563; margin: 0 0 14px; line-height: 1.6; }
    @media (max-width: 800px) { .cms-banner { grid-template-columns: 1fr; } .cms-banner.align-right { direction: ltr; } }
    .cms-text { margin: 14px 0; padding: 0 4px; line-height: 1.6; color: #1f2937; }
    .cms-text .md { white-space: pre-wrap; }
    .cms-image { margin: 14px 0; }
    .cms-image img { width: 100%; max-height: 480px; object-fit: cover; border-radius: 12px; }
    .cms-cta-wrap { text-align: center; margin: 18px 0; }
    .cms-btn { display: inline-block; padding: 12px 26px; background: linear-gradient(135deg, #6366f1, #ec4899);
               color: #fff; border-radius: 999px; font-weight: 600; text-decoration: none; font-size: 14px; }
    .cms-btn:hover { transform: translateY(-1px); }
    .cms-btn.ghost { background: transparent; color: #4f46e5; border: 1px solid #c7d2fe; }
    .cms-grid { display: grid; gap: 14px; margin: 14px 0; }
    .cms-grid-cell { display: block; padding: 14px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
                     text-decoration: none; color: #111827; }
    .cms-grid-cell:hover { border-color: #c7d2fe; transform: translateY(-2px); transition: all .15s; }
    .cms-grid-cell img { width: 100%; height: 160px; object-fit: cover; border-radius: 8px; margin-bottom: 10px; }
    .cms-grid-cell h3 { margin: 0 0 6px; font-size: 16px; }
    .cms-product-list { margin: 18px 0; }
    .cms-product-list h2 { font-size: 20px; color: #111827; margin: 0 0 12px; }
    .cms-products { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
    .cms-prod { background: #fff; border: 1px solid #e5e7eb; border-radius: 11px; overflow: hidden;
                text-decoration: none; color: #111827; display: flex; flex-direction: column; }
    .cms-prod img { width: 100%; height: 200px; object-fit: cover; }
    .cms-prod strong { padding: 10px 12px 4px; font-size: 13px; line-height: 1.3; }
    .cms-prod .price { padding: 0 12px 12px; font-weight: 700; color: #ec4899; font-size: 14px; }
    .cms-loading { padding: 14px; color: #9ca3af; font-size: 13px; }
    .cms-spacer { height: 24px; }
    .cms-spacer.md { height: 48px; }
    .cms-spacer.lg { height: 80px; }
    .cms-divider { border: none; border-top: 1px solid #e5e7eb; margin: 20px 0; }
  `]
})
export class CmsBlocksComponent implements OnChanges {
  @Input() blocks: Array<{ type: string; props: any }> = [];

  productsByBlockIndex: Record<number, ProductLite[]> = {};
  Math = Math;

  constructor(private http: HttpClient, private sanitizer: DomSanitizer) {}

  ngOnChanges(c: SimpleChanges) {
    if (c['blocks']) this.fetchProductLists();
  }

  // Sanitize-by-trust the html in text/grid blocks. We trust admin-authored content;
  // the full XSS hardening would route through DOMPurify which we don't ship here.
  renderedHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html || '');
  }

  private fetchProductLists() {
    this.productsByBlockIndex = {};
    (this.blocks || []).forEach((b, idx) => {
      if (b.type === 'product-list' && Array.isArray(b.props?.productIds) && b.props.productIds.length > 0) {
        const ids: number[] = b.props.productIds.slice(0, b.props?.limit || 12);
        // Single batched call to /api/products/by-ids
        this.http.get<any>(`${environementDev.api}/api/products/by-ids?ids=${ids.join(',')}`).subscribe({
          next: (r: any) => {
            const items: ProductLite[] = Array.isArray(r) ? r : (r?.items || r?.data || []);
            // Preserve the admin-specified order (the API may return them differently)
            const byId = new Map(items.map((p) => [p.id, p]));
            this.productsByBlockIndex[idx] = ids.map((id) => byId.get(id)).filter(Boolean) as ProductLite[];
          },
          error: () => { this.productsByBlockIndex[idx] = []; }
        });
      }
    });
  }
}
