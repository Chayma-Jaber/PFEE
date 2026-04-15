import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { OrderService } from '../../../services/order.service';
import { TrackingTimelineComponent, TrackingStep } from '../../commun/tracking-timeline/tracking-timeline.component';

interface OrderItem {
  id: number;
  title: string;
  image: string;
  quantity: number;
  unitPrice: number;
  color?: string;
  size?: string;
}

interface TrackingInfo {
  orderId: number;
  orderSlug: string;
  status: string;
  trackingNumber: string | null;
  carrier: string;
  estimatedDelivery: Date | null;
  shippingAddress: {
    name: string;
    address: string;
    city: string;
    postalCode: string;
    phone: string;
  };
  items: OrderItem[];
  total: number;
  steps: TrackingStep[];
  currentStep: number;
}

@Component({
  selector: 'app-order-tracking',
  standalone: true,
  imports: [CommonModule, RouterModule, TrackingTimelineComponent],
  template: `
    <div class="order-tracking-container">
      <!-- Loading State -->
      <div *ngIf="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Chargement du suivi de commande...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="error && !isLoading" class="error-state">
        <div class="error-icon">
          <i class="fa fa-exclamation-triangle"></i>
        </div>
        <h2>Une erreur est survenue</h2>
        <p>{{ error }}</p>
        <button class="btn-primary" (click)="goBack()">Retour aux commandes</button>
      </div>

      <!-- Tracking Content -->
      <div *ngIf="!isLoading && !error && trackingInfo" class="tracking-content">
        <!-- Header -->
        <div class="tracking-header">
          <button class="back-button" (click)="goBack()">
            <i class="fa fa-arrow-left"></i>
            Retour
          </button>
          <h1>Suivi de commande</h1>
          <span class="order-number">Commande #{{ trackingInfo.orderSlug }}</span>
        </div>

        <!-- Progress Overview Card -->
        <div class="progress-card">
          <div class="progress-header">
            <div class="status-indicator" [class]="getStatusClass()">
              <i [class]="getCurrentStepIcon()"></i>
              <span>{{ getCurrentStepLabel() }}</span>
            </div>
            <div *ngIf="trackingInfo.estimatedDelivery" class="estimated-delivery">
              <span class="delivery-label">Livraison estimee</span>
              <span class="delivery-date">{{ formatDate(trackingInfo.estimatedDelivery) }}</span>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="progress-bar-container">
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="getProgressPercentage()"></div>
            </div>
            <div class="progress-labels">
              <span>Confirmee</span>
              <span>En route</span>
              <span>Livree</span>
            </div>
          </div>
        </div>

        <div class="content-grid">
          <!-- Left Column: Timeline -->
          <div class="timeline-section">
            <div class="section-card">
              <h3 class="section-title">
                <i class="fa fa-history"></i>
                Historique du colis
              </h3>
              <app-tracking-timeline
                [steps]="trackingInfo.steps"
                [currentStep]="trackingInfo.currentStep"
              ></app-tracking-timeline>
            </div>
          </div>

          <!-- Right Column: Details -->
          <div class="details-section">
            <!-- Tracking Number Card -->
            <div class="section-card tracking-number-card" *ngIf="trackingInfo.trackingNumber">
              <h3 class="section-title">
                <i class="fa fa-barcode"></i>
                Numero de suivi
              </h3>
              <div class="tracking-number-row">
                <span class="tracking-number">{{ trackingInfo.trackingNumber }}</span>
                <button class="copy-button" (click)="copyTrackingNumber()" [class.copied]="copied">
                  <i [class]="copied ? 'fa fa-check' : 'fa fa-copy'"></i>
                  {{ copied ? 'Copie !' : 'Copier' }}
                </button>
              </div>
              <div class="carrier-info">
                <img [src]="getCarrierLogo()" [alt]="trackingInfo.carrier" class="carrier-logo">
                <span class="carrier-name">{{ trackingInfo.carrier }}</span>
              </div>
            </div>

            <!-- Delivery Address Card -->
            <div class="section-card">
              <h3 class="section-title">
                <i class="fa fa-map-marker-alt"></i>
                Adresse de livraison
              </h3>
              <div class="address-content">
                <p class="address-name">{{ trackingInfo.shippingAddress.name }}</p>
                <p class="address-line">{{ trackingInfo.shippingAddress.address }}</p>
                <p class="address-line">{{ trackingInfo.shippingAddress.postalCode }} {{ trackingInfo.shippingAddress.city }}</p>
                <p class="address-phone">
                  <i class="fa fa-phone"></i>
                  {{ trackingInfo.shippingAddress.phone }}
                </p>
              </div>

              <!-- Map Placeholder -->
              <div class="map-placeholder">
                <i class="fa fa-map"></i>
                <span>Carte de livraison</span>
              </div>
            </div>

            <!-- Order Summary Card -->
            <div class="section-card">
              <h3 class="section-title">
                <i class="fa fa-shopping-bag"></i>
                Resume de la commande
              </h3>
              <div class="order-items">
                <div *ngFor="let item of trackingInfo.items" class="order-item">
                  <img [src]="item.image" [alt]="item.title" class="item-image">
                  <div class="item-details">
                    <p class="item-title">{{ item.title }}</p>
                    <p class="item-variant" *ngIf="item.color || item.size">
                      {{ item.color }}<span *ngIf="item.color && item.size"> - </span>{{ item.size }}
                    </p>
                    <p class="item-quantity">Quantite: {{ item.quantity }}</p>
                  </div>
                  <span class="item-price">{{ item.unitPrice | number:'1.3-3' }} TND</span>
                </div>
              </div>
              <div class="order-total">
                <span>Total</span>
                <span class="total-amount">{{ trackingInfo.total | number:'1.3-3' }} TND</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Support Section -->
        <div class="support-section">
          <div class="support-card">
            <div class="support-content">
              <i class="fa fa-headset"></i>
              <div class="support-text">
                <h4>Besoin d'aide ?</h4>
                <p>Notre equipe est disponible pour vous assister</p>
              </div>
            </div>
            <button class="btn-support" routerLink="/account/support">
              <i class="fa fa-envelope"></i>
              Contacter le support
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .order-tracking-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 16px 60px;
      font-family: 'std55', 'Avenir LT Std', Helvetica, Arial, sans-serif;
    }

    /* Loading State */
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 400px;
      text-align: center;
    }

    .spinner {
      width: 48px;
      height: 48px;
      border: 3px solid #f0f0f0;
      border-top-color: #000;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading-state p {
      color: #666;
      font-size: 14px;
    }

    /* Error State */
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 400px;
      text-align: center;
    }

    .error-icon {
      width: 80px;
      height: 80px;
      background-color: #fef2f2;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 24px;
    }

    .error-icon i {
      font-size: 40px;
      color: #ef4444;
    }

    .error-state h2 {
      font-size: 24px;
      color: #000;
      margin-bottom: 8px;
    }

    .error-state p {
      color: #666;
      margin-bottom: 24px;
    }

    /* Header */
    .tracking-header {
      margin-bottom: 24px;
    }

    .back-button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: none;
      border: none;
      color: #666;
      font-size: 14px;
      cursor: pointer;
      padding: 8px 0;
      margin-bottom: 16px;
      transition: color 0.2s;
    }

    .back-button:hover {
      color: #000;
    }

    .tracking-header h1 {
      font-family: 'std95', 'Avenir LT Std', Helvetica, Arial, sans-serif;
      font-size: 28px;
      font-weight: 600;
      color: #000;
      margin: 0 0 8px 0;
    }

    .order-number {
      font-size: 14px;
      color: #666;
    }

    /* Progress Card */
    .progress-card {
      background: linear-gradient(135deg, #000 0%, #333 100%);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
      color: #fff;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(255, 255, 255, 0.1);
      padding: 12px 20px;
      border-radius: 30px;
    }

    .status-indicator i {
      font-size: 20px;
    }

    .status-indicator span {
      font-size: 16px;
      font-weight: 500;
    }

    .status-indicator.status-confirmed {
      background: rgba(34, 197, 94, 0.2);
      color: #86efac;
    }

    .status-indicator.status-preparing {
      background: rgba(251, 191, 36, 0.2);
      color: #fde047;
    }

    .status-indicator.status-shipped {
      background: rgba(59, 130, 246, 0.2);
      color: #93c5fd;
    }

    .status-indicator.status-delivering {
      background: rgba(168, 85, 247, 0.2);
      color: #d8b4fe;
    }

    .status-indicator.status-delivered {
      background: rgba(34, 197, 94, 0.3);
      color: #86efac;
    }

    .estimated-delivery {
      text-align: right;
    }

    .delivery-label {
      display: block;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      margin-bottom: 4px;
    }

    .delivery-date {
      font-family: 'std95', 'Avenir LT Std', Helvetica, Arial, sans-serif;
      font-size: 18px;
      font-weight: 600;
    }

    .progress-bar-container {
      margin-top: 16px;
    }

    .progress-bar {
      height: 6px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #22c55e 0%, #86efac 100%);
      border-radius: 3px;
      transition: width 0.5s ease;
    }

    .progress-labels {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
    }

    /* Content Grid */
    .content-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }

    @media (max-width: 900px) {
      .content-grid {
        grid-template-columns: 1fr;
      }
    }

    /* Section Cards */
    .section-card {
      background: #fff;
      border: 1px solid #e5e5e5;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
    }

    .section-title {
      font-family: 'std95', 'Avenir LT Std', Helvetica, Arial, sans-serif;
      font-size: 16px;
      font-weight: 600;
      color: #000;
      margin: 0 0 16px 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .section-title i {
      color: #666;
    }

    /* Tracking Number Card */
    .tracking-number-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f9f9f9;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
    }

    .tracking-number {
      font-family: 'Courier New', monospace;
      font-size: 16px;
      font-weight: 600;
      letter-spacing: 1px;
    }

    .copy-button {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #000;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .copy-button:hover {
      background: #333;
    }

    .copy-button.copied {
      background: #22c55e;
    }

    .carrier-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .carrier-logo {
      width: 40px;
      height: 40px;
      object-fit: contain;
      background: #f5f5f5;
      border-radius: 8px;
      padding: 4px;
    }

    .carrier-name {
      font-size: 14px;
      font-weight: 500;
      color: #333;
    }

    /* Address Card */
    .address-content {
      margin-bottom: 16px;
    }

    .address-name {
      font-weight: 600;
      color: #000;
      margin: 0 0 8px 0;
    }

    .address-line {
      color: #666;
      margin: 0 0 4px 0;
      font-size: 14px;
    }

    .address-phone {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #666;
      margin-top: 12px;
      font-size: 14px;
    }

    .address-phone i {
      color: #22c55e;
    }

    .map-placeholder {
      background: linear-gradient(135deg, #f0f0f0 0%, #e5e5e5 100%);
      border-radius: 8px;
      height: 120px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: #999;
    }

    .map-placeholder i {
      font-size: 32px;
    }

    .map-placeholder span {
      font-size: 12px;
    }

    /* Order Items */
    .order-items {
      border-top: 1px solid #eee;
      padding-top: 16px;
    }

    .order-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #f5f5f5;
    }

    .order-item:last-child {
      border-bottom: none;
    }

    .item-image {
      width: 60px;
      height: 60px;
      object-fit: cover;
      border-radius: 8px;
      background: #f5f5f5;
    }

    .item-details {
      flex: 1;
    }

    .item-title {
      font-size: 14px;
      font-weight: 500;
      color: #000;
      margin: 0 0 4px 0;
    }

    .item-variant {
      font-size: 12px;
      color: #666;
      margin: 0 0 4px 0;
    }

    .item-quantity {
      font-size: 12px;
      color: #999;
      margin: 0;
    }

    .item-price {
      font-weight: 600;
      font-size: 14px;
      color: #000;
    }

    .order-total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 16px;
      margin-top: 8px;
      border-top: 2px solid #000;
    }

    .order-total span:first-child {
      font-weight: 600;
      font-size: 16px;
    }

    .total-amount {
      font-family: 'std95', 'Avenir LT Std', Helvetica, Arial, sans-serif;
      font-size: 18px;
      font-weight: 700;
    }

    /* Support Section */
    .support-section {
      margin-top: 32px;
    }

    .support-card {
      background: linear-gradient(135deg, #f8f9fa 0%, #fff 100%);
      border: 1px solid #e5e5e5;
      border-radius: 12px;
      padding: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }

    .support-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .support-content > i {
      font-size: 32px;
      color: #000;
    }

    .support-text h4 {
      font-size: 16px;
      font-weight: 600;
      color: #000;
      margin: 0 0 4px 0;
    }

    .support-text p {
      font-size: 14px;
      color: #666;
      margin: 0;
    }

    .btn-support {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #000;
      color: #fff;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      text-decoration: none;
    }

    .btn-support:hover {
      background: #333;
    }

    /* Buttons */
    .btn-primary {
      background-color: #000;
      color: #fff;
      border: none;
      padding: 14px 32px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s ease;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .btn-primary:hover {
      background-color: #333;
    }

    /* Responsive */
    @media (max-width: 640px) {
      .order-tracking-container {
        padding: 16px 12px 40px;
      }

      .tracking-header h1 {
        font-size: 22px;
      }

      .progress-card {
        padding: 20px 16px;
      }

      .progress-header {
        flex-direction: column;
      }

      .estimated-delivery {
        text-align: left;
      }

      .section-card {
        padding: 16px;
      }

      .tracking-number-row {
        flex-direction: column;
        gap: 12px;
        align-items: stretch;
      }

      .copy-button {
        justify-content: center;
      }

      .support-card {
        flex-direction: column;
        text-align: center;
      }

      .support-content {
        flex-direction: column;
      }

      .btn-support {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class OrderTrackingComponent implements OnInit {
  orderId: number | null = null;
  isLoading: boolean = true;
  error: string | null = null;
  trackingInfo: TrackingInfo | null = null;
  copied: boolean = false;

  private readonly defaultSteps: TrackingStep[] = [
    { id: 1, label: 'Commande confirmee', icon: 'fa-check-circle', description: 'Votre commande a ete validee' },
    { id: 2, label: 'En preparation', icon: 'fa-box', description: 'Votre colis est en cours de preparation' },
    { id: 3, label: 'Expediee', icon: 'fa-shipping-fast', description: 'Votre colis a ete remis au transporteur' },
    { id: 4, label: 'En cours de livraison', icon: 'fa-truck', description: 'Votre colis est en route vers vous' },
    { id: 5, label: 'Livree', icon: 'fa-home', description: 'Votre colis a ete livre' }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService
  ) {}

  ngOnInit(): void {
    const orderIdParam = this.route.snapshot.paramMap.get('orderId');
    if (orderIdParam) {
      this.orderId = parseInt(orderIdParam, 10);
      this.loadTrackingInfo();
    } else {
      this.error = 'Identifiant de commande manquant';
      this.isLoading = false;
    }
  }

  loadTrackingInfo(): void {
    if (!this.orderId) return;

    this.isLoading = true;
    this.error = null;

    this.orderService.getOrderById(this.orderId).subscribe({
      next: (response) => {
        if (response.status === 200 && response.data) {
          this.trackingInfo = this.mapOrderToTrackingInfo(response.data);
        } else {
          this.error = 'Impossible de charger les informations de suivi';
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading tracking info:', err);
        this.error = 'Erreur lors du chargement des informations de suivi';
        this.isLoading = false;
      }
    });
  }

  private mapOrderToTrackingInfo(order: any): TrackingInfo {
    const currentStep = this.getStepFromStatus(order.status || order.statusId);
    const steps = this.buildStepsWithTimestamps(order, currentStep);

    return {
      orderId: order.id,
      orderSlug: order.slug || `CMD-${order.id}`,
      status: order.status || this.getStatusLabel(order.statusId),
      trackingNumber: order.trackingNumber || this.generateMockTrackingNumber(),
      carrier: order.carrier || this.getRandomCarrier(),
      estimatedDelivery: order.estimatedDelivery || this.calculateEstimatedDelivery(order.createdAt, currentStep),
      shippingAddress: {
        name: order.shippingAddress?.name || `${order.shippingAddress?.firstName || ''} ${order.shippingAddress?.lastName || ''}`.trim() || 'Client',
        address: order.shippingAddress?.address || order.shippingAddress?.street || '',
        city: order.shippingAddress?.city || '',
        postalCode: order.shippingAddress?.postalCode || '',
        phone: order.shippingAddress?.phone || ''
      },
      items: (order.products || order.orderItems || []).map((item: any) => ({
        id: item.id || item.productId,
        title: item.title || item.product?.title || 'Produit',
        image: item.image || item.product?.image || 'assets/images/placeholder-product.jpg',
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || item.price || 0,
        color: item.color,
        size: item.size
      })),
      total: order.total || 0,
      steps: steps,
      currentStep: currentStep
    };
  }

  private getStepFromStatus(status: string | number): number {
    if (typeof status === 'number') {
      // Map status IDs to steps
      switch (status) {
        case 1: return 0; // Pending/Confirmed
        case 2: return 1; // Processing/Preparing
        case 3: return 2; // Shipped
        case 4: return 3; // Out for delivery
        case 5: return 4; // Delivered
        default: return 0;
      }
    }

    // Map status strings to steps
    const statusLower = status.toLowerCase();
    if (statusLower.includes('livr') || statusLower.includes('deliver')) return 4;
    if (statusLower.includes('cours') || statusLower.includes('transit')) return 3;
    if (statusLower.includes('expedi') || statusLower.includes('ship')) return 2;
    if (statusLower.includes('prepar') || statusLower.includes('process')) return 1;
    return 0;
  }

  private getStatusLabel(statusId: number): string {
    switch (statusId) {
      case 1: return 'Confirmee';
      case 2: return 'En preparation';
      case 3: return 'Expediee';
      case 4: return 'En cours de livraison';
      case 5: return 'Livree';
      default: return 'En cours';
    }
  }

  private buildStepsWithTimestamps(order: any, currentStep: number): TrackingStep[] {
    const createdAt = new Date(order.createdAt);

    return this.defaultSteps.map((step, index) => {
      let timestamp: Date | undefined;

      if (index <= currentStep) {
        // Calculate approximate timestamps based on step
        const hoursToAdd = index * 24; // Each step approximately 24 hours apart
        timestamp = new Date(createdAt.getTime() + hoursToAdd * 60 * 60 * 1000);
      }

      return {
        ...step,
        timestamp
      };
    });
  }

  private calculateEstimatedDelivery(createdAt: string, currentStep: number): Date {
    const orderDate = new Date(createdAt);
    // Estimate 3-5 days for delivery
    const daysToAdd = currentStep >= 4 ? 0 : (5 - currentStep);
    return new Date(orderDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  }

  private generateMockTrackingNumber(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'TN';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private getRandomCarrier(): string {
    const carriers = ['Aramex', 'Tunisia Post', 'Rapid Poste'];
    return carriers[Math.floor(Math.random() * carriers.length)];
  }

  getCarrierLogo(): string {
    if (!this.trackingInfo) return '';

    switch (this.trackingInfo.carrier.toLowerCase()) {
      case 'aramex':
        return 'https://www.aramex.com/Sitefinity/WebsiteTemplates/aramex/App_Themes/aramex/Images/aramex-logo-2.png';
      case 'tunisia post':
        return 'https://upload.wikimedia.org/wikipedia/fr/thumb/7/78/Logo_de_La_Poste_Tunisienne.svg/200px-Logo_de_La_Poste_Tunisienne.svg.png';
      default:
        return 'assets/images/carrier-default.png';
    }
  }

  getStatusClass(): string {
    if (!this.trackingInfo) return '';

    switch (this.trackingInfo.currentStep) {
      case 0: return 'status-confirmed';
      case 1: return 'status-preparing';
      case 2: return 'status-shipped';
      case 3: return 'status-delivering';
      case 4: return 'status-delivered';
      default: return 'status-confirmed';
    }
  }

  getCurrentStepLabel(): string {
    if (!this.trackingInfo) return '';
    return this.trackingInfo.steps[this.trackingInfo.currentStep]?.label || '';
  }

  getCurrentStepIcon(): string {
    if (!this.trackingInfo) return 'fa fa-box';
    return 'fa ' + (this.trackingInfo.steps[this.trackingInfo.currentStep]?.icon || 'fa-box');
  }

  getProgressPercentage(): number {
    if (!this.trackingInfo) return 0;
    return (this.trackingInfo.currentStep / (this.trackingInfo.steps.length - 1)) * 100;
  }

  formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  }

  copyTrackingNumber(): void {
    if (!this.trackingInfo?.trackingNumber) return;

    navigator.clipboard.writeText(this.trackingInfo.trackingNumber).then(() => {
      this.copied = true;
      setTimeout(() => {
        this.copied = false;
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  goBack(): void {
    this.router.navigate(['/account/profile']);
  }
}
