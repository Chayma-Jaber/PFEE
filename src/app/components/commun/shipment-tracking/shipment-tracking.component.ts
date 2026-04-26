import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';

interface ShipmentEvent { status: string; label: string; at: string; location?: string; note?: string; }
interface TrackingData {
  trackingNumber: string;
  provider: string;
  status: string;
  events: ShipmentEvent[];
  estimatedDeliveryAt?: string;
  recipientCity?: string;
}

/**
 * Premium shipment tracking timeline.
 * Fetches data by tracking number (public endpoint) or by order id (admin endpoint).
 * Renders a vertical timeline with the full status progression.
 */
@Component({
  selector: 'app-shipment-tracking',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="shipment-tracking" *ngIf="data">
      <div class="st-head">
        <div>
          <h3><i class="fas fa-truck"></i> Suivi de votre commande</h3>
          <p class="tn"><strong>N° de suivi:</strong> <code>{{ data.trackingNumber }}</code> <span class="prov">({{ providerLabel(data.provider) }})</span></p>
          <p class="eta" *ngIf="data.estimatedDeliveryAt"><i class="far fa-clock"></i> Livraison estimée: <strong>{{ formatDate(data.estimatedDeliveryAt) }}</strong></p>
        </div>
        <span class="status-pill" [ngClass]="statusClass(data.status)">{{ statusLabel(data.status) }}</span>
      </div>

      <div class="timeline">
        <div class="t-step" *ngFor="let step of allSteps; let i = index" [class.done]="isStepDone(step.key)" [class.current]="isCurrent(step.key)">
          <div class="t-dot"><i class="fas" [class.fa-check]="isStepDone(step.key)" [class.fa-circle]="!isStepDone(step.key)"></i></div>
          <div class="t-body">
            <div class="t-label">{{ step.label }}</div>
            <div class="t-meta" *ngIf="eventForStep(step.key) as e">
              <span class="t-time">{{ formatDate(e.at) }}</span>
              <span class="t-loc" *ngIf="e.location"> · {{ e.location }}</span>
              <div class="t-note" *ngIf="e.note">{{ e.note }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="st-empty" *ngIf="!loading && !data">
      <i class="fas fa-box-open"></i>
      <p>Aucun suivi disponible pour cette commande.</p>
    </div>

    <div class="st-loading" *ngIf="loading">
      <i class="fas fa-spinner fa-spin"></i> Chargement du suivi...
    </div>
  `,
  styles: [`
    .shipment-tracking { background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:24px; margin:20px 0; }
    .st-head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; gap:16px; flex-wrap:wrap; }
    .st-head h3 { margin:0 0 8px; font-size:18px; color:#111827; display:flex; align-items:center; gap:10px; }
    .st-head h3 i { color:#6366f1; }
    .tn { margin:4px 0; font-size:13px; color:#6b7280; }
    .tn code { background:#f3f4f6; padding:3px 10px; border-radius:6px; color:#4338ca; font-weight:600; }
    .prov { font-size:12px; color:#9ca3af; }
    .eta { margin:4px 0; font-size:13px; color:#374151; }
    .status-pill { padding:8px 16px; border-radius:20px; font-size:13px; font-weight:600; }
    .status-pill.warm { background:#fef3c7; color:#92400e; }
    .status-pill.info { background:#dbeafe; color:#1e40af; }
    .status-pill.progress { background:#ede9fe; color:#5b21b6; }
    .status-pill.success { background:#d1fae5; color:#065f46; }
    .status-pill.danger { background:#fee2e2; color:#991b1b; }

    .timeline { position:relative; padding-left:30px; }
    .timeline::before { content:''; position:absolute; left:11px; top:8px; bottom:8px; width:2px; background:#e5e7eb; }
    .t-step { position:relative; padding-bottom:18px; }
    .t-step:last-child { padding-bottom:0; }
    .t-dot { position:absolute; left:-30px; top:0; width:24px; height:24px; background:#fff; border:2px solid #e5e7eb; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; color:#d1d5db; }
    .t-step.done .t-dot { background:#10b981; border-color:#10b981; color:#fff; }
    .t-step.current .t-dot { background:#6366f1; border-color:#6366f1; color:#fff; box-shadow:0 0 0 4px rgba(99,102,241,0.2); }
    .t-label { font-weight:600; color:#374151; font-size:14px; }
    .t-step.done .t-label { color:#111827; }
    .t-step.current .t-label { color:#4338ca; }
    .t-meta { font-size:12px; color:#6b7280; margin-top:2px; }
    .t-time { font-weight:500; }
    .t-note { font-size:12px; color:#6b7280; margin-top:4px; font-style:italic; }
    .st-empty, .st-loading { text-align:center; padding:30px; color:#9ca3af; }
    .st-empty i { font-size:32px; margin-bottom:12px; }
  `]
})
export class ShipmentTrackingComponent implements OnChanges {
  @Input() trackingNumber?: string;
  @Input() orderId?: number;

  data: TrackingData | null = null;
  loading = false;

  allSteps = [
    { key: 'PREPARING', label: 'Préparation chez Barsha' },
    { key: 'DEPOT_BARSHA', label: 'Dépôt Barsha' },
    { key: 'HANDED_OVER', label: 'Remis au transporteur' },
    { key: 'IN_TRANSIT', label: 'En transit' },
    { key: 'DEPOT_DELIVERY', label: 'Dépôt de livraison' },
    { key: 'OUT_FOR_DELIVERY', label: 'En cours de livraison' },
    { key: 'DELIVERED', label: 'Livré' },
  ];

  constructor(private http: HttpClient) {}

  ngOnChanges(ch: SimpleChanges): void {
    if (this.trackingNumber) this.loadByTracking(this.trackingNumber);
    else if (this.orderId) this.loadByOrder(this.orderId);
  }

  private loadByTracking(tn: string) {
    this.loading = true;
    this.http.get<TrackingData>(`${environementDev.api}/api/shipping/track/${tn}`).subscribe({
      next: (d) => { this.data = d; this.loading = false; },
      error: () => { this.data = null; this.loading = false; }
    });
  }

  private loadByOrder(oid: number) {
    const token = localStorage.getItem('admin_jwt') || localStorage.getItem('jwt') || '';
    this.loading = true;
    this.http.get<{ shipment: any }>(
      `${environementDev.api}/api/admin/shipments/by-order/${oid}`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).subscribe({
      next: (r) => {
        const s = r?.shipment;
        if (!s) { this.data = null; this.loading = false; return; }
        this.data = {
          trackingNumber: s.tracking_number,
          provider: s.provider,
          status: s.status,
          events: s.events || [],
          estimatedDeliveryAt: s.estimated_delivery_at,
          recipientCity: s.recipient_city,
        };
        this.loading = false;
      },
      error: () => { this.data = null; this.loading = false; }
    });
  }

  private order = ['PREPARING', 'DEPOT_BARSHA', 'HANDED_OVER', 'IN_TRANSIT', 'DEPOT_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED'];

  isStepDone(key: string): boolean {
    if (!this.data) return false;
    return this.order.indexOf(key) <= this.order.indexOf(this.data.status);
  }
  isCurrent(key: string): boolean {
    return this.data?.status === key;
  }
  eventForStep(key: string): ShipmentEvent | null {
    if (!this.data?.events) return null;
    // Most recent event with this status wins
    const matched = this.data.events.filter(e => e.status === key);
    return matched.length > 0 ? matched[matched.length - 1] : null;
  }

  statusLabel(s: string): string {
    const map: any = { PREPARING: 'En préparation', DEPOT_BARSHA: 'Dépôt Barsha', HANDED_OVER: 'Chez le transporteur', IN_TRANSIT: 'En transit', DEPOT_DELIVERY: 'Dépôt livraison', OUT_FOR_DELIVERY: 'En livraison', DELIVERED: 'Livré', FAILED: 'Échec', RETURNED: 'Retourné', CANCELLED: 'Annulé' };
    return map[s] || s;
  }
  statusClass(s: string): string {
    if (s === 'DELIVERED') return 'success';
    if (s === 'FAILED' || s === 'CANCELLED') return 'danger';
    if (s === 'OUT_FOR_DELIVERY') return 'progress';
    if (s === 'IN_TRANSIT' || s === 'HANDED_OVER') return 'info';
    return 'warm';
  }
  providerLabel(p: string): string {
    return { FIRST_DELIVERY: 'First Delivery', ARAMEX: 'Aramex', INTERNAL: 'Barsha' }[p] || p;
  }
  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}
