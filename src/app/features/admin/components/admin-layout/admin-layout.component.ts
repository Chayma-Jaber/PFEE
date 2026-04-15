import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface AdminUser {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatar?: string;
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, HttpClientModule],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss'
})
export class AdminLayoutComponent implements OnInit {
  sidebarCollapsed = false;
  currentUser: AdminUser | null = null;
  currentTime = '';
  isOnline = true;

  menuItems = [
    { icon: 'fas fa-tachometer-alt', label: 'Tableau de bord', route: '/admin/dashboard' },
    { icon: 'fas fa-shopping-bag', label: 'Commandes', route: '/admin/orders', badge: 'orders' },
    { icon: 'fas fa-box', label: 'Produits', route: '/admin/products' },
    { icon: 'fas fa-palette', label: 'Tenues', route: '/admin/outfits' },
    { icon: 'fas fa-users', label: 'Clients', route: '/admin/customers' },
    { icon: 'fas fa-gem', label: 'Fidelite', route: '/admin/loyalty' },
    { icon: 'fas fa-ticket-alt', label: 'Coupons', route: '/admin/coupons' },
    { icon: 'fas fa-gift', label: 'Cartes cadeaux', route: '/admin/gift-cards' },
    { icon: 'fas fa-undo', label: 'Retours', route: '/admin/returns', badge: 'returns' },
    { icon: 'fas fa-headset', label: 'Support', route: '/admin/support', badge: 'support' },
    { icon: 'fas fa-question-circle', label: 'FAQ', route: '/admin/faq' },
    { icon: 'fas fa-chart-line', label: 'Rapports', route: '/admin/reports' },
    { icon: 'fas fa-brain', label: 'Analytics IA', route: '/admin/ai-analytics' }
  ];

  pendingOrders = 0;
  pendingReturns = 0;
  pendingSupport = 0;

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadDashboardCounts();
    this.updateTime();
    setInterval(() => this.updateTime(), 60000);

    // Check online status
    window.addEventListener('online', () => this.isOnline = true);
    window.addEventListener('offline', () => this.isOnline = false);
  }

  private updateTime(): void {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private loadCurrentUser(): void {
    // Try to load from localStorage first
    const storedUser = localStorage.getItem('admin_user');
    if (storedUser) {
      try {
        this.currentUser = JSON.parse(storedUser);
      } catch {
        this.currentUser = {
          firstName: 'Admin',
          lastName: 'Barsha',
          email: 'admin@barsha.com.tn',
          role: 'SUPER_ADMIN'
        };
      }
    } else {
      this.currentUser = {
        firstName: 'Admin',
        lastName: 'Barsha',
        email: 'admin@barsha.com.tn',
        role: 'SUPER_ADMIN'
      };
    }
  }

  private loadDashboardCounts(): void {
    const token = localStorage.getItem('admin_jwt') || localStorage.getItem('jwt');
    if (!token) return;

    this.http.get<any>('http://localhost:8000/api/admin/dashboard/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    }).subscribe({
      next: (stats) => {
        this.pendingOrders = stats?.orders?.pending || 0;
        this.pendingReturns = stats?.returns?.pending || 0;
      },
      error: () => {
        // Fallback counts
        this.pendingOrders = 0;
        this.pendingReturns = 0;
      }
    });
  }

  get userInitials(): string {
    if (!this.currentUser) return 'A';
    const first = this.currentUser.firstName?.charAt(0) || '';
    const last = this.currentUser.lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || 'A';
  }

  get userFullName(): string {
    if (!this.currentUser) return 'Admin';
    return `${this.currentUser.firstName || ''} ${this.currentUser.lastName || ''}`.trim() || 'Admin';
  }

  get userRole(): string {
    if (!this.currentUser) return 'Administrateur';
    const roleMap: Record<string, string> = {
      'SUPER_ADMIN': 'Super Admin',
      'ADMIN': 'Administrateur',
      'MANAGER': 'Manager',
      'SUPPORT': 'Support',
      'WAREHOUSE': 'Entrepôt'
    };
    return roleMap[this.currentUser.role] || 'Administrateur';
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  logout(): void {
    localStorage.removeItem('admin_jwt');
    localStorage.removeItem('admin_refresh');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('jwt');
    this.router.navigate(['/admin/login']);
  }

  getBadgeCount(badge: string): number | null {
    if (badge === 'orders') return this.pendingOrders > 0 ? this.pendingOrders : null;
    if (badge === 'returns') return this.pendingReturns > 0 ? this.pendingReturns : null;
    if (badge === 'support') return this.pendingSupport > 0 ? this.pendingSupport : null;
    return null;
  }
}
