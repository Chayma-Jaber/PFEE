import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';

@Component({
  selector: 'app-referral-share',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button class="ref-btn" (click)="share()" [title]="hint">
      <i class="fas fa-gift"></i>
      <span>Inviter un ami</span>
    </button>
    <div class="ref-result" *ngIf="shareUrl">
      <strong>🎁 Votre code de parrainage :</strong>
      <div class="ref-box">
        <code>{{ code }}</code>
        <button class="copy" (click)="copy()">{{ copied ? '✓ Copié' : 'Copier' }}</button>
      </div>
      <p class="hint-p">Partagez ce lien. Votre filleul bénéficie d'une réduction et vous gagnez des points.</p>
    </div>
  `,
  styles: [`
    .ref-btn { background: linear-gradient(135deg, #fbbf24, #ec4899); color: #fff; border: none; padding: 10px 18px; border-radius: 24px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; margin: 12px 0; }
    .ref-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(236,72,153,.25); }
    .ref-result { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 10px; padding: 12px 14px; margin-top: 10px; }
    .ref-box { display: flex; align-items: center; gap: 10px; margin: 6px 0; }
    .ref-box code { background: #fff; padding: 6px 14px; border-radius: 8px; font-weight: 700; color: #92400e; letter-spacing: 2px; font-size: 15px; }
    .copy { background: #111; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; }
    .hint-p { font-size: 12px; color: #92400e; margin: 4px 0 0; }
  `]
})
export class ReferralShareComponent {
  @Input() productId?: number;
  code = '';
  shareUrl = '';
  copied = false;
  hint = 'Partagez ce produit et obtenez une récompense';

  constructor(private http: HttpClient) {}

  share() {
    const token = localStorage.getItem('jwt');
    if (!token) { alert('Connectez-vous pour inviter un ami'); return; }
    this.http.post<any>(`${environementDev.api}/api/storefront/w4/referral/share`,
      { productId: this.productId },
      { headers: { Authorization: `Bearer ${token}` } }
    ).subscribe({
      next: (r) => { this.code = r.code; this.shareUrl = window.location.origin + '/r/' + r.code; },
      error: () => {}
    });
  }

  copy() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(this.shareUrl);
      this.copied = true;
      setTimeout(() => this.copied = false, 2000);
    }
  }
}
