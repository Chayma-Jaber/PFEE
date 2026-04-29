/**
 * BARSHA VIRTUAL TRY-ON COMPONENT
 * ================================
 * Placeholder component for virtual try-on feature using AR technology.
 * Allows users to visualize products on their photos.
 *
 * Categories supported:
 * - Lunettes (glasses): positioned on face area
 * - Haut (tops): positioned on torso area
 * - Accessoires: various positions
 */

import { Component, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type TryOnCategory = 'lunettes' | 'haut' | 'accessoires' | 'other';

interface TryOnPosition {
  top: string;
  left: string;
  width: string;
  transform: string;
}

@Component({
  selector: 'app-virtual-try-on',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="virtual-try-on-overlay" *ngIf="isOpen" (click)="closeOnBackdrop($event)">
      <div class="virtual-try-on-modal" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="modal-header">
          <div class="header-content">
            <div class="ar-badge">
              <i class="fas fa-cube"></i>
              <span>Powered by AR</span>
            </div>
            <h2 class="modal-title">Essayage Virtuel</h2>
            <p class="modal-subtitle">Visualisez ce produit sur vous</p>
          </div>
          <button class="close-btn" (click)="close()" aria-label="Fermer">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Coming Soon Overlay -->
        <div class="coming-soon-overlay" *ngIf="showComingSoon">
          <div class="coming-soon-content">
            <i class="fas fa-magic"></i>
            <h3>Bientot disponible</h3>
            <p>La technologie AR sera integree prochainement pour une experience immersive.</p>
            <button class="dismiss-btn" (click)="dismissComingSoon()">
              Essayer la version demo
            </button>
          </div>
        </div>

        <!-- Main Content -->
        <div class="modal-body">
          <!-- Step Indicator -->
          <div class="steps-indicator">
            <div class="step" [class.active]="currentStep >= 1" [class.completed]="currentStep > 1">
              <span class="step-number">1</span>
              <span class="step-label">Photo</span>
            </div>
            <div class="step-line" [class.active]="currentStep > 1"></div>
            <div class="step" [class.active]="currentStep >= 2" [class.completed]="currentStep > 2">
              <span class="step-number">2</span>
              <span class="step-label">Ajuster</span>
            </div>
            <div class="step-line" [class.active]="currentStep > 2"></div>
            <div class="step" [class.active]="currentStep >= 3">
              <span class="step-number">3</span>
              <span class="step-label">Resultat</span>
            </div>
          </div>

          <!-- Step 1: Upload Photo -->
          <div class="step-content" *ngIf="currentStep === 1">
            <div class="upload-section">
              <div class="upload-instructions">
                <i class="fas fa-info-circle"></i>
                <p>{{ getInstructionText() }}</p>
              </div>

              <div class="upload-options">
                <!-- File Upload -->
                <div
                  class="upload-zone"
                  [class.drag-over]="isDragOver"
                  (dragover)="onDragOver($event)"
                  (dragleave)="onDragLeave($event)"
                  (drop)="onDrop($event)"
                  (click)="openFileSelector()"
                >
                  <input
                    type="file"
                    #fileInput
                    (change)="onFileSelected($event)"
                    accept="image/*"
                    hidden
                  >
                  <div class="upload-icon">
                    <i class="fas fa-cloud-upload-alt"></i>
                  </div>
                  <span class="upload-text">Telecharger une photo</span>
                  <span class="upload-hint">ou glisser-deposer ici</span>
                </div>

                <div class="divider">
                  <span>ou</span>
                </div>

                <!-- Camera Option -->
                <button class="camera-btn" (click)="openCamera()">
                  <i class="fas fa-camera"></i>
                  <span>Utiliser la camera</span>
                </button>
              </div>

              <!-- Demo Mode -->
              <div class="demo-mode">
                <button class="demo-btn" (click)="useDemoImage()">
                  <i class="fas fa-user"></i>
                  Utiliser une silhouette demo
                </button>
              </div>
            </div>
          </div>

          <!-- Step 2: Preview & Adjust -->
          <div class="step-content" *ngIf="currentStep === 2">
            <div class="preview-section">
              <div class="preview-container">
                <!-- User Image -->
                <div class="image-wrapper">
                  <img
                    [src]="userImage || silhouetteImage"
                    alt="Votre photo"
                    class="user-image"
                    [class.silhouette]="!userImage"
                  >

                  <!-- Product Overlay -->
                  <div
                    *ngIf="canRenderOverlay"
                    class="product-overlay"
                    [style.top]="productPosition.top"
                    [style.left]="productPosition.left"
                    [style.width]="productPosition.width"
                    [style.transform]="productPosition.transform + ' scale(' + (productScale / 100) + ')'"
                  >
                    <img [src]="productImage" [alt]="'Produit - Essayage virtuel'" class="product-image">
                  </div>

                  <div class="preview-fallback-badge" *ngIf="!canRenderOverlay">
                    Apercu demo
                  </div>
                </div>
              </div>

              <div class="preview-fallback-panel" *ngIf="!canRenderOverlay">
                <div class="fallback-product-card">
                  <img [src]="productImage" alt="Produit" class="fallback-product-image">
                </div>
                <p>
                  Cette photo produit contient deja un mannequin ou un decor.
                  On evite donc un faux collage et on garde un apercu propre.
                </p>
              </div>

              <!-- Adjustment Controls -->
              <div class="adjustment-controls" *ngIf="canRenderOverlay">
                <h4>Ajuster la taille</h4>
                <div class="slider-container">
                  <span class="slider-label">Petit</span>
                  <input
                    type="range"
                    [(ngModel)]="productScale"
                    min="50"
                    max="150"
                    step="5"
                    class="size-slider"
                  >
                  <span class="slider-label">Grand</span>
                </div>
                <div class="scale-value">{{ productScale }}%</div>
              </div>

              <!-- Action Buttons -->
              <div class="step-actions">
                <button class="back-btn" (click)="previousStep()">
                  <i class="fas fa-arrow-left"></i>
                  Retour
                </button>
                <button class="next-btn" (click)="nextStep()">
                  Voir le resultat
                  <i class="fas fa-arrow-right"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Step 3: Result -->
          <div class="step-content" *ngIf="currentStep === 3">
            <div class="result-section">
              <div class="result-container">
                <div class="image-wrapper final">
                  <img
                    [src]="userImage || silhouetteImage"
                    alt="Resultat essayage"
                    class="user-image"
                    [class.silhouette]="!userImage"
                  >
                  <div
                    *ngIf="canRenderOverlay"
                    class="product-overlay"
                    [style.top]="productPosition.top"
                    [style.left]="productPosition.left"
                    [style.width]="productPosition.width"
                    [style.transform]="productPosition.transform + ' scale(' + (productScale / 100) + ')'"
                  >
                    <img [src]="productImage" alt="Produit" class="product-image">
                  </div>

                  <div class="preview-fallback-badge" *ngIf="!canRenderOverlay">
                    Apercu demo
                  </div>
                </div>
              </div>

              <div class="preview-fallback-panel" *ngIf="!canRenderOverlay">
                <div class="fallback-product-card">
                  <img [src]="productImage" alt="Produit" class="fallback-product-image">
                </div>
                <p>
                  Resultat non fusionne: une image produit detouree est necessaire pour un essayage credible.
                </p>
              </div>

              <!-- Result Actions -->
              <div class="result-actions">
                <button class="share-btn" (click)="shareResult()">
                  <i class="fas fa-share-alt"></i>
                  Partager
                </button>
                <button class="retry-btn" (click)="resetTryOn()">
                  <i class="fas fa-redo"></i>
                  Recommencer
                </button>
              </div>

              <div class="result-note">
                <i class="fas fa-lightbulb"></i>
                <p>Ceci est un apercu. Le rendu final peut varier selon les conditions d'eclairage et la morphologie.</p>
              </div>

              <!-- Final Action -->
              <div class="final-actions">
                <button class="back-btn" (click)="previousStep()">
                  <i class="fas fa-arrow-left"></i>
                  Modifier
                </button>
                <button class="add-cart-btn" (click)="close()">
                  <i class="fas fa-shopping-bag"></i>
                  Ajouter au panier
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Category Badge -->
        <div class="category-badge">
          <i [class]="getCategoryIcon()"></i>
          <span>{{ getCategoryLabel() }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Overlay */
    .virtual-try-on-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      z-index: 10000;
      display: flex;
      justify-content: center;
      align-items: center;
      animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* Modal */
    .virtual-try-on-modal {
      position: relative;
      width: 95%;
      max-width: 600px;
      max-height: 90vh;
      background: linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5),
                  0 0 40px rgba(94, 129, 244, 0.1);
      animation: slideUp 0.4s ease;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(30px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* Header */
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 24px;
      background: linear-gradient(135deg, rgba(94, 129, 244, 0.15) 0%, transparent 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .header-content {
      flex: 1;
    }

    .ar-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      background: linear-gradient(135deg, #5e81f4 0%, #1fcf93 100%);
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      color: white;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }

    .ar-badge i {
      font-size: 10px;
    }

    .modal-title {
      font-size: 24px;
      font-weight: 700;
      color: white;
      margin: 0 0 4px 0;
      font-family: 'std55', sans-serif;
    }

    .modal-subtitle {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.6);
      margin: 0;
    }

    .close-btn {
      width: 40px;
      height: 40px;
      border: none;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 50%;
      color: white;
      font-size: 18px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: rotate(90deg);
    }

    /* Coming Soon Overlay */
    .coming-soon-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(26, 26, 46, 0.95);
      backdrop-filter: blur(10px);
      z-index: 100;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 40px;
    }

    .coming-soon-content {
      text-align: center;
      max-width: 320px;
    }

    .coming-soon-content i {
      font-size: 60px;
      color: #5e81f4;
      margin-bottom: 20px;
      animation: float 3s ease-in-out infinite;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }

    .coming-soon-content h3 {
      font-size: 28px;
      color: white;
      margin: 0 0 12px 0;
      font-weight: 700;
    }

    .coming-soon-content p {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.7);
      line-height: 1.6;
      margin: 0 0 24px 0;
    }

    .dismiss-btn {
      padding: 14px 28px;
      background: linear-gradient(135deg, #5e81f4 0%, #1fcf93 100%);
      border: none;
      border-radius: 30px;
      color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .dismiss-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(94, 129, 244, 0.4);
    }

    /* Modal Body */
    .modal-body {
      padding: 24px;
      max-height: calc(90vh - 150px);
      overflow-y: auto;
    }

    /* Steps Indicator */
    .steps-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 30px;
    }

    .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }

    .step-number {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      border: 2px solid rgba(255, 255, 255, 0.2);
      color: rgba(255, 255, 255, 0.5);
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
    }

    .step.active .step-number {
      background: linear-gradient(135deg, #5e81f4 0%, #1fcf93 100%);
      border-color: transparent;
      color: white;
      box-shadow: 0 4px 15px rgba(94, 129, 244, 0.4);
    }

    .step.completed .step-number {
      background: #1fcf93;
      border-color: transparent;
      color: white;
    }

    .step-label {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
      font-weight: 500;
    }

    .step.active .step-label {
      color: white;
    }

    .step-line {
      width: 60px;
      height: 2px;
      background: rgba(255, 255, 255, 0.1);
      margin: 0 10px;
      margin-bottom: 22px;
      transition: background 0.3s ease;
    }

    .step-line.active {
      background: linear-gradient(90deg, #5e81f4, #1fcf93);
    }

    /* Step Content */
    .step-content {
      animation: fadeInStep 0.3s ease;
    }

    @keyframes fadeInStep {
      from {
        opacity: 0;
        transform: translateX(20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    /* Upload Section */
    .upload-section {
      text-align: center;
    }

    .upload-instructions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 12px 20px;
      background: rgba(94, 129, 244, 0.1);
      border: 1px solid rgba(94, 129, 244, 0.2);
      border-radius: 12px;
      margin-bottom: 24px;
    }

    .upload-instructions i {
      color: #5e81f4;
      font-size: 16px;
    }

    .upload-instructions p {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.8);
      margin: 0;
    }

    .upload-options {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .upload-zone {
      padding: 40px 20px;
      border: 2px dashed rgba(255, 255, 255, 0.2);
      border-radius: 16px;
      cursor: pointer;
      transition: all 0.3s ease;
      background: rgba(255, 255, 255, 0.02);
    }

    .upload-zone:hover,
    .upload-zone.drag-over {
      border-color: #5e81f4;
      background: rgba(94, 129, 244, 0.1);
    }

    .upload-icon {
      width: 70px;
      height: 70px;
      margin: 0 auto 16px;
      background: linear-gradient(135deg, #5e81f4 0%, #1fcf93 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .upload-icon i {
      font-size: 28px;
      color: white;
    }

    .upload-text {
      display: block;
      font-size: 16px;
      font-weight: 600;
      color: white;
      margin-bottom: 6px;
    }

    .upload-hint {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.5);
    }

    .divider {
      display: flex;
      align-items: center;
      gap: 15px;
      color: rgba(255, 255, 255, 0.4);
      font-size: 13px;
    }

    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: rgba(255, 255, 255, 0.1);
    }

    .camera-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 16px 24px;
      background: transparent;
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      color: white;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .camera-btn:hover {
      border-color: white;
      background: rgba(255, 255, 255, 0.05);
    }

    .camera-btn i {
      font-size: 20px;
    }

    .demo-mode {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .demo-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: rgba(255, 255, 255, 0.7);
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .demo-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: white;
    }

    /* Preview Section */
    .preview-section {
      text-align: center;
    }

    .preview-container,
    .result-container {
      position: relative;
      margin-bottom: 24px;
    }

    .image-wrapper {
      position: relative;
      display: inline-block;
      border-radius: 16px;
      overflow: hidden;
      background: rgba(0, 0, 0, 0.3);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    }

    .image-wrapper.final {
      box-shadow: 0 15px 50px rgba(0, 0, 0, 0.4),
                  0 0 30px rgba(94, 129, 244, 0.2);
    }

    .user-image {
      display: block;
      max-width: 100%;
      max-height: 350px;
      object-fit: contain;
    }

    .user-image.silhouette {
      opacity: 0.6;
      filter: brightness(0.8);
    }

    .product-overlay {
      position: absolute;
      pointer-events: none;
      transition: all 0.2s ease;
    }

    .product-image {
      width: 100%;
      height: auto;
      object-fit: contain;
      filter: drop-shadow(0 5px 15px rgba(0, 0, 0, 0.3));
    }

    .preview-fallback-badge {
      position: absolute;
      left: 12px;
      bottom: 12px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(17, 24, 39, 0.85);
      border: 1px solid rgba(94, 129, 244, 0.35);
      color: white;
      font-size: 12px;
      font-weight: 600;
      backdrop-filter: blur(8px);
    }

    .preview-fallback-panel {
      display: flex;
      align-items: center;
      gap: 16px;
      margin: 0 auto 24px;
      max-width: 520px;
      padding: 16px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.08);
      text-align: left;
    }

    .preview-fallback-panel p {
      margin: 0;
      color: rgba(255, 255, 255, 0.82);
      font-size: 13px;
      line-height: 1.5;
    }

    .fallback-product-card {
      flex: 0 0 92px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.96);
    }

    .fallback-product-image {
      width: 100%;
      max-height: 110px;
      object-fit: contain;
      border-radius: 8px;
    }

    /* Adjustment Controls */
    .adjustment-controls {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .adjustment-controls h4 {
      font-size: 14px;
      font-weight: 600;
      color: white;
      margin: 0 0 16px 0;
    }

    .slider-container {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .slider-label {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
      min-width: 45px;
    }

    .slider-label:last-child {
      text-align: right;
    }

    .size-slider {
      flex: 1;
      -webkit-appearance: none;
      appearance: none;
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      outline: none;
    }

    .size-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 22px;
      height: 22px;
      background: linear-gradient(135deg, #5e81f4 0%, #1fcf93 100%);
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(94, 129, 244, 0.4);
      transition: transform 0.2s;
    }

    .size-slider::-webkit-slider-thumb:hover {
      transform: scale(1.1);
    }

    .size-slider::-moz-range-thumb {
      width: 22px;
      height: 22px;
      background: linear-gradient(135deg, #5e81f4 0%, #1fcf93 100%);
      border-radius: 50%;
      border: none;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(94, 129, 244, 0.4);
    }

    .scale-value {
      font-size: 13px;
      color: #5e81f4;
      font-weight: 600;
      margin-top: 10px;
    }

    /* Action Buttons */
    .step-actions,
    .final-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    .back-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 24px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      color: white;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .back-btn:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    .next-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 28px;
      background: linear-gradient(135deg, #5e81f4 0%, #1fcf93 100%);
      border: none;
      border-radius: 12px;
      color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .next-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(94, 129, 244, 0.4);
    }

    /* Result Actions */
    .result-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-bottom: 20px;
    }

    .share-btn,
    .retry-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 10px;
      color: white;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .share-btn:hover,
    .retry-btn:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    .result-note {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 14px;
      background: rgba(255, 193, 7, 0.1);
      border: 1px solid rgba(255, 193, 7, 0.2);
      border-radius: 10px;
      margin-bottom: 20px;
    }

    .result-note i {
      color: #ffc107;
      font-size: 16px;
      margin-top: 2px;
    }

    .result-note p {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      margin: 0;
      line-height: 1.5;
      text-align: left;
    }

    .add-cart-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 32px;
      background: linear-gradient(135deg, #5e81f4 0%, #1fcf93 100%);
      border: none;
      border-radius: 12px;
      color: white;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .add-cart-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(94, 129, 244, 0.4);
    }

    /* Category Badge */
    .category-badge {
      position: absolute;
      bottom: 20px;
      left: 20px;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.8);
    }

    .category-badge i {
      font-size: 14px;
      color: #5e81f4;
    }

    /* Responsive */
    @media (max-width: 576px) {
      .virtual-try-on-modal {
        width: 100%;
        max-width: 100%;
        height: 100%;
        max-height: 100%;
        border-radius: 0;
      }

      .modal-header {
        padding: 16px;
      }

      .modal-title {
        font-size: 20px;
      }

      .modal-body {
        padding: 16px;
        max-height: calc(100vh - 120px);
      }

      .step-line {
        width: 30px;
      }

      .upload-zone {
        padding: 30px 15px;
      }

      .upload-icon {
        width: 60px;
        height: 60px;
      }

      .upload-icon i {
        font-size: 24px;
      }

      .user-image {
        max-height: 280px;
      }

      .step-actions,
      .final-actions,
      .result-actions,
      .preview-fallback-panel {
        flex-direction: column;
      }

      .back-btn,
      .next-btn,
      .add-cart-btn,
      .share-btn,
      .retry-btn {
        width: 100%;
        justify-content: center;
      }
    }

    @media (max-width: 380px) {
      .steps-indicator {
        transform: scale(0.9);
      }

      .modal-title {
        font-size: 18px;
      }

      .ar-badge {
        font-size: 10px;
        padding: 3px 10px;
      }
    }
  `]
})
export class VirtualTryOnComponent {
  @Input() productId: number = 0;
  @Input() productImage: string = '';
  @Input() productCategory: string = '';
  @Output() closeEvent = new EventEmitter<void>();
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  isOpen = false;
  showComingSoon = true;
  currentStep = 1;
  isDragOver = false;

  userImage: string | null = null;
  productScale = 100;

  // Default silhouette image (base64 placeholder)
  silhouetteImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDMwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjMkQzNDQ4Ii8+CjxjaXJjbGUgY3g9IjE1MCIgY3k9IjgwIiByPSI0NSIgZmlsbD0iIzRBNTU2OCIvPgo8cGF0aCBkPSJNNzAgMTgwQzcwIDE2MCA5MCAxNDAgMTUwIDE0MEMyMTAgMTQwIDIzMCAxNjAgMjMwIDE4MFYzNjBDMjMwIDM4MCAyMTAgNDAwIDE1MCA0MDBDOTA0MDAgNzAgMzgwIDcwIDM2MFYxODBaIiBmaWxsPSIjNEE1NTY4Ii8+CjxwYXRoIGQ9Ik03MCAyMDBMNTAgMjgwTDQwIDM2MEw2MCAzNjBMOTAgMjgwTDcwIDIwMFoiIGZpbGw9IiM0QTU1NjgiLz4KPHBhdGggZD0iTTIzMCAyMDBMMjUwIDI4MEwyNjAgMzYwTDI0MCAzNjBMMjEwIDI4MEwyMzAgMjAwWiIgZmlsbD0iIzRBNTU2OCIvPgo8L3N2Zz4K';

  // Category-specific product positions
  private categoryPositions: Record<TryOnCategory, TryOnPosition> = {
    lunettes: { top: '12%', left: '50%', width: '45%', transform: 'translateX(-50%)' },
    haut: { top: '35%', left: '50%', width: '70%', transform: 'translateX(-50%)' },
    accessoires: { top: '25%', left: '50%', width: '40%', transform: 'translateX(-50%)' },
    other: { top: '30%', left: '50%', width: '50%', transform: 'translateX(-50%)' }
  };

  get productPosition(): TryOnPosition {
    const category = this.normalizeCategory(this.productCategory);
    return this.categoryPositions[category] || this.categoryPositions['other'];
  }

  get canRenderOverlay(): boolean {
    return this.isOverlayFriendlyImage(this.productImage);
  }

  open(): void {
    this.isOpen = true;
    this.showComingSoon = true;
    this.currentStep = 1;
    this.userImage = null;
    this.productScale = 100;
  }

  close(): void {
    this.isOpen = false;
    this.closeEvent.emit();
  }

  closeOnBackdrop(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('virtual-try-on-overlay')) {
      this.close();
    }
  }

  dismissComingSoon(): void {
    this.showComingSoon = false;
  }

  private isOverlayFriendlyImage(imageUrl: string): boolean {
    if (!imageUrl) {
      return false;
    }

    const normalizedUrl = imageUrl.toLowerCase();
    const overlayHints = [
      'transparent',
      'detoure',
      'detouree',
      'cutout',
      'isolated',
      'ghost',
      'packshot',
      'flat',
      'overlay'
    ];

    return normalizedUrl.endsWith('.png') ||
      normalizedUrl.startsWith('data:image/png') ||
      overlayHints.some((hint) => normalizedUrl.includes(hint));
  }

  private normalizeCategory(category: string): TryOnCategory {
    const lowerCategory = category.toLowerCase();

    if (lowerCategory.includes('lunette') || lowerCategory.includes('glass') || lowerCategory.includes('optic')) {
      return 'lunettes';
    }
    if (lowerCategory.includes('haut') || lowerCategory.includes('shirt') || lowerCategory.includes('top') ||
        lowerCategory.includes('pull') || lowerCategory.includes('veste') || lowerCategory.includes('blouson') ||
        lowerCategory.includes('jacket') || lowerCategory.includes('sweat') || lowerCategory.includes('chemise')) {
      return 'haut';
    }
    if (lowerCategory.includes('access') || lowerCategory.includes('sac') || lowerCategory.includes('bag') ||
        lowerCategory.includes('ceinture') || lowerCategory.includes('belt') || lowerCategory.includes('montre') ||
        lowerCategory.includes('watch') || lowerCategory.includes('bijou') || lowerCategory.includes('jewel')) {
      return 'accessoires';
    }

    return 'other';
  }

  getInstructionText(): string {
    const category = this.normalizeCategory(this.productCategory);

    switch (category) {
      case 'lunettes':
        return 'Prenez une photo de votre visage de face pour un meilleur resultat.';
      case 'haut':
        return 'Prenez une photo de vous debout, de face, avec les bras le long du corps.';
      case 'accessoires':
        return 'Prenez une photo claire pour positionner l\'accessoire.';
      default:
        return 'Prenez une photo de vous pour visualiser ce produit.';
    }
  }

  getCategoryIcon(): string {
    const category = this.normalizeCategory(this.productCategory);

    switch (category) {
      case 'lunettes':
        return 'fas fa-glasses';
      case 'haut':
        return 'fas fa-tshirt';
      case 'accessoires':
        return 'fas fa-gem';
      default:
        return 'fas fa-cube';
    }
  }

  getCategoryLabel(): string {
    const category = this.normalizeCategory(this.productCategory);

    switch (category) {
      case 'lunettes':
        return 'Lunettes';
      case 'haut':
        return 'Haut';
      case 'accessoires':
        return 'Accessoire';
      default:
        return 'Produit';
    }
  }

  openFileSelector(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.processFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      this.processFile(event.dataTransfer.files[0]);
    }
  }

  private processFile(file: File): void {
    if (!file.type.startsWith('image/')) {
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.userImage = e.target?.result as string;
      this.nextStep();
    };
    reader.readAsDataURL(file);
  }

  openCamera(): void {
    // Placeholder - actual camera implementation would go here
    // For now, just open file selector with camera capture hint
    if (this.fileInput) {
      this.fileInput.nativeElement.setAttribute('capture', 'user');
      this.fileInput.nativeElement.click();
    }
  }

  useDemoImage(): void {
    this.userImage = null; // Will use silhouette
    this.nextStep();
  }

  nextStep(): void {
    if (this.currentStep < 3) {
      this.currentStep++;
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  resetTryOn(): void {
    this.currentStep = 1;
    this.userImage = null;
    this.productScale = 100;
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  shareResult(): void {
    // Placeholder for share functionality
    // Could integrate with Web Share API or social sharing
    if (navigator.share) {
      navigator.share({
        title: 'Mon essayage virtuel Barsha',
        text: 'Regardez cet article que j\'ai essaye virtuellement sur Barsha!',
        url: window.location.href
      }).catch(() => {
        // Share cancelled or failed
      });
    }
  }
}
