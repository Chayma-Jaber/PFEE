import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';
import { CartService, CartItem } from '../../../services/cart.service';
import { BgRemovalService } from '../../../services/bg-removal.service';

type SlotKey = 'TOP' | 'BOTTOM' | 'SHOES' | 'ACCESSORY';
type SkinTone = 'porcelaine' | 'beige' | 'tan' | 'caramel' | 'ebene';

interface Slot {
  key: SlotKey;
  label: string;
  icon: string;
  selected?: any;
}

interface CatalogProduct {
  id: number;
  title: string;
  slug?: string;
  currentPrice: number;
  firstImageUrl: string;
  famille?: string;
  sku?: string;
  ean13?: string;
}

/**
 * Studio Look — premium on-body outfit composer.
 *
 * Architecture (v3)
 * ─────────────────
 * Two visual layers in one stacking container:
 *   1. SVG mannequin (body only) — anatomical silhouette, skin gradient,
 *      gender + 5 skin tones, scaled by build/height.
 *   2. HTML <img> overlays for each picked garment — positioned absolutely
 *      at the relevant body zone (top/bottom/shoes/accessory).
 *
 * Why HTML <img> instead of SVG <image>:
 *   - SVG <image> with cross-origin URLs is fragile (CORS, content-type, blob
 *     conversion). Every product photo in the previous version showed as a
 *     broken-image cloud icon.
 *   - HTML <img> just works with any URL.
 *   - Colour fidelity is preserved (no mix-blend-mode, no clip-path slice).
 *
 * Body customisation
 * ──────────────────
 *  - gender    : F | M
 *  - skinTone  : porcelaine | beige | tan | caramel | ebene (5 tones)
 *  - heightCm  : 150 ↔ 195 cm, stepper (±1 per click)
 *  - buildIdx  : −3 ↔ +3, stepper (slim ↔ fuller, ×0.05 per step on X)
 *
 * Picker is filtered per-slot via a regex on the product title (the catalogue
 * has no formal sub-category). AI completion calls /api/storefront/w3/complete
 * -outfit and slots each suggestion into its semantic slot.
 */
@Component({
  selector: 'app-studio-look',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="studio">
      <!-- Header -->
      <header class="studio-head">
        <div class="eyebrow">— Le Studio Barsha —</div>
        <h1>Composez votre look</h1>
        <p>Habillez votre mannequin sur mesure. Choisissez votre carnation, votre silhouette, et un article par catégorie.</p>
      </header>

      <!-- Toolbar: gender + skin + build + height + counter -->
      <div class="toolbar">
        <div class="left-controls">
          <!-- Gender -->
          <div class="gender-switch" role="tablist" aria-label="Genre du mannequin">
            <button role="tab" [attr.aria-selected]="gender === 'F'"
                    [class.active]="gender === 'F'" (click)="setGender('F')">
              <span class="dot dot-f"></span> Femme
            </button>
            <button role="tab" [attr.aria-selected]="gender === 'M'"
                    [class.active]="gender === 'M'" (click)="setGender('M')">
              <span class="dot dot-m"></span> Homme
            </button>
          </div>

          <!-- Skin tone (5 swatches) -->
          <div class="control-group" role="group" aria-label="Carnation">
            <span class="ctrl-label">Carnation</span>
            <button *ngFor="let t of toneOptions"
                    class="tone-btn"
                    [class.active]="skinTone === t.key"
                    [style.background]="t.color"
                    [attr.aria-label]="t.label"
                    [title]="t.label"
                    (click)="setSkinTone(t.key)"></button>
          </div>

          <!-- Build (corpulence) — stepper -->
          <div class="control-group stepper-group" aria-label="Corpulence">
            <span class="ctrl-label">Corpulence</span>
            <button class="stepper-btn" (click)="adjustBuild(-1)"
                    [disabled]="buildIdx <= -3" aria-label="Plus mince">−</button>
            <span class="stepper-value">{{ buildLabel }}</span>
            <button class="stepper-btn" (click)="adjustBuild(1)"
                    [disabled]="buildIdx >= 3" aria-label="Plus forte">+</button>
          </div>

          <!-- Height (taille) — stepper -->
          <div class="control-group stepper-group" aria-label="Taille">
            <span class="ctrl-label">Taille</span>
            <button class="stepper-btn" (click)="adjustHeight(-1)"
                    [disabled]="heightCm <= 150" aria-label="Plus petite">−</button>
            <span class="stepper-value">{{ heightCm }} cm</span>
            <button class="stepper-btn" (click)="adjustHeight(1)"
                    [disabled]="heightCm >= 195" aria-label="Plus grande">+</button>
          </div>
        </div>

        <div class="counter" [class.dim]="totalItems === 0">
          <span>{{ totalItems }}/4 articles</span>
          <span class="sep">·</span>
          <span class="price">{{ totalPrice | number:'1.2-2' }} TND</span>
        </div>
      </div>

      <!-- Stage: slots left, mannequin centre, slots right -->
      <div class="stage">
        <div class="side-col side-left">
          <ng-container [ngTemplateOutlet]="slotTpl"
                        [ngTemplateOutletContext]="{ s: slotByKey('TOP') }"></ng-container>
          <ng-container [ngTemplateOutlet]="slotTpl"
                        [ngTemplateOutletContext]="{ s: slotByKey('SHOES') }"></ng-container>
        </div>

        <!-- ── Mannequin stage ─────────────────────────────────────── -->
        <div class="mannequin-wrap">
          <div class="mannequin-stage"
               [style.--skin]="currentSkin"
               [style.--skin-shadow]="darken(currentSkin, 14)"
               [style.--skin-light]="lighten(currentSkin, 8)"
               [style.--scaleX]="buildScale"
               [style.--scaleY]="heightScale">

            <!-- SVG body -->
            <svg class="mannequin-svg"
                 [class.is-male]="gender === 'M'"
                 viewBox="0 0 220 540" xmlns="http://www.w3.org/2000/svg"
                 preserveAspectRatio="xMidYMid meet"
                 aria-hidden="true">
              <defs>
                <!-- Skin gradient: subtle left shadow, right highlight -->
                <linearGradient [attr.id]="'skin-' + uid" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%"   stop-color="var(--skin-shadow)"/>
                  <stop offset="48%"  stop-color="var(--skin)"/>
                  <stop offset="100%" stop-color="var(--skin-light)"/>
                </linearGradient>
                <!-- Soft body shadow for the cast under the figure -->
                <radialGradient [attr.id]="'castShadow-' + uid" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stop-color="rgba(0,0,0,0.30)"/>
                  <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
                </radialGradient>
                <!-- Body highlight (right side rim-light) -->
                <radialGradient [attr.id]="'rim-' + uid" cx="80%" cy="40%" r="60%">
                  <stop offset="0%"   stop-color="rgba(255,255,255,0.22)"/>
                  <stop offset="60%"  stop-color="rgba(255,255,255,0.04)"/>
                  <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
                </radialGradient>
                <!-- Body shadow (left side core-shadow) -->
                <radialGradient [attr.id]="'core-' + uid" cx="20%" cy="50%" r="55%">
                  <stop offset="0%"   stop-color="rgba(0,0,0,0.18)"/>
                  <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
                </radialGradient>
                <!-- Hair gradient (warm dark base for both genders) -->
                <linearGradient [attr.id]="'hair-' + uid" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%"  stop-color="#3a2715"/>
                  <stop offset="55%" stop-color="#231609"/>
                  <stop offset="100%" stop-color="#120a04"/>
                </linearGradient>
              </defs>

              <!-- Cast shadow under feet -->
              <ellipse cx="110" cy="525" rx="62" ry="6"
                       [attr.fill]="'url(#castShadow-' + uid + ')'"/>

              <!-- ── BODY ─────────────────────────────────────────── -->
              <g [attr.fill]="'url(#skin-' + uid + ')'">
                <!-- FEMALE silhouette: anatomical, with subtle bust + hourglass -->
                <path *ngIf="gender === 'F'" class="body" d="
                  M 110,32
                  C 96,32 86,42 86,55
                  C 86,62 88,68 91,73
                  C 87,75 84,79 84,84
                  C 84,87 86,90 89,92
                  L 89,99
                  C 89,103 92,106 96,107
                  L 84,112
                  C 76,116 71,123 70,131
                  L 67,143
                  C 64,147 60,151 58,156
                  L 54,170
                  C 51,180 53,191 60,198
                  L 64,210
                  C 64,225 64,240 64,250
                  L 62,265
                  C 60,272 58,278 58,285
                  L 56,295
                  C 53,308 50,322 56,330
                  L 60,335
                  L 60,235
                  C 60,230 62,224 65,220
                  L 65,170
                  L 70,165
                  L 74,180
                  C 78,200 80,218 80,238
                  L 80,260
                  C 80,275 79,290 76,302
                  L 73,322
                  C 71,335 69,350 70,365
                  L 72,395
                  C 73,410 74,425 76,438
                  L 78,470
                  C 78,485 80,498 84,510
                  L 86,520
                  C 87,524 90,526 94,526
                  L 100,526
                  C 103,526 106,524 107,520
                  L 108,510
                  C 110,500 110,490 110,480
                  L 110,360
                  C 110,358 110,358 110,360
                  L 110,480
                  C 110,490 110,500 112,510
                  L 113,520
                  C 114,524 117,526 120,526
                  L 126,526
                  C 130,526 133,524 134,520
                  L 136,510
                  C 140,498 142,485 142,470
                  L 144,438
                  C 146,425 147,410 148,395
                  L 150,365
                  C 151,350 149,335 147,322
                  L 144,302
                  C 141,290 140,275 140,260
                  L 140,238
                  C 140,218 142,200 146,180
                  L 150,165
                  L 155,170
                  L 155,220
                  C 158,224 160,230 160,235
                  L 160,335
                  L 164,330
                  C 170,322 167,308 164,295
                  L 162,285
                  C 162,278 160,272 158,265
                  L 156,250
                  C 156,240 156,225 156,210
                  L 160,198
                  C 167,191 169,180 166,170
                  L 162,156
                  C 160,151 156,147 153,143
                  L 150,131
                  C 149,123 144,116 136,112
                  L 124,107
                  C 128,106 131,103 131,99
                  L 131,92
                  C 134,90 136,87 136,84
                  C 136,79 133,75 129,73
                  C 132,68 134,62 134,55
                  C 134,42 124,32 110,32 Z"/>

                <!-- MALE silhouette: broader shoulders, narrower hips, straighter torso -->
                <path *ngIf="gender === 'M'" class="body" d="
                  M 110,32
                  C 95,32 84,42 84,57
                  C 84,65 87,72 91,76
                  C 87,79 84,83 84,87
                  C 84,90 86,93 89,95
                  L 89,103
                  C 89,107 92,110 96,111
                  L 80,118
                  C 70,123 64,131 62,140
                  L 58,156
                  C 54,160 50,166 48,172
                  L 44,188
                  C 41,200 44,212 52,219
                  L 58,232
                  C 58,247 58,260 58,270
                  L 56,285
                  C 53,298 51,312 56,322
                  L 60,330
                  L 60,235
                  C 60,228 63,222 67,218
                  L 67,168
                  L 72,165
                  L 76,182
                  C 80,202 82,220 82,242
                  L 82,265
                  C 82,278 81,292 78,304
                  L 76,322
                  C 73,335 71,350 71,365
                  L 73,400
                  C 74,415 75,430 77,442
                  L 79,475
                  C 79,490 81,503 85,515
                  L 87,524
                  C 88,528 91,530 95,530
                  L 102,530
                  C 105,530 108,528 109,524
                  L 110,515
                  C 110,505 110,495 110,485
                  L 110,365
                  C 110,363 110,363 110,365
                  L 110,485
                  C 110,495 110,505 110,515
                  L 111,524
                  C 112,528 115,530 118,530
                  L 125,530
                  C 129,530 132,528 133,524
                  L 135,515
                  C 139,503 141,490 141,475
                  L 143,442
                  C 145,430 146,415 147,400
                  L 149,365
                  C 149,350 147,335 144,322
                  L 142,304
                  C 139,292 138,278 138,265
                  L 138,242
                  C 138,220 140,202 144,182
                  L 148,165
                  L 153,168
                  L 153,218
                  C 157,222 160,228 160,235
                  L 160,330
                  L 164,322
                  C 169,312 167,298 164,285
                  L 162,270
                  C 162,260 162,247 162,232
                  L 168,219
                  C 176,212 179,200 176,188
                  L 172,172
                  C 170,166 166,160 162,156
                  L 158,140
                  C 156,131 150,123 140,118
                  L 124,111
                  C 128,110 131,107 131,103
                  L 131,95
                  C 134,93 136,90 136,87
                  C 136,83 133,79 129,76
                  C 133,72 136,65 136,57
                  C 136,42 125,32 110,32 Z"/>
              </g>

              <!-- Body shading layer (rim-light + core-shadow) — gives 3D feel -->
              <g class="body-shading" pointer-events="none">
                <!-- Rim light hugs the body silhouette by sharing path bbox -->
                <rect x="40" y="30" width="140" height="500" [attr.fill]="'url(#core-' + uid + ')'"
                      style="mix-blend-mode: multiply"/>
                <rect x="40" y="30" width="140" height="500" [attr.fill]="'url(#rim-' + uid + ')'"
                      style="mix-blend-mode: screen"/>
              </g>

              <!-- Hair (drawn after body so it sits on top of the head) -->
              <g class="hair" [attr.fill]="'url(#hair-' + uid + ')'">
                <!-- F: shoulder-length sleek hair, frames the face -->
                <path *ngIf="gender === 'F'" d="
                  M 110,28
                  C 92,28 78,42 78,60
                  C 78,68 80,76 84,82
                  L 80,98 L 76,118
                  C 73,128 72,138 73,148
                  L 78,162
                  C 80,156 84,150 89,148
                  L 89,99 C 89,103 92,106 96,107
                  L 100,108
                  C 102,98 99,86 98,76
                  C 96,68 96,60 100,52
                  C 105,46 113,46 118,52
                  C 122,60 122,68 120,76
                  C 119,86 116,98 118,108
                  L 124,107 C 128,106 131,103 131,99
                  L 131,148
                  C 136,150 140,156 142,162
                  L 147,148
                  C 148,138 147,128 144,118
                  L 140,98 L 136,82
                  C 140,76 142,68 142,60
                  C 142,42 128,28 110,28 Z"/>
                <!-- M: short tapered crop on top of head -->
                <path *ngIf="gender === 'M'" d="
                  M 110,30
                  C 95,30 84,40 84,55
                  L 88,72
                  C 90,68 93,65 96,64
                  C 100,55 104,52 110,52
                  C 116,52 120,55 124,64
                  C 127,65 130,68 132,72
                  L 136,55
                  C 136,40 125,30 110,30 Z"/>
              </g>

              <!-- Face features (very subtle) -->
              <g class="face" pointer-events="none" stroke-linecap="round">
                <ng-container *ngIf="gender === 'F'">
                  <!-- Brows -->
                  <path d="M97,55 Q102,52 106,54" stroke="rgba(0,0,0,.2)" stroke-width="1" fill="none"/>
                  <path d="M114,54 Q118,52 123,55" stroke="rgba(0,0,0,.2)" stroke-width="1" fill="none"/>
                  <!-- Eyes -->
                  <ellipse cx="101" cy="60" rx="1.4" ry="1" fill="rgba(0,0,0,.65)"/>
                  <ellipse cx="119" cy="60" rx="1.4" ry="1" fill="rgba(0,0,0,.65)"/>
                  <!-- Nose tip -->
                  <path d="M109,68 L110,72 L111,68" stroke="rgba(0,0,0,.18)" stroke-width=".7" fill="none"/>
                  <!-- Lips -->
                  <path d="M105,77 Q110,80 115,77" stroke="#9d4a52" stroke-width="1.4" fill="none" opacity=".7"/>
                  <path d="M105,77 Q110,75 115,77" stroke="#9d4a52" stroke-width=".8" fill="none" opacity=".6"/>
                  <!-- Cheek hints -->
                  <ellipse cx="96" cy="68" rx="2" ry="3" fill="rgba(220,140,140,.15)"/>
                  <ellipse cx="124" cy="68" rx="2" ry="3" fill="rgba(220,140,140,.15)"/>
                  <!-- Bust hint -->
                  <path d="M93,148 Q98,160 95,172" stroke="rgba(0,0,0,.14)" stroke-width=".8" fill="none"/>
                  <path d="M127,148 Q122,160 125,172" stroke="rgba(0,0,0,.14)" stroke-width=".8" fill="none"/>
                  <!-- Navel -->
                  <circle cx="110" cy="232" r="1" fill="rgba(0,0,0,.18)"/>
                  <!-- Knees -->
                  <path d="M88,408 Q92,415 88,422" stroke="rgba(0,0,0,.14)" stroke-width=".8" fill="none"/>
                  <path d="M132,408 Q128,415 132,422" stroke="rgba(0,0,0,.14)" stroke-width=".8" fill="none"/>
                </ng-container>
                <ng-container *ngIf="gender === 'M'">
                  <!-- Brows -->
                  <path d="M96,57 Q102,54 107,56" stroke="rgba(0,0,0,.3)" stroke-width="1.4" fill="none"/>
                  <path d="M113,56 Q118,54 124,57" stroke="rgba(0,0,0,.3)" stroke-width="1.4" fill="none"/>
                  <!-- Eyes -->
                  <ellipse cx="101" cy="62" rx="1.4" ry="1" fill="rgba(0,0,0,.7)"/>
                  <ellipse cx="119" cy="62" rx="1.4" ry="1" fill="rgba(0,0,0,.7)"/>
                  <!-- Nose -->
                  <path d="M109,70 L110,75 L112,70" stroke="rgba(0,0,0,.2)" stroke-width=".8" fill="none"/>
                  <!-- Lips (thin) -->
                  <path d="M105,82 Q110,84 115,82" stroke="rgba(80,40,30,.55)" stroke-width="1.1" fill="none"/>
                  <!-- Jaw shadow -->
                  <path d="M92,82 Q110,90 128,82" stroke="rgba(0,0,0,.12)" stroke-width=".8" fill="none"/>
                  <!-- Pec line -->
                  <path d="M84,142 Q110,134 136,142" stroke="rgba(0,0,0,.15)" stroke-width=".9" fill="none"/>
                  <!-- Abdominal centerline -->
                  <line x1="110" y1="170" x2="110" y2="232" stroke="rgba(0,0,0,.14)" stroke-width=".8" stroke-dasharray="2 4"/>
                  <!-- Knees -->
                  <path d="M88,418 Q92,425 88,432" stroke="rgba(0,0,0,.14)" stroke-width=".8" fill="none"/>
                  <path d="M132,418 Q128,425 132,432" stroke="rgba(0,0,0,.14)" stroke-width=".8" fill="none"/>
                </ng-container>
              </g>
            </svg>

            <!-- ── HTML garment overlays ───────────────────────────── -->

            <!-- BOTTOM (rendered first so the top can overlap waistband) -->
            <div class="garment-zone zone-bottom" *ngIf="slotByKey('BOTTOM').selected as p"
                 [class.is-processed]="isProcessed('BOTTOM')">
              <div class="garment-shadow"></div>
              <img class="garment-img" [src]="bgFor('BOTTOM')" [alt]="p.title"
                   (error)="onImgError($event)" loading="lazy"/>
            </div>

            <!-- TOP -->
            <div class="garment-zone zone-top" *ngIf="slotByKey('TOP').selected as p"
                 [class.is-processed]="isProcessed('TOP')">
              <div class="garment-shadow"></div>
              <img class="garment-img" [src]="bgFor('TOP')" [alt]="p.title"
                   (error)="onImgError($event)" loading="lazy"/>
            </div>

            <!-- SHOES -->
            <div class="garment-zone zone-shoes" *ngIf="slotByKey('SHOES').selected as p"
                 [class.is-processed]="isProcessed('SHOES')">
              <div class="garment-shadow"></div>
              <img class="garment-img" [src]="bgFor('SHOES')" [alt]="p.title"
                   (error)="onImgError($event)" loading="lazy"/>
            </div>

            <!-- ACCESSORY -->
            <div class="garment-zone zone-acc" *ngIf="slotByKey('ACCESSORY').selected as p"
                 [class.is-processed]="isProcessed('ACCESSORY')">
              <div class="garment-shadow"></div>
              <img class="garment-img" [src]="bgFor('ACCESSORY')" [alt]="p.title"
                   (error)="onImgError($event)" loading="lazy"/>
            </div>
          </div>

          <div class="mannequin-meta">
            <span>{{ getBodyLabel() }}</span>
          </div>
        </div>

        <div class="side-col side-right">
          <ng-container [ngTemplateOutlet]="slotTpl"
                        [ngTemplateOutletContext]="{ s: slotByKey('ACCESSORY') }"></ng-container>
          <ng-container [ngTemplateOutlet]="slotTpl"
                        [ngTemplateOutletContext]="{ s: slotByKey('BOTTOM') }"></ng-container>
        </div>
      </div>

      <!-- Action bar -->
      <div class="actions">
        <button class="btn ghost" (click)="resetAll()" [disabled]="totalItems === 0">
          <i class="fas fa-redo"></i> Réinitialiser
        </button>
        <button class="btn ghost" (click)="saveLook()" [disabled]="totalItems === 0" title="Sauvegarder ce look">
          <i class="fas fa-bookmark"></i> Sauvegarder
        </button>
        <button class="btn ai" (click)="askAiCompletion()" [disabled]="aiLoading || totalItems === 0">
          <i class="fas" [class.fa-magic]="!aiLoading" [class.fa-spinner]="aiLoading" [class.fa-spin]="aiLoading"></i>
          {{ aiLoading ? 'Le styliste réfléchit...' : "Compléter avec l'IA" }}
        </button>
        <button class="btn realistic" (click)="openRealistic()" [disabled]="totalItems === 0">
          <i class="fas fa-camera"></i> Aperçu réaliste
        </button>
        <button class="btn primary" (click)="addAllToCart()" [disabled]="totalItems === 0">
          <i class="fas fa-shopping-bag"></i> Ajouter la tenue ({{ totalItems }}) · {{ totalPrice | number:'1.2-2' }} TND
        </button>
      </div>

      <!-- AI suggestions strip -->
      <div class="ai-strip" *ngIf="aiSuggestions.length > 0">
        <div class="ai-head">
          <i class="fas fa-magic"></i>
          <strong>Suggestions du styliste</strong>
          <button class="dismiss" (click)="aiSuggestions = []">×</button>
        </div>
        <div class="ai-grid">
          <div class="ai-item" *ngFor="let p of aiSuggestions">
            <img [src]="p.firstImageUrl" [alt]="p.title" loading="lazy" (error)="onImgError($event)"/>
            <div class="ai-item-body">
              <div class="t">{{ p.title }}</div>
              <div class="p">{{ p.currentPrice | number:'1.2-2' }} TND</div>
              <button (click)="addSuggestion(p)">+ Ajouter</button>
            </div>
          </div>
        </div>
      </div>

      <div class="toast" *ngIf="toast.msg" [class.ok]="toast.kind === 'ok'" [class.err]="toast.kind === 'err'">
        <i class="fas" [class.fa-check]="toast.kind === 'ok'" [class.fa-exclamation-triangle]="toast.kind === 'err'"></i>
        {{ toast.msg }}
      </div>

      <!-- ── Realistic preview modal (Mode 2: editorial composition + AI stylist note) ─ -->
      <div class="realistic-overlay" *ngIf="realisticOpen" (click)="closeRealistic()">
        <div class="realistic-modal" (click)="$event.stopPropagation()">
          <div class="realistic-head">
            <div>
              <span class="r-eyebrow">Aperçu réaliste</span>
              <h3>Votre look · {{ getBodyLabel() }}</h3>
            </div>
            <button class="realistic-x" (click)="closeRealistic()">×</button>
          </div>

          <div class="realistic-body">
            <!-- Editorial composition: large mannequin with worn outfit -->
            <div class="realistic-stage">
              <div class="r-stage-frame"
                   [style.--skin]="currentSkin"
                   [style.--skin-shadow]="darken(currentSkin, 14)"
                   [style.--skin-light]="lighten(currentSkin, 8)"
                   [style.--scaleX]="buildScale"
                   [style.--scaleY]="heightScale">
                <!-- Reuse the same SVG body, scaled up -->
                <svg class="r-mannequin"
                     [class.is-male]="gender === 'M'"
                     viewBox="0 0 220 540" xmlns="http://www.w3.org/2000/svg"
                     preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <linearGradient [attr.id]="'rskin-' + uid" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%"   stop-color="var(--skin-shadow)"/>
                      <stop offset="48%"  stop-color="var(--skin)"/>
                      <stop offset="100%" stop-color="var(--skin-light)"/>
                    </linearGradient>
                    <radialGradient [attr.id]="'rcastShadow-' + uid" cx="50%" cy="50%" r="50%">
                      <stop offset="0%"   stop-color="rgba(0,0,0,0.30)"/>
                      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
                    </radialGradient>
                    <radialGradient [attr.id]="'rrim-' + uid" cx="80%" cy="40%" r="60%">
                      <stop offset="0%" stop-color="rgba(255,255,255,0.22)"/>
                      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
                    </radialGradient>
                    <radialGradient [attr.id]="'rcore-' + uid" cx="20%" cy="50%" r="55%">
                      <stop offset="0%" stop-color="rgba(0,0,0,0.18)"/>
                      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
                    </radialGradient>
                    <linearGradient [attr.id]="'rhair-' + uid" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stop-color="#3a2715"/>
                      <stop offset="100%" stop-color="#120a04"/>
                    </linearGradient>
                  </defs>
                  <ellipse cx="110" cy="525" rx="62" ry="6"
                           [attr.fill]="'url(#rcastShadow-' + uid + ')'"/>
                  <g [attr.fill]="'url(#rskin-' + uid + ')'">
                    <path *ngIf="gender === 'F'" class="body" d="M 110,32 C 96,32 86,42 86,55 C 86,62 88,68 91,73 C 87,75 84,79 84,84 C 84,87 86,90 89,92 L 89,99 C 89,103 92,106 96,107 L 84,112 C 76,116 71,123 70,131 L 67,143 C 64,147 60,151 58,156 L 54,170 C 51,180 53,191 60,198 L 64,210 C 64,225 64,240 64,250 L 62,265 C 60,272 58,278 58,285 L 56,295 C 53,308 50,322 56,330 L 60,335 L 60,235 C 60,230 62,224 65,220 L 65,170 L 70,165 L 74,180 C 78,200 80,218 80,238 L 80,260 C 80,275 79,290 76,302 L 73,322 C 71,335 69,350 70,365 L 72,395 C 73,410 74,425 76,438 L 78,470 C 78,485 80,498 84,510 L 86,520 C 87,524 90,526 94,526 L 100,526 C 103,526 106,524 107,520 L 108,510 C 110,500 110,490 110,480 L 110,360 C 110,358 110,358 110,360 L 110,480 C 110,490 110,500 112,510 L 113,520 C 114,524 117,526 120,526 L 126,526 C 130,526 133,524 134,520 L 136,510 C 140,498 142,485 142,470 L 144,438 C 146,425 147,410 148,395 L 150,365 C 151,350 149,335 147,322 L 144,302 C 141,290 140,275 140,260 L 140,238 C 140,218 142,200 146,180 L 150,165 L 155,170 L 155,220 C 158,224 160,230 160,235 L 160,335 L 164,330 C 170,322 167,308 164,295 L 162,285 C 162,278 160,272 158,265 L 156,250 C 156,240 156,225 156,210 L 160,198 C 167,191 169,180 166,170 L 162,156 C 160,151 156,147 153,143 L 150,131 C 149,123 144,116 136,112 L 124,107 C 128,106 131,103 131,99 L 131,92 C 134,90 136,87 136,84 C 136,79 133,75 129,73 C 132,68 134,62 134,55 C 134,42 124,32 110,32 Z"/>
                    <path *ngIf="gender === 'M'" class="body" d="M 110,32 C 95,32 84,42 84,57 C 84,65 87,72 91,76 C 87,79 84,83 84,87 C 84,90 86,93 89,95 L 89,103 C 89,107 92,110 96,111 L 80,118 C 70,123 64,131 62,140 L 58,156 C 54,160 50,166 48,172 L 44,188 C 41,200 44,212 52,219 L 58,232 C 58,247 58,260 58,270 L 56,285 C 53,298 51,312 56,322 L 60,330 L 60,235 C 60,228 63,222 67,218 L 67,168 L 72,165 L 76,182 C 80,202 82,220 82,242 L 82,265 C 82,278 81,292 78,304 L 76,322 C 73,335 71,350 71,365 L 73,400 C 74,415 75,430 77,442 L 79,475 C 79,490 81,503 85,515 L 87,524 C 88,528 91,530 95,530 L 102,530 C 105,530 108,528 109,524 L 110,515 C 110,505 110,495 110,485 L 110,365 C 110,363 110,363 110,365 L 110,485 C 110,495 110,505 110,515 L 111,524 C 112,528 115,530 118,530 L 125,530 C 129,530 132,528 133,524 L 135,515 C 139,503 141,490 141,475 L 143,442 C 145,430 146,415 147,400 L 149,365 C 149,350 147,335 144,322 L 142,304 C 139,292 138,278 138,265 L 138,242 C 138,220 140,202 144,182 L 148,165 L 153,168 L 153,218 C 157,222 160,228 160,235 L 160,330 L 164,322 C 169,312 167,298 164,285 L 162,270 C 162,260 162,247 162,232 L 168,219 C 176,212 179,200 176,188 L 172,172 C 170,166 166,160 162,156 L 158,140 C 156,131 150,123 140,118 L 124,111 C 128,110 131,107 131,103 L 131,95 C 134,93 136,90 136,87 C 136,83 133,79 129,76 C 133,72 136,65 136,57 C 136,42 125,32 110,32 Z"/>
                  </g>
                  <!-- Body shading + hair + face — matching the live preview -->
                  <g class="body-shading" pointer-events="none">
                    <rect x="40" y="30" width="140" height="500" [attr.fill]="'url(#rcore-' + uid + ')'" style="mix-blend-mode: multiply"/>
                    <rect x="40" y="30" width="140" height="500" [attr.fill]="'url(#rrim-' + uid + ')'" style="mix-blend-mode: screen"/>
                  </g>
                  <g class="hair" [attr.fill]="'url(#rhair-' + uid + ')'">
                    <path *ngIf="gender === 'F'" d="M 110,28 C 92,28 78,42 78,60 C 78,68 80,76 84,82 L 80,98 L 76,118 C 73,128 72,138 73,148 L 78,162 C 80,156 84,150 89,148 L 89,99 C 89,103 92,106 96,107 L 100,108 C 102,98 99,86 98,76 C 96,68 96,60 100,52 C 105,46 113,46 118,52 C 122,60 122,68 120,76 C 119,86 116,98 118,108 L 124,107 C 128,106 131,103 131,99 L 131,148 C 136,150 140,156 142,162 L 147,148 C 148,138 147,128 144,118 L 140,98 L 136,82 C 140,76 142,68 142,60 C 142,42 128,28 110,28 Z"/>
                    <path *ngIf="gender === 'M'" d="M 110,30 C 95,30 84,40 84,55 L 88,72 C 90,68 93,65 96,64 C 100,55 104,52 110,52 C 116,52 120,55 124,64 C 127,65 130,68 132,72 L 136,55 C 136,40 125,30 110,30 Z"/>
                  </g>
                  <g class="face" pointer-events="none" stroke-linecap="round">
                    <ng-container *ngIf="gender === 'F'">
                      <path d="M97,55 Q102,52 106,54" stroke="rgba(0,0,0,.2)" stroke-width="1" fill="none"/>
                      <path d="M114,54 Q118,52 123,55" stroke="rgba(0,0,0,.2)" stroke-width="1" fill="none"/>
                      <ellipse cx="101" cy="60" rx="1.4" ry="1" fill="rgba(0,0,0,.65)"/>
                      <ellipse cx="119" cy="60" rx="1.4" ry="1" fill="rgba(0,0,0,.65)"/>
                      <path d="M109,68 L110,72 L111,68" stroke="rgba(0,0,0,.18)" stroke-width=".7" fill="none"/>
                      <path d="M105,77 Q110,80 115,77" stroke="#9d4a52" stroke-width="1.4" fill="none" opacity=".7"/>
                      <ellipse cx="96" cy="68" rx="2" ry="3" fill="rgba(220,140,140,.15)"/>
                      <ellipse cx="124" cy="68" rx="2" ry="3" fill="rgba(220,140,140,.15)"/>
                    </ng-container>
                    <ng-container *ngIf="gender === 'M'">
                      <path d="M96,57 Q102,54 107,56" stroke="rgba(0,0,0,.3)" stroke-width="1.4" fill="none"/>
                      <path d="M113,56 Q118,54 124,57" stroke="rgba(0,0,0,.3)" stroke-width="1.4" fill="none"/>
                      <ellipse cx="101" cy="62" rx="1.4" ry="1" fill="rgba(0,0,0,.7)"/>
                      <ellipse cx="119" cy="62" rx="1.4" ry="1" fill="rgba(0,0,0,.7)"/>
                      <path d="M109,70 L110,75 L112,70" stroke="rgba(0,0,0,.2)" stroke-width=".8" fill="none"/>
                      <path d="M105,82 Q110,84 115,82" stroke="rgba(80,40,30,.55)" stroke-width="1.1" fill="none"/>
                      <path d="M92,82 Q110,90 128,82" stroke="rgba(0,0,0,.12)" stroke-width=".8" fill="none"/>
                    </ng-container>
                  </g>
                </svg>

                <!-- Garments worn (uses BG-removed images when ready) -->
                <div class="garment-zone zone-bottom" *ngIf="slotByKey('BOTTOM').selected as p"
                     [class.is-processed]="isProcessed('BOTTOM')">
                  <img class="garment-img" [src]="bgFor('BOTTOM')" [alt]="p.title"/>
                </div>
                <div class="garment-zone zone-top" *ngIf="slotByKey('TOP').selected as p"
                     [class.is-processed]="isProcessed('TOP')">
                  <img class="garment-img" [src]="bgFor('TOP')" [alt]="p.title"/>
                </div>
                <div class="garment-zone zone-shoes" *ngIf="slotByKey('SHOES').selected as p"
                     [class.is-processed]="isProcessed('SHOES')">
                  <img class="garment-img" [src]="bgFor('SHOES')" [alt]="p.title"/>
                </div>
                <div class="garment-zone zone-acc" *ngIf="slotByKey('ACCESSORY').selected as p"
                     [class.is-processed]="isProcessed('ACCESSORY')">
                  <img class="garment-img" [src]="bgFor('ACCESSORY')" [alt]="p.title"/>
                </div>
              </div>
            </div>

            <!-- Sidebar: outfit details + AI stylist note -->
            <aside class="realistic-side">
              <h4>La tenue</h4>
              <ul class="r-pieces">
                <li *ngFor="let s of slots" [class.empty]="!s.selected">
                  <span class="r-cat">{{ s.label }}</span>
                  <ng-container *ngIf="s.selected; else noPiece">
                    <span class="r-title">{{ s.selected.title }}</span>
                    <span class="r-price">{{ s.selected.currentPrice | number:'1.2-2' }} TND</span>
                  </ng-container>
                  <ng-template #noPiece><span class="r-empty">—</span></ng-template>
                </li>
              </ul>
              <div class="r-total">
                <span>Total</span>
                <strong>{{ totalPrice | number:'1.2-2' }} TND</strong>
              </div>

              <div class="r-stylist">
                <div class="r-stylist-head">
                  <i class="fas fa-quote-left"></i>
                  <span>Note du styliste</span>
                  <button *ngIf="!stylistNote && !stylistLoading"
                          class="r-stylist-gen" (click)="generateStylistNote()">
                    Générer
                  </button>
                </div>
                <div class="r-stylist-body" *ngIf="stylistNote">{{ stylistNote }}</div>
                <div class="r-stylist-body loading" *ngIf="stylistLoading">
                  <i class="fas fa-spinner fa-spin"></i> Le styliste rédige son avis...
                </div>
                <div class="r-stylist-body empty" *ngIf="!stylistNote && !stylistLoading">
                  Cliquez sur « Générer » pour obtenir une critique professionnelle de votre tenue.
                </div>
              </div>

              <div class="r-actions">
                <button class="btn ghost" (click)="saveLook()">
                  <i class="fas fa-bookmark"></i> Sauvegarder
                </button>
                <button class="btn ghost" (click)="shareLook()">
                  <i class="fas fa-share-alt"></i> Partager
                </button>
                <button class="btn primary" (click)="addAllToCart(); closeRealistic()">
                  <i class="fas fa-shopping-bag"></i> Ajouter au panier
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>

    <!-- Slot card template -->
    <ng-template #slotTpl let-s="s">
      <div class="slot-card" [class.filled]="!!s.selected" [attr.data-slot]="s.key">
        <div class="slot-icon" [attr.title]="s.label">{{ s.icon }}</div>
        <div class="slot-label">
          <span class="cat">{{ s.label }}</span>
          <span class="hint" *ngIf="!s.selected">À choisir</span>
        </div>
        <ng-container *ngIf="s.selected; else emptySlot">
          <div class="slot-product">
            <img [src]="s.selected.firstImageUrl" [alt]="s.selected.title" (error)="onImgError($event)"/>
            <div class="slot-product-info">
              <div class="t">{{ s.selected.title }}</div>
              <div class="p">{{ s.selected.currentPrice | number:'1.2-2' }} TND</div>
            </div>
          </div>
          <div class="slot-actions">
            <button class="btn-mini" (click)="openPicker(s)">Changer</button>
            <button class="btn-mini danger" (click)="clear(s)">Retirer</button>
          </div>
        </ng-container>
        <ng-template #emptySlot>
          <button class="slot-pick-empty" (click)="openPicker(s)">
            <i class="fas fa-plus"></i> Choisir
          </button>
        </ng-template>
      </div>
    </ng-template>

    <!-- Picker modal -->
    <div class="picker-overlay" *ngIf="pickerOpen" (click)="closePicker()">
      <div class="picker-modal" (click)="$event.stopPropagation()">
        <div class="picker-head">
          <div>
            <strong>Choisir un article — {{ pickerFor?.label }}</strong>
            <span class="picker-sub">{{ filteredCatalog.length }} article(s) disponible(s)</span>
          </div>
          <button class="picker-x" (click)="closePicker()">×</button>
        </div>
        <div class="picker-search">
          <i class="fas fa-search"></i>
          <input type="text" [(ngModel)]="search" placeholder="Rechercher par nom..." autofocus />
        </div>
        <div class="picker-grid" *ngIf="!catalogLoading; else loadingTpl">
          <button class="pcard" *ngFor="let p of filteredCatalog" (click)="pick(p)">
            <img [src]="p.firstImageUrl" [alt]="p.title" loading="lazy" (error)="onImgError($event)"/>
            <div class="pcard-info">
              <div class="t">{{ p.title }}</div>
              <div class="p">{{ p.currentPrice | number:'1.2-2' }} TND</div>
            </div>
          </button>
          <div class="picker-empty" *ngIf="filteredCatalog.length === 0">
            <i class="fas fa-search"></i>
            <p>Aucun article correspondant.</p>
            <small>Essayez un autre terme ou changez de catégorie.</small>
          </div>
        </div>
        <ng-template #loadingTpl>
          <div class="picker-loading">
            <i class="fas fa-spinner fa-spin"></i> Chargement du catalogue...
          </div>
        </ng-template>
      </div>
    </div>
  `,
  styleUrls: ['./studio-look.component.scss']
})
export class StudioLookComponent implements OnInit {
  uid = 'studio-' + Math.random().toString(36).slice(2, 8);

  // ─── Body customisation ─────────────────────────────────────────────
  gender: 'M' | 'F' = 'F';
  skinTone: SkinTone = 'beige';
  heightCm = 168;       // 150..195
  buildIdx = 0;         // -3..+3 (slim ↔ fuller)

  toneOptions: { key: SkinTone; label: string; color: string }[] = [
    { key: 'porcelaine', label: 'Porcelaine',   color: '#f6dcc4' },
    { key: 'beige',      label: 'Beige clair',  color: '#eac298' },
    { key: 'tan',        label: 'Halé',         color: '#c89072' },
    { key: 'caramel',    label: 'Caramel',      color: '#9a6a45' },
    { key: 'ebene',      label: 'Ébène',        color: '#5a3724' },
  ];

  // ─── Slots ──────────────────────────────────────────────────────────
  slots: Slot[] = [
    { key: 'TOP',       label: 'Haut',       icon: '👕' },
    { key: 'BOTTOM',    label: 'Bas',        icon: '👖' },
    { key: 'SHOES',     label: 'Chaussures', icon: '👟' },
    { key: 'ACCESSORY', label: 'Accessoire', icon: '👜' },
  ];

  // ─── Catalogue / picker / AI / cart state ───────────────────────────
  catalog: CatalogProduct[] = [];
  catalogLoading = false;
  aiSuggestions: CatalogProduct[] = [];
  aiLoading = false;
  pickerOpen = false;
  pickerFor: Slot | null = null;
  search = '';
  toast: { msg: string; kind: 'ok' | 'err' } = { msg: '', kind: 'ok' };

  // ─── Realistic preview (Mode 2) ─────────────────────────────────────
  realisticOpen = false;
  stylistNote = '';
  stylistLoading = false;

  private slotKeywords: Record<SlotKey, RegExp> = {
    TOP:       /\b(t[\s-]?shirt|tshirt|polo|chemise|chemisier|blouse|pull|sweat|hoodie|sweatshirt|cardigan|gilet|veste|blouson|manteau|top|debardeur|tunique|crop|robe|tunique)\b/i,
    BOTTOM:    /\b(jean|jeans|pantalon|short|jupe|jogger|legging|bermuda|chino|cargo|robe)\b/i,
    SHOES:     /\b(chaussure|basket|sneaker|botte|bottine|escarpin|mocassin|sandale|tong|espadrille|derby|richelieu|ballerine|mule|slipper)\b/i,
    ACCESSORY: /\b(sac|sacoche|ceinture|bijou|collier|bracelet|bague|montre|chapeau|casquette|bonnet|echarpe|foulard|cravate|noeud|lunette|portefeuille|chaussette|gants?)\b/i,
  };

  // Per-slot processed-image cache: maps original product URL → transparent PNG
  // (or original URL if BG removal failed). Read by the template via `bgFor()`.
  private processedImg: Record<SlotKey, string | null> = {
    TOP: null, BOTTOM: null, SHOES: null, ACCESSORY: null,
  };

  constructor(
    private http: HttpClient,
    private cartService: CartService,
    private bg: BgRemovalService,
  ) {}

  ngOnInit(): void { this.loadCatalog(); }

  // ─── Background-removed image getter (used by template) ─────────────
  // For each slot, returns the processed (transparent) image URL when available,
  // or the raw product URL while BG removal is in progress / failed.
  bgFor(key: SlotKey): string {
    const slot = this.slotByKey(key);
    if (!slot.selected) return '';
    const orig = slot.selected.firstImageUrl;
    return this.processedImg[key] || orig;
  }

  // Whether the BG-removed version is ready (used to enable mix-blend-mode
  // fallback when not yet ready).
  isProcessed(key: SlotKey): boolean {
    return !!this.processedImg[key];
  }

  // Trigger BG removal whenever a slot's selection changes.
  private processSlot(key: SlotKey): void {
    const slot = this.slotByKey(key);
    this.processedImg[key] = null;
    if (!slot.selected || !slot.selected.firstImageUrl) return;
    const url = slot.selected.firstImageUrl;
    this.bg.remove(url).then(processed => {
      // Guard against the user changing the slot mid-flight.
      const current = this.slotByKey(key);
      if (current.selected && current.selected.firstImageUrl === url) {
        this.processedImg[key] = processed;
      }
    });
  }

  // ─── Body morph getters ─────────────────────────────────────────────
  // Build: each step on ±3 scale shifts horizontal by 0.05 — so −3 = 0.85,
  // 0 = 1.00, +3 = 1.15 (~30% spread). Visible enough to "see" the change.
  get buildScale(): number { return 1 + this.buildIdx * 0.05; }
  // Height: linear map 150 cm → 0.92, 168 cm → 1.00, 195 cm → 1.13.
  get heightScale(): number { return 0.92 + (this.heightCm - 150) * (0.21 / 45); }

  // Stepper handlers — clamped, multiple clicks compound naturally.
  adjustBuild(delta: number): void {
    this.buildIdx = Math.max(-3, Math.min(3, this.buildIdx + delta));
  }
  adjustHeight(delta: number): void {
    this.heightCm = Math.max(150, Math.min(195, this.heightCm + delta));
  }

  get buildLabel(): string {
    const labels = ['Très mince', 'Mince', 'Fine', 'Standard', 'Pulpeuse', 'Forte', 'Plus forte'];
    return labels[this.buildIdx + 3];
  }
  get currentSkin(): string {
    return this.toneOptions.find(t => t.key === this.skinTone)?.color || '#eac298';
  }
  setSkinTone(t: SkinTone): void { this.skinTone = t; }

  lighten(hex: string, pct: number): string { return this.adjust(hex, pct); }
  darken(hex: string, pct: number): string { return this.adjust(hex, -pct); }
  private adjust(hex: string, pct: number): string {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return hex;
    const f = (h: string) => Math.max(0, Math.min(255, parseInt(h, 16) + Math.round(255 * pct / 100)));
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return '#' + toHex(f(m[1])) + toHex(f(m[2])) + toHex(f(m[3]));
  }

  getBodyLabel(): string {
    const genderLbl = this.gender === 'F' ? 'Femme' : 'Homme';
    return `${genderLbl} · ${this.heightCm} cm · ${this.buildLabel}`;
  }

  // ─── Slot helpers ───────────────────────────────────────────────────
  slotByKey(k: SlotKey): Slot { return this.slots.find(s => s.key === k)!; }
  get totalItems(): number { return this.slots.filter(s => !!s.selected).length; }
  get totalPrice(): number {
    return this.slots.reduce((sum, s) => sum + (s.selected ? Number(s.selected.currentPrice) || 0 : 0), 0);
  }
  get filteredCatalog(): CatalogProduct[] {
    if (!this.pickerFor) return [];
    const rx = this.slotKeywords[this.pickerFor.key];
    const q = (this.search || '').trim().toLowerCase();
    return this.catalog.filter(p => {
      if (!rx.test(p.title || '')) return false;
      if (!q) return true;
      return (p.title || '').toLowerCase().includes(q);
    });
  }

  setGender(g: 'M' | 'F'): void {
    if (this.gender === g) return;
    this.gender = g;
    this.slots.forEach(s => {
      if (s.selected && s.selected.famille && s.selected.famille !== 'UNISEX') {
        const wantWomen = g === 'F';
        const isWomen = s.selected.famille === 'WOMEN';
        if (wantWomen !== isWomen) {
          s.selected = null;
          this.processedImg[s.key] = null;
        }
      }
    });
    this.aiSuggestions = [];
    this.loadCatalog();
  }

  openPicker(s: Slot): void {
    this.pickerFor = s;
    this.pickerOpen = true;
    this.search = '';
    if (this.catalog.length === 0) this.loadCatalog();
  }
  closePicker(): void {
    this.pickerOpen = false;
    this.pickerFor = null;
    this.search = '';
  }
  clear(s: Slot): void {
    s.selected = null;
    this.processedImg[s.key] = null;
  }
  resetAll(): void {
    this.slots.forEach(s => s.selected = null);
    this.processedImg = { TOP: null, BOTTOM: null, SHOES: null, ACCESSORY: null };
    this.aiSuggestions = [];
    this.showToast('Tenue réinitialisée', 'ok');
  }
  pick(p: CatalogProduct): void {
    if (!this.pickerFor) return;
    const key = this.pickerFor.key;
    this.pickerFor.selected = p;
    this.closePicker();
    this.processSlot(key);
    this.showToast(`${p.title} ajouté à votre tenue`, 'ok');
  }

  // ─── Catalogue loading ──────────────────────────────────────────────
  loadCatalog(): void {
    this.catalogLoading = true;
    const famille = this.gender === 'F' ? 'WOMEN' : 'MEN';
    const url = (f: string) => `${environementDev.api}/api/products?limit=200&famille=${f}`;
    Promise.all([this.fetch(url(famille)), this.fetch(url('UNISEX'))]).then(([primary, extra]) => {
      const seen = new Set<number>();
      const merged: CatalogProduct[] = [];
      for (const p of [...primary, ...extra]) {
        if (!seen.has(p.id) && p.firstImageUrl) {
          seen.add(p.id); merged.push(p);
        }
      }
      this.catalog = merged;
      this.catalogLoading = false;
    }).catch(() => { this.catalog = []; this.catalogLoading = false; });
  }
  private fetch(url: string): Promise<CatalogProduct[]> {
    return new Promise(resolve => {
      this.http.get<{ items: any[] }>(url).subscribe({
        next: r => resolve((r?.items || []).map(p => this.normalize(p))),
        error: () => resolve([]),
      });
    });
  }
  private normalize(p: any): CatalogProduct {
    return {
      id: p.id,
      title: p.title || '',
      slug: p.slug || '',
      currentPrice: Number(p.currentPrice || p.price || 0),
      firstImageUrl: p.firstImageUrl || (p.images?.[0]?.imageUrl) || '',
      famille: p.famille,
      sku: p.sku,
      ean13: p.ean13 || p.sku || '',
    };
  }

  // ─── AI completion ──────────────────────────────────────────────────
  askAiCompletion(): void {
    const anchor = this.slots.find(s => !!s.selected);
    if (!anchor) {
      this.showToast("Choisissez d'abord un article pour orienter le styliste.", 'err');
      return;
    }
    this.aiLoading = true;
    const token = localStorage.getItem('jwt') || '';
    const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
    this.http.get<any>(
      `${environementDev.api}/api/storefront/w3/complete-outfit/${anchor.selected.id}`,
      { headers }
    ).subscribe({
      next: (r) => {
        const emptyKeys = new Set(this.slots.filter(s => !s.selected).map(s => s.key));
        const candidates = (r?.outfit || [])
          .map((p: any) => this.normalize(p))
          .filter((p: CatalogProduct) => p.firstImageUrl);
        const seen = new Set<number>();
        const picked: CatalogProduct[] = [];
        for (const slot of this.slots.filter(s => emptyKeys.has(s.key))) {
          const rx = this.slotKeywords[slot.key];
          const match = candidates.find((c: CatalogProduct) => rx.test(c.title) && !seen.has(c.id));
          if (match) { picked.push(match); seen.add(match.id); }
        }
        this.aiSuggestions = picked.length > 0 ? picked : candidates.slice(0, 4);
        this.aiLoading = false;
        if (this.aiSuggestions.length === 0) {
          this.showToast('Aucune suggestion pertinente trouvée.', 'err');
        }
      },
      error: () => {
        this.aiLoading = false;
        this.showToast("L'IA est temporairement indisponible.", 'err');
      }
    });
  }

  addSuggestion(p: CatalogProduct): void {
    let target: Slot | undefined;
    for (const slot of this.slots) {
      if (this.slotKeywords[slot.key].test(p.title)) { target = slot; break; }
    }
    if (!target) target = this.slots.find(s => !s.selected);
    if (target) {
      target.selected = p;
      this.processSlot(target.key);
      this.aiSuggestions = this.aiSuggestions.filter(s => s.id !== p.id);
      this.showToast(`${p.title} ajouté à ${target.label}`, 'ok');
    }
  }

  // ─── Cart ───────────────────────────────────────────────────────────
  addAllToCart(): void {
    const items = this.slots.filter(s => !!s.selected).map(s => s.selected);
    if (items.length === 0) {
      this.showToast("Sélectionnez au moins un article.", 'err');
      return;
    }
    for (const p of items) {
      const cartItem: CartItem = {
        product: {
          id: p.id, title: p.title, sku: p.sku || '',
          currentPrice: p.currentPrice, firstImageUrl: p.firstImageUrl,
        } as any,
        image: p.firstImageUrl,
        quantity: 1,
        selectedColor: '', selectedSize: '',
        ean13: p.ean13 || p.sku || `BSH-${p.id}`,
      };
      this.cartService.addToCartDirectly(cartItem);
    }
    this.showToast(`${items.length} article(s) ajouté(s) au panier ✓`, 'ok');
  }

  // ─── Realistic preview / save / share ───────────────────────────────
  openRealistic(): void {
    if (this.totalItems === 0) {
      this.showToast("Sélectionnez d'abord au moins un article.", 'err');
      return;
    }
    this.realisticOpen = true;
    this.stylistNote = '';
  }
  closeRealistic(): void {
    this.realisticOpen = false;
    this.stylistLoading = false;
  }

  // Generate a professional stylist note via the existing /api/chat endpoint.
  // Falls back gracefully if the AI service is unreachable.
  generateStylistNote(): void {
    const items = this.slots.filter(s => !!s.selected).map(s => `${s.label}: ${s.selected.title}`);
    if (items.length === 0) return;
    this.stylistLoading = true;
    this.stylistNote = '';

    const messages = [{
      role: 'user',
      content:
        `Tu es un styliste professionnel pour la marque Barsha (mode tunisienne). ` +
        `Je porte cette tenue : ${items.join(', ')}. ` +
        `Genre : ${this.gender === 'F' ? 'femme' : 'homme'}, taille : ${this.heightCm} cm, ` +
        `corpulence : ${this.buildLabel.toLowerCase()}. ` +
        `Donne-moi en 3 à 4 phrases courtes une critique stylistique élégante : ` +
        `est-ce que la tenue fonctionne, dans quel contexte la porter, ` +
        `et un conseil pour l'élever davantage. Reste précis et professionnel, sans flatterie.`
    }];

    this.http.post<any>(`${environementDev.api}/api/chat`, { messages })
      .subscribe({
        next: (r) => {
          this.stylistLoading = false;
          // Backend returns { reply, products?, ... } or similar
          this.stylistNote = (r?.reply || r?.message || r?.text || '').trim()
            || "Cette tenue présente de bons fondamentaux. Pensez à harmoniser les textures et à choisir des accessoires en cohérence avec votre carnation pour un résultat plus abouti.";
        },
        error: () => {
          this.stylistLoading = false;
          // Honest fallback: a generic but useful note rather than a fake "AI" response.
          this.stylistNote =
            "L'avis du styliste est temporairement indisponible. Pensez à équilibrer les volumes (haut près du corps avec un bas plus fluide, ou inversement) et à laisser une couleur dominante. Vos accessoires doivent rester sobres pour ne pas saturer la tenue.";
        }
      });
  }

  saveLook(): void {
    const items = this.slots.filter(s => !!s.selected).map(s => ({
      key: s.key,
      productId: s.selected.id,
      title: s.selected.title,
      price: s.selected.currentPrice,
    }));
    if (items.length === 0) {
      this.showToast("Sélectionnez au moins un article.", 'err');
      return;
    }
    const look = {
      id: 'look-' + Date.now(),
      gender: this.gender,
      skinTone: this.skinTone,
      heightCm: this.heightCm,
      buildIdx: this.buildIdx,
      items,
      total: this.totalPrice,
      savedAt: new Date().toISOString(),
    };
    try {
      const key = 'barsha:saved-looks';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.unshift(look);
      // Cap to most recent 20 to avoid quota issues.
      localStorage.setItem(key, JSON.stringify(existing.slice(0, 20)));
      this.showToast('Look sauvegardé ✓', 'ok');
    } catch {
      this.showToast('Impossible de sauvegarder (stockage saturé)', 'err');
    }
  }

  shareLook(): void {
    const items = this.slots.filter(s => !!s.selected).map(s => `${s.label}: ${s.selected.title}`);
    if (items.length === 0) {
      this.showToast("Sélectionnez au moins un article.", 'err');
      return;
    }
    const text =
      `Mon look Barsha — ${items.join(' · ')} — Total : ${this.totalPrice.toFixed(2)} TND`;
    const url = window.location.href;

    // Web Share API where available (mobile + some desktop browsers).
    const nav: any = navigator;
    if (typeof nav.share === 'function') {
      nav.share({ title: 'Mon look Barsha', text, url })
        .then(() => this.showToast('Partagé', 'ok'))
        .catch(() => { /* user cancelled */ });
      return;
    }
    // Fallback: copy to clipboard.
    const blob = `${text}\n${url}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(blob).then(
        () => this.showToast('Lien copié dans le presse-papiers', 'ok'),
        () => this.showToast('Impossible de copier', 'err'),
      );
    } else {
      this.showToast('Partage non supporté par ce navigateur', 'err');
    }
  }

  // ─── UX helpers ─────────────────────────────────────────────────────
  onImgError(ev: Event): void {
    const img = ev.target as HTMLImageElement;
    img.style.opacity = '0.3';
    img.src =
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><rect width="60" height="60" fill="%23f3f4f6"/><text x="30" y="34" text-anchor="middle" font-family="sans-serif" font-size="9" fill="%239ca3af">image</text></svg>`
      );
  }

  private toastTimer: any;
  private showToast(msg: string, kind: 'ok' | 'err'): void {
    this.toast = { msg, kind };
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = { msg: '', kind: 'ok' }), 3500);
  }
}
