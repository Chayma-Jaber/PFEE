import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    // Check for admin JWT token first
    const adminToken = localStorage.getItem('admin_jwt');
    if (adminToken) {
      // Verify token is valid and has admin role
      const payload = this.decodeToken(adminToken);
      if (payload && this.isAdminRole(payload.role)) {
        return true;
      }
    }

    // Check regular JWT as fallback (for users who logged in via admin/login)
    const regularToken = localStorage.getItem('jwt');
    if (regularToken) {
      const payload = this.decodeToken(regularToken);
      if (payload && this.isAdminRole(payload.role)) {
        return true;
      }
    }

    // No valid admin token found, redirect to login
    this.router.navigate(['/admin/login']);
    return false;
  }

  private decodeToken(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }

  private isAdminRole(role: string): boolean {
    const adminRoles = ['super_admin', 'admin', 'manager', 'support', 'warehouse', 'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPPORT', 'WAREHOUSE'];
    return adminRoles.includes(role);
  }
}
