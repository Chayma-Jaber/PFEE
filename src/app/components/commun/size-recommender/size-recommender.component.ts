import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';
import { ProductService } from '../../../services/product.service';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

interface SizeRecommendation {
  recommendedSize: string | null;
  confidence: number;
  alternatives: Array<{ size: string; confidence: number }>;
  reason: string;
  usedMeasurements: string[];
  fallback: boolean;
}

interface SizeProfile {
  id?: number;
  height: number | null;
  weight: number | null;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  shoulder_width: number | null;
  inseam: number | null;
  shoe_size_eu: number | null;
  fit_preference: 'TIGHT' | 'REGULAR' | 'LOOSE';
  usual_size_top: string | null;
  usual_size_bottom: string | null;
}

@Component({
  selector: 'app-size-recommender',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="size-reco" *ngIf="productId">
      <div *ngIf="!jwt" class="hint muted">
        <i class="fas fa-ruler"></i> Connectez-vous pour obtenir une recommandation de taille personnalisée.
      </div>

      <div *ngIf="jwt && reco && !showWizard" class="reco-chip" [class.low-conf]="reco.confidence < 0.5">
        <i class="fas fa-magic"></i>
        <div class="reco-body">
          <strong *ngIf="reco.recommendedSize">Votre taille : {{ reco.recommendedSize }}</strong>
          <strong *ngIf="!reco.recommendedSize">Complétez votre profil</strong>
          <small>{{ reco.reason }}</small>
          <div class="alts" *ngIf="reco.alternatives?.length">
            Autres tailles proches :
            <span *ngFor="let a of reco.alternatives" class="alt">{{ a.size }}</span>
          </div>
          <div class="confidence" *ngIf="reco.recommendedSize">
            <div class="bar"><div class="fill" [style.width.%]="reco.confidence * 100"></div></div>
            <span>{{ (reco.confidence * 100).toFixed(0) }}% fiabilité</span>
          </div>
        </div>
        <button class="btn-edit" (click)="openWizard()"><i class="fas fa-edit"></i></button>
      </div>

      <div *ngIf="jwt && showWizard" class="wizard">
        <h4><i class="fas fa-ruler-combined"></i> Votre profil de mensurations</h4>
        <div class="grid">
          <label>Taille (cm) <input type="number" [(ngModel)]="form.height" min="100" max="220" /></label>
          <label>Poids (kg) <input type="number" [(ngModel)]="form.weight" min="30" max="200" /></label>
          <label>Tour de poitrine <input type="number" [(ngModel)]="form.chest" min="60" max="160" /></label>
          <label>Tour de taille <input type="number" [(ngModel)]="form.waist" min="50" max="160" /></label>
          <label>Tour de hanches <input type="number" [(ngModel)]="form.hips" min="60" max="160" /></label>
          <label>Entrejambe (inseam) <input type="number" [(ngModel)]="form.inseam" min="50" max="100" /></label>
          <label>Pointure EU <input type="number" [(ngModel)]="form.shoe_size_eu" min="30" max="50" step="0.5" /></label>
          <label>Préférence
            <select [(ngModel)]="form.fit_preference">
              <option value="TIGHT">Ajusté près du corps</option>
              <option value="REGULAR">Coupe standard</option>
              <option value="LOOSE">Ample</option>
            </select>
          </label>
        </div>
        <div class="actions">
          <button class="btn-save" (click)="save()" [disabled]="saving">
            <i class="fas fa-save"></i> {{ saving ? 'Enregistrement...' : 'Enregistrer & recalculer' }}
          </button>
          <button class="btn-cancel" (click)="showWizard = false">Annuler</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .size-reco { margin: 12px 0; }
    .hint.muted { color: #6b7280; font-size: 13px; padding: 8px 12px; background: #f9fafb; border-radius: 8px; }
    .hint.muted i { margin-right: 6px; color: #6366f1; }
    .reco-chip { display: flex; gap: 12px; padding: 12px 14px; background: linear-gradient(135deg, #eef2ff, #fce7f3); border: 1px solid #c7d2fe; border-radius: 10px; align-items: flex-start; }
    .reco-chip.low-conf { background: linear-gradient(135deg, #fffbeb, #fef3c7); border-color: #fde68a; }
    .reco-chip > i { color: #6366f1; font-size: 18px; margin-top: 2px; }
    .reco-body { flex: 1; }
    .reco-body strong { display: block; font-size: 14px; color: #111827; margin-bottom: 2px; }
    .reco-body small { font-size: 12px; color: #6b7280; line-height: 1.4; }
    .alts { margin-top: 6px; font-size: 12px; color: #6b7280; }
    .alts .alt { display: inline-block; background: #fff; border: 1px solid #e5e7eb; padding: 1px 8px; border-radius: 8px; margin-left: 4px; font-weight: 600; color: #4f46e5; }
    .confidence { display: flex; gap: 8px; align-items: center; margin-top: 6px; }
    .bar { flex: 1; height: 4px; background: #e5e7eb; border-radius: 2px; overflow: hidden; max-width: 120px; }
    .fill { height: 100%; background: linear-gradient(90deg, #6366f1, #ec4899); transition: width .3s; }
    .confidence span { font-size: 11px; color: #6b7280; }
    .btn-edit { background: transparent; border: 1px solid #d1d5db; padding: 4px 10px; border-radius: 6px; cursor: pointer; color: #6366f1; height: fit-content; }
    .wizard { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; }
    .wizard h4 { margin: 0 0 12px; font-size: 14px; color: #111827; }
    .wizard h4 i { color: #6366f1; margin-right: 6px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .grid label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #6b7280; }
    .grid input, .grid select { padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }
    .actions { margin-top: 12px; display: flex; gap: 8px; }
    .btn-save { padding: 8px 14px; background: #111; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
    .btn-cancel { background: transparent; border: 1px solid #d1d5db; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; }
  `]
})
export class SizeRecommenderComponent implements OnChanges {
  @Input() productId!: number;
  private readonly localProfileKey = 'size_profile_local';

  reco: SizeRecommendation | null = null;
  showWizard = false;
  saving = false;

  form: SizeProfile = {
    height: null, weight: null, chest: null, waist: null, hips: null,
    shoulder_width: null, inseam: null, shoe_size_eu: null,
    fit_preference: 'REGULAR', usual_size_top: null, usual_size_bottom: null,
  };

  get jwt(): boolean { return !!localStorage.getItem('jwt'); }

  constructor(
    private http: HttpClient,
    private productService: ProductService
  ) {}

  ngOnChanges(ch: SimpleChanges) {
    if (ch['productId'] && this.productId && this.jwt) {
      this.loadProfile();
      this.loadReco();
    }
  }

  private authHeaders(): Record<string, string> {
    const t = localStorage.getItem('jwt');
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  loadProfile() {
    if ((environementDev as any).useLocalAuth) {
      this.loadLocalProfile();
      return;
    }

    this.http.get<{ profile: SizeProfile | null }>(
      `${environementDev.api}/api/storefront/sizing/profile`,
      { headers: this.authHeaders() }
    ).subscribe({
      next: (r) => { if (r?.profile) this.form = { ...this.form, ...r.profile }; },
      error: () => {}
    });
  }

  loadReco() {
    if ((environementDev as any).useLocalAuth) {
      this.loadLocalRecommendation();
      return;
    }

    this.http.get<SizeRecommendation>(
      `${environementDev.api}/api/storefront/sizing/recommend/${this.productId}`,
      { headers: this.authHeaders() }
    ).subscribe({
      next: (r) => this.reco = r,
      error: () => this.reco = null
    });
  }

  openWizard() { this.showWizard = true; }

  save() {
    if ((environementDev as any).useLocalAuth) {
      this.saving = true;
      localStorage.setItem(this.localProfileKey, JSON.stringify(this.form));
      this.saving = false;
      this.showWizard = false;
      this.loadLocalRecommendation();
      return;
    }

    this.saving = true;
    this.http.put<{ profile: SizeProfile }>(
      `${environementDev.api}/api/storefront/sizing/profile`,
      this.form,
      { headers: this.authHeaders() }
    ).subscribe({
      next: () => { this.saving = false; this.showWizard = false; this.loadReco(); },
      error: () => { this.saving = false; }
    });
  }

  private loadLocalProfile(): void {
    try {
      const raw = localStorage.getItem(this.localProfileKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      this.form = { ...this.form, ...parsed };
    } catch {
      // Ignore malformed local profile and keep defaults.
    }
  }

  private loadLocalRecommendation(): void {
    this.productService.getProductById(this.productId).pipe(
      catchError(() => of(null))
    ).subscribe((product: any) => {
      if (!product) {
        this.reco = null;
        return;
      }

      const famille = String(product?.Famille || '').toLowerCase();
      const isBottom =
        famille.includes('pantalon') ||
        famille.includes('jean') ||
        famille.includes('short') ||
        famille.includes('jupe') ||
        famille.includes('bas');

      const recommendedSize = isBottom
        ? this.form.usual_size_bottom
        : this.form.usual_size_top;

      this.reco = {
        recommendedSize: recommendedSize || null,
        confidence: recommendedSize ? 0.55 : 0.15,
        alternatives: [],
        reason: recommendedSize
          ? 'Recommandation basee sur votre taille habituelle en mode local'
          : 'Renseignez votre taille habituelle pour obtenir une recommandation locale',
        usedMeasurements: recommendedSize ? ['usual_size'] : [],
        fallback: true
      };
    });
  }
}
