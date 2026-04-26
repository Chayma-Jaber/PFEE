import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';
import { ADMIN_PAGE_STYLES, adminAuthHeaders } from '../_shared/admin-page.styles';

@Component({
  selector: 'app-admin-ugc-moderation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <div>
          <h1><i class="fas fa-comments"></i> Modération UGC automatique</h1>
          <p>Score chaque post UGC (NSFW, spam, qualité, image). Pipeline cron toutes les 10 min, queue manuelle pour les cas limites.</p>
        </div>
        <button class="btn gradient" (click)="runPipeline()" [disabled]="running">
          <i class="fas fa-bolt"></i> {{ running ? '…' : 'Lancer pipeline' }}
        </button>
      </div>
      <div class="toast" [class.ok]="toastKind==='ok'" [class.err]="toastKind==='err'" *ngIf="toast">{{ toast }}</div>

      <div class="stats-grid" *ngIf="stats">
        <div class="stat-card"><div class="stat-icon amber"><i class="fas fa-hourglass"></i></div><div><span class="stat-value">{{ stats.pending }}</span><span class="stat-label">En attente</span></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="fas fa-check"></i></div><div><span class="stat-value">{{ stats.approved }}</span><span class="stat-label">Approuvés</span></div></div>
        <div class="stat-card"><div class="stat-icon red"><i class="fas fa-times"></i></div><div><span class="stat-value">{{ stats.rejected }}</span><span class="stat-label">Rejetés</span></div></div>
      </div>

      <div class="card">
        <h2><i class="fas fa-list"></i> Queue de revue manuelle ({{ items.length }})</h2>
        <div class="row-list">
          <div class="row-item" *ngFor="let p of items">
            <div *ngIf="p.image_url"><img [src]="p.image_url" alt="UGC" style="width:80px;height:80px;object-fit:cover;border-radius:8px" /></div>
            <div class="grow">
              <div style="display:flex;gap:6px;margin-bottom:4px">
                <span class="badge" [class.err]="p.moderation?.scores?.overall < 30" [class.warn]="p.moderation?.scores?.overall < 75" [class.ok]="p.moderation?.scores?.overall >= 75">Score {{ p.moderation?.scores?.overall }}/100</span>
                <span class="badge idle">NSFW {{ p.moderation?.scores?.nsfw }}</span>
                <span class="badge idle">Spam {{ p.moderation?.scores?.spam }}</span>
                <span class="badge idle">Qualité {{ p.moderation?.scores?.quality }}</span>
              </div>
              <div class="small">User #{{ p.user_id }}{{ p.product_id ? ' · Produit #' + p.product_id : '' }}</div>
              <div *ngIf="p.caption" style="margin:4px 0;font-size:13px">{{ p.caption }}</div>
              <div class="small" *ngIf="p.moderation?.reasons?.length">Raisons : {{ p.moderation.reasons.join(', ') }}</div>
            </div>
          </div>
          <div class="empty" *ngIf="items.length === 0">Queue vide. Tout a été traité automatiquement ✓</div>
        </div>
      </div>
    </div>
  `,
  styles: [ADMIN_PAGE_STYLES]
})
export class AdminUgcModerationComponent implements OnInit {
  stats: any = null;
  items: any[] = [];
  running = false;
  toast = ''; toastKind: 'ok'|'err' = 'ok';

  constructor(private http: HttpClient) {}
  ngOnInit() { this.loadStats(); this.load(); }

  loadStats() { this.http.get<any>(`${environementDev.api}/api/admin/ugc-moderation/stats`, { headers: adminAuthHeaders() }).subscribe({ next: r => this.stats = r }); }
  load() { this.http.get<any>(`${environementDev.api}/api/admin/ugc-moderation/queue?limit=50`, { headers: adminAuthHeaders() }).subscribe({ next: r => this.items = r.items || [] }); }

  runPipeline() {
    this.running = true;
    this.http.post<any>(`${environementDev.api}/api/admin/ugc-moderation/run-pipeline`, { limit: 200 }, { headers: adminAuthHeaders() })
      .subscribe({
        next: r => { this.running = false; this.show(`${r.processed} traités · ${r.autoApproved} approuvés · ${r.autoRejected} rejetés · ${r.needsReview} à revoir`, 'ok'); this.loadStats(); this.load(); },
        error: () => { this.running = false; this.show('Erreur', 'err'); }
      });
  }

  private show(m: string, k: 'ok'|'err') { this.toast = m; this.toastKind = k; setTimeout(() => this.toast = '', 4500); }
}
