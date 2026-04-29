import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';
import { AdminModuleContextComponent } from '../_shared/admin-module-context.component';
import { ADMIN_PAGE_STYLES, adminAuthHeaders } from '../_shared/admin-page.styles';

// Combined dashboard for the platform plumbing — events bus + observability snapshot.
@Component({
  selector: 'app-admin-platform',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminModuleContextComponent],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <div>
          <h1><i class="fas fa-server"></i> Platform — events &amp; observability</h1>
          <p>Bus d'événements de domaine + métriques HTTP + erreurs récentes. Auto-refresh toutes les 30s.</p>
        </div>
      </div>

      <app-admin-module-context moduleKey="platform" />

      <div class="stats-grid" *ngIf="snap">
        <div class="stat-card"><div class="stat-icon indigo"><i class="fas fa-stopwatch"></i></div><div><span class="stat-value">{{ snap.uptimeSec }}s</span><span class="stat-label">Uptime</span></div></div>
        <div class="stat-card"><div class="stat-icon green"><i class="fas fa-arrow-down"></i></div><div><span class="stat-value">{{ snap.counters?.http_requests_total || 0 }}</span><span class="stat-label">HTTP requests</span></div></div>
        <div class="stat-card"><div class="stat-icon red"><i class="fas fa-exclamation"></i></div><div><span class="stat-value">{{ snap.counters?.errors_total || 0 }}</span><span class="stat-label">Errors</span></div></div>
        <div class="stat-card"><div class="stat-icon amber"><i class="fas fa-bug"></i></div><div><span class="stat-value">{{ snap.counters?.http_5xx_total || 0 }}</span><span class="stat-label">HTTP 5xx</span></div></div>
        <div class="stat-card"><div class="stat-icon teal"><i class="fas fa-broadcast-tower"></i></div><div><span class="stat-value">{{ eventsStats?.last24h || 0 }}</span><span class="stat-label">Events 24h</span></div></div>
      </div>

      <div class="layout two-col">
        <div class="card">
          <h2><i class="fas fa-tachometer-alt"></i> Latences par route (p95)</h2>
          <table *ngIf="routes.length > 0">
            <thead><tr><th>Route</th><th>Calls</th><th>p50</th><th>p95</th><th>p99</th></tr></thead>
            <tbody>
              <tr *ngFor="let r of routes">
                <td class="mono small">{{ r.route }}</td>
                <td>{{ r.h.count }}</td>
                <td>{{ r.h.p50 }}ms</td>
                <td><strong>{{ r.h.p95 }}ms</strong></td>
                <td>{{ r.h.p99 }}ms</td>
              </tr>
            </tbody>
          </table>
          <div class="empty" *ngIf="routes.length === 0">Aucune métrique encore (faites quelques requêtes).</div>

          <h2 style="margin-top:18px"><i class="fas fa-exclamation-triangle"></i> Dernières erreurs</h2>
          <div class="row-list">
            <div class="row-item" *ngFor="let e of (snap?.recentErrors || [])">
              <div class="grow">
                <strong style="color:#dc2626">{{ e.message }}</strong>
                <div class="small">{{ formatDate(e.at) }} · {{ e.context?.method }} {{ e.context?.route }} · ID {{ e.correlationId?.slice(0,8) }}</div>
              </div>
            </div>
            <div class="empty" *ngIf="!snap?.recentErrors?.length">Aucune erreur récente ✓</div>
          </div>
        </div>

        <div class="card">
          <h2><i class="fas fa-broadcast-tower"></i> Événements de domaine</h2>
          <div *ngIf="eventsStats">
            <h3 style="font-size:13px;margin:6px 0">Top types (24h)</h3>
            <table>
              <tr *ngFor="let t of eventsStats.byType24h">
                <td>{{ t.type }}</td>
                <td style="text-align:right"><strong>{{ t.count }}</strong></td>
              </tr>
            </table>
          </div>

          <h3 style="font-size:13px;margin:14px 0 6px">Derniers événements</h3>
          <div class="row-list">
            <div class="row-item" *ngFor="let ev of recentEvents">
              <div class="grow">
                <div style="display:flex;gap:6px;align-items:center">
                  <span class="badge indigo">{{ ev.type }}</span>
                  <span *ngIf="ev.aggregate_id" class="mono small">{{ ev.aggregate_id }}</span>
                  <span class="small">{{ formatDate(ev.occurred_at) }}</span>
                </div>
                <pre class="mono" style="margin:4px 0 0;white-space:pre-wrap;font-size:11px">{{ ev.payload | json }}</pre>
              </div>
            </div>
            <div class="empty" *ngIf="recentEvents.length === 0">Aucun événement.</div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [ADMIN_PAGE_STYLES]
})
export class AdminPlatformComponent implements OnInit, OnDestroy {
  snap: any = null;
  routes: any[] = [];
  eventsStats: any = null;
  recentEvents: any[] = [];
  private timer: any = null;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.refresh();
    this.timer = setInterval(() => this.refresh(), 30000);
  }
  ngOnDestroy() { if (this.timer) clearInterval(this.timer); }

  refresh() {
    this.http.get<any>(`${environementDev.api}/api/admin/observability/snapshot`, { headers: adminAuthHeaders() })
      .subscribe({
        next: r => {
          this.snap = r;
          this.routes = Object.entries(r?.routes || {}).map(([route, h]: [string, any]) => ({ route, h })).sort((a, b) => b.h.p95 - a.h.p95).slice(0, 20);
        }
      });
    this.http.get<any>(`${environementDev.api}/api/admin/events/stats`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.eventsStats = r });
    this.http.get<any>(`${environementDev.api}/api/admin/events/recent?limit=30`, { headers: adminAuthHeaders() })
      .subscribe({ next: r => this.recentEvents = r.items || [] });
  }

  formatDate(d: string) { return d ? new Date(d).toLocaleTimeString('fr-FR') : ''; }
}
