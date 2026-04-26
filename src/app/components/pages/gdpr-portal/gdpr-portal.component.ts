import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';

@Component({
  selector: 'app-gdpr-portal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="gdpr-page">
      <h1><i class="fas fa-user-shield"></i> Mes données personnelles</h1>
      <p class="muted">Sous le RGPD et la loi tunisienne, vous avez le droit de consulter, exporter, et demander l'effacement de vos données personnelles.</p>

      <div *ngIf="toast" class="toast" [class.ok]="toastKind==='ok'" [class.err]="toastKind==='err'">{{ toast }}</div>

      <div class="actions-grid">
        <div class="action-card">
          <i class="fas fa-download"></i>
          <h3>Exporter mes données</h3>
          <p>Recevez un fichier JSON contenant l'ensemble de vos données : profil, commandes, notifications.</p>
          <button class="btn primary" (click)="fileRequest('EXPORT')">Demander un export</button>
        </div>
        <div class="action-card">
          <i class="fas fa-eraser"></i>
          <h3>Effacer mon compte</h3>
          <p>Vos informations personnelles seront anonymisées. L'historique de commandes est conservé 10 ans (obligation fiscale).</p>
          <button class="btn danger" (click)="fileRequest('ERASURE')">Demander l'effacement</button>
        </div>
        <div class="action-card">
          <i class="fas fa-edit"></i>
          <h3>Rectifier mes données</h3>
          <p>Demandez une correction si vos informations sont erronées (nom, adresse…).</p>
          <button class="btn ghost" (click)="fileRequest('RECTIFICATION')">Demander une rectification</button>
        </div>
      </div>

      <h2 style="margin-top:30px"><i class="fas fa-history"></i> Mes demandes</h2>
      <div *ngIf="loading" class="loading">Chargement…</div>
      <div *ngIf="!loading && items.length === 0" class="empty">Aucune demande pour l'instant.</div>
      <div class="req-list" *ngIf="!loading && items.length > 0">
        <div class="req-item" *ngFor="let r of items">
          <div>
            <strong>{{ typeLabel(r.type) }}</strong>
            <span class="badge"
              [class.ok]="r.status==='COMPLETED'"
              [class.warn]="r.status==='IN_PROGRESS' || r.status==='RECEIVED'"
              [class.err]="r.status==='REJECTED'">
              {{ statusLabel(r.status) }}
            </span>
            <div class="muted small">Demandée le {{ formatDate(r.created_at) }}</div>
            <div class="muted small" *ngIf="r.completed_at">Terminée le {{ formatDate(r.completed_at) }}</div>
          </div>
          <button *ngIf="r.type==='EXPORT' && r.status==='COMPLETED' && r.export_payload"
            class="btn primary small" (click)="downloadExport(r)">
            <i class="fas fa-download"></i> Télécharger
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .gdpr-page { max-width: 1000px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 26px; font-weight: 600; color: #111827; margin: 0 0 6px; }
    h1 i { color: #6366f1; margin-right: 8px; }
    h2 { font-size: 17px; color: #111827; margin: 0 0 14px; }
    .muted { color: #6b7280; }
    .small { font-size: 12px; }
    .toast { padding: 11px 14px; border-radius: 8px; margin: 14px 0; font-size: 13px; }
    .toast.ok { background: #d1fae5; color: #065f46; }
    .toast.err { background: #fee2e2; color: #991b1b; }
    .actions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-top: 20px; }
    .action-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 22px; }
    .action-card i { font-size: 28px; color: #6366f1; margin-bottom: 12px; display: inline-block; }
    .action-card h3 { margin: 0 0 8px; color: #111827; font-size: 15px; }
    .action-card p { color: #6b7280; font-size: 13px; line-height: 1.5; min-height: 60px; }
    .btn { padding: 9px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; border: 1px solid; }
    .btn.primary { background: linear-gradient(135deg,#6366f1,#ec4899); color: #fff; border-color: transparent; }
    .btn.danger { background: transparent; color: #dc2626; border-color: #fca5a5; }
    .btn.ghost { background: transparent; color: #4b5563; border-color: #d1d5db; }
    .btn.small { padding: 6px 10px; font-size: 12px; }
    .loading, .empty { text-align: center; padding: 30px; color: #6b7280; font-size: 13px; }
    .req-list { display: flex; flex-direction: column; gap: 8px; }
    .req-item { padding: 13px 16px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; }
    .req-item strong { font-size: 14px; color: #111827; margin-right: 8px; }
    .badge { font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 9px; }
    .badge.ok { background: #d1fae5; color: #065f46; }
    .badge.warn { background: #fef3c7; color: #92400e; }
    .badge.err { background: #fee2e2; color: #991b1b; }
  `]
})
export class GdprPortalComponent implements OnInit {
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
    this.http.get<any>(`${environementDev.api}/api/storefront/gdpr/requests/mine`, { headers: this.headers() })
      .subscribe({
        next: r => { this.items = r.items || []; this.loading = false; },
        error: () => { this.items = []; this.loading = false; }
      });
  }

  fileRequest(type: 'EXPORT'|'ERASURE'|'RECTIFICATION') {
    if (type === 'ERASURE' && !confirm('Vous êtes sur le point de demander l\'effacement définitif de vos données personnelles. Continuer ?')) return;
    const reason = type === 'RECTIFICATION' ? prompt('Que faut-il rectifier ?') : null;
    this.http.post<any>(`${environementDev.api}/api/storefront/gdpr/requests`,
      { type, reason: reason || undefined },
      { headers: this.headers() }
    ).subscribe({
      next: () => { this.show('Demande enregistrée. Notre équipe vous contactera sous 30 jours.', 'ok'); this.load(); },
      error: e => this.show(e?.error?.message || 'Erreur', 'err')
    });
  }

  downloadExport(r: any) {
    const blob = new Blob([JSON.stringify(r.export_payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `barsha-export-${r.id}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  typeLabel(t: string) { return ({ EXPORT: 'Export de données', ERASURE: 'Effacement', RECTIFICATION: 'Rectification' } as any)[t] || t; }
  statusLabel(s: string) { return ({ RECEIVED: 'Reçue', IN_PROGRESS: 'En cours', COMPLETED: 'Terminée', REJECTED: 'Rejetée' } as any)[s] || s; }
  formatDate(d: string) { return d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' }) : ''; }
  private show(m: string, k: 'ok'|'err') { this.toast = m; this.toastKind = k; setTimeout(() => this.toast = '', 5000); }
}
