import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

interface Store {
  id: number;
  name: string;
  address: string;
  phone: string;
  email: string;
  hours: string;
  coordinates: { lat: number; lng: number };
  services: string[];
}

@Component({
  selector: 'app-store-locator',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="store-locator-container">
      <!-- Header -->
      <div class="store-locator-header">
        <h1>Nos Boutiques</h1>
        <p>Trouvez la boutique Barsha la plus proche de chez vous</p>
      </div>

      <!-- Search and Filters -->
      <div class="search-filters-section">
        <div class="search-box">
          <i class="bi bi-search"></i>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            (input)="filterStores()"
            placeholder="Rechercher par ville ou code postal..."
          />
          <button *ngIf="searchQuery" class="clear-btn" (click)="clearSearch()">
            <i class="bi bi-x"></i>
          </button>
        </div>

        <div class="service-filters">
          <span class="filter-label">Filtrer par services :</span>
          <button
            *ngFor="let service of availableServices"
            class="service-filter-btn"
            [class.active]="selectedServices.has(service.key)"
            (click)="toggleServiceFilter(service.key)"
          >
            <i [class]="service.icon"></i>
            {{ service.label }}
          </button>
        </div>
      </div>

      <!-- Main Content -->
      <div class="store-locator-content">
        <!-- Store List -->
        <div class="store-list">
          <div class="stores-count">
            {{ filteredStores.length }} boutique{{ filteredStores.length !== 1 ? 's' : '' }} trouvee{{ filteredStores.length !== 1 ? 's' : '' }}
          </div>

          <div
            *ngFor="let store of filteredStores"
            class="store-card"
            [class.expanded]="expandedStoreId === store.id"
            (click)="toggleStoreExpansion(store.id)"
          >
            <div class="store-card-header">
              <div class="store-main-info">
                <h3 class="store-name">{{ store.name }}</h3>
                <p class="store-address">
                  <i class="bi bi-geo-alt"></i>
                  {{ store.address }}
                </p>
              </div>
              <div class="expand-icon">
                <i [class]="expandedStoreId === store.id ? 'bi bi-chevron-up' : 'bi bi-chevron-down'"></i>
              </div>
            </div>

            <div class="store-services">
              <span
                *ngFor="let service of store.services"
                class="service-badge"
                [ngClass]="'service-' + service"
              >
                <i [class]="getServiceIcon(service)"></i>
                {{ getServiceLabel(service) }}
              </span>
            </div>

            <!-- Expanded Details -->
            <div class="store-details" *ngIf="expandedStoreId === store.id">
              <div class="detail-row">
                <i class="bi bi-telephone"></i>
                <span>{{ store.phone }}</span>
              </div>
              <div class="detail-row">
                <i class="bi bi-envelope"></i>
                <span>{{ store.email }}</span>
              </div>
              <div class="detail-row">
                <i class="bi bi-clock"></i>
                <span>{{ store.hours }}</span>
              </div>

              <div class="store-actions">
                <a
                  [href]="getDirectionsUrl(store)"
                  target="_blank"
                  class="action-btn directions-btn"
                  (click)="$event.stopPropagation()"
                >
                  <i class="bi bi-map"></i>
                  Itineraire
                </a>
                <a
                  [href]="'tel:' + store.phone"
                  class="action-btn call-btn"
                  (click)="$event.stopPropagation()"
                >
                  <i class="bi bi-telephone-fill"></i>
                  Appeler
                </a>
              </div>
            </div>
          </div>

          <!-- No Results -->
          <div *ngIf="filteredStores.length === 0" class="no-results">
            <i class="bi bi-shop"></i>
            <p>Aucune boutique trouvee pour votre recherche</p>
            <button class="reset-btn" (click)="resetFilters()">Reinitialiser les filtres</button>
          </div>
        </div>

        <!-- Map Placeholder -->
        <div class="map-container">
          <div class="map-placeholder">
            <div class="map-overlay">
              <i class="bi bi-geo-alt-fill"></i>
              <span>Carte de la Tunisie</span>
              <p>{{ filteredStores.length }} boutiques Barsha</p>
            </div>
            <!-- Store markers on map -->
            <div class="map-markers">
              <div
                *ngFor="let store of filteredStores"
                class="map-marker"
                [style.top.%]="getMarkerTop(store)"
                [style.left.%]="getMarkerLeft(store)"
                [class.active]="expandedStoreId === store.id"
                (click)="selectStore(store.id)"
                [title]="store.name"
              >
                <i class="bi bi-geo-alt-fill"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .store-locator-container {
      min-height: 100vh;
      background: #f8f9fa;
      padding-bottom: 60px;
    }

    .store-locator-header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      padding: 60px 20px;
      text-align: center;
    }

    .store-locator-header h1 {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 10px;
    }

    .store-locator-header p {
      font-size: 1.1rem;
      opacity: 0.9;
    }

    .search-filters-section {
      max-width: 1400px;
      margin: -30px auto 30px;
      padding: 0 20px;
    }

    .search-box {
      background: white;
      border-radius: 12px;
      padding: 15px 20px;
      display: flex;
      align-items: center;
      gap: 15px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      margin-bottom: 20px;
    }

    .search-box i {
      color: #666;
      font-size: 1.2rem;
    }

    .search-box input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 1rem;
      color: #333;
    }

    .search-box input::placeholder {
      color: #999;
    }

    .clear-btn {
      background: none;
      border: none;
      color: #999;
      cursor: pointer;
      padding: 5px;
      font-size: 1.2rem;
    }

    .clear-btn:hover {
      color: #333;
    }

    .service-filters {
      display: flex;
      align-items: center;
      gap: 15px;
      flex-wrap: wrap;
    }

    .filter-label {
      font-weight: 500;
      color: #666;
    }

    .service-filter-btn {
      background: white;
      border: 2px solid #e0e0e0;
      border-radius: 25px;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: 0.9rem;
      color: #555;
    }

    .service-filter-btn:hover {
      border-color: #1a1a2e;
      color: #1a1a2e;
    }

    .service-filter-btn.active {
      background: #1a1a2e;
      border-color: #1a1a2e;
      color: white;
    }

    .store-locator-content {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 20px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
    }

    .store-list {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .stores-count {
      font-size: 0.9rem;
      color: #666;
      padding: 0 5px;
    }

    .store-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      border: 2px solid transparent;
    }

    .store-card:hover {
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }

    .store-card.expanded {
      border-color: #1a1a2e;
    }

    .store-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .store-main-info {
      flex: 1;
    }

    .store-name {
      font-size: 1.25rem;
      font-weight: 600;
      color: #1a1a2e;
      margin-bottom: 8px;
    }

    .store-address {
      color: #666;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .store-address i {
      color: #e74c3c;
    }

    .expand-icon {
      color: #999;
      font-size: 1.2rem;
    }

    .store-services {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 15px;
    }

    .service-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 500;
    }

    .service-badge.service-click-collect {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .service-badge.service-returns {
      background: #e3f2fd;
      color: #1565c0;
    }

    .service-badge.service-alterations {
      background: #fff3e0;
      color: #ef6c00;
    }

    .service-badge.service-personal-shopper {
      background: #f3e5f5;
      color: #7b1fa2;
    }

    .store-details {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }

    .detail-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      color: #555;
    }

    .detail-row i {
      color: #1a1a2e;
      width: 20px;
      text-align: center;
    }

    .store-actions {
      display: flex;
      gap: 15px;
      margin-top: 20px;
    }

    .action-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.3s ease;
    }

    .directions-btn {
      background: #1a1a2e;
      color: white;
    }

    .directions-btn:hover {
      background: #2d2d4a;
    }

    .call-btn {
      background: #e8f5e9;
      color: #2e7d32;
      border: 2px solid #2e7d32;
    }

    .call-btn:hover {
      background: #2e7d32;
      color: white;
    }

    .no-results {
      text-align: center;
      padding: 60px 20px;
      background: white;
      border-radius: 12px;
    }

    .no-results i {
      font-size: 4rem;
      color: #ddd;
      margin-bottom: 20px;
    }

    .no-results p {
      color: #666;
      margin-bottom: 20px;
    }

    .reset-btn {
      background: #1a1a2e;
      color: white;
      border: none;
      padding: 12px 25px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: background 0.3s ease;
    }

    .reset-btn:hover {
      background: #2d2d4a;
    }

    .map-container {
      position: sticky;
      top: 20px;
      height: fit-content;
    }

    .map-placeholder {
      background: linear-gradient(135deg, #e8f4f8 0%, #d1e8f0 100%);
      border-radius: 12px;
      height: 600px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    }

    .map-overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: #1a1a2e;
      z-index: 1;
    }

    .map-overlay i {
      font-size: 3rem;
      color: #e74c3c;
      margin-bottom: 15px;
      display: block;
    }

    .map-overlay span {
      font-size: 1.5rem;
      font-weight: 600;
      display: block;
      margin-bottom: 5px;
    }

    .map-overlay p {
      color: #666;
    }

    .map-markers {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    }

    .map-marker {
      position: absolute;
      transform: translate(-50%, -100%);
      font-size: 1.8rem;
      color: #e74c3c;
      cursor: pointer;
      transition: all 0.3s ease;
      z-index: 2;
    }

    .map-marker:hover,
    .map-marker.active {
      color: #1a1a2e;
      transform: translate(-50%, -100%) scale(1.3);
    }

    /* Responsive Design */
    @media (max-width: 992px) {
      .store-locator-content {
        grid-template-columns: 1fr;
      }

      .map-container {
        position: relative;
        top: 0;
        order: -1;
      }

      .map-placeholder {
        height: 300px;
      }
    }

    @media (max-width: 768px) {
      .store-locator-header {
        padding: 40px 15px;
      }

      .store-locator-header h1 {
        font-size: 1.8rem;
      }

      .service-filters {
        gap: 10px;
      }

      .filter-label {
        width: 100%;
      }

      .service-filter-btn {
        padding: 6px 12px;
        font-size: 0.85rem;
      }

      .store-actions {
        flex-direction: column;
      }

      .action-btn {
        padding: 14px 20px;
      }
    }

    @media (max-width: 480px) {
      .search-filters-section {
        margin-top: -20px;
      }

      .store-card {
        padding: 15px;
      }

      .store-name {
        font-size: 1.1rem;
      }
    }
  `]
})
export class StoreLocatorComponent implements OnInit {
  stores: Store[] = [
    {
      id: 1,
      name: 'Barsha Tunis Centre',
      address: 'Avenue Habib Bourguiba, Tunis 1000',
      phone: '+216 71 123 456',
      email: 'tunis@barsha.tn',
      hours: 'Lun-Sam: 9h-20h, Dim: 10h-18h',
      coordinates: { lat: 36.8065, lng: 10.1815 },
      services: ['click-collect', 'returns', 'alterations']
    },
    {
      id: 2,
      name: 'Barsha Sfax',
      address: 'Route de Tunis, Sfax 3000',
      phone: '+216 74 234 567',
      email: 'sfax@barsha.tn',
      hours: 'Lun-Sam: 9h-19h',
      coordinates: { lat: 34.7406, lng: 10.7603 },
      services: ['click-collect', 'returns']
    },
    {
      id: 3,
      name: 'Barsha Sousse Mall',
      address: 'Mall of Sousse, Sousse 4000',
      phone: '+216 73 345 678',
      email: 'sousse@barsha.tn',
      hours: 'Lun-Dim: 10h-22h',
      coordinates: { lat: 35.8288, lng: 10.6405 },
      services: ['click-collect', 'returns', 'personal-shopper']
    }
  ];

  filteredStores: Store[] = [];
  searchQuery = '';
  selectedServices = new Set<string>();
  expandedStoreId: number | null = null;

  availableServices = [
    { key: 'click-collect', label: 'Click & Collect', icon: 'bi bi-bag-check' },
    { key: 'returns', label: 'Retours', icon: 'bi bi-arrow-return-left' },
    { key: 'alterations', label: 'Retouches', icon: 'bi bi-scissors' },
    { key: 'personal-shopper', label: 'Personal Shopper', icon: 'bi bi-person-badge' }
  ];

  // Tunisia bounds for positioning markers
  private tunisiaBounds = {
    minLat: 30.2,
    maxLat: 37.5,
    minLng: 7.5,
    maxLng: 11.6
  };

  ngOnInit(): void {
    this.filteredStores = [...this.stores];
  }

  filterStores(): void {
    this.filteredStores = this.stores.filter(store => {
      // Search filter
      const searchMatch = !this.searchQuery ||
        store.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        store.address.toLowerCase().includes(this.searchQuery.toLowerCase());

      // Service filter
      const serviceMatch = this.selectedServices.size === 0 ||
        [...this.selectedServices].every(service => store.services.includes(service));

      return searchMatch && serviceMatch;
    });
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.filterStores();
  }

  toggleServiceFilter(service: string): void {
    if (this.selectedServices.has(service)) {
      this.selectedServices.delete(service);
    } else {
      this.selectedServices.add(service);
    }
    this.filterStores();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.selectedServices.clear();
    this.filteredStores = [...this.stores];
  }

  toggleStoreExpansion(storeId: number): void {
    this.expandedStoreId = this.expandedStoreId === storeId ? null : storeId;
  }

  selectStore(storeId: number): void {
    this.expandedStoreId = storeId;
    // Scroll to the store card
    const element = document.querySelector('.store-card.expanded');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  getServiceIcon(service: string): string {
    const icons: { [key: string]: string } = {
      'click-collect': 'bi bi-bag-check',
      'returns': 'bi bi-arrow-return-left',
      'alterations': 'bi bi-scissors',
      'personal-shopper': 'bi bi-person-badge'
    };
    return icons[service] || 'bi bi-check-circle';
  }

  getServiceLabel(service: string): string {
    const labels: { [key: string]: string } = {
      'click-collect': 'Click & Collect',
      'returns': 'Retours',
      'alterations': 'Retouches',
      'personal-shopper': 'Personal Shopper'
    };
    return labels[service] || service;
  }

  getDirectionsUrl(store: Store): string {
    const { lat, lng } = store.coordinates;
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }

  getMarkerTop(store: Store): number {
    const { lat } = store.coordinates;
    const { minLat, maxLat } = this.tunisiaBounds;
    // Invert because CSS top increases downward
    return 100 - ((lat - minLat) / (maxLat - minLat)) * 80 + 10;
  }

  getMarkerLeft(store: Store): number {
    const { lng } = store.coordinates;
    const { minLng, maxLng } = this.tunisiaBounds;
    return ((lng - minLng) / (maxLng - minLng)) * 80 + 10;
  }
}
