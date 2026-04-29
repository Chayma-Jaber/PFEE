import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';
import { AdminModuleContextComponent } from '../_shared/admin-module-context.component';
import { ADMIN_PAGE_STYLES, adminAuthHeaders } from '../_shared/admin-page.styles';

@Component({
  selector: 'app-admin-lifecycle',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminModuleContextComponent],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <div>
          <h1><i class="fas fa-route"></i> Lifecycle marketing — drips</h1>
          <p>Séquences automatiques (welcome, panier abandonné, winback, post-livraison). Cron toutes les 5 min.</p>
        </div>
        <button class="btn gradient" (click)="processNow()" [disabled]="processing">
          <i class="fas fa-play"></i> {{ processing ? '…' : 'Forcer envoi' }}
        </button>
      </div>
      <app-admin-module-context moduleKey="lifecycle" />
      <div class="toast" [class.ok]="toastKind==='ok'" [class.err]="toastKind==='err'" *ngIf="toast">{{ toast }}</div>

      <div class="stats-grid" *ngIf="stats">
        <div class="stat-card"><div class="stat-icon indigo"><i class="fas fa-stream"></i></div><div><span class="stat-value">{{ stats.sequences }}</span><span class="stat-label">Séquences</span></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="fas fa-bolt"></i></div><div><span class="stat-value">{{ stats.active }}</span><span class="stat-label">Inscrits actifs</span></div></div>
        <div class="stat-card"><div class="stat-icon teal"><i class="fas fa-check-double"></i></div><div><span class="stat-value">{{ stats.completed }}</span><span class="stat-label">Terminés</span></div></div>
        <div class="stat-card"><div class="stat-icon red"><i class="fas fa-times"></i></div><div><span class="stat-value">{{ stats.failed }}</span><span class="stat-label">Échecs</span></div></div>
      </div>

      <div class="layout two-col">
        <div class="card">
          <h2><i class="fas fa-plus-circle"></i> Nouvelle séquence</h2>
          <div class="form-grid one">
            <label>Nom <input [(ngModel)]="form.name" /></label>
            <label>Trigger
              <select [(ngModel)]="form.trigger_event">
                <optgroup label="Customer lifecycle">
                  <option value="user.registered">Inscription (welcome)</option>
                  <option value="cart.abandoned">Panier abandonné</option>
                  <option value="order.placed">Post-achat</option>
                  <option value="order.delivered">Post-livraison</option>
                  <option value="customer.churning">Winback (churn)</option>
                  <option value="subscription.cancelled">Abonnement annulé</option>
                </optgroup>
                <optgroup label="Marketplace fulfillment">
                  <option value="seller.fulfillment.shipped">Article vendeur expédié</option>
                  <option value="seller.fulfillment.delivered">Article vendeur livré</option>
                  <option value="seller.fulfillment.cancelled">Article vendeur annulé</option>
                </optgroup>
                <optgroup label="Mixed orders (partial states)">
                  <option value="order.partially_shipped">Commande partiellement expédiée</option>
                  <option value="order.partially_delivered">Commande partiellement livrée</option>
                </optgroup>
              </select>
            </label>
            <label>Description <textarea [(ngModel)]="form.description" rows="2"></textarea></label>
            <label class="wide">Étapes JSON
              <textarea [(ngModel)]="stepsRaw" rows="6" [placeholder]="stepsPlaceholder"></textarea>
            </label>
          </div>
          <div class="actions">
            <button class="btn primary" (click)="create()" [disabled]="saving">{{ saving ? '…' : 'Créer' }}</button>
          </div>
        </div>

        <div class="card">
          <h2><i class="fas fa-list"></i> Séquences ({{ sequences.length }})</h2>
          <div class="row-list">
            <div class="row-item" *ngFor="let s of sequences" [class.muted]="!s.is_active">
              <div class="grow">
                <strong>{{ s.name }}</strong>
                <span class="badge indigo">{{ s.trigger_event }}</span>
                <span class="badge" [class.ok]="s.is_active" [class.idle]="!s.is_active">{{ s.is_active ? 'Actif' : 'Pause' }}</span>
                <div class="small">{{ s.steps?.length }} étape(s)</div>
                <div class="small" *ngIf="s.description">{{ s.description }}</div>
              </div>
              <div style="display:flex;flex-direction:column;gap:3px">
                <button class="btn ghost" style="padding:4px 8px;font-size:11px" (click)="preview(s)">Aperçu</button>
                <button class="btn ghost" style="padding:4px 8px;font-size:11px" (click)="toggle(s)">{{ s.is_active ? 'Pause' : 'Reprendre' }}</button>
                <button class="btn danger" style="padding:4px 8px;font-size:11px" (click)="remove(s)">Supp.</button>
              </div>
            </div>
            <div class="empty" *ngIf="sequences.length === 0">Aucune séquence.</div>
          </div>
        </div>
      </div>

      <!-- Preview / test panel -->
      <div class="card" *ngIf="previewData" style="margin-top:14px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h2><i class="fas fa-eye"></i> Aperçu — {{ previewData.sequence.name }}</h2>
          <button class="btn ghost" style="padding:5px 10px;font-size:11px" (click)="previewData = null; testResult = null">✕ Fermer</button>
        </div>
        <div class="form-grid">
          <label>User ID pour test réel
            <input type="number" [(ngModel)]="testUserId" placeholder="123" />
          </label>
          <label>Étape à envoyer (index)
            <input type="number" [(ngModel)]="testStepIndex" min="0" [max]="previewData.renderedSteps.length - 1" />
          </label>
        </div>
        <div class="actions">
          <button class="btn primary" (click)="testSend()" [disabled]="sending || !testUserId">
            <i class="fas fa-paper-plane"></i> {{ sending ? '…' : 'Envoyer ce test maintenant' }}
          </button>
        </div>
        <div *ngIf="testResult" style="margin-top:10px;padding:10px;border-radius:8px"
             [style.background]="testResult.outcome?.sent ? '#d1fae5' : '#fee2e2'"
             [style.color]="testResult.outcome?.sent ? '#065f46' : '#991b1b'">
          <strong>{{ testResult.outcome?.sent ? '✓ Envoyé' : '✗ Échec' }}</strong>
          ({{ testResult.outcome?.channel }})
          <span *ngIf="testResult.outcome?.reason">: {{ testResult.outcome.reason }}</span>
        </div>

        <div style="margin-top:14px">
          <h3 style="font-size:13px;margin:0 0 8px;color:#374151">
            Étapes rendues avec :
            {{ previewData.sampleUser.name || previewData.sampleUser.email || ('user #' + previewData.sampleUser.id) }}
          </h3>
          <div class="row-list">
            <div class="row-item" *ngFor="let st of previewData.renderedSteps">
              <div class="grow">
                <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
                  <span class="badge indigo">Étape {{ st.index + 1 }}</span>
                  <span class="badge idle">{{ st.channel }}</span>
                  <span class="small">délai +{{ st.delayHours }}h</span>
                </div>
                <div *ngIf="st.renderedSubject" style="font-weight:600;margin-bottom:4px">{{ st.renderedSubject }}</div>
                <pre class="mono" style="margin:0;white-space:pre-wrap;background:#f9fafb;padding:8px;border-radius:6px;font-size:12px">{{ st.renderedBody }}</pre>
                <div *ngIf="st.actionUrl" class="small">CTA : {{ st.actionUrl }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [ADMIN_PAGE_STYLES]
})
export class AdminLifecycleComponent implements OnInit {
  stats: any = null;
  sequences: any[] = [];
  saving = false;
  processing = false;
  sending = false;
  toast = ''; toastKind: 'ok'|'err' = 'ok';
  form: any = { name: '', trigger_event: 'user.registered', description: '' };
  stepsRaw = '[{"delayHours":0,"channel":"EMAIL","subject":"Bienvenue chez Barsha","body":"Bonjour {{firstName}}, ravi de vous accueillir."}]';
  stepsPlaceholder = '[{"delayHours":0,"channel":"EMAIL","subject":"Bienvenue","body":"Bonjour {{firstName}}..."},{"delayHours":48,"channel":"SMS","body":"-10% pour vous"}]';

  // Preview / test-send state
  previewData: any = null;
  testUserId: number | null = null;
  testStepIndex = 0;
  testResult: any = null;

  constructor(private http: HttpClient) {}
  ngOnInit() { this.loadStats(); this.load(); }

  loadStats() { this.http.get<any>(`${environementDev.api}/api/admin/lifecycle/stats`, { headers: adminAuthHeaders() }).subscribe({ next: r => this.stats = r }); }
  load() { this.http.get<any>(`${environementDev.api}/api/admin/lifecycle/sequences`, { headers: adminAuthHeaders() }).subscribe({ next: r => this.sequences = r.items || [] }); }

  create() {
    let steps: any;
    try { steps = JSON.parse(this.stepsRaw); } catch { this.show('JSON étapes invalide', 'err'); return; }
    if (!Array.isArray(steps) || steps.length === 0) { this.show('Au moins 1 étape requise', 'err'); return; }
    this.saving = true;
    this.http.post(`${environementDev.api}/api/admin/lifecycle/sequences`, { ...this.form, steps, is_active: true }, { headers: adminAuthHeaders() })
      .subscribe({
        next: () => { this.saving = false; this.show('Séquence créée', 'ok'); this.loadStats(); this.load(); },
        error: () => { this.saving = false; this.show('Erreur', 'err'); }
      });
  }

  toggle(s: any) {
    this.http.put(`${environementDev.api}/api/admin/lifecycle/sequences/${s.id}`, { is_active: !s.is_active }, { headers: adminAuthHeaders() })
      .subscribe({ next: () => this.load() });
  }

  remove(s: any) {
    if (!confirm(`Supprimer la séquence "${s.name}" ?`)) return;
    this.http.delete(`${environementDev.api}/api/admin/lifecycle/sequences/${s.id}`, { headers: adminAuthHeaders() })
      .subscribe({ next: () => this.load() });
  }

  processNow() {
    this.processing = true;
    this.http.post<any>(`${environementDev.api}/api/admin/lifecycle/process-due`, { limit: 200 }, { headers: adminAuthHeaders() })
      .subscribe({
        next: r => { this.processing = false; this.show(`${r.sent} envois, ${r.completed} terminés`, 'ok'); this.loadStats(); },
        error: () => { this.processing = false; this.show('Erreur', 'err'); }
      });
  }

  preview(s: any) {
    this.testResult = null;
    this.testStepIndex = 0;
    this.http.post<any>(`${environementDev.api}/api/admin/lifecycle/sequences/${s.id}/preview`, {}, { headers: adminAuthHeaders() })
      .subscribe({
        next: r => { this.previewData = r; setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100); },
        error: () => this.show('Erreur aperçu', 'err')
      });
  }

  testSend() {
    if (!this.previewData?.sequence?.id || !this.testUserId) return;
    this.sending = true;
    this.testResult = null;
    this.http.post<any>(`${environementDev.api}/api/admin/lifecycle/sequences/${this.previewData.sequence.id}/test-send`,
      { userId: Number(this.testUserId), stepIndex: Number(this.testStepIndex) || 0 },
      { headers: adminAuthHeaders() }
    ).subscribe({
      next: r => { this.sending = false; this.testResult = r; },
      error: e => { this.sending = false; this.testResult = { outcome: { sent: false, channel: '?', reason: e?.error?.message || 'erreur réseau' } }; }
    });
  }

  private show(m: string, k: 'ok'|'err') { this.toast = m; this.toastKind = k; setTimeout(() => this.toast = '', 3500); }
}
