import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, ActivatedRoute, RouterModule } from '@angular/router';
import { filter, distinctUntilChanged } from 'rxjs/operators';
import { Subscription } from 'rxjs';

export interface BreadcrumbItem {
  label: string;
  url: string;
  isActive: boolean;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav aria-label="Fil d'Ariane" class="breadcrumb-nav" *ngIf="breadcrumbs.length > 1">
      <ol class="breadcrumb" itemscope itemtype="https://schema.org/BreadcrumbList">
        <li class="breadcrumb-item"
            *ngFor="let crumb of breadcrumbs; let i = index; let last = last"
            [class.active]="last"
            itemprop="itemListElement"
            itemscope
            itemtype="https://schema.org/ListItem">
          <a *ngIf="!last"
             [routerLink]="crumb.url"
             itemprop="item"
             class="breadcrumb-link">
            <span itemprop="name">{{ crumb.label }}</span>
          </a>
          <span *ngIf="last" itemprop="name" class="current">{{ crumb.label }}</span>
          <meta itemprop="position" [content]="i + 1">
        </li>
      </ol>
    </nav>
  `,
  styles: [`
    .breadcrumb-nav {
      padding: 12px 0;
      margin-bottom: 16px;
    }

    .breadcrumb {
      display: flex;
      flex-wrap: wrap;
      padding: 0;
      margin: 0;
      list-style: none;
      font-size: 13px;
      color: #666;
    }

    .breadcrumb-item {
      display: flex;
      align-items: center;
    }

    .breadcrumb-item + .breadcrumb-item::before {
      content: "/";
      padding: 0 10px;
      color: #ccc;
    }

    .breadcrumb-link {
      color: #667eea;
      text-decoration: none;
      transition: color 0.2s;
    }

    .breadcrumb-link:hover {
      color: #1a1a2e;
      text-decoration: underline;
    }

    .breadcrumb-item.active .current {
      color: #1a1a2e;
      font-weight: 500;
    }

    @media (max-width: 576px) {
      .breadcrumb {
        font-size: 12px;
      }

      .breadcrumb-item + .breadcrumb-item::before {
        padding: 0 6px;
      }
    }
  `]
})
export class BreadcrumbComponent implements OnInit, OnDestroy {
  breadcrumbs: BreadcrumbItem[] = [];
  private routerSubscription?: Subscription;

  // Route label mapping
  private routeLabels: { [key: string]: string } = {
    '': 'Accueil',
    'femme': 'Femme',
    'homme': 'Homme',
    'enfant': 'Enfant',
    'accessoires': 'Accessoires',
    'nouveautes': 'Nouveautés',
    'promotions': 'Promotions',
    'produit': 'Produit',
    'categorie': 'Catégorie',
    'panier': 'Panier',
    'checkout': 'Commande',
    'compte': 'Mon Compte',
    'favoris': 'Favoris',
    'connexion': 'Connexion',
    'inscription': 'Inscription',
    'contact': 'Contact',
    'a-propos': 'À Propos',
    'about-us': 'À Propos',
    'politique-confidentialite': 'Confidentialité',
    'privacy': 'Confidentialité',
    'livraison-retours': 'Livraison & Retours',
    'shipping-return': 'Livraison & Retours',
    'guide-tailles': 'Guide des Tailles',
    'size-guide': 'Guide des Tailles',
    'order-confirmation': 'Confirmation',
    'admin': 'Administration'
  };

  constructor(private router: Router, private activatedRoute: ActivatedRoute) {}

  ngOnInit(): void {
    this.buildBreadcrumbs();

    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      distinctUntilChanged()
    ).subscribe(() => {
      this.buildBreadcrumbs();
    });
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }

  private buildBreadcrumbs(): void {
    const url = this.router.url.split('?')[0]; // Remove query params
    const segments = url.split('/').filter(s => s);

    this.breadcrumbs = [
      { label: 'Accueil', url: '/', isActive: segments.length === 0 }
    ];

    let currentUrl = '';
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentUrl += '/' + segment;
      const isLast = i === segments.length - 1;

      // Skip numeric IDs in breadcrumb display (but keep in URL)
      if (/^\d+$/.test(segment)) {
        continue;
      }

      // Get label
      let label = this.getLabel(segment);

      // For product pages, try to get product name from route data or session
      if (segment === 'produit' && segments[i + 1]) {
        const productName = sessionStorage.getItem('currentProductName');
        if (productName && isLast) {
          label = productName;
        }
      }

      this.breadcrumbs.push({
        label,
        url: currentUrl,
        isActive: isLast
      });
    }
  }

  private getLabel(segment: string): string {
    // Check direct mapping
    if (this.routeLabels[segment.toLowerCase()]) {
      return this.routeLabels[segment.toLowerCase()];
    }

    // Handle slug format (e.g., "robe-ete-fleurie" -> "Robe été fleurie")
    return segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }
}
