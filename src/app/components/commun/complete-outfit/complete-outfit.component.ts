import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';
import { ProductService } from '../../../services/product.service';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface OutfitData {
  base: { id: number; title: string; firstImageUrl: string; currentPrice: number };
  bundles: Array<{ id: number; name: string; bundlePrice: number; imageUrl?: string }>;
  outfit: Array<{ id: number; title: string; slug?: string; firstImageUrl: string; currentPrice: number }>;
  reason: string;
}

/**
 * Wave 3 — "Complete this outfit" on product detail.
 * Calls /storefront/w3/complete-outfit/:id, shows bundles (if any) + AI-curated outfit items.
 */
@Component({
  selector: 'app-complete-outfit',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="co-wrap" *ngIf="data && (data.outfit?.length || data.bundles?.length)">
      <div class="co-head">
        <span class="co-icon">✨</span>
        <div>
          <h3>Complétez ce look</h3>
          <p>{{ data.reason }}</p>
        </div>
        <a class="co-studio" [routerLink]="['/studio-look']"><i class="fas fa-palette"></i> Studio Look</a>
      </div>

      <!-- Bundles -->
      <div class="co-bundles" *ngIf="data.bundles && data.bundles.length > 0">
        <h4>📦 Packs contenant cet article</h4>
        <div class="b-list">
          <div *ngFor="let b of data.bundles" class="bundle-card">
            <img *ngIf="b.imageUrl" [src]="b.imageUrl" [alt]="b.name" />
            <div>
              <strong>{{ b.name }}</strong>
              <span>{{ b.bundlePrice | number:'1.2-2' }} TND</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Outfit suggestions -->
      <div class="co-items" *ngIf="data.outfit && data.outfit.length > 0">
        <div class="co-grid">
          <a *ngFor="let p of data.outfit" class="co-tile" [routerLink]="['/detail-produit', p.id]">
            <img *ngIf="p.firstImageUrl" [src]="p.firstImageUrl" [alt]="p.title" />
            <div class="co-tile-body">
              <div class="t">{{ p.title }}</div>
              <div class="p">{{ p.currentPrice | number:'1.2-2' }} TND</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .co-wrap {
      background: linear-gradient(135deg, #fdf2f8 0%, #eef2ff 100%);
      border-radius: 18px;
      padding: 22px 24px;
      margin: 28px 0;
      border: 1px solid rgba(236, 72, 153, 0.15);
    }
    .co-head { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
    .co-icon { font-size: 32px; }
    .co-head h3 { margin: 0 0 3px; font-size: 18px; color: #111827; }
    .co-head p { margin: 0; font-size: 13px; color: #6b7280; }
    .co-studio {
      margin-left: auto;
      background: linear-gradient(135deg, #6366f1, #ec4899);
      color: #fff; padding: 8px 18px; border-radius: 20px;
      font-size: 13px; text-decoration: none; font-weight: 600;
      display: inline-flex; align-items: center; gap: 6px;
    }

    .co-bundles h4 { font-size: 14px; margin: 0 0 8px; color: #111827; }
    .b-list { display: flex; gap: 10px; overflow-x: auto; margin-bottom: 16px; }
    .bundle-card {
      display: flex; gap: 10px; align-items: center;
      background: #fff; padding: 10px; border-radius: 10px;
      flex: 0 0 240px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .bundle-card img { width: 50px; height: 50px; object-fit: cover; border-radius: 6px; }
    .bundle-card strong { display: block; font-size: 13px; color: #111827; }
    .bundle-card span { font-size: 14px; color: #10b981; font-weight: 700; }

    .co-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
    .co-tile {
      background: #fff; border-radius: 12px; overflow: hidden;
      text-decoration: none; color: inherit;
      transition: transform .2s, box-shadow .2s;
      box-shadow: 0 2px 6px rgba(0,0,0,0.04);
    }
    .co-tile:hover { transform: translateY(-3px); box-shadow: 0 6px 14px rgba(99,102,241,0.15); }
    .co-tile img { width: 100%; height: 180px; object-fit: cover; background: #f9fafb; }
    .co-tile-body { padding: 10px 12px; }
    .co-tile .t { font-size: 13px; font-weight: 500; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .co-tile .p { color: #10b981; font-weight: 700; font-size: 14px; margin-top: 4px; }
  `]
})
export class CompleteOutfitComponent implements OnChanges {
  @Input() productId?: number;
  data: OutfitData | null = null;

  constructor(
    private http: HttpClient,
    private productService: ProductService
  ) {}

  ngOnChanges(ch: SimpleChanges): void {
    if (!this.productId) { this.data = null; return; }

    if ((environementDev as any).useLocalAuth) {
      this.loadLocalFallback();
      return;
    }

    const token = localStorage.getItem('jwt');
    const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
    this.http.get<OutfitData>(
      `${environementDev.api}/api/storefront/w3/complete-outfit/${this.productId}`,
      { headers }
    ).subscribe({
      next: (r) => { this.data = r; },
      error: () => { this.loadLocalFallback(); }
    });
  }

  private loadLocalFallback(): void {
    if (!this.productId) {
      this.data = null;
      return;
    }

    this.productService.getProductById(this.productId).pipe(
      catchError(() => of(null))
    ).subscribe((product: any) => {
      if (!product?.id || !product?.title || !product?.Famille || !product?.Persona) {
        this.data = null;
        return;
      }

      this.productService.getSimilarProducts(
        product.title,
        product.Famille,
        product.Persona
      ).pipe(
        catchError(() => of({ hits: [] }))
      ).subscribe((response) => {
        const outfit = (response?.hits || [])
          .filter((item: any) => item?.id && item.id !== product.id)
          .slice(0, 4)
          .map((item: any) => ({
            id: item.id,
            title: item.title,
            slug: item.slug,
            firstImageUrl: item.firstImg?.url || item.firstImageUrl || 'assets/images/placeholder.png',
            currentPrice: Number(item.currentPrice ?? item.price ?? 0),
          }));

        this.data = outfit.length > 0 ? {
          base: {
            id: product.id,
            title: product.title,
            firstImageUrl: product.firstImg?.url || 'assets/images/placeholder.png',
            currentPrice: Number(product.currentPrice ?? product.price ?? 0),
          },
          bundles: [],
          outfit,
          reason: 'Suggestions similaires disponibles en mode local'
        } : null;
      });
    });
  }
}
