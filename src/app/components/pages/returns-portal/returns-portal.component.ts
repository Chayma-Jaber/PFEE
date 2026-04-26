import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { environementDev } from '../../../../environements/environementDev';

interface OrderItem {
  id: number;
  product_id?: number;
  title?: string;
  sku?: string;
  unit_price?: number;
  quantity?: number;
  image_url?: string;
  variant_info?: any;
}

interface OrderLite {
  id: number;
  reference?: string;
  slug?: string;
  total?: number;
  total_amount?: number;
  delivered_at?: string;
  created_at?: string;
  items?: OrderItem[];
}

interface ReturnRow {
  id: number;
  order_id: number;
  reason: string;
  description?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RECEIVED' | 'REFUNDED' | 'CLOSED' | string;
  created_at: string;
  photos?: string[];
  items?: any[];
}

interface ReturnSelection {
  orderItemId: number;
  title: string;
  quantity: number;
  maxQuantity: number;
  checked: boolean;
}

const REASONS = [
  { code: 'SIZE', label: 'Taille ne convient pas' },
  { code: 'QUALITY', label: 'Qualité en deçà des attentes' },
  { code: 'DIFFERENT', label: 'Différent de la description / photo' },
  { code: 'DAMAGED', label: 'Article endommagé à la réception' },
  { code: 'WRONG_ITEM', label: 'Mauvais article livré' },
  { code: 'CHANGED_MIND', label: 'J\'ai changé d\'avis' },
  { code: 'OTHER', label: 'Autre (précisez)' },
];

@Component({
  selector: 'app-returns-portal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="returns-portal">
      <div class="portal-header">
        <h1><i class="fas fa-undo-alt"></i> Mes retours</h1>
        <p>Demandez le retour ou échange d'un article livré. Délai : 14 jours après réception.</p>
      </div>

      <div *ngIf="toast" class="toast" [class.ok]="toastKind==='ok'" [class.err]="toastKind==='err'">
        <i class="fas" [class.fa-check-circle]="toastKind==='ok'" [class.fa-exclamation-circle]="toastKind==='err'"></i>
        {{ toast }}
      </div>

      <div class="layout">
        <!-- LEFT: my existing returns -->
        <div class="card history-card">
          <h2><i class="fas fa-history"></i> Historique</h2>
          <div *ngIf="loadingHistory" class="loading">Chargement...</div>
          <div *ngIf="!loadingHistory && returns.length === 0" class="empty">
            <i class="fas fa-inbox"></i>
            <p>Aucune demande de retour pour l'instant.</p>
          </div>
          <div class="ret-list" *ngIf="!loadingHistory && returns.length > 0">
            <div class="ret-row" *ngFor="let r of returns">
              <div class="ret-head">
                <span class="badge" [class]="'s-' + (r.status || 'PENDING').toLowerCase()">{{ statusLabel(r.status) }}</span>
                <small>#{{ r.id }} · {{ formatDate(r.created_at) }}</small>
              </div>
              <div class="ret-body">
                <strong>Commande #{{ r.order_id }}</strong>
                <span class="reason">{{ reasonLabel(r.reason) }}</span>
                <p *ngIf="r.description" class="desc">{{ r.description }}</p>
                <div class="photos" *ngIf="r.photos?.length">
                  <img *ngFor="let p of r.photos" [src]="p" alt="photo retour" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT: new request wizard -->
        <div class="card wizard-card">
          <h2><i class="fas fa-plus-circle"></i> Nouvelle demande</h2>

          <!-- Step 1: pick an order -->
          <div class="step" *ngIf="step === 1">
            <div class="step-head">
              <span class="num">1</span>
              <span>Choisissez la commande à retourner</span>
            </div>
            <div *ngIf="loadingOrders" class="loading">Chargement...</div>
            <div *ngIf="!loadingOrders && orders.length === 0" class="empty muted">
              <i class="fas fa-box-open"></i>
              <p>Aucune commande éligible au retour. Les retours sont possibles pour les commandes livrées sans demande en cours.</p>
            </div>
            <div class="order-list" *ngIf="!loadingOrders && orders.length > 0">
              <label class="order-card" *ngFor="let o of orders" [class.selected]="selectedOrder?.id === o.id">
                <input type="radio" name="order" [value]="o.id" (change)="pickOrder(o)" />
                <div>
                  <strong>Commande #{{ o.reference || o.slug || o.id }}</strong>
                  <p class="muted">
                    {{ formatDate(o.delivered_at || o.created_at) }}
                    · {{ o.total || o.total_amount | number:'1.2-2' }} TND
                    · {{ o.items?.length || 0 }} article(s)
                  </p>
                </div>
              </label>
            </div>
            <div class="actions" *ngIf="orders.length > 0">
              <button class="btn-primary" (click)="goToStep2()" [disabled]="!selectedOrder">
                Continuer <i class="fas fa-arrow-right"></i>
              </button>
            </div>
          </div>

          <!-- Step 2: pick items + reason -->
          <div class="step" *ngIf="step === 2 && selectedOrder">
            <div class="step-head">
              <span class="num">2</span>
              <span>Articles, motif et photos</span>
              <button class="btn-ghost" (click)="step = 1"><i class="fas fa-arrow-left"></i> Retour</button>
            </div>

            <p class="muted">Commande #{{ selectedOrder.reference || selectedOrder.id }}</p>
            <div *ngIf="loadingProducts" class="loading">Chargement des articles...</div>

            <div class="items-list" *ngIf="!loadingProducts">
              <label class="item-card" *ngFor="let it of selections" [class.selected]="it.checked">
                <input type="checkbox" [(ngModel)]="it.checked" />
                <div class="item-body">
                  <strong>{{ it.title }}</strong>
                  <div class="qty" *ngIf="it.checked">
                    <label>Quantité :</label>
                    <input type="number" min="1" [max]="it.maxQuantity" [(ngModel)]="it.quantity" />
                    <small>/ {{ it.maxQuantity }} acheté(s)</small>
                  </div>
                </div>
              </label>
              <div *ngIf="selections.length === 0" class="empty muted">Aucun article détaillé.</div>
            </div>

            <div class="form-group">
              <label>Motif du retour *</label>
              <select [(ngModel)]="reason">
                <option value="">Sélectionner...</option>
                <option *ngFor="let r of reasons" [value]="r.code">{{ r.label }}</option>
              </select>
            </div>

            <div class="form-group">
              <label>Commentaire {{ reason === 'OTHER' ? '(obligatoire)' : '(optionnel)' }}</label>
              <textarea rows="3" [(ngModel)]="description" maxlength="500"
                placeholder="Décrivez votre problème (sera transmis au support)..."></textarea>
              <small class="muted">{{ description.length }}/500</small>
            </div>

            <div class="form-group">
              <label>Photos (optionnel, 3 max)</label>
              <div class="photo-inputs">
                <input *ngFor="let _ of [0,1,2]; let i = index"
                  type="url"
                  [(ngModel)]="photoUrls[i]"
                  placeholder="URL de photo #{{ i + 1 }}" />
              </div>
              <small class="muted">Hébergez vos images (imgur, drive) et collez les URL.</small>
            </div>

            <div class="actions">
              <button class="btn-primary" (click)="submit()" [disabled]="!canSubmit() || submitting">
                <i class="fas" [class.fa-spinner]="submitting" [class.fa-spin]="submitting" [class.fa-paper-plane]="!submitting"></i>
                {{ submitting ? 'Envoi...' : 'Envoyer la demande' }}
              </button>
            </div>
          </div>

          <!-- Step 3: confirmation -->
          <div class="step success-step" *ngIf="step === 3">
            <div class="ok-icon"><i class="fas fa-check"></i></div>
            <h3>Demande envoyée !</h3>
            <p>Notre équipe examine votre demande et vous contacte sous 48h ouvrées.</p>
            <button class="btn-primary" (click)="reset()"><i class="fas fa-plus"></i> Nouvelle demande</button>
            <a [routerLink]="['/profile']" class="btn-ghost">Retour au compte</a>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .returns-portal { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .portal-header h1 { font-size: 26px; font-weight: 600; color: #111827; margin: 0 0 6px; }
    .portal-header h1 i { color: #6366f1; margin-right: 8px; }
    .portal-header p { color: #6b7280; margin: 0 0 20px; font-size: 14px; }
    .toast { padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; display: flex; gap: 8px; font-size: 14px; }
    .toast.ok { background: #d1fae5; color: #065f46; }
    .toast.err { background: #fee2e2; color: #991b1b; }
    .layout { display: grid; grid-template-columns: 380px 1fr; gap: 20px; align-items: flex-start; }
    @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 22px; }
    .card h2 { font-size: 17px; font-weight: 600; margin: 0 0 16px; color: #111827; display: flex; align-items: center; gap: 8px; }
    .card h2 i { color: #6366f1; }
    .loading, .empty { text-align: center; padding: 30px 10px; color: #6b7280; font-size: 14px; }
    .empty i { font-size: 32px; color: #d1d5db; display: block; margin-bottom: 10px; }
    .empty p { margin: 0; }
    .muted { color: #9ca3af; }
    .ret-list { display: flex; flex-direction: column; gap: 10px; max-height: 600px; overflow-y: auto; }
    .ret-row { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; }
    .ret-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .ret-head small { color: #9ca3af; font-size: 12px; }
    .badge { font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 10px; letter-spacing: .5px; }
    .s-pending { background: #fef3c7; color: #92400e; }
    .s-approved { background: #d1fae5; color: #065f46; }
    .s-rejected { background: #fee2e2; color: #991b1b; }
    .s-received { background: #dbeafe; color: #1e40af; }
    .s-refunded { background: #dcfce7; color: #166534; }
    .s-closed { background: #e5e7eb; color: #4b5563; }
    .ret-body strong { display: block; font-size: 14px; color: #111827; }
    .ret-body .reason { font-size: 13px; color: #6366f1; font-weight: 500; }
    .ret-body .desc { margin: 6px 0 0; font-size: 13px; color: #6b7280; }
    .photos { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
    .photos img { width: 50px; height: 50px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; }

    .step-head { display: flex; align-items: center; gap: 10px; font-weight: 600; color: #111827; margin-bottom: 16px; font-size: 15px; }
    .step-head .num { width: 26px; height: 26px; border-radius: 50%; background: linear-gradient(135deg,#6366f1,#ec4899); color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; }
    .btn-ghost { margin-left: auto; background: transparent; border: none; color: #6366f1; cursor: pointer; font-size: 13px; }
    .order-list, .items-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; max-height: 360px; overflow-y: auto; }
    .order-card, .item-card { display: flex; gap: 12px; padding: 14px; border: 2px solid #e5e7eb; border-radius: 10px; cursor: pointer; transition: all .15s; align-items: flex-start; }
    .order-card:hover, .item-card:hover { border-color: #9ca3af; }
    .order-card.selected, .item-card.selected { border-color: #6366f1; background: #eef2ff; }
    .order-card strong, .item-body strong { display: block; font-size: 14px; color: #111827; }
    .order-card p { margin: 3px 0 0; font-size: 12px; }
    .item-body { flex: 1; }
    .item-body .qty { margin-top: 8px; display: flex; gap: 8px; align-items: center; font-size: 13px; color: #374151; }
    .item-body .qty input { width: 60px; padding: 5px 8px; border: 1px solid #d1d5db; border-radius: 6px; }
    .form-group { margin-bottom: 14px; }
    .form-group label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; color: #374151; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; box-sizing: border-box; }
    .form-group textarea { resize: vertical; }
    .photo-inputs { display: flex; flex-direction: column; gap: 6px; }
    .photo-inputs input { width: 100%; }
    .actions { display: flex; gap: 10px; margin-top: 6px; }
    .btn-primary { padding: 12px 22px; background: linear-gradient(135deg,#6366f1,#ec4899); color: #fff; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; display: inline-flex; gap: 8px; align-items: center; font-size: 14px; }
    .btn-primary:hover { transform: translateY(-1px); }
    .btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; }

    .success-step { text-align: center; padding: 30px 0; }
    .success-step .ok-icon { width: 72px; height: 72px; margin: 0 auto 18px; background: linear-gradient(135deg,#10b981,#059669); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 30px; }
    .success-step h3 { margin: 0 0 8px; color: #111827; }
    .success-step p { color: #6b7280; margin: 0 0 20px; }
    .success-step .btn-ghost { text-decoration: none; padding: 10px 18px; border-radius: 10px; background: #f3f4f6; margin-left: 10px; color: #374151; }
  `]
})
export class ReturnsPortalComponent implements OnInit {
  step = 1;
  loadingHistory = false;
  loadingOrders = false;
  loadingProducts = false;
  submitting = false;

  returns: ReturnRow[] = [];
  orders: OrderLite[] = [];
  selectedOrder: OrderLite | null = null;

  selections: ReturnSelection[] = [];
  reason = '';
  description = '';
  photoUrls: string[] = ['', '', ''];

  reasons = REASONS;

  toast = '';
  toastKind: 'ok' | 'err' = 'ok';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadHistory();
    this.loadOrders();
  }

  private authHeaders(): Record<string, string> {
    const t = localStorage.getItem('jwt');
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  loadHistory() {
    this.loadingHistory = true;
    this.http.get<ReturnRow[]>(`${environementDev.api}/api/getOrdersReturns`, { headers: this.authHeaders() })
      .subscribe({
        next: (r) => { this.returns = Array.isArray(r) ? r : ((r as any)?.data || []); this.loadingHistory = false; },
        error: () => { this.returns = []; this.loadingHistory = false; }
      });
  }

  loadOrders() {
    this.loadingOrders = true;
    this.http.get<OrderLite[]>(`${environementDev.api}/api/availablesOrdersForReturnRequest`, { headers: this.authHeaders() })
      .subscribe({
        next: (r) => { this.orders = Array.isArray(r) ? r : ((r as any)?.data || []); this.loadingOrders = false; },
        error: () => { this.orders = []; this.loadingOrders = false; }
      });
  }

  pickOrder(o: OrderLite) {
    this.selectedOrder = o;
  }

  goToStep2() {
    if (!this.selectedOrder) return;
    this.step = 2;
    this.loadingProducts = true;
    this.http.get<OrderItem[]>(
      `${environementDev.api}/api/availablesOrderProductsForReturn/${this.selectedOrder.id}`,
      { headers: this.authHeaders() }
    ).subscribe({
      next: (items) => {
        const list: OrderItem[] = Array.isArray(items) ? items : ((items as any)?.data || []);
        this.selections = list.map((it) => ({
          orderItemId: it.id,
          title: it.title || `Article #${it.id}`,
          quantity: 1,
          maxQuantity: Math.max(1, Number(it.quantity || 1)),
          checked: false,
        }));
        this.loadingProducts = false;
      },
      error: () => { this.selections = []; this.loadingProducts = false; }
    });
  }

  canSubmit(): boolean {
    if (!this.selectedOrder) return false;
    if (!this.reason) return false;
    if (this.reason === 'OTHER' && !this.description.trim()) return false;
    const anyItem = this.selections.length === 0 || this.selections.some((s) => s.checked);
    return anyItem;
  }

  submit() {
    if (!this.canSubmit() || !this.selectedOrder) return;
    this.submitting = true;
    const payload = {
      order_id: this.selectedOrder.id,
      reason: this.reason,
      description: this.description.trim() || undefined,
      items: this.selections.filter((s) => s.checked).map((s) => ({
        orderItemId: s.orderItemId,
        title: s.title,
        quantity: s.quantity,
      })),
      photos: this.photoUrls.map((u) => u.trim()).filter(Boolean),
    };
    this.http.post<any>(`${environementDev.api}/api/createOrderReturnRequest`, payload, { headers: this.authHeaders() })
      .subscribe({
        next: (r) => {
          this.submitting = false;
          if (r?.success) {
            this.step = 3;
            this.showToast('Demande de retour enregistrée', 'ok');
            this.loadHistory();
            this.loadOrders();
          } else {
            this.showToast(r?.message || 'Erreur lors de la création', 'err');
          }
        },
        error: (err) => {
          this.submitting = false;
          this.showToast(err?.error?.message || 'Erreur réseau', 'err');
        }
      });
  }

  reset() {
    this.step = 1;
    this.selectedOrder = null;
    this.selections = [];
    this.reason = '';
    this.description = '';
    this.photoUrls = ['', '', ''];
  }

  reasonLabel(code: string): string {
    const r = REASONS.find((x) => x.code === code);
    return r ? r.label : code;
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'EN ATTENTE',
      APPROVED: 'APPROUVÉ',
      REJECTED: 'REFUSÉ',
      RECEIVED: 'REÇU',
      REFUNDED: 'REMBOURSÉ',
      CLOSED: 'CLÔTURÉ',
    };
    return map[status] || status;
  }

  formatDate(d?: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private showToast(msg: string, kind: 'ok' | 'err') {
    this.toast = msg; this.toastKind = kind;
    setTimeout(() => this.toast = '', 4000);
  }
}
