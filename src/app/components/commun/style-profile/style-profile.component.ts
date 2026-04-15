/**
 * BARSHA USER STYLE PROFILE COMPONENT
 * ====================================
 * Interactive style preference builder for personalized recommendations.
 *
 * Features:
 * - Style preference selection (casual, chic, sporty, elegant)
 * - Color palette preferences
 * - Size preferences
 * - Occasion preferences
 * - Backend persistence via UserPreferencesService
 */

import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserPreferencesService, UserStyleProfile } from '../../../services/user-preferences.service';

interface StyleOption {
  id: string;
  name: string;
  description: string;
  image?: string;
  selected: boolean;
}

interface ColorOption {
  id: string;
  name: string;
  hex: string;
  selected: boolean;
}

interface OccasionOption {
  id: string;
  name: string;
  icon: string;
  selected: boolean;
}

@Component({
  selector: 'app-style-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="style-profile-container" [class.loading]="isLoading">
      <!-- Loading Overlay -->
      <div class="loading-overlay" *ngIf="isLoading">
        <div class="loading-spinner"></div>
        <span>Chargement de votre profil...</span>
      </div>

      <header class="profile-header">
        <div class="header-content">
          <h2>Votre profil style</h2>
          <p>Personnalisez vos recommandations en nous parlant de vos préférences</p>
          <div class="sync-status" *ngIf="!isLoading">
            <span class="sync-badge" [class.synced]="backendSynced" [class.local]="!backendSynced">
              <svg *ngIf="backendSynced" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <svg *ngIf="!backendSynced" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="2" width="20" height="20" rx="2"/>
                <path d="M8 8h8v8H8z"/>
              </svg>
              {{ backendSynced ? 'Synchronisé' : 'Local uniquement' }}
            </span>
          </div>
        </div>
        <div class="completion-indicator">
          <div class="completion-bar">
            <div class="completion-fill" [style.width.%]="completionPercentage"></div>
          </div>
          <span class="completion-text">{{ completionPercentage }}% complété</span>
        </div>
      </header>

      <!-- Style Preferences -->
      <section class="profile-section">
        <h3 class="section-title">
          <span class="title-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </span>
          Vos styles préférés
        </h3>
        <p class="section-description">Sélectionnez les styles qui vous correspondent</p>

        <div class="style-grid">
          <button
            *ngFor="let style of styleOptions"
            class="style-card"
            [class.selected]="style.selected"
            (click)="toggleStyle(style)"
          >
            <div class="style-visual" [attr.data-style]="style.id">
              <svg *ngIf="style.id === 'casual'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <svg *ngIf="style.id === 'chic'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
              <svg *ngIf="style.id === 'sporty'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
              <svg *ngIf="style.id === 'elegant'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </div>
            <div class="style-info">
              <span class="style-name">{{ style.name }}</span>
              <span class="style-desc">{{ style.description }}</span>
            </div>
            <div class="selected-check" *ngIf="style.selected">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
          </button>
        </div>
      </section>

      <!-- Color Preferences -->
      <section class="profile-section">
        <h3 class="section-title">
          <span class="title-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2a10 10 0 0 1 0 20"/>
            </svg>
          </span>
          Vos couleurs favorites
        </h3>
        <p class="section-description">Choisissez jusqu'à 5 couleurs que vous aimez porter</p>

        <div class="color-grid">
          <button
            *ngFor="let color of colorOptions"
            class="color-chip"
            [class.selected]="color.selected"
            [style.--color-value]="color.hex"
            [attr.aria-label]="color.name"
            [attr.title]="color.name"
            (click)="toggleColor(color)"
            [disabled]="!color.selected && selectedColorsCount >= 5"
          >
            <span class="color-swatch"></span>
            <span class="color-name">{{ color.name }}</span>
            <span class="color-check" *ngIf="color.selected">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </span>
          </button>
        </div>
      </section>

      <!-- Occasions -->
      <section class="profile-section">
        <h3 class="section-title">
          <span class="title-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </span>
          Occasions typiques
        </h3>
        <p class="section-description">Pour quelles occasions achetez-vous principalement ?</p>

        <div class="occasion-grid">
          <button
            *ngFor="let occasion of occasionOptions"
            class="occasion-chip"
            [class.selected]="occasion.selected"
            (click)="toggleOccasion(occasion)"
          >
            <span class="occasion-icon">{{ occasion.icon }}</span>
            <span class="occasion-name">{{ occasion.name }}</span>
          </button>
        </div>
      </section>

      <!-- Save Button -->
      <div class="profile-actions">
        <button class="save-btn" (click)="saveProfile()" [disabled]="isSaving">
          <span *ngIf="!isSaving">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            Sauvegarder mes préférences
          </span>
          <span *ngIf="isSaving">Sauvegarde en cours...</span>
        </button>
        <p class="save-note" *ngIf="lastSaved">
          Dernière sauvegarde : {{ lastSaved | date:'dd/MM/yyyy à HH:mm' }}
        </p>
      </div>
    </div>
  `,
  styles: [`
    .style-profile-container {
      position: relative;
      padding: 1.5rem;
      background: #fff;
      border-radius: 12px;
    }

    .style-profile-container.loading {
      min-height: 300px;
    }

    /* Loading Overlay */
    .loading-overlay {
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.95);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      z-index: 10;
      border-radius: 12px;
    }

    .loading-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #f0f0f0;
      border-top-color: #667eea;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading-overlay span {
      font-family: 'std55', sans-serif;
      font-size: 0.9rem;
      color: #666;
    }

    /* Sync Status */
    .sync-status {
      margin-top: 0.5rem;
    }

    .sync-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.6rem;
      border-radius: 12px;
      font-family: 'std55', sans-serif;
      font-size: 0.7rem;
      font-weight: 500;
    }

    .sync-badge svg {
      width: 12px;
      height: 12px;
    }

    .sync-badge.synced {
      background: rgba(76, 175, 80, 0.1);
      color: #4caf50;
    }

    .sync-badge.local {
      background: rgba(255, 152, 0, 0.1);
      color: #ff9800;
    }

    .profile-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid #f0f0f0;
    }

    .header-content h2 {
      font-family: 'std95', sans-serif;
      font-size: 1.35rem;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 0.35rem;
    }

    .header-content p {
      font-family: 'std55', sans-serif;
      font-size: 0.9rem;
      color: #666;
      margin: 0;
    }

    .completion-indicator {
      text-align: right;
    }

    .completion-bar {
      width: 120px;
      height: 6px;
      background: #f0f0f0;
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 0.35rem;
    }

    .completion-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      border-radius: 3px;
      transition: width 0.4s ease;
    }

    .completion-text {
      font-size: 0.75rem;
      color: #888;
    }

    .profile-section {
      margin-bottom: 2rem;
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-family: 'std95', sans-serif;
      font-size: 1rem;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 0.35rem;
    }

    .title-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      color: #667eea;
    }

    .title-icon svg {
      width: 18px;
      height: 18px;
    }

    .section-description {
      font-family: 'std55', sans-serif;
      font-size: 0.85rem;
      color: #888;
      margin: 0 0 1rem;
      padding-left: 34px;
    }

    /* Style Grid */
    .style-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
    }

    .style-card {
      position: relative;
      padding: 1.25rem 1rem;
      background: #fafafa;
      border: 2px solid transparent;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.25s ease;
      text-align: center;
    }

    .style-card:hover {
      background: #f5f5f5;
      border-color: #e0e0e0;
    }

    .style-card.selected {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08));
      border-color: #667eea;
    }

    .style-visual {
      width: 48px;
      height: 48px;
      margin: 0 auto 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }

    .style-visual svg {
      width: 24px;
      height: 24px;
      color: #666;
    }

    .style-card.selected .style-visual svg {
      color: #667eea;
    }

    .style-info {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .style-name {
      font-family: 'std55', sans-serif;
      font-size: 0.9rem;
      font-weight: 500;
      color: #1a1a1a;
    }

    .style-desc {
      font-family: 'std55', sans-serif;
      font-size: 0.75rem;
      color: #888;
    }

    .selected-check {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      width: 20px;
      height: 20px;
      background: #667eea;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .selected-check svg {
      width: 12px;
      height: 12px;
      color: #fff;
    }

    /* Color Grid */
    .color-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .color-chip {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.85rem;
      background: #fff;
      border: 1px solid #e5e5e5;
      border-radius: 24px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .color-chip:hover:not(:disabled) {
      border-color: #ccc;
      transform: translateY(-1px);
    }

    .color-chip.selected {
      border-color: var(--color-value);
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.05), rgba(118, 75, 162, 0.05));
    }

    .color-chip:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .color-swatch {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--color-value);
      border: 1px solid rgba(0,0,0,0.1);
    }

    .color-name {
      font-family: 'std55', sans-serif;
      font-size: 0.8rem;
      color: #333;
    }

    .color-check {
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .color-check svg {
      width: 14px;
      height: 14px;
      color: #667eea;
    }

    /* Occasion Grid */
    .occasion-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .occasion-chip {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.65rem 1rem;
      background: #fafafa;
      border: 2px solid transparent;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .occasion-chip:hover {
      background: #f5f5f5;
      border-color: #e0e0e0;
    }

    .occasion-chip.selected {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
      border-color: #667eea;
    }

    .occasion-icon {
      font-size: 1.1rem;
    }

    .occasion-name {
      font-family: 'std55', sans-serif;
      font-size: 0.85rem;
      color: #333;
    }

    /* Actions */
    .profile-actions {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid #f0f0f0;
      text-align: center;
    }

    .save-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.85rem 2rem;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: #fff;
      border: none;
      border-radius: 8px;
      font-family: 'std55', sans-serif;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.25s ease;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.25);
    }

    .save-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.35);
    }

    .save-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .save-btn svg {
      width: 18px;
      height: 18px;
    }

    .save-note {
      font-family: 'std55', sans-serif;
      font-size: 0.75rem;
      color: #888;
      margin: 0.75rem 0 0;
    }

    /* Responsive */
    @media (max-width: 900px) {
      .style-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 600px) {
      .profile-header {
        flex-direction: column;
        gap: 1rem;
      }

      .completion-indicator {
        text-align: left;
        width: 100%;
      }

      .completion-bar {
        width: 100%;
      }

      .style-grid {
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
      }

      .style-card {
        padding: 1rem 0.75rem;
      }

      .section-description {
        padding-left: 0;
      }
    }
  `]
})
export class StyleProfileComponent implements OnInit {
  @Output() profileSaved = new EventEmitter<UserStyleProfile>();

  styleOptions: StyleOption[] = [
    { id: 'casual', name: 'Casual', description: 'Confort au quotidien', selected: false },
    { id: 'chic', name: 'Chic', description: 'Élégance raffinée', selected: false },
    { id: 'sporty', name: 'Sportif', description: 'Dynamique et actif', selected: false },
    { id: 'elegant', name: 'Élégant', description: 'Occasions spéciales', selected: false }
  ];

  colorOptions: ColorOption[] = [
    { id: 'noir', name: 'Noir', hex: '#1a1a1a', selected: false },
    { id: 'blanc', name: 'Blanc', hex: '#ffffff', selected: false },
    { id: 'beige', name: 'Beige', hex: '#f5f5dc', selected: false },
    { id: 'marine', name: 'Marine', hex: '#1a237e', selected: false },
    { id: 'bleu', name: 'Bleu', hex: '#2196f3', selected: false },
    { id: 'rouge', name: 'Rouge', hex: '#f44336', selected: false },
    { id: 'rose', name: 'Rose', hex: '#e91e63', selected: false },
    { id: 'gris', name: 'Gris', hex: '#9e9e9e', selected: false },
    { id: 'vert', name: 'Vert', hex: '#4caf50', selected: false },
    { id: 'marron', name: 'Marron', hex: '#795548', selected: false },
    { id: 'camel', name: 'Camel', hex: '#c19a6b', selected: false },
    { id: 'bordeaux', name: 'Bordeaux', hex: '#800020', selected: false }
  ];

  occasionOptions: OccasionOption[] = [
    { id: 'work', name: 'Travail', icon: '💼', selected: false },
    { id: 'weekend', name: 'Week-end', icon: '☀️', selected: false },
    { id: 'evening', name: 'Soirée', icon: '🌙', selected: false },
    { id: 'sport', name: 'Sport', icon: '🏃', selected: false },
    { id: 'travel', name: 'Voyage', icon: '✈️', selected: false },
    { id: 'special', name: 'Occasion spéciale', icon: '✨', selected: false }
  ];

  isSaving = false;
  isLoading = true;
  lastSaved: Date | null = null;
  backendSynced = false;
  serverCompletionScore = 0;

  constructor(private preferencesService: UserPreferencesService) {}

  ngOnInit(): void {
    this.loadProfileFromBackend();
  }

  get selectedColorsCount(): number {
    return this.colorOptions.filter(c => c.selected).length;
  }

  get completionPercentage(): number {
    // Use server-calculated score if available
    if (this.serverCompletionScore > 0) {
      return Math.round(this.serverCompletionScore);
    }

    // Fallback to client-side calculation
    const totalSections = 3;
    let completed = 0;

    if (this.styleOptions.some(s => s.selected)) completed++;
    if (this.colorOptions.some(c => c.selected)) completed++;
    if (this.occasionOptions.some(o => o.selected)) completed++;

    return Math.round((completed / totalSections) * 100);
  }

  toggleStyle(style: StyleOption): void {
    style.selected = !style.selected;
  }

  toggleColor(color: ColorOption): void {
    if (!color.selected && this.selectedColorsCount >= 5) return;
    color.selected = !color.selected;
  }

  toggleOccasion(occasion: OccasionOption): void {
    occasion.selected = !occasion.selected;
  }

  /**
   * Load profile from backend API (with localStorage fallback).
   */
  loadProfileFromBackend(): void {
    this.isLoading = true;

    this.preferencesService.getProfile().subscribe({
      next: (profile) => {
        this.applyProfileToUI(profile);
        this.backendSynced = true;
        this.isLoading = false;

        if (profile.completion_score) {
          this.serverCompletionScore = profile.completion_score;
        }

        if (profile.updated_at) {
          this.lastSaved = new Date(profile.updated_at);
        }
      },
      error: (error) => {
        console.warn('Failed to load profile from backend:', error);
        this.loadFromLocalStorageFallback();
        this.isLoading = false;
      }
    });
  }

  /**
   * Apply backend profile data to UI components.
   */
  private applyProfileToUI(profile: UserStyleProfile): void {
    // Reset all selections first
    this.styleOptions.forEach(s => s.selected = false);
    this.colorOptions.forEach(c => c.selected = false);
    this.occasionOptions.forEach(o => o.selected = false);

    // Apply styles
    (profile.preferred_styles || []).forEach(s => {
      const opt = this.styleOptions.find(so => so.id === s);
      if (opt) opt.selected = true;
    });

    // Apply colors
    (profile.preferred_colors || []).forEach(c => {
      const opt = this.colorOptions.find(co => co.id === c);
      if (opt) opt.selected = true;
    });

    // Apply occasions
    (profile.preferred_occasions || []).forEach(o => {
      const opt = this.occasionOptions.find(oo => oo.id === o);
      if (opt) opt.selected = true;
    });
  }

  /**
   * Fallback to localStorage if backend unavailable.
   */
  private loadFromLocalStorageFallback(): void {
    try {
      const saved = localStorage.getItem('barsha_style_profile');
      if (saved) {
        const data = JSON.parse(saved);

        // Handle both old format (styles) and new format (preferred_styles)
        const styles = data.preferred_styles || data.styles || [];
        const colors = data.preferred_colors || data.colors || [];
        const occasions = data.preferred_occasions || data.occasions || [];

        styles.forEach((s: string) => {
          const opt = this.styleOptions.find(so => so.id === s);
          if (opt) opt.selected = true;
        });

        colors.forEach((c: string) => {
          const opt = this.colorOptions.find(co => co.id === c);
          if (opt) opt.selected = true;
        });

        occasions.forEach((o: string) => {
          const opt = this.occasionOptions.find(oo => oo.id === o);
          if (opt) opt.selected = true;
        });

        const updatedAt = data.updated_at || data.updatedAt;
        if (updatedAt) {
          this.lastSaved = new Date(updatedAt);
        }
      }
    } catch (e) {
      console.error('Error loading style profile from localStorage:', e);
    }
  }

  /**
   * Save profile to backend (with localStorage backup).
   */
  saveProfile(): void {
    this.isSaving = true;

    const profileData: Partial<UserStyleProfile> = {
      preferred_styles: this.styleOptions.filter(s => s.selected).map(s => s.id),
      preferred_colors: this.colorOptions.filter(c => c.selected).map(c => c.id),
      preferred_occasions: this.occasionOptions.filter(o => o.selected).map(o => o.id)
    };

    this.preferencesService.updateProfile(profileData).subscribe({
      next: (profile) => {
        this.isSaving = false;
        this.backendSynced = true;
        this.lastSaved = new Date();

        if (profile.completion_score) {
          this.serverCompletionScore = profile.completion_score;
        }

        // Emit event with full profile
        this.profileSaved.emit(profile);
      },
      error: (error) => {
        console.warn('Failed to save to backend, using localStorage:', error);
        this.isSaving = false;
        this.lastSaved = new Date();
        this.backendSynced = false;

        // Emit with partial data
        this.profileSaved.emit({
          preferred_styles: profileData.preferred_styles || [],
          preferred_colors: profileData.preferred_colors || [],
          preferred_occasions: profileData.preferred_occasions || [],
          preferred_categories: []
        });
      }
    });
  }
}
