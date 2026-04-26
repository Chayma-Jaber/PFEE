import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { environementDev } from '../../../../environements/environementDev';

@Component({
  selector: 'app-subscriptions-portal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="subs-portal">
      <div class="head">
        <h1><i class="fas fa-redo-alt"></i> Mes abonnements</h1>
        <p>Recevez vos essentiels automatiquement, à votre rythme. Modifiable ou annulable à tout moment.</p>
      </div>

      <div *ngIf="toast" class="toast" [class.ok]="toastKind==='ok'" [class.err]="toastKind==='err'">{{ toast }}</div>

      <div *ngIf="loading" class="loading">Chargement…</div>

      <div *ngIf="!loading && items.length === 0" class="empty-state">
        <i class="fas fa-box-open"></i>
        <h3>Aucun abonnement actif</h3>
        <p>Activez "Subscribe &amp; save" sur n'importe quel produit du catalogue pour bénéficier de -10% à chaque livraison.</p>
        <a routerLink="/tn/shop" class="btn-primary">Parcourir le catalogue</a>
      </div>

      <div *ngIf="!loading && items.length > 0" class="cards">
        <div class="sub-card" *ngFor="let s of items">
          <div class="card-head">
            <div>
              <strong>Produit #{{ s.product_id }} × {{ s.quantity }}</strong>
              <div class="muted">tous les {{ s.frequency_days }} jours · -{{ s.discount_pct }}%</div>
            </div>
            <span class="badge"
              [class.ok]="s.status==='ACTIVE'"
              [class.warn]="s.status==='PAUSED'"
              [class.err]="s.status==='PAST_DUE' || s.status==='CANCELLED'">
              {{ statusLabel(s.status) }}
            </span>
          </div>
          <div class="card-meta">
            <div><i class="far fa-calendar"></i> Prochaine commande : <strong>{{ formatDate(s.next_charge_at) }}</strong></div>
            <div><i class="fas fa-history"></i> {{ s.total_cycles }} cycle(s) effectué(s)</div>
            <div *ngIf="s.last_error" class="err-line"><i class="fas fa-exclamation-triangle"></i> Dernier paiement : {{ s.last_error }}</div>
          </div>
          <div class="card-actions">
            <button *ngIf="s.status==='ACTIVE'" class="btn-ghost" (click)="skip(s)">Passer la prochaine</button>
            <button *ngIf="s.status==='ACTIVE'" class="btn-ghost" (click)="pause(s)">Mettre en pause</button>
            <button *ngIf="s.status==='PAUSED'" class="btn-primary" (click)="resume(s)">Reprendre</button>
            <button *ngIf="s.status!=='CANCELLED'" class="btn-danger" (click)="cancel(s)">Annuler</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .subs-portal { max-width: 1100px; margin: 0 auto; padding: 24px; }
    .head h1 { font-size: 26px; font-weight: 600; color: #111827; margin: 0 0 4px; }
    .head h1 i { color: #6366f1; margin-right: 8px; }
    .head p { color: #6b7280; margin: 0 0 22px; }
    .toast { padding: 11px 14px; border-radius: 8px; margin-bottom: 14px; font-size: 13px; }
    .toast.ok { background: #d1fae5; color: #065f46; }
    .toast.err { background: #fee2e2; color: #991b1b; }
    .loading { text-align: center; padding: 50px; color: #6b7280; }
    .empty-state { text-align: center; padding: 60px 20px; background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; }
    .empty-state i { font-size: 38px; color: #d1d5db; margin-bottom: 12px; }
    .empty-state h3 { margin: 0 0 6px; color: #111827; }
    .empty-state p { color: #6b7280; max-width: 420px; margin: 0 auto 18px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 14px; }
    .sub-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 18px; }
    .card-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .card-head strong { display: block; font-size: 15px; color: #111827; }
    .muted { color: #9ca3af; font-size: 12px; margin-top: 2px; }
    .badge { font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 9px; }
    .badge.ok { background: #d1fae5; color: #065f46; }
    .badge.warn { background: #fef3c7; color: #92400e; }
    .badge.err { background: #fee2e2; color: #991b1b; }
    .card-meta { font-size: 13px; color: #4b5563; line-height: 1.7; margin-bottom: 12px; }
    .card-meta i { width: 16px; color: #6366f1; }
    .err-line { color: #dc2626; font-size: 12px; }
    .card-actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .btn-primary, .btn-ghost, .btn-danger { padding: 7px 12px; border-radius: 7px; cursor: pointer; font-size: 12px; font-weight: 500; border: 1px solid; text-decoration: none; }
    .btn-primary { background: linear-gradient(135deg,#6366f1,#ec4899); color: #fff; border-color: transparent; }
    .btn-ghost { background: transparent; color: #4b5563; border-color: #d1d5db; }
    .btn-danger { background: transparent; color: #dc2626; border-color: #fca5a5; }
  `]
})
export class SubscriptionsPortalComponent implements OnInit {
  items: any[] = [];
  loading = false;
  toast = ''; toastKind: 'ok'|'err' = 'ok';

  constructor(private http: HttpClient) {}
  ngOnInit() { this.load(); }

  private headers(): Record<string, string> {
    const t = localStorage.getItem('jwt');
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  load() {
    this.loading = true;
    this.http.get<any>(`${environementDev.api}/api/storefront/subscriptions`, { headers: this.headers() })
      .subscribe({
        next: r => { this.items = r.items || []; this.loading = false; },
        error: () => { this.items = []; this.loading = false; }
      });
  }

  skip(s: any) {
    this.http.post(`${environementDev.api}/api/storefront/subscriptions/${s.id}/skip`, {}, { headers: this.headers() })
      .subscribe({ next: () => { this.show('Prochaine livraison passée', 'ok'); this.load(); } });
  }

  pause(s: any) {
    const days = prompt('Mettre en pause pendant combien de jours ? (vide = indéfini)', '');
    const until = days ? new Date(Date.now() + Number(days)*86400000).toISOString() : undefined;
    this.http.post(`${environementDev.api}/api/storefront/subscriptions/${s.id}/pause`, { until }, { headers: this.headers() })
      .subscribe({ next: () => { this.show('Abonnement en pause', 'ok'); this.load(); } });
  }

  resume(s: any) {
    this.http.post(`${environementDev.api}/api/storefront/subscriptions/${s.id}/resume`, {}, { headers: this.headers() })
      .subscribe({ next: () => { this.show('Abonnement repris', 'ok'); this.load(); } });
  }

  cancel(s: any) {
    if (!confirm('Annuler définitivement cet abonnement ?')) return;
    const reason = prompt('Pourquoi annulez-vous ? (optionnel)') || '';
    this.http.post(`${environementDev.api}/api/storefront/subscriptions/${s.id}/cancel`, { reason }, { headers: this.headers() })
      .subscribe({ next: () => { this.show('Abonnement annulé', 'ok'); this.load(); } });
  }

  statusLabel(s: string) {
    return ({ ACTIVE: 'Actif', PAUSED: 'En pause', CANCELLED: 'Annulé', PAST_DUE: 'Échec paiement' } as any)[s] || s;
  }
  formatDate(d: string) { return d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' }) : ''; }
  private show(m: string, k: 'ok'|'err') { this.toast = m; this.toastKind = k; setTimeout(() => this.toast = '', 3500); }
}
