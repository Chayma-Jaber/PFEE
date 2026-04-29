import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';

type SlotKey = 'TOP' | 'BOTTOM' | 'SHOES' | 'ACCESSORY';

interface Slot {
  key: SlotKey;
  label: string;
  icon: string;
  selected?: CatalogProduct | null;
}

interface CatalogProduct {
  id: number;
  title: string;
  slug?: string;
  currentPrice: number;
  firstImageUrl: string;
  famille?: string;
  ligne?: string;
  persona?: string;
  categories?: Array<{ id?: number; name?: string; slug?: string }>;
  searchText: string;
}

@Component({
  selector: 'app-studio-look',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="studio">
      <div class="studio-head">
        <h1>Studio Look</h1>
        <p>Composez une tenue cohérente avec un aperçu fidèle des produits, sans collage trompeur sur mannequin.</p>
      </div>

      <div class="gender-switch">
        <button [class.active]="gender === 'F'" (click)="setGender('F')">Femme</button>
        <button [class.active]="gender === 'M'" (click)="setGender('M')">Homme</button>
      </div>

      <div class="studio-layout">
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

          <div class="summary" *ngIf="totalPrice > 0">
            <div class="total-row"><span>Total de la tenue :</span><strong>{{ totalPrice | number:'1.2-2' }} TND</strong></div>
            <button class="btn-compose" (click)="addAllToCart()" [disabled]="totalItems === 0">
              <i class="fas fa-shopping-bag"></i> Tout ajouter au panier ({{ totalItems }})
            </button>
            <button class="btn-ai" (click)="askAiCompletion()">
              <i class="fas fa-sparkles"></i> Compléter avec l'IA
            </button>
          </div>
        </aside>

        <div class="preview-stage">
          <div class="preview-shell">
            <div class="preview-hero">
              <div class="preview-copy">
                <span class="eyebrow">Aperçu du look</span>
                <h2>{{ gender === 'F' ? 'Sélection femme' : 'Sélection homme' }}</h2>
                <p>Les photos sont affichées séparément pour garder un rendu réel et éviter les superpositions fausses.</p>
              </div>
            </div>

            <div class="preview-grid">
              <div class="preview-card" *ngFor="let s of slots" [class.empty]="!s.selected">
                <div class="preview-card-head">
                  <span>{{ s.icon }}</span>
                  <strong>{{ s.label }}</strong>
                </div>

                <ng-container *ngIf="s.selected; else emptySlot">
                  <div class="preview-image-wrap">
                    <img [src]="s.selected.firstImageUrl || placeholderImage" [alt]="s.selected.title" />
                  </div>
                  <div class="preview-meta">
                    <div class="preview-title">{{ s.selected.title }}</div>
                    <div class="preview-price">{{ s.selected.currentPrice | number:'1.2-2' }} TND</div>
                  </div>
                </ng-container>

                <ng-template #emptySlot>
                  <div class="preview-empty">
                    <span class="preview-empty-icon">{{ s.icon }}</span>
                    <p>Choisissez un article {{ articleHint(s) }}.</p>
                  </div>
                </ng-template>
              </div>
            </div>
          </div>

          <div class="mannequin-caption" *ngIf="totalItems === 0">
            <p>Sélectionnez un haut, un bas, des chaussures et un accessoire pour composer votre look.</p>
          </div>

          <div class="ai-note" *ngIf="aiSuggestions.length > 0">
            <i class="fas fa-sparkles"></i> Suggestions IA pour compléter :
            <div class="suggestions">
              <div class="sug" *ngFor="let p of aiSuggestions">
                <img [src]="p.firstImageUrl || placeholderImage" [alt]="p.title" />
                <div>
                  <strong>{{ p.title }}</strong>
                  <span>{{ p.currentPrice | number:'1.2-2' }} TND</span>
                  <button (click)="addSuggestion(p)">Ajouter</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside class="picker" *ngIf="pickerOpen">
          <div class="picker-head">
            <strong>Choisir un article — {{ pickerFor?.label }}</strong>
            <button class="x" (click)="pickerOpen = false">×</button>
          </div>

          <input
            type="text"
            [(ngModel)]="search"
            placeholder="Rechercher..."
            (ngModelChange)="applyCatalogFilter()"
          />

          <div class="picker-subtitle" *ngIf="pickerFor">
            Produits filtrés pour la catégorie {{ pickerFor.label.toLowerCase() }}.
          </div>

          <div class="catalog-list">
            <div class="catalog-item" *ngFor="let p of catalog" (click)="pick(p)">
              <img [src]="p.firstImageUrl || placeholderImage" [alt]="p.title" />
              <div>
                <div class="t">{{ p.title }}</div>
                <div class="p">{{ p.currentPrice | number:'1.2-2' }} TND</div>
              </div>
            </div>
            <div class="empty" *ngIf="catalog.length === 0">Aucun produit compatible trouvé.</div>
          </div>
        </aside>
      </div>

      <p class="notice-ok" *ngIf="okMsg">{{ okMsg }}</p>
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
  allProducts: CatalogProduct[] = [];
  catalog: CatalogProduct[] = [];
  aiSuggestions: CatalogProduct[] = [];
  pickerOpen = false;
  pickerFor: Slot | null = null;
  search = '';
  okMsg = '';
  placeholderImage = 'assets/images/placeholder.png';

  private readonly slotKeywords: Record<SlotKey, string[]> = {
    TOP: ['t shirt', 'tshirt', 'top', 'pull', 'chemise', 'chemisier', 'blouse', 'cardigan', 'veste', 'blazer', 'gilet', 'sweat', 'hoodie', 'body', 'haut', 'polo', 'shirt', 'jacket', 'blouson', 'tunique'],
    BOTTOM: ['jean', 'pantalon', 'pant', 'short', 'jupe', 'legging', 'cargo', 'bas', 'trouser', 'jogger'],
    SHOES: ['chaussure', 'chaussures', 'sandale', 'sandales', 'escarpin', 'escarpins', 'basket', 'baskets', 'mocassin', 'mocassins', 'sneaker', 'sneakers', 'botte', 'bottes', 'boots', 'slipper', 'slippers'],
    ACCESSORY: ['accessoire', 'accessoires', 'sac', 'pochette', 'ceinture', 'casquette', 'chapeau', 'bonnet', 'foulard', 'echarpe', 'collier', 'bracelet', 'boucle', 'lunette', 'lunettes', 'bijou', 'watch', 'montre', 'bag']
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadCatalog();
  }

  setGender(g: 'M' | 'F') {
    this.gender = g;
    this.search = '';
    this.loadCatalog();
  }

  slotByKey(k: SlotKey): Slot {
    return this.slots.find((s) => s.key === k)!;
  }

  articleHint(slot: Slot): string {
    switch (slot.key) {
      case 'TOP':
        return 'du haut';
      case 'BOTTOM':
        return 'du bas';
      case 'SHOES':
        return 'de chaussures';
      case 'ACCESSORY':
        return "d'accessoire";
    }
  }

  get totalItems(): number {
    return this.slots.filter((s) => s.selected).length;
  }

  get totalPrice(): number {
    return this.slots.reduce((sum, s) => sum + (s.selected ? Number(s.selected.currentPrice) : 0), 0);
  }

  openPicker(slot: Slot) {
    this.pickerFor = slot;
    this.pickerOpen = true;
    this.applyCatalogFilter();
  }

  clear(slot: Slot) {
    slot.selected = null;
  }

  loadCatalog() {
    const famille = this.gender === 'F' ? 'WOMEN' : 'MEN';
    const primaryUrl = `${environementDev.api}/api/products?limit=80&famille=${famille}&isActive=true`;
    const unisexUrl = `${environementDev.api}/api/products?limit=40&famille=UNISEX&isActive=true`;

    this.http.get<{ items: any[] }>(primaryUrl).subscribe({
      next: (primaryResponse) => {
        const primaryItems = (primaryResponse?.items || []).map((item) => this.normalize(item));
        this.http.get<{ items: any[] }>(unisexUrl).subscribe({
          next: (unisexResponse) => {
            const extraItems = (unisexResponse?.items || []).map((item) => this.normalize(item));
            const seen = new Set<number>();
            this.allProducts = [...primaryItems, ...extraItems].filter((item) => {
              if (!item.firstImageUrl || seen.has(item.id)) {
                return false;
              }
              seen.add(item.id);
              return true;
            });
            this.applyCatalogFilter();
          },
          error: () => {
            this.allProducts = primaryItems.filter((item) => !!item.firstImageUrl);
            this.applyCatalogFilter();
          }
        });
      },
      error: () => {
        this.allProducts = [];
        this.catalog = [];
      }
    });
  }

  applyCatalogFilter() {
    const normalizedSearch = this.normalizeText(this.search);
    const slot = this.pickerFor;
    let items = this.allProducts;

    if (slot) {
      items = items.filter((product) => this.matchesSlot(product, slot.key));
    }

    if (normalizedSearch) {
      items = items.filter((product) => product.searchText.includes(normalizedSearch));
    }

    this.catalog = items.slice(0, 40);
  }

  private normalize(raw: any): CatalogProduct {
    const title = String(raw?.title || '').trim();
    const ligne = String(raw?.ligne || raw?.Ligne || '').trim();
    const persona = String(raw?.persona || raw?.Persona || '').trim();
    const categories = Array.isArray(raw?.categories) ? raw.categories : [];
    const searchText = this.normalizeText([
      title,
      ligne,
      persona,
      raw?.famille,
      ...categories.flatMap((category: any) => [category?.name, category?.slug])
    ].filter(Boolean).join(' '));

    return {
      id: Number(raw?.id),
      title,
      slug: raw?.slug,
      currentPrice: Number(raw?.currentPrice || raw?.price || 0),
      firstImageUrl: raw?.firstImageUrl || '',
      famille: raw?.famille,
      ligne,
      persona,
      categories,
      searchText,
    };
  }

  private normalizeText(value: string): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private matchesSlot(product: CatalogProduct, slotKey: SlotKey): boolean {
    const text = product.searchText;
    const wantedKeywords = this.slotKeywords[slotKey];
    const directMatch = wantedKeywords.some((keyword) => text.includes(keyword));

    if (slotKey === 'TOP') {
      const isBottom = this.slotKeywords.BOTTOM.some((keyword) => text.includes(keyword));
      const isShoes = this.slotKeywords.SHOES.some((keyword) => text.includes(keyword));
      const isAccessory = this.slotKeywords.ACCESSORY.some((keyword) => text.includes(keyword));
      return directMatch && !isBottom && !isShoes && !isAccessory;
    }

    return directMatch;
  }

  private guessSlot(product: CatalogProduct): SlotKey | null {
    const orderedKeys: SlotKey[] = ['TOP', 'BOTTOM', 'SHOES', 'ACCESSORY'];
    return orderedKeys.find((key) => this.matchesSlot(product, key)) || null;
  }

  pick(product: CatalogProduct) {
    if (!this.pickerFor) {
      return;
    }

    this.pickerFor.selected = product;
    this.pickerOpen = false;
    this.pickerFor = null;
    this.search = '';
    this.catalog = [];
  }

  askAiCompletion() {
    const anchor = this.slots.find((s) => s.selected);
    if (!anchor?.selected) {
      this.okMsg = 'Choisissez au moins un article pour déclencher l’IA.';
      return;
    }

    const token = localStorage.getItem('jwt') || '';
    const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
    this.http.get<any>(`${environementDev.api}/api/storefront/w3/complete-outfit/${anchor.selected.id}`, { headers }).subscribe({
      next: (response) => {
        this.aiSuggestions = (response?.outfit || [])
          .map((item: any) => this.normalize(item))
          .filter((item: CatalogProduct) => !!item.firstImageUrl)
          .slice(0, 4);
        this.okMsg = response?.reason || 'Suggestions IA générées.';
      },
      error: () => {
        this.okMsg = 'IA indisponible.';
      }
    });
  }

  addSuggestion(product: CatalogProduct) {
    const guessedSlot = this.guessSlot(product);
    const target = guessedSlot
      ? this.slots.find((slot) => slot.key === guessedSlot && !slot.selected)
      : null;

    const emptyFallback = this.slots.find((slot) => !slot.selected);
    const destination = target || emptyFallback;

    if (destination) {
      destination.selected = product;
      this.aiSuggestions = this.aiSuggestions.filter((item) => item.id !== product.id);
    }
  }

  addAllToCart() {
    const items = this.slots.filter((s) => s.selected).map((s) => s.selected);

    try {
      const existing = JSON.parse(localStorage.getItem('cart') || '[]');
      items.forEach((product) => existing.push({ product, quantity: 1 }));
      localStorage.setItem('cart', JSON.stringify(existing));
      this.okMsg = `${items.length} article(s) ajouté(s) au panier.`;
    } catch {
      this.okMsg = 'Erreur lors de l’ajout au panier.';
    }
  }
}
