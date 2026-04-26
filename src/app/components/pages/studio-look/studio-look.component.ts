import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';

interface Slot {
  key: 'TOP' | 'BOTTOM' | 'SHOES' | 'ACCESSORY';
  label: string;
  icon: string;
  selected?: any;
}
interface CatalogProduct {
  id: number; title: string; slug?: string; currentPrice: number; firstImageUrl: string; famille?: string;
}

/**
 * Studio Look — premium outfit composer.
 * Customer picks items by slot (Top / Bas / Chaussures / Accessoire) and sees
 * them composed on a male/female mannequin silhouette.
 * Connects to existing cart + complete-outfit AI endpoint.
 */
@Component({
  selector: 'app-studio-look',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="studio">
      <div class="studio-head">
        <h1>✨ Studio Look — Essayage Stylé</h1>
        <p>Composez votre tenue complète. Sélectionnez un article par catégorie et visualisez le résultat sur un mannequin.</p>
      </div>

      <div class="gender-switch">
        <button [class.active]="gender === 'F'" (click)="setGender('F')">👗 Femme</button>
        <button [class.active]="gender === 'M'" (click)="setGender('M')">👔 Homme</button>
      </div>

      <div class="studio-layout">
        <!-- Left: slots -->
        <aside class="slots">
          <div class="slot" *ngFor="let s of slots" [class.filled]="!!s.selected">
            <div class="slot-head">
              <span class="icon">{{ s.icon }}</span>
              <div>
                <strong>{{ s.label }}</strong>
                <span class="muted" *ngIf="!s.selected">Non choisi</span>
                <span class="muted price" *ngIf="s.selected">{{ s.selected.currentPrice | number:'1.2-2' }} TND</span>
              </div>
              <button class="clear" *ngIf="s.selected" (click)="clear(s)" title="Retirer">×</button>
            </div>
            <div class="slot-picker">
              <button class="pick" (click)="openPicker(s)">
                <i class="fas fa-plus"></i> {{ s.selected ? 'Changer' : 'Choisir' }}
              </button>
            </div>
          </div>

          <!-- Summary -->
          <div class="summary" *ngIf="totalPrice > 0">
            <div class="total-row"><span>Total de la tenue:</span><strong>{{ totalPrice | number:'1.2-2' }} TND</strong></div>
            <button class="btn-compose" (click)="addAllToCart()" [disabled]="totalItems === 0">
              <i class="fas fa-shopping-bag"></i> Tout ajouter au panier ({{ totalItems }})
            </button>
            <button class="btn-ai" (click)="askAiCompletion()">
              <i class="fas fa-sparkles"></i> Compléter avec l'IA
            </button>
          </div>
        </aside>

        <!-- Center: mannequin -->
        <div class="mannequin-stage">
          <div class="mannequin" [class.m]="gender === 'M'" [class.f]="gender === 'F'">
            <!-- Silhouette background (CSS-based) -->
            <div class="silhouette"></div>
            <!-- Layered product images -->
            <div class="layer layer-top" *ngIf="slotByKey('TOP').selected">
              <img [src]="slotByKey('TOP').selected.firstImageUrl" [alt]="slotByKey('TOP').selected.title" />
            </div>
            <div class="layer layer-bottom" *ngIf="slotByKey('BOTTOM').selected">
              <img [src]="slotByKey('BOTTOM').selected.firstImageUrl" [alt]="slotByKey('BOTTOM').selected.title" />
            </div>
            <div class="layer layer-shoes" *ngIf="slotByKey('SHOES').selected">
              <img [src]="slotByKey('SHOES').selected.firstImageUrl" [alt]="slotByKey('SHOES').selected.title" />
            </div>
            <div class="layer layer-acc" *ngIf="slotByKey('ACCESSORY').selected">
              <img [src]="slotByKey('ACCESSORY').selected.firstImageUrl" [alt]="slotByKey('ACCESSORY').selected.title" />
            </div>
          </div>
          <div class="mannequin-caption" *ngIf="totalItems === 0">
            <i class="fas fa-tshirt"></i>
            <p>Sélectionnez un haut, un bas, des chaussures et un accessoire pour composer votre look.</p>
          </div>
          <div class="ai-note" *ngIf="aiSuggestions.length > 0">
            <i class="fas fa-sparkles"></i> Suggestions IA pour compléter:
            <div class="suggestions">
              <div class="sug" *ngFor="let p of aiSuggestions">
                <img [src]="p.firstImageUrl" [alt]="p.title" />
                <div>
                  <strong>{{ p.title }}</strong>
                  <span>{{ p.currentPrice | number:'1.2-2' }} TND</span>
                  <button (click)="addSuggestion(p)">Ajouter</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: picker panel (opens when a slot is being filled) -->
        <aside class="picker" *ngIf="pickerOpen">
          <div class="picker-head">
            <strong>Choisir un article — {{ pickerFor?.label }}</strong>
            <button class="x" (click)="pickerOpen = false">×</button>
          </div>
          <input type="text" [(ngModel)]="search" placeholder="Rechercher..." (keyup.enter)="loadCatalog()" />
          <div class="catalog-list">
            <div class="catalog-item" *ngFor="let p of catalog" (click)="pick(p)">
              <img [src]="p.firstImageUrl" [alt]="p.title" />
              <div>
                <div class="t">{{ p.title }}</div>
                <div class="p">{{ p.currentPrice | number:'1.2-2' }} TND</div>
              </div>
            </div>
            <div class="empty" *ngIf="catalog.length === 0">Aucun produit trouvé.</div>
          </div>
        </aside>
      </div>

      <p class="notice-ok" *ngIf="okMsg">✓ {{ okMsg }}</p>
    </div>
  `,
  styleUrls: ['./studio-look.component.scss']
})
export class StudioLookComponent implements OnInit {
  gender: 'M' | 'F' = 'F';
  slots: Slot[] = [
    { key: 'TOP', label: 'Haut', icon: '👕' },
    { key: 'BOTTOM', label: 'Bas', icon: '👖' },
    { key: 'SHOES', label: 'Chaussures', icon: '👟' },
    { key: 'ACCESSORY', label: 'Accessoire', icon: '👜' },
  ];
  catalog: CatalogProduct[] = [];
  aiSuggestions: CatalogProduct[] = [];
  pickerOpen = false;
  pickerFor: Slot | null = null;
  search = '';
  okMsg = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void { this.loadCatalog(); }

  setGender(g: 'M' | 'F') { this.gender = g; this.loadCatalog(); }

  slotByKey(k: string): Slot {
    return this.slots.find(s => s.key === k)!;
  }

  get totalItems(): number { return this.slots.filter(s => s.selected).length; }
  get totalPrice(): number {
    return this.slots.reduce((sum, s) => sum + (s.selected ? Number(s.selected.currentPrice) : 0), 0);
  }

  openPicker(s: Slot) { this.pickerFor = s; this.pickerOpen = true; this.loadCatalog(); }

  clear(s: Slot) { s.selected = null; }

  loadCatalog() {
    const famille = this.gender === 'F' ? 'WOMEN' : 'MEN';
    const primary = `${environementDev.api}/api/products?limit=18&famille=${famille}`;
    this.http.get<{ items: any[] }>(primary).subscribe({
      next: (r) => {
        const primary = (r?.items || []).map(p => this.normalize(p));
        // Include UNISEX too so the composer always has enough variety
        this.http.get<{ items: any[] }>(`${environementDev.api}/api/products?limit=18&famille=UNISEX`).subscribe({
          next: (r2) => {
            const extra = (r2?.items || []).map(p => this.normalize(p));
            const seen = new Set<number>();
            this.catalog = [...primary, ...extra].filter(p => !seen.has(p.id) && (seen.add(p.id), true));
          },
          error: () => { this.catalog = primary; }
        });
      },
      error: () => this.catalog = []
    });
  }

  private normalize(p: any): CatalogProduct {
    return {
      id: p.id, title: p.title, slug: p.slug,
      currentPrice: Number(p.currentPrice || p.price || 0),
      firstImageUrl: p.firstImageUrl || '',
      famille: p.famille,
    };
  }

  pick(p: CatalogProduct) {
    if (!this.pickerFor) return;
    this.pickerFor.selected = p;
    this.pickerOpen = false;
    this.pickerFor = null;
  }

  askAiCompletion() {
    // Use the first filled slot's product as anchor for complete-outfit AI
    const anchor = this.slots.find(s => s.selected);
    if (!anchor) { this.okMsg = 'Choisissez au moins un article pour déclencher l\'IA.'; return; }
    const token = localStorage.getItem('jwt') || '';
    const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
    this.http.get<any>(
      `${environementDev.api}/api/storefront/w3/complete-outfit/${anchor.selected.id}`,
      { headers }
    ).subscribe({
      next: (r) => {
        this.aiSuggestions = (r.outfit || []).slice(0, 4).map((p: any) => this.normalize(p));
        this.okMsg = r.reason || 'Suggestions IA générées';
      },
      error: () => this.okMsg = 'IA indisponible'
    });
  }

  addSuggestion(p: CatalogProduct) {
    // Fill the first empty slot
    const empty = this.slots.find(s => !s.selected);
    if (empty) empty.selected = p;
    this.aiSuggestions = this.aiSuggestions.filter(s => s.id !== p.id);
  }

  addAllToCart() {
    // Store items in localStorage cart (cart service listens)
    const items = this.slots.filter(s => s.selected).map(s => s.selected);
    try {
      const existing = JSON.parse(localStorage.getItem('cart') || '[]');
      items.forEach(p => existing.push({ product: p, quantity: 1 }));
      localStorage.setItem('cart', JSON.stringify(existing));
      this.okMsg = `✓ ${items.length} article(s) ajoutés au panier`;
    } catch {
      this.okMsg = 'Erreur ajout panier';
    }
  }
}
