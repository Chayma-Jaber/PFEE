import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../../environements/environementDev';

interface ReportCard {
  title: string;
  description: string;
  icon: string;
  type: string;
  color: string;
}

interface ReportData {
  reportType: string;
  period: string;
  generatedAt: string;
  summary?: any;
  dailySales?: any[];
  paymentMethods?: any[];
  topCustomers?: any[];
  dailySignups?: any[];
  topProducts?: any[];
  categoryBreakdown?: any[];
  reasonBreakdown?: any[];
}

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="reports-page">
      <div class="page-header">
        <div class="header-content">
          <h1>Rapports & Analyses</h1>
          <p class="subtitle">Générez des rapports détaillés pour analyser les performances de votre boutique</p>
        </div>
        <div class="header-actions">
          <select class="period-select" [(ngModel)]="selectedPeriod" (change)="onPeriodChange()">
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
            <option value="90d">90 derniers jours</option>
            <option value="365d">Cette année</option>
          </select>
          <button class="btn-export" (click)="exportAll()" [disabled]="exporting">
            <i class="fas" [class.fa-download]="!exporting" [class.fa-spinner]="exporting" [class.fa-spin]="exporting"></i>
            {{ exporting ? 'Export...' : 'Exporter tout' }}
          </button>
        </div>
      </div>

      <div class="reports-grid">
        <div *ngFor="let report of reports"
             class="report-card"
             [style.--accent-color]="report.color"
             [class.loading]="loadingReport === report.type"
             (click)="generateReport(report.type)">
          <div class="report-icon">
            <i [class]="report.icon"></i>
          </div>
          <div class="report-content">
            <h3>{{ report.title }}</h3>
            <p>{{ report.description }}</p>
          </div>
          <div class="report-action">
            <span *ngIf="loadingReport !== report.type">Générer <i class="fas fa-arrow-right"></i></span>
            <span *ngIf="loadingReport === report.type"><i class="fas fa-spinner fa-spin"></i> Génération...</span>
          </div>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="quick-stats-section" *ngIf="salesReport">
        <h2>Aperçu rapide - {{ getPeriodLabel() }}</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon sales"><i class="fas fa-chart-line"></i></div>
            <div class="stat-info">
              <span class="stat-value">{{ salesReport.summary?.totalRevenue | number:'1.0-0' }} TND</span>
              <span class="stat-label">Chiffre d'affaires</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon customers"><i class="fas fa-users"></i></div>
            <div class="stat-info">
              <span class="stat-value">{{ customersReport?.summary?.newCustomers || 0 }}</span>
              <span class="stat-label">Nouveaux clients</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon orders"><i class="fas fa-shopping-bag"></i></div>
            <div class="stat-info">
              <span class="stat-value">{{ salesReport.summary?.completedOrders || 0 }}</span>
              <span class="stat-label">Commandes livrées</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon returns"><i class="fas fa-undo"></i></div>
            <div class="stat-info">
              <span class="stat-value">{{ returnsReport?.summary?.returnRate || 0 }}%</span>
              <span class="stat-label">Taux de retour</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Report Detail Modal -->
      <div class="report-modal" *ngIf="activeReport" (click)="closeModal($event)">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ getReportTitle(activeReport.reportType) }}</h2>
            <div class="modal-actions">
              <button class="btn-export-small" (click)="downloadReport(activeReport.reportType, 'csv')">
                <i class="fas fa-file-csv"></i> CSV
              </button>
              <button class="btn-export-small" (click)="downloadReport(activeReport.reportType, 'json')">
                <i class="fas fa-file-code"></i> JSON
              </button>
              <button class="btn-close" (click)="activeReport = null">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>

          <div class="modal-body">
            <!-- Sales Report Detail -->
            <div *ngIf="activeReport.reportType === 'sales'">
              <div class="report-summary">
                <div class="summary-item">
                  <span class="label">Total Commandes</span>
                  <span class="value">{{ activeReport.summary?.totalOrders }}</span>
                </div>
                <div class="summary-item">
                  <span class="label">Chiffre d'affaires</span>
                  <span class="value">{{ activeReport.summary?.totalRevenue | number:'1.2-2' }} TND</span>
                </div>
                <div class="summary-item">
                  <span class="label">Panier moyen</span>
                  <span class="value">{{ activeReport.summary?.averageOrderValue | number:'1.2-2' }} TND</span>
                </div>
                <div class="summary-item">
                  <span class="label">Taux de conversion</span>
                  <span class="value">{{ activeReport.summary?.conversionRate }}%</span>
                </div>
              </div>

              <h3>Ventes par jour</h3>
              <div class="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Commandes</th>
                      <th>Revenus</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let day of activeReport.dailySales">
                      <td>{{ day.date }}</td>
                      <td>{{ day.orders }}</td>
                      <td>{{ day.revenue | number:'1.2-2' }} TND</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Customers Report Detail -->
            <div *ngIf="activeReport.reportType === 'customers'">
              <div class="report-summary">
                <div class="summary-item">
                  <span class="label">Total Clients</span>
                  <span class="value">{{ activeReport.summary?.totalCustomers }}</span>
                </div>
                <div class="summary-item">
                  <span class="label">Nouveaux</span>
                  <span class="value">{{ activeReport.summary?.newCustomers }}</span>
                </div>
                <div class="summary-item">
                  <span class="label">Actifs</span>
                  <span class="value">{{ activeReport.summary?.activeCustomers }}</span>
                </div>
                <div class="summary-item">
                  <span class="label">Croissance</span>
                  <span class="value">+{{ activeReport.summary?.growthRate }}%</span>
                </div>
              </div>

              <h3>Top Clients</h3>
              <div class="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Email</th>
                      <th>Commandes</th>
                      <th>Total dépensé</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let customer of activeReport.topCustomers">
                      <td>{{ customer.name }}</td>
                      <td>{{ customer.email }}</td>
                      <td>{{ customer.orderCount }}</td>
                      <td>{{ customer.totalSpent | number:'1.2-2' }} TND</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Products Report Detail -->
            <div *ngIf="activeReport.reportType === 'products'">
              <h3>Produits les plus vendus</h3>
              <div class="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Produit</th>
                      <th>Quantité vendue</th>
                      <th>Revenus</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let product of activeReport.topProducts">
                      <td>{{ product.title }}</td>
                      <td>{{ product.quantitySold }}</td>
                      <td>{{ product.revenue | number:'1.2-2' }} TND</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3>Par catégorie</h3>
              <div class="category-breakdown">
                <div *ngFor="let cat of activeReport.categoryBreakdown" class="category-item">
                  <div class="category-info">
                    <span class="cat-name">{{ cat.category }}</span>
                    <span class="cat-qty">{{ cat.quantitySold }} unités</span>
                  </div>
                  <span class="cat-revenue">{{ cat.revenue | number:'1.2-2' }} TND</span>
                </div>
              </div>
            </div>

            <!-- Returns Report Detail -->
            <div *ngIf="activeReport.reportType === 'returns'">
              <div class="report-summary">
                <div class="summary-item">
                  <span class="label">Total Retours</span>
                  <span class="value">{{ activeReport.summary?.totalReturns }}</span>
                </div>
                <div class="summary-item">
                  <span class="label">En attente</span>
                  <span class="value">{{ activeReport.summary?.pendingReturns }}</span>
                </div>
                <div class="summary-item">
                  <span class="label">Approuvés</span>
                  <span class="value">{{ activeReport.summary?.approvedReturns }}</span>
                </div>
                <div class="summary-item">
                  <span class="label">Remboursé</span>
                  <span class="value">{{ activeReport.summary?.totalRefunded | number:'1.2-2' }} TND</span>
                </div>
              </div>

              <h3>Par motif</h3>
              <div class="reason-breakdown">
                <div *ngFor="let reason of activeReport.reasonBreakdown" class="reason-item">
                  <span class="reason-name">{{ formatReason(reason.reason) }}</span>
                  <span class="reason-count">{{ reason.count }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Reports -->
      <div class="recent-reports-section">
        <h2>Rapports récents</h2>
        <div class="reports-table">
          <table>
            <thead>
              <tr>
                <th>Rapport</th>
                <th>Type</th>
                <th>Période</th>
                <th>Date de création</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of recentReports">
                <td class="report-name">{{ item.name }}</td>
                <td><span class="type-badge" [class]="item.type">{{ item.typeLabel }}</span></td>
                <td>{{ item.period }}</td>
                <td>{{ item.date }}</td>
                <td>
                  <button class="btn-icon" title="Télécharger" (click)="downloadFromUrl(item.downloadUrl)">
                    <i class="fas fa-download"></i>
                  </button>
                  <button class="btn-icon" title="Voir" (click)="viewReport(item.type)">
                    <i class="fas fa-eye"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .reports-page {
      max-width: 1400px;
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 32px;
      gap: 20px;
      flex-wrap: wrap;

      .header-content {
        h1 {
          font-size: 28px;
          font-weight: 700;
          color: #1a1a2e;
          margin: 0 0 8px 0;
        }

        .subtitle {
          color: #666;
          font-size: 14px;
          margin: 0;
        }
      }

      .header-actions {
        display: flex;
        gap: 12px;
        align-items: center;
      }

      .period-select {
        padding: 12px 16px;
        border: 2px solid #e8e8e8;
        border-radius: 10px;
        font-size: 14px;
        background: #fff;
        cursor: pointer;

        &:focus {
          outline: none;
          border-color: #667eea;
        }
      }

      .btn-export {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 24px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
        border: none;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s;
        box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);

        &:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
        }

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }
    }

    .reports-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      margin-bottom: 40px;

      @media (max-width: 1000px) {
        grid-template-columns: repeat(2, 1fr);
      }

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
      }
    }

    .report-card {
      background: #fff;
      border-radius: 16px;
      padding: 28px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border: 2px solid transparent;
      position: relative;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 4px;
        height: 100%;
        background: var(--accent-color);
        opacity: 0;
        transition: opacity 0.3s;
      }

      &:hover, &.loading {
        transform: translateY(-4px);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
        border-color: var(--accent-color);

        &::before {
          opacity: 1;
        }

        .report-action {
          color: var(--accent-color);

          i {
            transform: translateX(4px);
          }
        }
      }

      .report-icon {
        width: 56px;
        height: 56px;
        border-radius: 14px;
        background: linear-gradient(135deg, var(--accent-color), var(--accent-color));
        opacity: 0.1;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 20px;
        position: relative;

        i {
          position: absolute;
          font-size: 24px;
          color: var(--accent-color);
        }
      }

      .report-content {
        h3 {
          font-size: 18px;
          font-weight: 600;
          color: #1a1a2e;
          margin: 0 0 8px 0;
        }

        p {
          font-size: 14px;
          color: #666;
          margin: 0;
          line-height: 1.5;
        }
      }

      .report-action {
        margin-top: 20px;
        font-size: 14px;
        font-weight: 600;
        color: #888;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: color 0.3s;

        i {
          transition: transform 0.3s;
        }
      }
    }

    .quick-stats-section {
      margin-bottom: 40px;

      h2 {
        font-size: 20px;
        font-weight: 600;
        color: #1a1a2e;
        margin: 0 0 20px 0;
      }
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;

      @media (max-width: 1000px) {
        grid-template-columns: repeat(2, 1fr);
      }

      @media (max-width: 500px) {
        grid-template-columns: 1fr;
      }
    }

    .stat-card {
      background: #fff;
      border-radius: 14px;
      padding: 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);

      .stat-icon {
        width: 52px;
        height: 52px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;

        &.sales {
          background: rgba(102, 126, 234, 0.1);
          color: #667eea;
        }

        &.customers {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }

        &.orders {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
        }

        &.returns {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }
      }

      .stat-info {
        .stat-value {
          display: block;
          font-size: 24px;
          font-weight: 700;
          color: #1a1a2e;
        }

        .stat-label {
          font-size: 13px;
          color: #666;
        }
      }
    }

    .report-modal {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;

      .modal-content {
        background: #fff;
        border-radius: 20px;
        width: 100%;
        max-width: 900px;
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 24px 28px;
        border-bottom: 1px solid #eee;

        h2 {
          font-size: 20px;
          font-weight: 600;
          color: #1a1a2e;
          margin: 0;
        }

        .modal-actions {
          display: flex;
          gap: 10px;
        }

        .btn-export-small {
          padding: 10px 16px;
          background: #f5f5f5;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          color: #333;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;

          &:hover {
            background: #eee;
          }
        }

        .btn-close {
          padding: 10px;
          background: none;
          border: none;
          font-size: 18px;
          color: #888;
          cursor: pointer;

          &:hover {
            color: #333;
          }
        }
      }

      .modal-body {
        padding: 28px;
        overflow-y: auto;

        h3 {
          font-size: 16px;
          font-weight: 600;
          color: #1a1a2e;
          margin: 24px 0 16px 0;

          &:first-child {
            margin-top: 0;
          }
        }
      }

      .report-summary {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        margin-bottom: 24px;

        @media (max-width: 600px) {
          grid-template-columns: repeat(2, 1fr);
        }

        .summary-item {
          background: #f8f9fc;
          padding: 16px;
          border-radius: 12px;
          text-align: center;

          .label {
            display: block;
            font-size: 12px;
            color: #666;
            margin-bottom: 4px;
          }

          .value {
            font-size: 20px;
            font-weight: 700;
            color: #1a1a2e;
          }
        }
      }

      .data-table {
        overflow-x: auto;

        table {
          width: 100%;
          border-collapse: collapse;

          th, td {
            padding: 14px 16px;
            text-align: left;
            border-bottom: 1px solid #eee;
          }

          th {
            background: #f8f9fc;
            font-size: 12px;
            font-weight: 600;
            color: #666;
            text-transform: uppercase;
          }

          td {
            font-size: 14px;
            color: #333;
          }
        }
      }

      .category-breakdown, .reason-breakdown {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .category-item, .reason-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 16px;
        background: #f8f9fc;
        border-radius: 10px;

        .category-info {
          display: flex;
          flex-direction: column;

          .cat-name {
            font-weight: 600;
            color: #1a1a2e;
          }

          .cat-qty {
            font-size: 13px;
            color: #888;
          }
        }

        .cat-revenue {
          font-weight: 600;
          color: #667eea;
        }

        .reason-name {
          font-weight: 500;
          color: #1a1a2e;
        }

        .reason-count {
          background: #667eea;
          color: #fff;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
        }
      }
    }

    .recent-reports-section {
      h2 {
        font-size: 20px;
        font-weight: 600;
        color: #1a1a2e;
        margin: 0 0 20px 0;
      }
    }

    .reports-table {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
      overflow: hidden;

      table {
        width: 100%;
        border-collapse: collapse;

        th, td {
          padding: 16px 20px;
          text-align: left;
        }

        th {
          background: #f8f9fc;
          font-size: 12px;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        td {
          font-size: 14px;
          border-bottom: 1px solid #f0f0f0;
        }

        tr:last-child td {
          border-bottom: none;
        }

        .report-name {
          font-weight: 500;
          color: #1a1a2e;
        }

        .type-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;

          &.sales {
            background: rgba(102, 126, 234, 0.1);
            color: #667eea;
          }

          &.customers {
            background: rgba(16, 185, 129, 0.1);
            color: #10b981;
          }

          &.products {
            background: rgba(245, 158, 11, 0.1);
            color: #f59e0b;
          }

          &.returns {
            background: rgba(239, 68, 68, 0.1);
            color: #ef4444;
          }
        }

        .btn-icon {
          background: none;
          border: none;
          padding: 8px;
          cursor: pointer;
          color: #888;
          border-radius: 6px;
          transition: all 0.2s;

          &:hover {
            background: #f0f0f0;
            color: #1a1a2e;
          }
        }
      }
    }
  `]
})
export class AdminReportsComponent implements OnInit {
  selectedPeriod = '30d';
  loadingReport: string | null = null;
  exporting = false;

  activeReport: ReportData | null = null;
  salesReport: ReportData | null = null;
  customersReport: ReportData | null = null;
  productsReport: ReportData | null = null;
  returnsReport: ReportData | null = null;

  reports: ReportCard[] = [
    {
      title: 'Rapport des ventes',
      description: 'Analyse complète des ventes, revenus et tendances',
      icon: 'fas fa-chart-bar',
      type: 'sales',
      color: '#667eea'
    },
    {
      title: 'Rapport clients',
      description: 'Analyse du comportement et de la fidélité client',
      icon: 'fas fa-users',
      type: 'customers',
      color: '#10b981'
    },
    {
      title: 'Rapport produits',
      description: 'Performance des produits et gestion des stocks',
      icon: 'fas fa-box',
      type: 'products',
      color: '#f59e0b'
    },
    {
      title: 'Rapport retours',
      description: 'Analyse des retours et remboursements',
      icon: 'fas fa-undo',
      type: 'returns',
      color: '#ef4444'
    }
  ];

  recentReports: any[] = [];

  private apiUrl = environementDev.api;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  private getHeaders() {
    const token = localStorage.getItem('admin_jwt') || localStorage.getItem('jwt');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  loadInitialData(): void {
    // Load sales report for quick stats
    this.generateReport('sales', false);
    this.generateReport('customers', false);
    this.generateReport('returns', false);

    // Load recent reports
    this.http.get<any[]>(`${this.apiUrl}/api/admin/reports/recent`, { headers: this.getHeaders() })
      .subscribe({
        next: (data) => {
          this.recentReports = data;
        },
        error: () => {
          // Use fallback
          const now = new Date();
          this.recentReports = [
            {
              name: `Ventes mensuelles - ${now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
              type: 'sales',
              typeLabel: 'Ventes',
              period: `01/${(now.getMonth() + 1).toString().padStart(2, '0')} - ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`,
              date: now.toLocaleDateString('fr-FR'),
              downloadUrl: `/api/admin/reports/export/sales?period=30d`
            }
          ];
        }
      });
  }

  generateReport(type: string, showModal: boolean = true): void {
    this.loadingReport = type;

    this.http.get<ReportData>(`${this.apiUrl}/api/admin/reports/${type}?period=${this.selectedPeriod}`, { headers: this.getHeaders() })
      .subscribe({
        next: (data) => {
          this.loadingReport = null;

          // Store in appropriate variable
          switch (type) {
            case 'sales':
              this.salesReport = data;
              break;
            case 'customers':
              this.customersReport = data;
              break;
            case 'products':
              this.productsReport = data;
              break;
            case 'returns':
              this.returnsReport = data;
              break;
          }

          if (showModal) {
            this.activeReport = data;
          }
        },
        error: (err) => {
          this.loadingReport = null;
          console.error('Error generating report:', err);
        }
      });
  }

  onPeriodChange(): void {
    this.loadInitialData();
  }

  viewReport(type: string): void {
    this.generateReport(type, true);
  }

  downloadReport(type: string, format: string): void {
    const url = `${this.apiUrl}/api/admin/reports/export/${type}?period=${this.selectedPeriod}&format=${format}`;
    this.downloadAuthenticatedFile(url, `${type}-${this.selectedPeriod}.${format}`);
  }

  downloadFromUrl(url: string): void {
    const absoluteUrl = `${this.apiUrl}${url}`;
    const extension = url.includes('format=pdf') ? 'pdf' : 'csv';
    this.downloadAuthenticatedFile(absoluteUrl, `report.${extension}`);
  }

  exportAll(): void {
    this.exporting = true;

    // Export all reports
    const types = ['sales', 'customers', 'products', 'returns'];
    types.forEach((type, index) => {
      setTimeout(() => {
        this.downloadReport(type, 'csv');
        if (index === types.length - 1) {
          this.exporting = false;
        }
      }, index * 500);
    });
  }

  private downloadAuthenticatedFile(url: string, filename: string): void {
    this.http.get(url, {
      headers: this.getHeaders(),
      responseType: 'blob'
    }).subscribe({
      next: (blob) => {
        const objectUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename;
        anchor.click();
        window.URL.revokeObjectURL(objectUrl);
      },
      error: (err) => {
        if (![401, 404].includes(err?.status)) {
          console.error('Error exporting report:', err);
        }
      }
    });
  }

  closeModal(event: any): void {
    if (event.target === event.currentTarget) {
      this.activeReport = null;
    }
  }

  getPeriodLabel(): string {
    const labels: Record<string, string> = {
      '7d': '7 derniers jours',
      '30d': '30 derniers jours',
      '90d': '90 derniers jours',
      '365d': 'Cette année'
    };
    return labels[this.selectedPeriod] || this.selectedPeriod;
  }

  getReportTitle(type: string): string {
    const titles: Record<string, string> = {
      'sales': 'Rapport des Ventes',
      'customers': 'Rapport Clients',
      'products': 'Rapport Produits',
      'returns': 'Rapport Retours'
    };
    return titles[type] || 'Rapport';
  }

  formatReason(reason: string): string {
    const reasons: Record<string, string> = {
      'wrong_size': 'Mauvaise taille',
      'defective': 'Article défectueux',
      'not_as_described': 'Non conforme à la description',
      'changed_mind': 'Changement d\'avis',
      'late_delivery': 'Livraison en retard',
      'unknown': 'Autre'
    };
    return reasons[reason] || reason;
  }
}
