import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';
import { ADMIN_PAGE_STYLES, adminAuthHeaders } from '../_shared/admin-page.styles';

@Component({
  selector: 'app-admin-b2b',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <div>
          <h1><i class="fas fa-handshake"></i> Comptes B2B &amp; devis</h1>
          <p>Onboarding entreprises, tiers de remise (BRONZE/SILVER/GOLD/PLATINUM), conditions de paiement, devis personnalisés.</p>
        </div>
      </div>
      <div class="toast" [class.ok]="toastKind==='ok'" [class.err]="toastKind==='err'" *ngIf="toast">{{ toast }}</div>

      <div class="stats-grid" *ngIf="stats">
        <div class="stat-card"><div class="stat-icon indigo"><i class="fas fa-building"></i></div><div><span class="stat-value">{{ stats.total }}</span><span class="stat-label">Comptes</span></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="fas fa-check"></i></div><div><span class="stat-value">{{ stats.approved }}</span><span class="stat-label">Actifs</span></div></div>
        <div class="stat-card"><div class="stat-icon amber"><i class="fas fa-hourglass"></i></div><div><span class="stat-value">{{ stats.pending }}</span><span class="stat-label">En attente</span></div></div>
        <div class="stat-card"><div class="stat-icon pink"><i class="fas fa-file-invoice"></i></div><div><span class="stat-value">{{ stats.quotesOpen }}</span><span class="stat-label">Devis ouverts</span></div></div>
      </div>

      <div class="filters">
        <button class="btn ghost" [class.primary]="tab==='accounts'" (click)="tab='accounts'">Comptes</button>
        <button class="btn ghost" [class.primary]="tab==='quotes'" (click)="tab='quotes'; loadQuotes()">Devis</button>
      </div>

      <div class="card" *ngIf="tab==='accounts'">
        <table *ngIf="accounts.length > 0">
          <thead><tr><th>ID</th><th>Société</th><th>VAT</th><th>Email</th><th>Tier</th><th>Remise</th><th>Crédit</th><th>Paiement</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            <tr *ngFor="let a of accounts">
              <td>#{{ a.id }}</td>
              <td><strong>{{ a.company_name }}</strong></td>
              <td class="small">{{ a.vat_number || '—' }}</td>
              <td class="small">{{ a.contact_email }}</td>
              <td><span class="badge indigo">{{ a.tier }}</span></td>
              <td>{{ a.custom_discount_pct ?? tierDiscount(a.tier) }}%</td>
              <td class="small">{{ a.credit_used }}/{{ a.credit_limit }}</td>
              <td class="small">{{ a.payment_terms }}</td>
              <td><span class="badge" [class.ok]="a.status==='APPROVED'" [class.warn]="a.status==='PENDING'" [class.err]="a.status!=='APPROVED' && a.status!=='PENDING'">{{ a.status }}</span></td>
              <td>
                <button *ngIf="a.status==='PENDING'" class="btn primary" style="padding:4px 8px;font-size:11px" (click)="approve(a)">Approuver</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="empty" *ngIf="accounts.length === 0">Aucun compte B2B.</div>
      </div>

      <div class="card" *ngIf="tab==='quotes'">
        <table *ngIf="quotes.length > 0">
          <thead><tr><th>ID</th><th>Compte</th><th>Articles</th><th>Sous-total</th><th>Remise prop.</th><th>Total</th><th>Valide</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            <tr *ngFor="let q of quotes">
              <td>#{{ q.id }}</td>
              <td>{{ q.account_id }}</td>
              <td class="small">{{ q.items?.length }} ligne(s)</td>
              <td>{{ q.subtotal }}</td>
              <td>{{ q.proposed_discount_pct }}% {{ q.approved_discount_pct ? '→ ' + q.approved_discount_pct + '%' : '' }}</td>
              <td><strong>{{ q.total }}</strong></td>
              <td class="small">{{ formatDate(q.valid_until) }}</td>
              <td><span class="badge" [class.ok]="q.status==='APPROVED'" [class.warn]="q.status==='SUBMITTED' || q.status==='UNDER_REVIEW'" [class.err]="q.status==='REJECTED'">{{ q.status }}</span></td>
              <td>
                <button *ngIf="q.status==='SUBMITTED' || q.status==='UNDER_REVIEW'" class="btn primary" style="padding:4px 8px;font-size:11px" (click)="approveQuote(q)">Approuver</button>
                <button *ngIf="q.status==='SUBMITTED' || q.status==='UNDER_REVIEW'" class="btn danger" style="padding:4px 8px;font-size:11px" (click)="rejectQuote(q)">Rejeter</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="empty" *ngIf="quotes.length === 0">Aucun devis.</div>
      </div>
    </div>
  `,
  styles: [ADMIN_PAGE_STYLES]
})
export class AdminB2BComponent implements OnInit {
  stats: any = null;
  accounts: any[] = [];
  quotes: any[] = [];
  tab: 'accounts'|'quotes' = 'accounts';
  toast = ''; toastKind: 'ok'|'err' = 'ok';

  constructor(private http: HttpClient) {}
  ngOnInit() { this.loadStats(); this.load(); }

  loadStats() {
    this.http.get<any>(`${environementDev.api}/api/admin/b2b/stats`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.stats = r });
  }

  load() {
    this.http.get<any>(`${environementDev.api}/api/admin/b2b/accounts`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.accounts = r.items || [] });
  }

  loadQuotes() {
    this.http.get<any>(`${environementDev.api}/api/admin/b2b/quotes`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.quotes = r.items || [] });
  }

  approve(a: any) {
    const tier = prompt('Tier (BRONZE/SILVER/GOLD/PLATINUM) :', a.tier) || a.tier;
    const customPct = prompt('Remise personnalisée % (vide = utiliser le tier) :', '');
    const credit = Number(prompt('Limite de crédit (TND, 0 = aucune) :', '0') || 0);
    const terms = prompt('Conditions paiement (PREPAID/NET_15/NET_30/NET_60) :', 'PREPAID') || 'PREPAID';
    const body: any = { tier, creditLimit: credit, paymentTerms: terms };
    if (customPct) body.customDiscountPct = Number(customPct);
    this.http.post(`${environementDev.api}/api/admin/b2b/accounts/${a.id}/approve`, body, { headers: adminAuthHeaders() })
      .subscribe({ next: () => { this.show('Compte approuvé', 'ok'); this.loadStats(); this.load(); } });
  }

  approveQuote(q: any) {
    const pct = prompt('Remise approuvée % (vide = garder proposée) :', String(q.proposed_discount_pct));
    const note = prompt('Note admin (optionnelle) :') || '';
    const body: any = { adminNotes: note };
    if (pct) body.approvedDiscountPct = Number(pct);
    this.http.post(`${environementDev.api}/api/admin/b2b/quotes/${q.id}/approve`, body, { headers: adminAuthHeaders() })
      .subscribe({ next: () => { this.show('Devis approuvé', 'ok'); this.loadQuotes(); } });
  }

  rejectQuote(q: any) {
    const note = prompt('Raison :') || 'rejet';
    this.http.post(`${environementDev.api}/api/admin/b2b/quotes/${q.id}/reject`, { adminNotes: note }, { headers: adminAuthHeaders() })
      .subscribe({ next: () => { this.show('Devis rejeté', 'ok'); this.loadQuotes(); } });
  }

  tierDiscount(t: string) { return ({ BRONZE: 5, SILVER: 10, GOLD: 15, PLATINUM: 20 } as any)[t] || 0; }
  formatDate(d: string) { return d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' }) : ''; }
  private show(m: string, k: 'ok'|'err') { this.toast = m; this.toastKind = k; setTimeout(() => this.toast = '', 3500); }
}
