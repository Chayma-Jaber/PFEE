import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';

@Component({
  selector: 'app-ugc-strip',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ugc-strip" *ngIf="posts.length > 0 || canPost">
      <div class="us-head">
        <h3>📸 Portez-le comme eux</h3>
        <button *ngIf="canPost" class="share-btn" (click)="showUpload = !showUpload">
          <i class="fas fa-camera"></i> Partager mon look
        </button>
      </div>

      <div class="upload-form" *ngIf="showUpload">
        <input type="text" [(ngModel)]="uploadUrl" placeholder="Lien de votre photo (URL)" />
        <input type="text" [(ngModel)]="uploadCaption" placeholder="Légende (optionnel)" />
        <button class="submit" (click)="submitUgc()" [disabled]="submitting">
          {{ submitting ? 'Envoi...' : 'Publier (sera modéré)' }}
        </button>
        <div class="ok-note" *ngIf="submitMsg">✓ {{ submitMsg }}</div>
      </div>

      <div class="ugc-grid" *ngIf="posts.length > 0">
        <div class="ugc-card" *ngFor="let p of posts">
          <img [src]="p.image_url" />
          <div class="ugc-overlay">
            <p *ngIf="p.caption">{{ p.caption }}</p>
            <button class="like" (click)="like(p)"><i class="fas fa-heart"></i> {{ p.likes_count }}</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ugc-strip { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 20px; margin: 24px 0; }
    .us-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
    .us-head h3 { margin: 0; font-size: 17px; color: #111827; }
    .share-btn { background: linear-gradient(135deg, #6366f1, #ec4899); color: #fff; border: none; padding: 8px 16px; border-radius: 20px; font-weight: 600; cursor: pointer; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; }
    .upload-form { background: #f9fafb; padding: 12px; border-radius: 10px; margin-bottom: 14px; }
    .upload-form input { width: 100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; margin-bottom: 8px; font-size: 13px; }
    .upload-form .submit { background: #111; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; }
    .ok-note { color: #10b981; font-size: 13px; margin-top: 6px; }
    .ugc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
    .ugc-card { position: relative; aspect-ratio: 1; border-radius: 10px; overflow: hidden; cursor: pointer; }
    .ugc-card img { width: 100%; height: 100%; object-fit: cover; transition: transform .3s; }
    .ugc-card:hover img { transform: scale(1.05); }
    .ugc-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; padding: 10px; background: linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.7) 100%); color: #fff; opacity: 0; transition: opacity .2s; }
    .ugc-card:hover .ugc-overlay { opacity: 1; }
    .ugc-overlay p { font-size: 12px; margin: 0 0 6px; }
    .like { background: rgba(255,255,255,0.2); color: #fff; border: none; padding: 4px 10px; border-radius: 10px; font-size: 11px; cursor: pointer; }
  `]
})
export class UgcStripComponent implements OnChanges {
  @Input() productId?: number;
  posts: any[] = [];
  showUpload = false;
  uploadUrl = '';
  uploadCaption = '';
  submitting = false;
  submitMsg = '';

  constructor(private http: HttpClient) {}

  get canPost(): boolean { return !!localStorage.getItem('jwt'); }

  ngOnChanges(ch: SimpleChanges) {
    if (!this.productId) return;
    this.http.get<any>(`${environementDev.api}/api/storefront/w4/ugc/feed?productId=${this.productId}&limit=8`)
      .subscribe({ next: (r) => this.posts = r.items || [], error: () => this.posts = [] });
  }

  submitUgc() {
    if (!this.uploadUrl) return;
    const token = localStorage.getItem('jwt');
    if (!token) return;
    this.submitting = true;
    this.http.post(`${environementDev.api}/api/storefront/w4/ugc`,
      { imageUrl: this.uploadUrl, caption: this.uploadCaption, productId: this.productId },
      { headers: { Authorization: `Bearer ${token}` } }
    ).subscribe({
      next: () => {
        this.submitMsg = 'Votre photo a été soumise. Elle apparaîtra après modération.';
        this.uploadUrl = ''; this.uploadCaption = ''; this.submitting = false;
        setTimeout(() => { this.submitMsg = ''; this.showUpload = false; }, 3500);
      },
      error: () => { this.submitMsg = 'Erreur lors de l\'envoi'; this.submitting = false; }
    });
  }

  like(p: any) {
    this.http.post(`${environementDev.api}/api/storefront/w4/ugc/${p.id}/like`, {}).subscribe({
      next: (r: any) => p.likes_count = r.likes,
      error: () => {}
    });
  }
}
