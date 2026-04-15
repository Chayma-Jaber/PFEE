import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface SizeRecommendation {
  size: string;
  confidence: number;
  message: string;
}

interface UserMeasurements {
  height: number | null;
  weight: number | null;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  footLength: number | null;
}

@Component({
  selector: 'app-size-guide-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="size-guide-overlay" *ngIf="isOpen" (click)="onOverlayClick($event)">
      <div class="size-guide-modal" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="modal-header">
          <h2 class="modal-title">Guide des tailles</h2>
          <button class="close-btn" (click)="close()" aria-label="Fermer">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Tab Navigation -->
        <div class="tab-navigation">
          <button
            class="tab-btn"
            [class.active]="activeTab === 'sizes'"
            (click)="activeTab = 'sizes'">
            <i class="fas fa-ruler"></i>
            Tableau des tailles
          </button>
          <button
            class="tab-btn"
            [class.active]="activeTab === 'finder'"
            (click)="activeTab = 'finder'">
            <i class="fas fa-search"></i>
            Trouver ma taille
          </button>
        </div>

        <!-- Content -->
        <div class="modal-content">
          <!-- Size Charts Tab -->
          <div class="tab-content" *ngIf="activeTab === 'sizes'">
            <!-- Category Tabs for Size Charts -->
            <div class="category-tabs" *ngIf="!category || category === 'all'">
              <button
                class="category-tab"
                [class.active]="activeCategory === 'vetements'"
                (click)="activeCategory = 'vetements'">
                Vetements
              </button>
              <button
                class="category-tab"
                [class.active]="activeCategory === 'chaussures'"
                (click)="activeCategory = 'chaussures'">
                Chaussures
              </button>
              <button
                class="category-tab"
                [class.active]="activeCategory === 'accessoires'"
                (click)="activeCategory = 'accessoires'">
                Accessoires
              </button>
            </div>

            <!-- Clothing Size Chart -->
            <div class="size-chart-section" *ngIf="activeCategory === 'vetements' || category === 'vetements'">
              <h3 class="section-title">
                <i class="fas fa-tshirt"></i>
                Vetements
              </h3>
              <p class="section-description">Mesurez-vous en portant des sous-vetements legers pour obtenir des mesures precises.</p>

              <div class="table-container">
                <table class="size-table">
                  <thead>
                    <tr>
                      <th>Taille</th>
                      <th>Tour de poitrine (cm)</th>
                      <th>Tour de taille (cm)</th>
                      <th>Tour de hanches (cm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let size of clothingSizes">
                      <td class="size-label">{{ size.label }}</td>
                      <td>{{ size.chest }}</td>
                      <td>{{ size.waist }}</td>
                      <td>{{ size.hips }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Visual Guide -->
              <div class="visual-guide">
                <h4>Comment prendre vos mesures</h4>
                <div class="measurement-tips">
                  <div class="tip">
                    <div class="tip-icon">
                      <i class="fas fa-arrows-alt-h"></i>
                    </div>
                    <div class="tip-content">
                      <strong>Tour de poitrine</strong>
                      <p>Mesurez horizontalement a l'endroit le plus fort de la poitrine.</p>
                    </div>
                  </div>
                  <div class="tip">
                    <div class="tip-icon">
                      <i class="fas fa-compress-alt"></i>
                    </div>
                    <div class="tip-content">
                      <strong>Tour de taille</strong>
                      <p>Mesurez a l'endroit le plus etroit de votre taille.</p>
                    </div>
                  </div>
                  <div class="tip">
                    <div class="tip-icon">
                      <i class="fas fa-expand-alt"></i>
                    </div>
                    <div class="tip-content">
                      <strong>Tour de hanches</strong>
                      <p>Mesurez a l'endroit le plus large de vos hanches.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Shoes Size Chart -->
            <div class="size-chart-section" *ngIf="activeCategory === 'chaussures' || category === 'chaussures'">
              <h3 class="section-title">
                <i class="fas fa-shoe-prints"></i>
                Chaussures
              </h3>
              <p class="section-description">Mesurez votre pied en fin de journee pour une precision optimale.</p>

              <div class="table-container">
                <table class="size-table">
                  <thead>
                    <tr>
                      <th>Taille EU</th>
                      <th>Longueur du pied (cm)</th>
                      <th>Taille UK</th>
                      <th>Taille US</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let size of shoeSizes">
                      <td class="size-label">{{ size.eu }}</td>
                      <td>{{ size.footLength }}</td>
                      <td>{{ size.uk }}</td>
                      <td>{{ size.us }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Visual Guide for Shoes -->
              <div class="visual-guide">
                <h4>Comment mesurer votre pied</h4>
                <div class="measurement-tips">
                  <div class="tip">
                    <div class="tip-icon">
                      <i class="fas fa-ruler-vertical"></i>
                    </div>
                    <div class="tip-content">
                      <strong>Longueur du pied</strong>
                      <p>Placez votre pied sur une feuille de papier et tracez le contour. Mesurez du talon au gros orteil.</p>
                    </div>
                  </div>
                  <div class="tip">
                    <div class="tip-icon">
                      <i class="fas fa-clock"></i>
                    </div>
                    <div class="tip-content">
                      <strong>Meilleur moment</strong>
                      <p>Mesurez en fin de journee car le pied gonfle legerement au cours de la journee.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Accessories Size Chart -->
            <div class="size-chart-section" *ngIf="activeCategory === 'accessoires' || category === 'accessoires'">
              <h3 class="section-title">
                <i class="fas fa-ring"></i>
                Accessoires
              </h3>

              <!-- Belt Sizes -->
              <div class="accessory-section">
                <h4 class="accessory-title">
                  <i class="fas fa-minus"></i>
                  Ceintures
                </h4>
                <div class="table-container">
                  <table class="size-table">
                    <thead>
                      <tr>
                        <th>Taille</th>
                        <th>Tour de taille (cm)</th>
                        <th>Longueur totale (cm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let size of beltSizes">
                        <td class="size-label">{{ size.label }}</td>
                        <td>{{ size.waist }}</td>
                        <td>{{ size.totalLength }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Ring Sizes -->
              <div class="accessory-section">
                <h4 class="accessory-title">
                  <i class="fas fa-ring"></i>
                  Bagues
                </h4>
                <div class="table-container">
                  <table class="size-table">
                    <thead>
                      <tr>
                        <th>Taille FR</th>
                        <th>Diametre (mm)</th>
                        <th>Circonference (mm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let size of ringSizes">
                        <td class="size-label">{{ size.fr }}</td>
                        <td>{{ size.diameter }}</td>
                        <td>{{ size.circumference }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <!-- Fit Finder Tab -->
          <div class="tab-content fit-finder" *ngIf="activeTab === 'finder'">
            <div class="finder-header">
              <h3>Trouver ma taille</h3>
              <p>Entrez vos mensurations pour obtenir une recommandation personnalisee.</p>
            </div>

            <!-- Body Diagram -->
            <div class="body-diagram">
              <div class="diagram-container">
                <svg viewBox="0 0 200 400" class="body-svg">
                  <!-- Simple body silhouette -->
                  <ellipse cx="100" cy="30" rx="25" ry="28" fill="#e0e0e0" stroke="#333" stroke-width="1"/>
                  <path d="M60,60 Q50,80 45,140 L55,140 L60,100 L70,140 L85,140 L85,60 Z" fill="#e0e0e0" stroke="#333" stroke-width="1"/>
                  <path d="M140,60 Q150,80 155,140 L145,140 L140,100 L130,140 L115,140 L115,60 Z" fill="#e0e0e0" stroke="#333" stroke-width="1"/>
                  <rect x="85" y="58" width="30" height="85" fill="#e0e0e0" stroke="#333" stroke-width="1"/>
                  <path d="M85,143 L75,280 L90,280 L100,200 L110,280 L125,280 L115,143 Z" fill="#e0e0e0" stroke="#333" stroke-width="1"/>
                  <path d="M75,280 L65,390 L85,390 L90,280 Z" fill="#e0e0e0" stroke="#333" stroke-width="1"/>
                  <path d="M110,280 L115,390 L135,390 L125,280 Z" fill="#e0e0e0" stroke="#333" stroke-width="1"/>

                  <!-- Measurement indicators -->
                  <line x1="40" y1="85" x2="160" y2="85" stroke="#007bff" stroke-width="2" stroke-dasharray="5,5"/>
                  <text x="165" y="88" fill="#007bff" font-size="10">Poitrine</text>

                  <line x1="50" y1="115" x2="150" y2="115" stroke="#28a745" stroke-width="2" stroke-dasharray="5,5"/>
                  <text x="155" y="118" fill="#28a745" font-size="10">Taille</text>

                  <line x1="55" y1="155" x2="145" y2="155" stroke="#dc3545" stroke-width="2" stroke-dasharray="5,5"/>
                  <text x="150" y="158" fill="#dc3545" font-size="10">Hanches</text>
                </svg>
              </div>
            </div>

            <!-- Measurement Form -->
            <div class="measurement-form">
              <div class="form-grid">
                <div class="form-group">
                  <label for="height">
                    <i class="fas fa-arrows-alt-v"></i>
                    Taille (cm)
                  </label>
                  <input
                    type="number"
                    id="height"
                    [(ngModel)]="measurements.height"
                    placeholder="Ex: 170"
                    min="100"
                    max="250">
                </div>

                <div class="form-group">
                  <label for="weight">
                    <i class="fas fa-weight"></i>
                    Poids (kg)
                  </label>
                  <input
                    type="number"
                    id="weight"
                    [(ngModel)]="measurements.weight"
                    placeholder="Ex: 65"
                    min="30"
                    max="200">
                </div>

                <div class="form-group">
                  <label for="chest">
                    <i class="fas fa-arrows-alt-h"></i>
                    Tour de poitrine (cm)
                  </label>
                  <input
                    type="number"
                    id="chest"
                    [(ngModel)]="measurements.chest"
                    placeholder="Ex: 90"
                    min="60"
                    max="150">
                </div>

                <div class="form-group">
                  <label for="waist">
                    <i class="fas fa-compress-alt"></i>
                    Tour de taille (cm)
                  </label>
                  <input
                    type="number"
                    id="waist"
                    [(ngModel)]="measurements.waist"
                    placeholder="Ex: 75"
                    min="50"
                    max="130">
                </div>

                <div class="form-group">
                  <label for="hips">
                    <i class="fas fa-expand-alt"></i>
                    Tour de hanches (cm)
                  </label>
                  <input
                    type="number"
                    id="hips"
                    [(ngModel)]="measurements.hips"
                    placeholder="Ex: 95"
                    min="60"
                    max="150">
                </div>

                <div class="form-group" *ngIf="category === 'chaussures' || activeCategory === 'chaussures'">
                  <label for="footLength">
                    <i class="fas fa-shoe-prints"></i>
                    Longueur du pied (cm)
                  </label>
                  <input
                    type="number"
                    id="footLength"
                    [(ngModel)]="measurements.footLength"
                    placeholder="Ex: 25"
                    min="15"
                    max="35"
                    step="0.1">
                </div>
              </div>

              <button class="find-size-btn" (click)="findMySize()" [disabled]="!canCalculate()">
                <i class="fas fa-magic"></i>
                Trouver ma taille
              </button>
            </div>

            <!-- Recommendation Result -->
            <div class="recommendation-result" *ngIf="recommendation">
              <div class="result-card" [class.high-confidence]="recommendation.confidence >= 80">
                <div class="result-header">
                  <i class="fas fa-check-circle"></i>
                  <span>Taille recommandee</span>
                </div>
                <div class="result-size">{{ recommendation.size }}</div>
                <div class="result-confidence">
                  <div class="confidence-bar">
                    <div class="confidence-fill" [style.width.%]="recommendation.confidence"></div>
                  </div>
                  <span class="confidence-text">Confiance: {{ recommendation.confidence }}%</span>
                </div>
                <p class="result-message">{{ recommendation.message }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <p class="footer-note">
            <i class="fas fa-info-circle"></i>
            Ces guides sont fournis a titre indicatif. Les tailles peuvent varier selon les modeles.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .size-guide-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.6);
      z-index: 9999;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
      animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .size-guide-modal {
      background: #fff;
      border-radius: 16px;
      max-width: 800px;
      width: 100%;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      animation: slideUp 0.3s ease;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid #e5e7eb;
      background: linear-gradient(135deg, #1a1a1a 0%, #333 100%);
      color: #fff;
    }

    .modal-title {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0;
      font-family: 'std55', sans-serif;
    }

    .close-btn {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #fff;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: rotate(90deg);
    }

    .close-btn i {
      font-size: 18px;
    }

    .tab-navigation {
      display: flex;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
    }

    .tab-btn {
      flex: 1;
      padding: 16px 24px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: #6b7280;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
      border-bottom: 2px solid transparent;
    }

    .tab-btn:hover {
      color: #1a1a1a;
      background: #f3f4f6;
    }

    .tab-btn.active {
      color: #1a1a1a;
      border-bottom-color: #1a1a1a;
      background: #fff;
    }

    .tab-btn i {
      font-size: 16px;
    }

    .modal-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }

    .category-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .category-tab {
      padding: 10px 20px;
      border: 1px solid #e5e7eb;
      background: #fff;
      border-radius: 25px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: #6b7280;
      transition: all 0.2s ease;
    }

    .category-tab:hover {
      border-color: #1a1a1a;
      color: #1a1a1a;
    }

    .category-tab.active {
      background: #1a1a1a;
      color: #fff;
      border-color: #1a1a1a;
    }

    .size-chart-section {
      margin-bottom: 32px;
    }

    .section-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 10px;
      color: #1a1a1a;
    }

    .section-title i {
      color: #6b7280;
    }

    .section-description {
      color: #6b7280;
      font-size: 14px;
      margin-bottom: 20px;
    }

    .table-container {
      overflow-x: auto;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      margin-bottom: 24px;
    }

    .size-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    .size-table th {
      background: #f9fafb;
      padding: 14px 16px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      white-space: nowrap;
      border-bottom: 1px solid #e5e7eb;
    }

    .size-table td {
      padding: 12px 16px;
      border-bottom: 1px solid #f3f4f6;
      color: #4b5563;
    }

    .size-table tr:last-child td {
      border-bottom: none;
    }

    .size-table tr:hover td {
      background: #f9fafb;
    }

    .size-label {
      font-weight: 600;
      color: #1a1a1a;
    }

    .visual-guide {
      background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
      border-radius: 12px;
      padding: 20px;
      margin-top: 20px;
    }

    .visual-guide h4 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 16px;
      color: #1a1a1a;
    }

    .measurement-tips {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .tip {
      display: flex;
      gap: 12px;
      background: #fff;
      padding: 16px;
      border-radius: 10px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .tip-icon {
      width: 40px;
      height: 40px;
      background: #1a1a1a;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .tip-icon i {
      color: #fff;
      font-size: 16px;
    }

    .tip-content strong {
      display: block;
      font-size: 14px;
      color: #1a1a1a;
      margin-bottom: 4px;
    }

    .tip-content p {
      font-size: 13px;
      color: #6b7280;
      margin: 0;
      line-height: 1.4;
    }

    .accessory-section {
      margin-bottom: 24px;
    }

    .accessory-title {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #374151;
    }

    .accessory-title i {
      color: #6b7280;
      font-size: 14px;
    }

    /* Fit Finder Styles */
    .fit-finder {
      max-width: 600px;
      margin: 0 auto;
    }

    .finder-header {
      text-align: center;
      margin-bottom: 24px;
    }

    .finder-header h3 {
      font-size: 1.5rem;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 8px;
    }

    .finder-header p {
      color: #6b7280;
      font-size: 14px;
    }

    .body-diagram {
      display: flex;
      justify-content: center;
      margin-bottom: 24px;
    }

    .diagram-container {
      width: 200px;
      height: 300px;
      background: #f9fafb;
      border-radius: 12px;
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .body-svg {
      width: 100%;
      height: 100%;
    }

    .measurement-form {
      background: #f9fafb;
      border-radius: 12px;
      padding: 24px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    @media (max-width: 480px) {
      .form-grid {
        grid-template-columns: 1fr;
      }
    }

    .form-group {
      display: flex;
      flex-direction: column;
    }

    .form-group label {
      font-size: 13px;
      font-weight: 500;
      color: #374151;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .form-group label i {
      color: #6b7280;
      font-size: 12px;
    }

    .form-group input {
      padding: 12px 14px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      transition: all 0.2s ease;
      background: #fff;
    }

    .form-group input:focus {
      outline: none;
      border-color: #1a1a1a;
      box-shadow: 0 0 0 3px rgba(26, 26, 26, 0.1);
    }

    .form-group input::placeholder {
      color: #9ca3af;
    }

    .find-size-btn {
      width: 100%;
      padding: 14px 24px;
      background: #1a1a1a;
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: all 0.2s ease;
    }

    .find-size-btn:hover:not(:disabled) {
      background: #333;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .find-size-btn:disabled {
      background: #d1d5db;
      cursor: not-allowed;
    }

    .find-size-btn i {
      font-size: 16px;
    }

    .recommendation-result {
      margin-top: 24px;
    }

    .result-card {
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 1px solid #86efac;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
    }

    .result-card.high-confidence {
      background: linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 100%);
      border-color: #4ade80;
    }

    .result-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 12px;
      color: #166534;
      font-weight: 500;
    }

    .result-header i {
      font-size: 20px;
    }

    .result-size {
      font-size: 3rem;
      font-weight: 700;
      color: #166534;
      margin-bottom: 16px;
    }

    .result-confidence {
      margin-bottom: 16px;
    }

    .confidence-bar {
      height: 8px;
      background: #d1fae5;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 8px;
    }

    .confidence-fill {
      height: 100%;
      background: linear-gradient(90deg, #4ade80, #22c55e);
      border-radius: 4px;
      transition: width 0.5s ease;
    }

    .confidence-text {
      font-size: 13px;
      color: #166534;
    }

    .result-message {
      font-size: 14px;
      color: #15803d;
      margin: 0;
    }

    .modal-footer {
      padding: 16px 24px;
      border-top: 1px solid #e5e7eb;
      background: #f9fafb;
    }

    .footer-note {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #6b7280;
      margin: 0;
    }

    .footer-note i {
      color: #9ca3af;
    }

    /* Responsive Styles */
    @media (max-width: 768px) {
      .size-guide-overlay {
        padding: 10px;
      }

      .size-guide-modal {
        max-height: 95vh;
        border-radius: 12px;
      }

      .modal-header {
        padding: 16px 20px;
      }

      .modal-title {
        font-size: 1.25rem;
      }

      .tab-btn {
        padding: 12px 16px;
        font-size: 13px;
      }

      .modal-content {
        padding: 16px;
      }

      .measurement-tips {
        grid-template-columns: 1fr;
      }

      .body-diagram {
        display: none;
      }

      .measurement-form {
        padding: 16px;
      }
    }

    @media (max-width: 480px) {
      .tab-btn {
        flex-direction: column;
        gap: 4px;
        padding: 10px 8px;
        font-size: 12px;
      }

      .category-tabs {
        justify-content: center;
      }

      .category-tab {
        padding: 8px 16px;
        font-size: 13px;
      }

      .size-table th,
      .size-table td {
        padding: 10px 12px;
        font-size: 13px;
      }

      .result-size {
        font-size: 2.5rem;
      }
    }
  `]
})
export class SizeGuideModalComponent implements OnInit {
  @Input() isOpen: boolean = false;
  @Input() category: 'vetements' | 'chaussures' | 'accessoires' | 'all' | null = null;
  @Output() closeModal = new EventEmitter<void>();

  activeTab: 'sizes' | 'finder' = 'sizes';
  activeCategory: 'vetements' | 'chaussures' | 'accessoires' = 'vetements';

  measurements: UserMeasurements = {
    height: null,
    weight: null,
    chest: null,
    waist: null,
    hips: null,
    footLength: null
  };

  recommendation: SizeRecommendation | null = null;

  // Clothing sizes data
  clothingSizes = [
    { label: 'XS', chest: '78-82', waist: '62-66', hips: '84-88' },
    { label: 'S', chest: '82-86', waist: '66-70', hips: '88-92' },
    { label: 'M', chest: '86-90', waist: '70-74', hips: '92-96' },
    { label: 'L', chest: '90-94', waist: '74-78', hips: '96-100' },
    { label: 'XL', chest: '94-98', waist: '78-82', hips: '100-104' },
    { label: 'XXL', chest: '98-102', waist: '82-86', hips: '104-108' }
  ];

  // Shoe sizes data
  shoeSizes = [
    { eu: '36', footLength: '22.5', uk: '3.5', us: '5' },
    { eu: '37', footLength: '23.0', uk: '4', us: '5.5' },
    { eu: '38', footLength: '23.5', uk: '5', us: '6.5' },
    { eu: '39', footLength: '24.5', uk: '6', us: '7.5' },
    { eu: '40', footLength: '25.0', uk: '6.5', us: '8' },
    { eu: '41', footLength: '25.5', uk: '7.5', us: '9' },
    { eu: '42', footLength: '26.5', uk: '8', us: '9.5' },
    { eu: '43', footLength: '27.0', uk: '9', us: '10.5' },
    { eu: '44', footLength: '27.5', uk: '9.5', us: '11' },
    { eu: '45', footLength: '28.5', uk: '10.5', us: '12' }
  ];

  // Belt sizes data
  beltSizes = [
    { label: 'S', waist: '70-80', totalLength: '95' },
    { label: 'M', waist: '80-90', totalLength: '105' },
    { label: 'L', waist: '90-100', totalLength: '115' },
    { label: 'XL', waist: '100-110', totalLength: '125' }
  ];

  // Ring sizes data
  ringSizes = [
    { fr: '48', diameter: '15.3', circumference: '48' },
    { fr: '50', diameter: '15.9', circumference: '50' },
    { fr: '52', diameter: '16.5', circumference: '52' },
    { fr: '54', diameter: '17.2', circumference: '54' },
    { fr: '56', diameter: '17.8', circumference: '56' },
    { fr: '58', diameter: '18.5', circumference: '58' },
    { fr: '60', diameter: '19.1', circumference: '60' },
    { fr: '62', diameter: '19.7', circumference: '62' }
  ];

  ngOnInit(): void {
    if (this.category && this.category !== 'all') {
      this.activeCategory = this.category;
    }
  }

  close(): void {
    this.closeModal.emit();
    this.recommendation = null;
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('size-guide-overlay')) {
      this.close();
    }
  }

  canCalculate(): boolean {
    // For shoes, we need foot length
    if (this.category === 'chaussures' || this.activeCategory === 'chaussures') {
      return this.measurements.footLength !== null && this.measurements.footLength > 0;
    }
    // For clothing, we need at least chest OR waist OR hips
    return (
      (this.measurements.chest !== null && this.measurements.chest > 0) ||
      (this.measurements.waist !== null && this.measurements.waist > 0) ||
      (this.measurements.hips !== null && this.measurements.hips > 0)
    );
  }

  findMySize(): void {
    if (this.category === 'chaussures' || this.activeCategory === 'chaussures') {
      this.findShoeSize();
    } else {
      this.findClothingSize();
    }
  }

  private findClothingSize(): void {
    const { chest, waist, hips } = this.measurements;
    let matchedSizes: { size: string; score: number }[] = [];

    for (const size of this.clothingSizes) {
      let score = 0;
      let measurements = 0;

      if (chest) {
        const [min, max] = size.chest.split('-').map(Number);
        if (chest >= min && chest <= max) {
          score += 100;
        } else if (chest >= min - 2 && chest <= max + 2) {
          score += 70;
        } else if (chest >= min - 4 && chest <= max + 4) {
          score += 40;
        }
        measurements++;
      }

      if (waist) {
        const [min, max] = size.waist.split('-').map(Number);
        if (waist >= min && waist <= max) {
          score += 100;
        } else if (waist >= min - 2 && waist <= max + 2) {
          score += 70;
        } else if (waist >= min - 4 && waist <= max + 4) {
          score += 40;
        }
        measurements++;
      }

      if (hips) {
        const [min, max] = size.hips.split('-').map(Number);
        if (hips >= min && hips <= max) {
          score += 100;
        } else if (hips >= min - 2 && hips <= max + 2) {
          score += 70;
        } else if (hips >= min - 4 && hips <= max + 4) {
          score += 40;
        }
        measurements++;
      }

      if (measurements > 0) {
        matchedSizes.push({
          size: size.label,
          score: Math.round(score / measurements)
        });
      }
    }

    matchedSizes.sort((a, b) => b.score - a.score);

    if (matchedSizes.length > 0) {
      const best = matchedSizes[0];
      let message = '';

      if (best.score >= 80) {
        message = 'Cette taille devrait vous convenir parfaitement.';
      } else if (best.score >= 60) {
        message = 'Cette taille devrait vous convenir. Considerez la taille au-dessus si vous preferez un ajustement plus ample.';
      } else {
        message = 'Basee sur vos mesures, cette taille est notre meilleure recommandation. Nous vous conseillons d\'essayer egalement la taille adjacente.';
      }

      this.recommendation = {
        size: best.size,
        confidence: best.score,
        message
      };
    }
  }

  private findShoeSize(): void {
    const footLength = this.measurements.footLength;
    if (!footLength) return;

    let matchedSize: { size: string; score: number } | null = null;

    for (const size of this.shoeSizes) {
      const sizeLength = parseFloat(size.footLength);
      const diff = Math.abs(footLength - sizeLength);

      if (diff <= 0.3) {
        matchedSize = { size: `EU ${size.eu}`, score: 95 };
        break;
      } else if (diff <= 0.5) {
        matchedSize = { size: `EU ${size.eu}`, score: 85 };
      } else if (diff <= 0.8 && (!matchedSize || matchedSize.score < 70)) {
        matchedSize = { size: `EU ${size.eu}`, score: 70 };
      } else if (diff <= 1.0 && (!matchedSize || matchedSize.score < 55)) {
        matchedSize = { size: `EU ${size.eu}`, score: 55 };
      }
    }

    if (matchedSize) {
      let message = '';
      if (matchedSize.score >= 85) {
        message = 'Cette pointure correspond parfaitement a la longueur de votre pied.';
      } else if (matchedSize.score >= 70) {
        message = 'Cette pointure devrait vous convenir. Si vous avez le pied large, considerez la pointure au-dessus.';
      } else {
        message = 'Basee sur vos mesures, cette pointure est notre meilleure recommandation.';
      }

      this.recommendation = {
        size: matchedSize.size,
        confidence: matchedSize.score,
        message
      };
    }
  }
}
