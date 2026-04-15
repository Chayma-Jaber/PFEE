import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin-content',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-content-manager">
      <div class="page-header">
        <h1>Gestion du contenu</h1>
      </div>

      <div class="content-sections">
        <!-- Banners Section -->
        <div class="section-card">
          <div class="section-header">
            <h2><i class="fas fa-image"></i> Bannières</h2>
            <button class="btn-add" (click)="addBanner()">
              <i class="fas fa-plus"></i> Ajouter
            </button>
          </div>
          <div class="section-content">
            <div class="banner-item" *ngFor="let banner of banners">
              <div class="banner-preview" *ngIf="banner.desktopImageUrl">
                <img [src]="banner.desktopImageUrl" [alt]="banner.name">
              </div>
              <div class="banner-info">
                <h3>{{ banner.name }}</h3>
                <p>{{ banner.location }}</p>
                <span class="status" [class.active]="banner.isActive">
                  {{ banner.isActive ? 'Actif' : 'Inactif' }}
                </span>
              </div>
              <div class="banner-actions">
                <button class="btn-edit" (click)="editBanner(banner)">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn-toggle" (click)="toggleBanner(banner)">
                  <i class="fas" [class.fa-eye]="banner.isActive" [class.fa-eye-slash]="!banner.isActive"></i>
                </button>
              </div>
            </div>
            <div class="empty-state" *ngIf="banners.length === 0">
              <p>Aucune bannière configurée</p>
            </div>
          </div>
        </div>

        <!-- Homepage Sections -->
        <div class="section-card">
          <div class="section-header">
            <h2><i class="fas fa-home"></i> Sections page d'accueil</h2>
          </div>
          <div class="section-content">
            <div class="section-item" *ngFor="let section of homeSections">
              <div class="section-info">
                <h3>{{ section.label }}</h3>
                <p>{{ section.description }}</p>
              </div>
              <div class="section-status">
                <span class="status" [class.active]="section.enabled">
                  {{ section.enabled ? 'Activé' : 'Désactivé' }}
                </span>
              </div>
              <div class="section-actions">
                <label class="toggle-switch">
                  <input type="checkbox" [(ngModel)]="section.enabled" (change)="toggleSection(section)">
                  <span class="slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- AI Features -->
        <div class="section-card">
          <div class="section-header">
            <h2><i class="fas fa-robot"></i> Fonctionnalités IA</h2>
          </div>
          <div class="section-content">
            <div class="feature-item" *ngFor="let feature of aiFeatures">
              <div class="feature-info">
                <h3>{{ feature.name }}</h3>
                <p>{{ feature.description }}</p>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" [(ngModel)]="feature.enabled" (change)="toggleFeature(feature)">
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-content-manager { max-width: 1200px; }
    .page-header { margin-bottom: 24px; }
    .page-header h1 { font-size: 24px; font-weight: 600; color: #1a1a2e; margin: 0; }
    .content-sections { display: flex; flex-direction: column; gap: 24px; }
    .section-card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .section-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: #f8f9fa; border-bottom: 1px solid #f0f0f0; }
    .section-header h2 { font-size: 16px; font-weight: 600; color: #1a1a2e; margin: 0; display: flex; align-items: center; gap: 10px; }
    .section-header h2 i { color: #667eea; }
    .btn-add { padding: 8px 16px; background: #667eea; color: #fff; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 13px; }
    .section-content { padding: 16px 20px; }
    .banner-item { display: flex; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
    .banner-item:last-child { border-bottom: none; }
    .banner-preview { width: 120px; height: 60px; background: #f5f5f5; border-radius: 6px; overflow: hidden; }
    .banner-preview img { width: 100%; height: 100%; object-fit: cover; }
    .banner-info { flex: 1; }
    .banner-info h3 { font-size: 14px; font-weight: 500; margin: 0 0 4px 0; }
    .banner-info p { font-size: 12px; color: #888; margin: 0; }
    .status { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; background: #f8d7da; color: #721c24; }
    .status.active { background: #d4edda; color: #155724; }
    .banner-actions { display: flex; gap: 8px; }
    .btn-edit, .btn-toggle { padding: 8px 10px; background: #f0f0f0; border: none; border-radius: 6px; cursor: pointer; }
    .btn-edit:hover, .btn-toggle:hover { background: #e0e0e0; }
    .section-item, .feature-item { display: flex; align-items: center; gap: 16px; padding: 16px 0; border-bottom: 1px solid #f0f0f0; }
    .section-item:last-child, .feature-item:last-child { border-bottom: none; }
    .section-info, .feature-info { flex: 1; }
    .section-info h3, .feature-info h3 { font-size: 14px; font-weight: 500; margin: 0 0 4px 0; }
    .section-info p, .feature-info p { font-size: 12px; color: #888; margin: 0; }
    .toggle-switch { position: relative; display: inline-block; width: 48px; height: 26px; }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; inset: 0; background: #ccc; border-radius: 26px; transition: 0.3s; }
    .slider::before { content: ''; position: absolute; height: 20px; width: 20px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.3s; }
    input:checked + .slider { background: #667eea; }
    input:checked + .slider::before { transform: translateX(22px); }
    .empty-state { text-align: center; padding: 24px; color: #888; }
  `]
})
export class AdminContentComponent implements OnInit {
  banners: any[] = [];
  homeSections = [
    { id: 'hero', label: 'Bannière héro', description: 'Image principale en haut de page', enabled: true },
    { id: 'promo', label: 'Section promo', description: 'Bande promotionnelle', enabled: true },
    { id: 'newArrivals', label: 'Nouveautés', description: 'Produits récemment ajoutés', enabled: true },
    { id: 'categories', label: 'Collections', description: 'Grille de catégories', enabled: true },
    { id: 'trending', label: 'Promotions', description: 'Produits en promotion', enabled: true },
    { id: 'editorial', label: 'Section éditoriale', description: 'Blocs collection homme/femme', enabled: true }
  ];
  aiFeatures = [
    { id: 'chatbot', name: 'Assistant Barsha', description: 'Chatbot IA pour l\'aide à l\'achat', enabled: true },
    { id: 'recommendations', name: 'Recommandations IA', description: 'Suggestions personnalisées', enabled: true },
    { id: 'visualSearch', name: 'Recherche visuelle', description: 'Recherche par image', enabled: true }
  ];

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadBanners();
  }

  loadBanners(): void {
    this.adminService.getBanners().subscribe(banners => {
      this.banners = banners;
    });
  }

  addBanner(): void {
    console.log('Add banner');
  }

  editBanner(banner: any): void {
    console.log('Edit banner', banner);
  }

  toggleBanner(banner: any): void {
    this.adminService.updateBanner(banner.id, { isActive: !banner.isActive }).subscribe(() => {
      banner.isActive = !banner.isActive;
    });
  }

  toggleSection(section: any): void {
    console.log('Toggle section', section.id, section.enabled);
  }

  toggleFeature(feature: any): void {
    console.log('Toggle feature', feature.id, feature.enabled);
  }
}
