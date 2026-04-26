import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';

/**
 * Wave 2 Style Quiz modal — captures persona, sizes, colors, budget.
 * Posts to /api/storefront/style-profile for logged-in users.
 */
@Component({
  selector: 'app-style-quiz-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="overlay" *ngIf="open" (click)="close()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-head">
          <h2>✨ Découvrez votre style Barsha</h2>
          <button class="x" (click)="close()"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div class="step">
            <label>Quel est votre style ?</label>
            <div class="chips">
              <button *ngFor="let s of styles" class="chip" [class.on]="form.style === s.value" (click)="form.style = s.value">{{ s.label }}</button>
            </div>
          </div>
          <div class="step">
            <label>Taille haut</label>
            <div class="chips">
              <button *ngFor="let s of sizes" class="chip" [class.on]="form.sizeTop === s" (click)="form.sizeTop = s">{{ s }}</button>
            </div>
          </div>
          <div class="step">
            <label>Taille bas</label>
            <div class="chips">
              <button *ngFor="let s of sizes" class="chip" [class.on]="form.sizeBottom === s" (click)="form.sizeBottom = s">{{ s }}</button>
            </div>
          </div>
          <div class="step">
            <label>Budget</label>
            <div class="chips">
              <button class="chip" [class.on]="form.budgetRange === 'economy'" (click)="form.budgetRange = 'economy'">Économique</button>
              <button class="chip" [class.on]="form.budgetRange === 'mid'" (click)="form.budgetRange = 'mid'">Moyen</button>
              <button class="chip" [class.on]="form.budgetRange === 'premium'" (click)="form.budgetRange = 'premium'">Premium</button>
              <button class="chip" [class.on]="form.budgetRange === 'luxury'" (click)="form.budgetRange = 'luxury'">Luxe</button>
            </div>
          </div>
          <div class="step">
            <label>Couleurs préférées (3 max)</label>
            <div class="chips">
              <button *ngFor="let c of colors" class="chip color" [class.on]="form.preferredColors.includes(c)" [style.background]="c === 'white' ? '#f3f4f6' : c" (click)="toggleColor(c)">{{ c }}</button>
            </div>
          </div>
          <div class="ok-line" *ngIf="okMsg">✓ {{ okMsg }}</div>
        </div>
        <div class="modal-foot">
          <button class="btn-skip" (click)="close()">Plus tard</button>
          <button class="btn-save" (click)="save()" [disabled]="saving">{{ saving ? 'Enregistrement...' : 'Enregistrer mon style' }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px; }
    .modal { background: #fff; border-radius: 16px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
    .modal-head { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid #f0f0f0; }
    .modal-head h2 { margin: 0; font-size: 20px; color: #111827; }
    .x { background: none; border: none; font-size: 18px; color: #6b7280; cursor: pointer; }
    .modal-body { padding: 20px 24px; }
    .step { margin-bottom: 18px; }
    .step label { display: block; font-weight: 600; color: #374151; margin-bottom: 8px; font-size: 14px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { background: #f3f4f6; border: 2px solid transparent; padding: 8px 14px; border-radius: 20px; cursor: pointer; font-size: 13px; color: #374151; }
    .chip.on { border-color: #6366f1; background: #eef2ff; color: #4338ca; font-weight: 600; }
    .chip.color { color: transparent; width: 40px; height: 40px; border-radius: 50%; padding: 0; border-width: 3px; }
    .chip.color.on { border-color: #111; }
    .ok-line { color: #10b981; font-size: 14px; margin-top: 10px; }
    .modal-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px; border-top: 1px solid #f0f0f0; }
    .btn-skip { background: #f3f4f6; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; }
    .btn-save { background: linear-gradient(135deg, #6366f1, #ec4899); color: #fff; border: none; padding: 10px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; }
    .btn-save:disabled { opacity: 0.6; }
  `]
})
export class StyleQuizModalComponent {
  @Input() open = false;
  @Output() closed = new EventEmitter<void>();

  styles = [
    { value: 'chic', label: '✨ Chic' },
    { value: 'casual', label: '👕 Casual' },
    { value: 'boho', label: '🌸 Bohème' },
    { value: 'sport', label: '🏃 Sportif' },
    { value: 'classic', label: '👔 Classique' },
    { value: 'street', label: '🎨 Street' },
  ];
  sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  colors = ['black', 'white', 'navy', 'red', 'green', 'pink', 'beige', 'grey'];

  form: any = { style: null, sizeTop: null, sizeBottom: null, budgetRange: null, preferredColors: [] as string[] };
  saving = false;
  okMsg = '';

  constructor(private http: HttpClient) {}

  toggleColor(c: string) {
    const idx = this.form.preferredColors.indexOf(c);
    if (idx >= 0) this.form.preferredColors.splice(idx, 1);
    else if (this.form.preferredColors.length < 3) this.form.preferredColors.push(c);
  }

  save() {
    const token = localStorage.getItem('jwt') || localStorage.getItem('admin_jwt');
    if (!token) { this.okMsg = 'Connectez-vous pour enregistrer votre profil.'; return; }
    this.saving = true;
    this.http.put(
      `${environementDev.api}/api/storefront/style-profile`,
      this.form,
      { headers: { Authorization: `Bearer ${token}` } }
    ).subscribe({
      next: () => { this.okMsg = 'Votre profil style est enregistré !'; this.saving = false; setTimeout(() => this.close(), 1500); },
      error: () => { this.saving = false; this.okMsg = 'Erreur lors de la sauvegarde.'; }
    });
  }

  close() { this.open = false; this.closed.emit(); }
}
