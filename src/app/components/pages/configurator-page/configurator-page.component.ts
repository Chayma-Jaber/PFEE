import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Subscription } from 'rxjs';
import { environementDev } from '../../../../environements/environementDev';
import { CartService } from '../../../services/cart.service';

interface PoolProduct { productId: number; title: string; price: number; image: string | null; }
interface ConfigSlot {
  id: number; name: string; position: number; required: boolean; max_items: number;
  pool: PoolProduct[];
}
interface ConfigFull {
  configurator: { id: number; slug: string; title: string; description: string | null;
                  cover_image: string | null; bundle_discount_pct: number; kind: string; };
  slots: ConfigSlot[];
}
interface PriceResult {
  configuratorId: number;
  lineItems: Array<{ productId: number; quantity: number; unitPrice: number; subtotal: number }>;
  subtotal: number; discountPct: number; discountAmount: number; total: number;
  missingSlots: number[]; isComplete: boolean;
}

// Variant selection modal state — one entry per chosen product.
interface VariantPick {
  productId: number;
  productTitle: string;
  productImage: string | null;
  unitPrice: number;
  quantity: number;
  variants: Array<{ id: number; couleur: string | null; taille: string | null; sku: string | null; ean13: string | null; stock: number; priceAdjust: number }>;
  // Auto-collected option dimensions (only show pickers for non-empty ones)
  colours: string[];
  sizes: string[];
  // Customer's pick
  selectedColour: string | null;
  selectedSize: string | null;
  // Resolved variant after picks (or the single variant when product has no choices)
  resolvedVariant: any | null;
  // Display message: "Cet article n'a pas de variantes" if pool is empty
  noVariants: boolean;
}

@Component({
  selector: 'app-configurator-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="cfg-wrap">
      <!-- LIST MODE — no slug, show active configurators as cards -->
      <div *ngIf="!slug">
        <header class="hero">
          <h1><i class="fas fa-puzzle-piece"></i> Composez votre coffret</h1>
          <p>Construisez un cadeau ou une tenue à partir d'une sélection curated. Une remise s'applique automatiquement quand le coffret est complet.</p>
        </header>
        <div *ngIf="loadingList" class="state">Chargement…</div>
        <div *ngIf="!loadingList && list.length === 0" class="state">
          <p>Aucun coffret en cours pour le moment.</p>
          <a routerLink="/" class="btn">Retour à l'accueil</a>
        </div>
        <div class="cfg-cards">
          <a *ngFor="let c of list" [routerLink]="['/configurator', c.slug]" class="cfg-card">
            <img *ngIf="c.cover_image" [src]="c.cover_image" [alt]="c.title" />
            <div class="cfg-card-body">
              <span class="badge">-{{ c.bundle_discount_pct }}%</span>
              <h3>{{ c.title }}</h3>
              <p>{{ c.description || 'Construisez votre coffret personnalisé' }}</p>
            </div>
          </a>
        </div>
      </div>

      <!-- DETAIL MODE — composing one configurator -->
      <div *ngIf="slug">
        <div *ngIf="loading" class="state">Chargement…</div>
        <div *ngIf="!loading && !data" class="state">
          <h2>Coffret introuvable</h2>
          <a routerLink="/configurator" class="btn">Voir tous les coffrets</a>
        </div>

        <ng-container *ngIf="data">
          <header class="hero">
            <a routerLink="/configurator" class="back">← Tous les coffrets</a>
            <h1>{{ data.configurator.title }}</h1>
            <p *ngIf="data.configurator.description">{{ data.configurator.description }}</p>
            <div class="hero-meta">
              <span class="chip">{{ data.slots.length }} étape(s)</span>
              <span class="chip success" *ngIf="data.configurator.bundle_discount_pct > 0">-{{ data.configurator.bundle_discount_pct }}% si complet</span>
            </div>
          </header>

          <div class="layout">
            <main class="slots-col">
              <section *ngFor="let slot of data.slots; let i = index" class="slot" [class.complete]="isSlotComplete(slot)">
                <div class="slot-head">
                  <span class="slot-num">{{ slot.position || (i + 1) }}</span>
                  <h2>{{ slot.name }}</h2>
                  <span class="slot-flag" *ngIf="!slot.required">optionnel</span>
                  <span class="slot-flag req" *ngIf="slot.required && !isSlotComplete(slot)">requis</span>
                  <span class="slot-flag ok" *ngIf="isSlotComplete(slot)">✓</span>
                </div>
                <div *ngIf="slot.pool.length === 0" class="empty">Aucun produit disponible pour ce slot.</div>
                <div class="pool" *ngIf="slot.pool.length > 0">
                  <button *ngFor="let p of slot.pool" type="button" class="pool-item"
                          [class.selected]="selectedFor(slot.id) === p.productId" (click)="pick(slot, p)">
                    <img *ngIf="p.image" [src]="p.image" [alt]="p.title" />
                    <strong>{{ p.title }}</strong>
                    <span class="pool-price">{{ p.price }} TND</span>
                  </button>
                </div>
                <div class="slot-qty" *ngIf="slot.max_items > 1 && selectedFor(slot.id)">
                  <label>Quantité : <input type="number" min="1" [max]="slot.max_items" [(ngModel)]="qtyMap[slot.id]" (ngModelChange)="recompute()" /></label>
                </div>
              </section>
            </main>

            <aside class="summary-col">
              <div class="summary">
                <h3>Récapitulatif</h3>
                <div *ngIf="!price?.lineItems?.length" class="muted">Sélectionnez des articles pour voir le prix.</div>
                <ul *ngIf="price?.lineItems?.length">
                  <li *ngFor="let li of (price?.lineItems || [])">
                    <span>{{ findTitle(li.productId) }} × {{ li.quantity }}</span>
                    <strong>{{ li.subtotal }} TND</strong>
                  </li>
                </ul>
                <div *ngIf="price" class="summary-totals">
                  <div><span>Sous-total</span><span>{{ price.subtotal }} TND</span></div>
                  <div *ngIf="price.discountPct > 0" class="discount">
                    <span>Remise coffret -{{ price.discountPct }}%</span>
                    <span>−{{ price.discountAmount }} TND</span>
                  </div>
                  <div class="grand"><span>Total</span><strong>{{ price.total }} TND</strong></div>
                </div>
                <div *ngIf="showBundleHint()" class="hint">
                  <i class="fas fa-info-circle"></i>
                  Complétez les {{ price?.missingSlots?.length || 0 }} étape(s) requise(s) pour activer la remise -{{ data?.configurator?.bundle_discount_pct || 0 }}%.
                </div>
                <button class="btn-cta" (click)="addAllToCart()" [disabled]="!price?.lineItems?.length || addingToCart">
                  <i class="fas fa-shopping-bag"></i>
                  {{ addingToCart ? 'Préparation…' : 'Ajouter le coffret au panier' }}
                </button>
              </div>
            </aside>
          </div>
        </ng-container>
      </div>

      <!-- ═══ Variant selection modal ═══════════════════════════════════════ -->
      <div *ngIf="picks.length > 0" class="modal-backdrop" (click)="closePicks()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h2><i class="fas fa-tshirt"></i> Choisissez vos variantes</h2>
            <button class="modal-close" (click)="closePicks()">×</button>
          </div>
          <p class="modal-sub">Sélectionnez la taille et la couleur pour chaque article du coffret.</p>

          <div class="picks">
            <div class="pick-row" *ngFor="let pk of picks" [class.no-variants]="pk.noVariants">
              <img *ngIf="pk.productImage" [src]="pk.productImage" [alt]="pk.productTitle" />
              <div class="pick-body">
                <strong>{{ pk.productTitle }}</strong>
                <span class="pick-price">{{ pk.unitPrice }} TND × {{ pk.quantity }}</span>

                <div *ngIf="pk.noVariants" class="no-var-msg">
                  <i class="fas fa-info-circle"></i> Pas de variante — sera ajouté tel quel.
                </div>

                <div *ngIf="!pk.noVariants" class="picker-row">
                  <label *ngIf="pk.colours.length > 0">
                    Couleur
                    <select [(ngModel)]="pk.selectedColour" (ngModelChange)="resolvePick(pk)">
                      <option [ngValue]="null" disabled>— choisir —</option>
                      <option *ngFor="let c of pk.colours" [ngValue]="c">{{ c }}</option>
                    </select>
                  </label>
                  <label *ngIf="pk.sizes.length > 0">
                    Taille
                    <select [(ngModel)]="pk.selectedSize" (ngModelChange)="resolvePick(pk)">
                      <option [ngValue]="null" disabled>— choisir —</option>
                      <option *ngFor="let s of pk.sizes" [ngValue]="s" [disabled]="!isSizeAvailable(pk, s)">
                        {{ s }}{{ !isSizeAvailable(pk, s) ? ' (rupture)' : '' }}
                      </option>
                    </select>
                  </label>
                </div>

                <div *ngIf="pk.resolvedVariant" class="resolved">
                  <span class="badge ok">✓ Variante résolue</span>
                  <span class="small">Stock : {{ pk.resolvedVariant.stock }}</span>
                </div>
                <div *ngIf="!pk.noVariants && !pk.resolvedVariant && (pk.selectedColour || pk.selectedSize)" class="resolved warn">
                  <span class="badge warn">⚠</span>
                  <span class="small">Cette combinaison n'existe pas — choisissez-en une autre.</span>
                </div>
              </div>
            </div>
          </div>

          <div *ngIf="checkoutError" class="err-banner">{{ checkoutError }}</div>

          <div class="modal-foot">
            <button class="btn-ghost-mini" (click)="closePicks()">Annuler</button>
            <button class="btn-cta" (click)="confirmAddBundle()" [disabled]="!allPicksReady() || addingToCart">
              <i class="fas fa-check"></i>
              {{ addingToCart ? 'Ajout en cours…' : 'Confirmer & ajouter au panier' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .cfg-wrap { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .hero { margin-bottom: 22px; }
    .hero h1 { font-size: 28px; color: #111827; margin: 4px 0 6px; }
    .hero h1 i { color: #ec4899; margin-right: 8px; }
    .hero p { color: #6b7280; margin: 0 0 8px; line-height: 1.5; }
    .back { display: inline-block; margin-bottom: 6px; color: #6366f1; text-decoration: none; font-size: 13px; }
    .hero-meta { display: flex; gap: 6px; margin-top: 8px; }
    .chip { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; background: #eef2ff; color: #4338ca; }
    .chip.success { background: linear-gradient(135deg, #ec4899, #f59e0b); color: #fff; }
    .state { text-align: center; padding: 60px 20px; color: #6b7280; }
    .btn { display: inline-block; padding: 10px 20px; background: #111; color: #fff; border-radius: 999px;
           text-decoration: none; font-size: 13px; }
    .cfg-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
    .cfg-card { display: block; background: #fff; border: 1px solid #e5e7eb; border-radius: 14px;
                overflow: hidden; text-decoration: none; color: #111827; transition: transform .15s; }
    .cfg-card:hover { transform: translateY(-3px); border-color: #c7d2fe; }
    .cfg-card img { width: 100%; height: 180px; object-fit: cover; }
    .cfg-card-body { padding: 14px 16px; }
    .cfg-card-body h3 { margin: 8px 0 4px; font-size: 16px; }
    .cfg-card-body p { color: #6b7280; font-size: 12px; line-height: 1.4; margin: 0; }
    .badge { background: linear-gradient(135deg, #ec4899, #6366f1); color: #fff;
             font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; }

    .layout { display: grid; grid-template-columns: 1fr 340px; gap: 20px; align-items: flex-start; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
    .slot { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 18px; margin-bottom: 14px; }
    .slot.complete { border-color: #86efac; background: #f0fdf4; }
    .slot-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .slot-num { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg,#6366f1,#ec4899);
                color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; }
    .slot-head h2 { margin: 0; font-size: 16px; color: #111827; flex: 1; }
    .slot-flag { font-size: 11px; padding: 2px 9px; border-radius: 999px; background: #f3f4f6; color: #4b5563; }
    .slot-flag.req { background: #fef3c7; color: #92400e; }
    .slot-flag.ok { background: #d1fae5; color: #065f46; }
    .pool { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
    .pool-item { background: #fff; border: 2px solid #e5e7eb; border-radius: 10px; padding: 8px 10px;
                 cursor: pointer; text-align: center; display: flex; flex-direction: column; align-items: stretch; }
    .pool-item:hover { border-color: #9ca3af; }
    .pool-item.selected { border-color: #ec4899; background: #fdf2f8; }
    .pool-item img { width: 100%; height: 110px; object-fit: cover; border-radius: 6px; margin-bottom: 6px; }
    .pool-item strong { font-size: 12px; color: #111827; line-height: 1.3; }
    .pool-price { font-size: 12px; color: #ec4899; font-weight: 600; margin-top: 2px; }
    .slot-qty { margin-top: 10px; font-size: 13px; color: #4b5563; }
    .slot-qty input { width: 60px; margin-left: 6px; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 5px; }
    .empty { color: #9ca3af; font-size: 12px; padding: 8px 0; }

    .summary { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 18px 20px; position: sticky; top: 20px; }
    .summary h3 { margin: 0 0 12px; font-size: 16px; color: #111827; }
    .summary ul { list-style: none; padding: 0; margin: 0 0 12px; }
    .summary li { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; color: #374151; border-bottom: 1px dashed #f3f4f6; }
    .summary li:last-child { border: none; }
    .summary-totals { padding-top: 10px; border-top: 1px solid #e5e7eb; }
    .summary-totals > div { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: #4b5563; }
    .summary-totals .discount { color: #ec4899; font-weight: 600; }
    .summary-totals .grand { padding-top: 8px; margin-top: 6px; border-top: 1px solid #e5e7eb; font-size: 15px; color: #111827; }
    .summary-totals .grand strong { color: #ec4899; font-size: 17px; }
    .hint { background: #eff6ff; color: #1e40af; padding: 10px 12px; border-radius: 8px; font-size: 12px; margin: 10px 0; line-height: 1.4; }
    .hint i { margin-right: 4px; }
    .btn-cta { width: 100%; padding: 12px; background: linear-gradient(135deg,#6366f1,#ec4899); color: #fff;
               border: none; border-radius: 10px; font-weight: 700; font-size: 14px; cursor: pointer; margin-top: 12px; }
    .btn-cta:disabled { opacity: .5; cursor: not-allowed; }
    .muted { color: #9ca3af; font-size: 13px; padding: 8px 0; }

    /* ── Variant selection modal ───────────────────────────── */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(17,24,39,0.65); display: flex;
                      justify-content: center; align-items: center; z-index: 1000; padding: 20px; }
    .modal { background: #fff; border-radius: 16px; max-width: 640px; width: 100%; max-height: 90vh;
             overflow-y: auto; padding: 24px; box-shadow: 0 30px 80px rgba(0,0,0,.35); }
    .modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .modal-head h2 { margin: 0; font-size: 18px; color: #111827; }
    .modal-head h2 i { color: #ec4899; margin-right: 6px; }
    .modal-close { background: transparent; border: none; font-size: 28px; line-height: 1; cursor: pointer; color: #6b7280; }
    .modal-sub { color: #6b7280; font-size: 13px; margin: 0 0 16px; }
    .picks { display: flex; flex-direction: column; gap: 12px; }
    .pick-row { display: grid; grid-template-columns: 80px 1fr; gap: 14px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 10px; }
    .pick-row.no-variants { background: #f9fafb; }
    .pick-row img { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; }
    .pick-body strong { display: block; font-size: 14px; color: #111827; }
    .pick-price { font-size: 12px; color: #ec4899; font-weight: 600; }
    .picker-row { display: flex; gap: 10px; margin-top: 8px; }
    .picker-row label { display: flex; flex-direction: column; gap: 3px; font-size: 11px; color: #6b7280; flex: 1; }
    .picker-row select { padding: 7px 9px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }
    .resolved { display: flex; gap: 6px; align-items: center; margin-top: 6px; }
    .resolved.warn { color: #92400e; }
    .resolved .small { font-size: 12px; color: #6b7280; }
    .badge { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 8px; }
    .badge.ok { background: #d1fae5; color: #065f46; }
    .badge.warn { background: #fef3c7; color: #92400e; }
    .no-var-msg { color: #6b7280; font-size: 12px; margin-top: 4px; }
    .err-banner { background: #fee2e2; color: #991b1b; padding: 10px 12px; border-radius: 8px;
                  margin-top: 12px; font-size: 13px; }
    .modal-foot { display: flex; gap: 8px; justify-content: flex-end; margin-top: 18px; padding-top: 14px;
                  border-top: 1px solid #f3f4f6; }
    .btn-ghost-mini { padding: 9px 16px; background: transparent; color: #4b5563; border: 1px solid #d1d5db;
                      border-radius: 8px; font-size: 13px; cursor: pointer; }
    .modal-foot .btn-cta { width: auto; flex: 1; max-width: 280px; margin-top: 0; }
  `]
})
export class ConfiguratorPageComponent implements OnInit, OnDestroy {
  slug: string | null = null;
  list: any[] = [];
  loadingList = false;
  data: ConfigFull | null = null;
  loading = false;

  // Selection state: slotId → productId; quantity per slot
  selectionMap: Record<number, number> = {};
  qtyMap: Record<number, number> = {};
  price: PriceResult | null = null;

  private routeSub: Subscription | null = null;
  private priceTimer: any = null;

  constructor(private route: ActivatedRoute, private router: Router, private http: HttpClient, private cart: CartService) {}

  ngOnInit() {
    this.routeSub = this.route.paramMap.subscribe((p) => {
      this.slug = p.get('slug');
      this.selectionMap = {};
      this.qtyMap = {};
      this.price = null;
      this.data = null;
      if (this.slug) this.loadOne(this.slug);
      else this.loadList();
    });
  }
  ngOnDestroy() { this.routeSub?.unsubscribe(); if (this.priceTimer) clearTimeout(this.priceTimer); }

  loadList() {
    this.loadingList = true;
    this.http.get<any>(`${environementDev.api}/api/storefront/configurator`).subscribe({
      next: r => { this.list = r?.items || []; this.loadingList = false; },
      error: () => { this.list = []; this.loadingList = false; }
    });
  }

  loadOne(slug: string) {
    this.loading = true;
    this.http.get<any>(`${environementDev.api}/api/storefront/configurator/${encodeURIComponent(slug)}`).subscribe({
      next: r => {
        this.data = (r && (r.configurator || r.slots)) ? r : (r?.data || null);
        if (!this.data?.configurator) this.data = null;
        this.loading = false;
      },
      error: () => { this.data = null; this.loading = false; }
    });
  }

  showBundleHint(): boolean {
    return !!(this.price?.missingSlots?.length && (this.data?.configurator?.bundle_discount_pct || 0) > 0);
  }

  pick(slot: ConfigSlot, p: PoolProduct) {
    if (this.selectionMap[slot.id] === p.productId) {
      // Toggle off: deselect for optional slots
      if (!slot.required) {
        delete this.selectionMap[slot.id];
        delete this.qtyMap[slot.id];
        this.recompute();
        return;
      }
    }
    this.selectionMap[slot.id] = p.productId;
    if (!this.qtyMap[slot.id]) this.qtyMap[slot.id] = 1;
    this.recompute();
  }

  selectedFor(slotId: number): number | null { return this.selectionMap[slotId] ?? null; }

  isSlotComplete(slot: ConfigSlot): boolean {
    return !!this.selectionMap[slot.id];
  }

  findTitle(productId: number): string {
    if (!this.data) return '';
    for (const s of this.data.slots) {
      const p = s.pool.find(x => x.productId === productId);
      if (p) return p.title;
    }
    return `Article #${productId}`;
  }

  recompute() {
    if (!this.data) return;
    if (this.priceTimer) clearTimeout(this.priceTimer);
    this.priceTimer = setTimeout(() => {
      const selection = Object.entries(this.selectionMap).map(([slotId, productId]) => ({
        slotId: Number(slotId), productId, quantity: Number(this.qtyMap[Number(slotId)] || 1),
      }));
      if (selection.length === 0) { this.price = null; return; }
      this.http.post<PriceResult>(
        `${environementDev.api}/api/storefront/configurator/${this.data!.configurator.id}/price`,
        { selection }
      ).subscribe({ next: (r) => this.price = r, error: () => this.price = null });
    }, 220);
  }

  // ─── Bundle checkout (variant-aware) ─────────────────────────────────
  // Click "Add bundle to cart" → fetch every selected product (with variants),
  // open a modal that asks the customer for size/colour per product, then push
  // each as a CartItem through CartService.addToCart so checkout sees them as
  // normal cart lines (with variant_info captured on the order item).

  picks: VariantPick[] = [];
  addingToCart = false;
  checkoutError = '';

  addAllToCart() {
    if (!this.price?.lineItems?.length || this.addingToCart) return;
    this.checkoutError = '';
    this.addingToCart = true;

    // Fetch every selected product in parallel to get variants + image
    const ids = this.price.lineItems.map((l) => l.productId);
    const requests = ids.map((id) =>
      this.http.get<any>(`${environementDev.api}/api/products/${id}`)
    );
    forkJoin(requests).subscribe({
      next: (results: any[]) => {
        this.addingToCart = false;
        this.picks = results.map((res, idx) => {
          // Some endpoints wrap in {data}, others return the product directly
          const product = res?.data || res;
          const variants = (product?.variants || []) as any[];
          const colours = Array.from(new Set(variants.map((v) => v.couleur).filter(Boolean))) as string[];
          const sizes = Array.from(new Set(variants.map((v) => v.taille).filter(Boolean))) as string[];
          const li = this.price!.lineItems[idx];
          const image = product?.firstImageUrl || product?.images?.[0]?.imageUrl || null;
          const noVariants = variants.length === 0;
          // If product has exactly one variant, auto-resolve it.
          const auto = variants.length === 1 ? variants[0] : null;
          return {
            productId: product.id,
            productTitle: product.title,
            productImage: image,
            unitPrice: li.unitPrice,
            quantity: li.quantity,
            variants,
            colours,
            sizes,
            selectedColour: auto?.couleur ?? null,
            selectedSize: auto?.taille ?? null,
            resolvedVariant: auto,
            noVariants,
          } as VariantPick;
        });
      },
      error: () => {
        this.addingToCart = false;
        this.checkoutError = 'Impossible de charger les variantes des produits';
      }
    });
  }

  closePicks() { this.picks = []; this.checkoutError = ''; }

  // Re-resolve the variant for one product when a colour/size dropdown changes.
  resolvePick(pk: VariantPick) {
    if (pk.noVariants) { pk.resolvedVariant = null; return; }
    const match = pk.variants.find((v) =>
      (pk.colours.length === 0 || v.couleur === pk.selectedColour) &&
      (pk.sizes.length === 0 || v.taille === pk.selectedSize)
    );
    pk.resolvedVariant = match || null;
  }

  // Disable size options that are out of stock for the chosen colour
  // (typical e-commerce behaviour — gives the customer immediate feedback).
  isSizeAvailable(pk: VariantPick, size: string): boolean {
    const candidates = pk.variants.filter((v) =>
      v.taille === size && (pk.colours.length === 0 || v.couleur === pk.selectedColour || !pk.selectedColour)
    );
    if (candidates.length === 0) return false;
    return candidates.some((v) => Number(v.stock || 0) > 0);
  }

  allPicksReady(): boolean {
    if (this.picks.length === 0) return false;
    return this.picks.every((pk) => pk.noVariants || !!pk.resolvedVariant);
  }

  // Push each pick to the cart via CartService.addToCart. Sequential so we can
  // surface stock errors per product. After all succeed, navigate to /panier.
  confirmAddBundle() {
    if (!this.allPicksReady()) return;
    this.addingToCart = true;
    this.checkoutError = '';
    const queue = [...this.picks];
    const next = () => {
      if (queue.length === 0) {
        this.addingToCart = false;
        this.picks = [];
        this.router.navigate(['/panier']);
        return;
      }
      const pk = queue.shift()!;
      const v = pk.resolvedVariant;
      const cartItem: any = {
        product: { id: pk.productId, title: pk.productTitle, currentPrice: pk.unitPrice + Number(v?.priceAdjust || 0), firstImageUrl: pk.productImage, sku: v?.sku || null } as any,
        image: pk.productImage || '',
        quantity: pk.quantity,
        selectedColor: v?.couleur || '',
        selectedSize: v?.taille || '',
        ean13: v?.ean13 || '',
      };
      // Skip stock check for variant-less products — cart will use product.totalStock
      try {
        const result = this.cart.addToCart(cartItem);
        // CartService returns Observable<{success, message?}>
        result.subscribe({
          next: (r: any) => {
            if (r?.success === false) {
              this.addingToCart = false;
              this.checkoutError = `${pk.productTitle} : ${r?.message || 'ajout impossible'}`;
              return;
            }
            next();
          },
          error: () => {
            this.addingToCart = false;
            this.checkoutError = `${pk.productTitle} : erreur réseau`;
          }
        });
      } catch (e: any) {
        this.addingToCart = false;
        this.checkoutError = `${pk.productTitle} : ${e?.message || 'erreur'}`;
      }
    };
    next();
  }
}
