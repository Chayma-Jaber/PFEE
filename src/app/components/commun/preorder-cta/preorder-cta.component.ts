import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';

interface Drop {
  id: number;
  product_id: number;
  status: string;
  capacity: number;
  reserved_count: number;
  deposit_pct: number;
  preorder_end: string;
  expected_ship_date: string | null;
  headline: string | null;
  allow_waitlist: boolean;
}

@Component({
  selector: 'app-preorder-cta',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="drop" class="preorder" [class.waitlist]="drop.status === 'WAITLIST' || drop.status === 'SOLD_OUT'">
      <div class="badge-row">
        <span class="ribbon"><i class="fas fa-rocket"></i> {{ drop.status === 'LIVE' ? 'En stock' : 'Pré-commande' }}</span>
        <span class="capacity">{{ drop.reserved_count }}/{{ drop.capacity }} réservés</span>
      </div>
      <h3>{{ drop.headline || 'Drop limité' }}</h3>
      <div class="meta">
        <div *ngIf="drop.expected_ship_date"><i class="fas fa-truck"></i> Expédition prévue : {{ formatDate(drop.expected_ship_date) }}</div>
        <div><i class="far fa-calendar-times"></i> Pré-commande jusqu'au {{ formatDate(drop.preorder_end) }}</div>
        <div *ngIf="drop.deposit_pct > 0"><i class="fas fa-percentage"></i> Acompte de {{ drop.deposit_pct }}% à la réservation, le reste à l'expédition</div>
      </div>

      <div *ngIf="reservation" class="confirm">
        <i class="fas fa-check-circle"></i>
        <span *ngIf="reservation.status === 'PENDING' || reservation.status === 'DEPOSITED'">
          Réservation confirmée — nous vous contactons pour le paiement de l'acompte.
        </span>
        <span *ngIf="reservation.status === 'WAITLIST'">
          Vous êtes en liste d'attente — position #{{ reservation.waitlist_position }}.
        </span>
      </div>

      <div *ngIf="!reservation">
        <button *ngIf="drop.status === 'PREORDER_OPEN'" class="btn-cta" (click)="reserve()" [disabled]="loading">
          <i class="fas fa-bookmark"></i> {{ loading ? 'Réservation…' : 'Réserver maintenant' }}
        </button>
        <button *ngIf="drop.status === 'WAITLIST' || drop.status === 'SOLD_OUT'" class="btn-cta waitlist" (click)="reserve()" [disabled]="loading || !drop.allow_waitlist">
          <i class="fas fa-list-ol"></i> {{ loading ? '…' : 'Rejoindre la liste d\\'attente' }}
        </button>
      </div>

      <div *ngIf="error" class="err-msg">{{ error }}</div>
    </div>
  `,
  styles: [`
    .preorder { background: linear-gradient(135deg, #fef3c7, #fde68a); border: 1px solid #fbbf24; border-radius: 14px; padding: 18px 20px; margin: 14px 0; }
    .preorder.waitlist { background: linear-gradient(135deg, #fce7f3, #fbcfe8); border-color: #ec4899; }
    .badge-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .ribbon { background: #ef4444; color: #fff; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: .5px; }
    .ribbon i { margin-right: 4px; }
    .capacity { font-size: 12px; font-weight: 700; color: #92400e; }
    h3 { margin: 0 0 8px; color: #111827; font-size: 17px; }
    .meta { font-size: 13px; color: #4b5563; line-height: 1.7; margin-bottom: 12px; }
    .meta i { width: 16px; color: #b45309; margin-right: 4px; }
    .btn-cta { width: 100%; padding: 12px; background: linear-gradient(135deg, #ef4444, #ec4899); color: #fff; border: none; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; }
    .btn-cta:hover { transform: translateY(-1px); }
    .btn-cta.waitlist { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
    .btn-cta:disabled { opacity: .5; cursor: not-allowed; transform: none; }
    .confirm { background: #d1fae5; color: #065f46; padding: 10px 14px; border-radius: 8px; font-size: 13px; }
    .confirm i { margin-right: 6px; }
    .err-msg { color: #dc2626; font-size: 12px; margin-top: 6px; }
  `]
})
export class PreorderCtaComponent implements OnChanges {
  @Input() productId!: number;

  drop: Drop | null = null;
  reservation: any = null;
  loading = false;
  error = '';

  constructor(private http: HttpClient) {}

  ngOnChanges(c: SimpleChanges) {
    if (c['productId'] && this.productId) this.load();
  }

  load() {
    this.http.get<any>(`${environementDev.api}/api/storefront/preorder/drop/product/${this.productId}`)
      .subscribe({
        next: r => {
          this.drop = r.drop;
          if (this.drop) this.loadMyReservation();
        },
        error: () => this.drop = null
      });
  }

  loadMyReservation() {
    const token = localStorage.getItem('jwt');
    if (!token) return;
    this.http.get<any>(`${environementDev.api}/api/storefront/preorder/reservations/mine`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).subscribe({
      next: r => {
        this.reservation = (r.items || []).find((x: any) => x.drop_id === this.drop?.id && x.status !== 'CANCELLED');
      }
    });
  }

  reserve() {
    const token = localStorage.getItem('jwt');
    if (!token) { this.error = 'Connectez-vous pour réserver.'; return; }
    if (!this.drop) return;
    this.loading = true;
    this.error = '';
    this.http.post<any>(`${environementDev.api}/api/storefront/preorder/drop/${this.drop.id}/reserve`,
      { quantity: 1 },
      { headers: { Authorization: `Bearer ${token}` } }
    ).subscribe({
      next: r => { this.loading = false; this.reservation = r; this.load(); },
      error: e => { this.loading = false; this.error = e?.error?.message || 'Erreur réservation'; }
    });
  }

  formatDate(d: string) { return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : ''; }
}
