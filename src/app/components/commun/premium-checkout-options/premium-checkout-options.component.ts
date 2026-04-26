import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';

export interface PremiumOptions {
  giftWrap: boolean;
  giftMessage: string;
  deliverySlotId: number | null;
  pickupLocationId: number | null;
  deliveryMode: 'HOME' | 'PICKUP';
}

@Component({
  selector: 'app-premium-checkout-options',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pco">
      <h3>✨ Options Premium</h3>

      <!-- Delivery mode switch -->
      <div class="mode-switch">
        <button [class.active]="opts.deliveryMode === 'HOME'" (click)="setMode('HOME')">
          <i class="fas fa-home"></i> Livraison à domicile
        </button>
        <button [class.active]="opts.deliveryMode === 'PICKUP'" (click)="setMode('PICKUP')">
          <i class="fas fa-store"></i> Retrait en boutique
        </button>
      </div>

      <!-- HOME: delivery slot -->
      <div class="section" *ngIf="opts.deliveryMode === 'HOME' && slots.length > 0">
        <label><i class="far fa-clock"></i> Créneau de livraison souhaité</label>
        <div class="slot-grid">
          <button *ngFor="let s of slots" class="slot-chip" [class.active]="opts.deliverySlotId === s.id" (click)="pickSlot(s)">
            <strong>{{ slotLabel(s.label) }}</strong>
            <span>{{ s.start_time }} - {{ s.end_time }}</span>
          </button>
        </div>
      </div>

      <!-- PICKUP: store selection -->
      <div class="section" *ngIf="opts.deliveryMode === 'PICKUP'">
        <label><i class="fas fa-map-marker-alt"></i> Point de retrait</label>
        <div class="pickup-list" *ngIf="pickups.length > 0">
          <label *ngFor="let p of pickups" class="pickup-card" [class.selected]="opts.pickupLocationId === p.id">
            <input type="radio" name="pickup" [value]="p.id" (change)="pickPickup(p)" />
            <div>
              <strong>{{ p.name }}</strong>
              <p>{{ p.address }}, {{ p.city }}</p>
              <small *ngIf="p.hours"><i class="far fa-clock"></i> {{ p.hours }}</small>
              <small *ngIf="p.phone"><i class="fas fa-phone"></i> {{ p.phone }}</small>
            </div>
          </label>
        </div>
        <p *ngIf="pickups.length === 0" class="muted">Aucun point de retrait disponible dans votre zone.</p>
      </div>

      <!-- Gift wrap -->
      <div class="section">
        <label class="gift-toggle">
          <input type="checkbox" [(ngModel)]="opts.giftWrap" (change)="emit()" />
          <span class="gift-label">🎁 Emballage cadeau premium (gratuit)</span>
        </label>
        <textarea
          *ngIf="opts.giftWrap"
          [(ngModel)]="opts.giftMessage"
          (input)="emit()"
          placeholder="Message personnalisé sur la carte cadeau (optionnel, 240 caractères max)"
          maxlength="240"
          rows="3"></textarea>
        <small *ngIf="opts.giftWrap" class="muted">{{ opts.giftMessage.length }}/240 caractères</small>
      </div>
    </div>
  `,
  styles: [`
    .pco { background: linear-gradient(135deg, #fdf2f8 0%, #eef2ff 100%); border-radius: 16px; padding: 20px; margin: 20px 0; border: 1px solid rgba(236,72,153,.15); }
    .pco h3 { margin: 0 0 14px; font-size: 17px; color: #111827; }
    .mode-switch { display: flex; gap: 8px; background: #fff; padding: 4px; border-radius: 12px; margin-bottom: 16px; }
    .mode-switch button { flex: 1; padding: 10px; background: transparent; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; color: #6b7280; }
    .mode-switch button.active { background: linear-gradient(135deg, #6366f1, #ec4899); color: #fff; }
    .mode-switch button i { margin-right: 6px; }
    .section { margin-bottom: 14px; }
    .section > label { display: block; font-weight: 600; font-size: 13px; color: #374151; margin-bottom: 8px; }
    .section > label i { color: #6366f1; margin-right: 5px; }
    .slot-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
    .slot-chip { background: #fff; border: 2px solid #e5e7eb; border-radius: 10px; padding: 10px; cursor: pointer; transition: all .15s; text-align: center; }
    .slot-chip strong { display: block; font-size: 13px; color: #111827; }
    .slot-chip span { font-size: 11px; color: #6b7280; }
    .slot-chip.active { border-color: #6366f1; background: #eef2ff; }
    .pickup-list { display: flex; flex-direction: column; gap: 8px; }
    .pickup-card { display: flex; gap: 10px; padding: 12px; background: #fff; border: 2px solid #e5e7eb; border-radius: 10px; cursor: pointer; transition: all .15s; }
    .pickup-card:hover { border-color: #9ca3af; }
    .pickup-card.selected { border-color: #6366f1; background: #eef2ff; }
    .pickup-card strong { display: block; font-size: 14px; color: #111827; }
    .pickup-card p { margin: 2px 0; font-size: 12px; color: #6b7280; }
    .pickup-card small { font-size: 11px; color: #9ca3af; display: inline-block; margin-right: 10px; }
    .pickup-card input[type=radio] { margin-top: 4px; }
    .gift-toggle { display: flex; align-items: center; gap: 10px; cursor: pointer; background: #fff; padding: 10px 14px; border-radius: 10px; border: 1px solid #e5e7eb; }
    .gift-toggle input { width: 18px; height: 18px; }
    .gift-label { font-weight: 600; color: #111827; }
    textarea { width: 100%; margin-top: 8px; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; resize: vertical; }
    .muted { color: #9ca3af; font-size: 12px; }
  `]
})
export class PremiumCheckoutOptionsComponent implements OnInit, OnChanges {
  @Input() city: string = 'Tunis';
  @Output() changed = new EventEmitter<PremiumOptions>();

  slots: any[] = [];
  pickups: any[] = [];

  opts: PremiumOptions = {
    giftWrap: false,
    giftMessage: '',
    deliverySlotId: null,
    pickupLocationId: null,
    deliveryMode: 'HOME',
  };

  constructor(private http: HttpClient) {}

  ngOnInit() { this.loadSlots(); this.loadPickups(); }
  ngOnChanges(ch: SimpleChanges) { if (ch['city']) { this.loadSlots(); this.loadPickups(); } }

  private loadSlots() {
    this.http.get<any>(`${environementDev.api}/api/storefront/w4/delivery-slots?city=${encodeURIComponent(this.city || '')}`)
      .subscribe({ next: (r) => this.slots = r.items || [], error: () => this.slots = [] });
  }

  private loadPickups() {
    this.http.get<any>(`${environementDev.api}/api/storefront/w4/pickup-locations?city=${encodeURIComponent(this.city || '')}`)
      .subscribe({ next: (r) => this.pickups = r.items || [], error: () => this.pickups = [] });
  }

  setMode(m: 'HOME' | 'PICKUP') {
    this.opts.deliveryMode = m;
    if (m === 'HOME') this.opts.pickupLocationId = null;
    else this.opts.deliverySlotId = null;
    this.emit();
  }

  pickSlot(s: any) { this.opts.deliverySlotId = s.id; this.emit(); }
  pickPickup(p: any) { this.opts.pickupLocationId = p.id; this.emit(); }

  slotLabel(label: string): string {
    return { MORNING: '🌅 Matin', AFTERNOON: '☀️ Après-midi', EVENING: '🌙 Soir' }[label] || label;
  }

  emit() { this.changed.emit({ ...this.opts }); }
}
