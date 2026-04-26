import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';

interface TierProgress {
  tier: string;
  lifetimePoints: number;
  availablePoints: number;
  nextTier: string | null;
  pointsToNext: number;
  progressPct: number;
  nextUnlocks: string[];
}

/**
 * Wave 3 — Loyalty tier progress widget.
 * Calls /storefront/w3/loyalty/progress for the logged-in user.
 */
@Component({
  selector: 'app-tier-progress-widget',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tier-widget" *ngIf="data">
      <div class="tw-head">
        <div class="tier-badge" [ngClass]="'tier-' + data.tier.toLowerCase()">
          <span class="tier-icon">{{ tierIcon(data.tier) }}</span>
          <span class="tier-label">{{ data.tier }}</span>
        </div>
        <div class="tw-points">
          <div class="points-available"><strong>{{ data.availablePoints }}</strong> points à utiliser</div>
          <div class="points-lifetime">{{ data.lifetimePoints }} points cumulés</div>
        </div>
      </div>

      <div class="tw-progress" *ngIf="data.nextTier">
        <div class="progress-labels">
          <span class="current">{{ data.tier }}</span>
          <span class="next">→ {{ data.nextTier }}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" [style.width.%]="data.progressPct"></div>
          <span class="progress-value">{{ data.progressPct }}%</span>
        </div>
        <div class="to-next">
          <i class="fas fa-trophy"></i>
          Plus que <strong>{{ data.pointsToNext }}</strong> points pour débloquer <strong>{{ data.nextTier }}</strong>
        </div>
      </div>

      <div class="tw-max" *ngIf="!data.nextTier">
        <i class="fas fa-crown"></i>
        <strong>Vous êtes au plus haut niveau !</strong>
        <p>Continuez à bénéficier de vos avantages premium.</p>
      </div>

      <div class="tw-unlocks" *ngIf="data.nextUnlocks?.length">
        <h4>🎁 Débloquez au niveau {{ data.nextTier }}:</h4>
        <div class="unlocks-list">
          <span *ngFor="let u of data.nextUnlocks" class="unlock-chip">{{ u }}</span>
        </div>
      </div>
    </div>

    <div class="tier-empty" *ngIf="loadedOnce && !data">
      <p>Connectez-vous pour voir votre progression fidélité.</p>
    </div>
  `,
  styles: [`
    .tier-widget {
      background: linear-gradient(135deg, #1a1a2e 0%, #4338ca 100%);
      color: #fff;
      border-radius: 20px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 10px 30px rgba(67, 56, 202, 0.25);
    }
    .tw-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .tier-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: rgba(255, 255, 255, 0.15);
      padding: 10px 20px;
      border-radius: 30px;
      backdrop-filter: blur(10px);
    }
    .tier-badge.tier-bronze { background: linear-gradient(135deg, #cd7f32, #a0522d); }
    .tier-badge.tier-silver { background: linear-gradient(135deg, #c0c0c0, #808080); }
    .tier-badge.tier-gold { background: linear-gradient(135deg, #ffd700, #daa520); }
    .tier-badge.tier-platinum { background: linear-gradient(135deg, #e5e4e2, #b3b2b0); color: #1a1a2e; }
    .tier-icon { font-size: 22px; }
    .tier-label { font-weight: 700; font-size: 15px; letter-spacing: 1px; }
    .tw-points { text-align: right; }
    .points-available { font-size: 18px; color: #fff; }
    .points-available strong { font-size: 24px; color: #fbbf24; }
    .points-lifetime { font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 4px; }

    .tw-progress { margin-bottom: 18px; }
    .progress-labels {
      display: flex; justify-content: space-between;
      font-size: 13px; margin-bottom: 6px; color: rgba(255,255,255,0.85);
    }
    .progress-labels .current { font-weight: 600; }
    .progress-labels .next { color: #fbbf24; font-weight: 600; }
    .progress-track {
      position: relative; height: 14px;
      background: rgba(255,255,255,0.15); border-radius: 7px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981, #fbbf24);
      border-radius: 7px;
      transition: width 1.2s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .progress-value {
      position: absolute; right: 10px; top: -2px;
      font-size: 11px; font-weight: 700;
      line-height: 14px; color: #1a1a2e;
    }
    .to-next {
      margin-top: 10px; font-size: 13px;
      color: rgba(255,255,255,0.9);
    }
    .to-next i { color: #fbbf24; margin-right: 6px; }

    .tw-max { text-align: center; padding: 10px 0; }
    .tw-max i { font-size: 36px; color: #fbbf24; margin-bottom: 8px; }
    .tw-max p { font-size: 13px; color: rgba(255,255,255,0.8); margin: 6px 0 0; }

    .tw-unlocks h4 {
      font-size: 13px; color: rgba(255,255,255,0.85); margin: 16px 0 10px;
    }
    .unlocks-list {
      display: flex; flex-wrap: wrap; gap: 6px;
    }
    .unlock-chip {
      background: rgba(255,255,255,0.15);
      padding: 6px 12px; border-radius: 16px;
      font-size: 12px; backdrop-filter: blur(10px);
    }

    .tier-empty {
      padding: 20px; text-align: center; color: #6b7280;
      background: #f9fafb; border-radius: 12px;
    }
  `]
})
export class TierProgressWidgetComponent implements OnInit {
  data: TierProgress | null = null;
  loadedOnce = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    const token = localStorage.getItem('jwt') || localStorage.getItem('admin_jwt');
    if (!token) { this.loadedOnce = true; return; }
    this.http.get<TierProgress>(
      `${environementDev.api}/api/storefront/w3/loyalty/progress`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).subscribe({
      next: (r) => { this.data = r; this.loadedOnce = true; },
      error: () => { this.loadedOnce = true; }
    });
  }

  tierIcon(t: string): string {
    return { BRONZE: '🥉', SILVER: '🥈', GOLD: '🥇', PLATINUM: '👑' }[t] || '🎖️';
  }
}
