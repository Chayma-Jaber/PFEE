import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';

@Component({
  selector: 'app-b2b-portal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="b2b-page">
      <div class="head">
        <h1><i class="fas fa-handshake"></i> Espace pro B2B</h1>
        <p>Tarifs préférentiels, devis personnalisés, conditions de paiement étendues pour les revendeurs.</p>
      </div>

      <div *ngIf="toast" class="toast" [class.ok]="toastKind==='ok'" [class.err]="toastKind==='err'">{{ toast }}</div>

      <!-- No account yet -->
      <div *ngIf="!loading && !account" class="card-cta">
        <h2>Vous êtes une entreprise ?</h2>
        <p class="muted">Demandez l'ouverture d'un compte B2B pour bénéficier de tarifs revendeur, devis sur mesure et paiement à 30 ou 60 jours.</p>
        <div class="form-grid">
          <label>Société * <input [(ngModel)]="apply.companyName" /></label>
          <label>Email contact * <input type="email" [(ngModel)]="apply.contactEmail" /></label>
          <label>Numéro fiscal <input [(ngModel)]="apply.vatNumber" /></label>
          <label>Téléphone <input [(ngModel)]="apply.contactPhone" /></label>
          <label class="wide">Adresse <input [(ngModel)]="apply.address" /></label>
          <label>Ville <input [(ngModel)]="apply.city" /></label>
        </div>
        <button class="btn primary" (click)="submitApply()" [disabled]="applying">
          {{ applying ? '…' : 'Soumettre la demande' }}
        </button>
      </div>

      <!-- Pending -->
      <div *ngIf="account && account.status==='PENDING'" class="status-card warn">
        <i class="fas fa-hourglass-half"></i>
        <div>
          <strong>Compte en attente d'approbation</strong>
          <p>Notre équipe examine votre demande sous 48h ouvrées. Vous serez notifié par email.</p>
        </div>
      </div>

      <!-- Approved -->
      <div *ngIf="account && account.status==='APPROVED'">
        <div class="profile-card">
          <div>
            <strong>{{ account.company_name }}</strong>
            <span class="badge indigo">{{ account.tier }}</span>
            <div class="muted small">Remise {{ account.custom_discount_pct ?? tierDiscount(account.tier) }}% · Paiement {{ account.payment_terms }}</div>
            <div class="muted small" *ngIf="account.credit_limit > 0">Crédit : {{ account.credit_used }}/{{ account.credit_limit }} TND</div>
          </div>
        </div>

        <div class="tabs">
          <button class="btn ghost" [class.primary]="tab==='catalog'" (click)="tab='catalog'; loadPriceList()">Tarifs B2B</button>
          <button class="btn ghost" [class.primary]="tab==='quotes'" (click)="tab='quotes'; loadQuotes()">Mes devis</button>
        </div>

        <div *ngIf="tab==='catalog'" class="card">
          <h3>Liste de prix B2B</h3>
          <table *ngIf="priceList.length > 0">
            <thead><tr><th>Produit</th><th>Prix public</th><th>Votre prix</th><th>Économie</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let p of priceList">
                <td>{{ p.title }}</td>
                <td>{{ p.base }} TND</td>
                <td><strong>{{ p.b2b }} TND</strong></td>
                <td>-{{ p.discountPct }}%</td>
                <td>
                  <input type="number" min="1" [(ngModel)]="qtyMap[p.productId]" placeholder="Qté" style="width:70px;padding:5px 8px;border:1px solid #d1d5db;border-radius:5px" />
                  <button class="btn primary small" (click)="addToQuote(p)">Ajouter au devis</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div *ngIf="quoteCart.length > 0" class="quote-cart">
            <h4>Votre panier devis ({{ quoteCart.length }} article(s))</h4>
            <ul>
              <li *ngFor="let q of quoteCart">{{ q.title }} × {{ q.quantity }} <button (click)="removeFromQuote(q)">×</button></li>
            </ul>
            <textarea [(ngModel)]="quoteNotes" rows="2" placeholder="Note (optionnelle)…"></textarea>
            <button class="btn gradient" (click)="submitQuote()" [disabled]="submitting">
              {{ submitting ? '…' : 'Soumettre le devis' }}
            </button>
          </div>
        </div>

        <div *ngIf="tab==='quotes'" class="card">
          <h3>Mes devis</h3>
          <div *ngIf="quotes.length === 0" class="muted">Aucun devis pour l'instant.</div>
          <table *ngIf="quotes.length > 0">
            <thead><tr><th>ID</th><th>Articles</th><th>Sous-total</th><th>Total</th><th>Statut</th><th>Validité</th></tr></thead>
            <tbody>
              <tr *ngFor="let q of quotes">
                <td>#{{ q.id }}</td>
                <td>{{ q.items?.length }} ligne(s)</td>
                <td>{{ q.subtotal }} TND</td>
                <td><strong>{{ q.total }} TND</strong></td>
                <td><span class="badge" [class.ok]="q.status==='APPROVED'" [class.warn]="q.status==='SUBMITTED'" [class.err]="q.status==='REJECTED'">{{ q.status }}</span></td>
                <td class="small muted">{{ formatDate(q.valid_until) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div *ngIf="account && (account.status==='REJECTED' || account.status==='SUSPENDED')" class="status-card err">
        <i class="fas fa-exclamation-triangle"></i>
        <div>
          <strong>Compte {{ account.status === 'REJECTED' ? 'rejeté' : 'suspendu' }}</strong>
          <p>Contactez le support pour plus d'informations.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .b2b-page { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .head h1 { font-size: 26px; font-weight: 600; color: #111827; margin: 0 0 4px; }
    .head h1 i { color: #6366f1; margin-right: 8px; }
    .head p { color: #6b7280; margin: 0 0 22px; }
    .toast { padding: 11px 14px; border-radius: 8px; margin-bottom: 14px; font-size: 13px; }
    .toast.ok { background: #d1fae5; color: #065f46; }
    .toast.err { background: #fee2e2; color: #991b1b; }
    .muted { color: #6b7280; }
    .small { font-size: 12px; }
    .card-cta, .status-card, .profile-card, .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 22px; margin-bottom: 14px; }
    .card-cta h2 { margin: 0 0 6px; color: #111827; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 14px 0; }
    .form-grid .wide { grid-column: 1 / -1; }
    .form-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #6b7280; }
    .form-grid input { padding: 9px 11px; border: 1px solid #d1d5db; border-radius: 7px; font-size: 14px; }
    .status-card { display: flex; gap: 14px; align-items: center; }
    .status-card.warn { background: #fffbeb; border-color: #fde68a; }
    .status-card.err { background: #fef2f2; border-color: #fca5a5; }
    .status-card i { font-size: 24px; color: #f59e0b; }
    .status-card.err i { color: #ef4444; }
    .status-card strong { display: block; color: #111827; }
    .status-card p { margin: 4px 0 0; color: #4b5563; font-size: 13px; }
    .profile-card { display: flex; justify-content: space-between; align-items: center; }
    .profile-card strong { font-size: 18px; color: #111827; margin-right: 8px; }
    .badge { font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 9px; }
    .badge.indigo { background: #eef2ff; color: #4f46e5; }
    .badge.ok { background: #d1fae5; color: #065f46; }
    .badge.warn { background: #fef3c7; color: #92400e; }
    .badge.err { background: #fee2e2; color: #991b1b; }
    .tabs { display: flex; gap: 8px; margin-bottom: 14px; }
    .btn { padding: 9px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; border: 1px solid #d1d5db; background: #fff; }
    .btn.primary { background: #111; color: #fff; border-color: #111; }
    .btn.gradient { background: linear-gradient(135deg,#6366f1,#ec4899); color: #fff; border: none; }
    .btn.ghost { background: transparent; color: #4b5563; }
    .btn.small { padding: 6px 10px; font-size: 12px; }
    .btn:disabled { opacity: .5; cursor: not-allowed; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; background: #f9fafb; padding: 9px; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #374151; }
    td { padding: 10px 9px; border-bottom: 1px solid #f3f4f6; }
    .quote-cart { margin-top: 18px; padding: 14px; background: #fafafa; border-radius: 10px; }
    .quote-cart ul { list-style: none; padding: 0; margin: 8px 0; }
    .quote-cart li { padding: 6px 0; }
    .quote-cart button { background: transparent; border: none; color: #ef4444; cursor: pointer; }
    .quote-cart textarea { width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; margin-bottom: 10px; }
  `]
})
export class B2bPortalComponent implements OnInit {
  account: any = null;
  loading = false;
  applying = false;
  submitting = false;
  apply = { companyName: '', contactEmail: '', vatNumber: '', contactPhone: '', address: '', city: '' };
  tab: 'catalog'|'quotes' = 'catalog';
  priceList: any[] = [];
  quotes: any[] = [];
  qtyMap: Record<number, number> = {};
  quoteCart: { productId: number; title: string; quantity: number }[] = [];
  quoteNotes = '';
  toast = ''; toastKind: 'ok'|'err' = 'ok';

  constructor(private http: HttpClient) {}
  ngOnInit() { this.loadMe(); }

  private headers(): Record<string, string> {
    const t = localStorage.getItem('jwt');
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  loadMe() {
    this.loading = true;
    this.http.get<any>(`${environementDev.api}/api/storefront/b2b/me`, { headers: this.headers() })
      .subscribe({
        next: r => { this.account = r.account; this.loading = false; if (this.account?.status === 'APPROVED') this.loadPriceList(); },
        error: () => { this.account = null; this.loading = false; }
      });
  }

  submitApply() {
    if (!this.apply.companyName || !this.apply.contactEmail) { this.show('Société + email requis', 'err'); return; }
    this.applying = true;
    this.http.post(`${environementDev.api}/api/storefront/b2b/apply`, this.apply, { headers: this.headers() })
      .subscribe({
        next: () => { this.applying = false; this.show('Demande envoyée. Vous serez notifié·e par email.', 'ok'); this.loadMe(); },
        error: e => { this.applying = false; this.show(e?.error?.message || 'Erreur', 'err'); }
      });
  }

  loadPriceList() {
    this.http.get<any>(`${environementDev.api}/api/storefront/b2b/price-list`, { headers: this.headers() })
      .subscribe({ next: r => this.priceList = (r.items || []).slice(0, 100) });
  }

  loadQuotes() {
    this.http.get<any>(`${environementDev.api}/api/storefront/b2b/quotes`, { headers: this.headers() })
      .subscribe({ next: r => this.quotes = r.items || [] });
  }

  addToQuote(p: any) {
    const qty = Number(this.qtyMap[p.productId] || 1);
    const existing = this.quoteCart.find(x => x.productId === p.productId);
    if (existing) existing.quantity = qty;
    else this.quoteCart.push({ productId: p.productId, title: p.title, quantity: qty });
    this.show(`${p.title} ajouté au devis`, 'ok');
  }

  removeFromQuote(q: any) { this.quoteCart = this.quoteCart.filter(x => x.productId !== q.productId); }

  submitQuote() {
    if (this.quoteCart.length === 0) return;
    this.submitting = true;
    this.http.post(`${environementDev.api}/api/storefront/b2b/quotes`,
      { items: this.quoteCart.map(x => ({ productId: x.productId, quantity: x.quantity })), notes: this.quoteNotes },
      { headers: this.headers() }
    ).subscribe({
      next: () => { this.submitting = false; this.show('Devis soumis ! Vous serez notifié·e quand l\'équipe l\'aura traité.', 'ok'); this.quoteCart = []; this.quoteNotes = ''; this.loadQuotes(); },
      error: e => { this.submitting = false; this.show(e?.error?.message || 'Erreur', 'err'); }
    });
  }

  tierDiscount(t: string) { return ({ BRONZE: 5, SILVER: 10, GOLD: 15, PLATINUM: 20 } as any)[t] || 0; }
  formatDate(d: string) { return d ? new Date(d).toLocaleDateString('fr-FR') : ''; }
  private show(m: string, k: 'ok'|'err') { this.toast = m; this.toastKind = k; setTimeout(() => this.toast = '', 4000); }
}
