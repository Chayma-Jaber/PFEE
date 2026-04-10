import { Injectable, Inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class MetaService {
  constructor(
    private meta: Meta,
    private router: Router,
    @Inject(DOCUMENT) private document: Document
  ) {}

  /**
   * Initialize the service to update canonical links on route changes
   */
  initCanonicalService(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.updateCanonicalUrl();
    });
  }

  /**
   * Updates the canonical URL to ensure it points to the HTTPS version
   */
  private updateCanonicalUrl(): void {
    // Get the current URL
    const currentUrl = this.router.url;
    
    // Create the full HTTPS URL
    const domain = 'www.barsha.com.tn';
    const httpsUrl = `https://${domain}${currentUrl}`;
    
    // Find existing canonical link tag
    let linkElement = this.document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    
    // If canonical link exists, update it, otherwise create a new one
    if (linkElement) {
      linkElement.setAttribute('href', httpsUrl);
    } else {
      linkElement = this.document.createElement('link');
      linkElement.setAttribute('rel', 'canonical');
      linkElement.setAttribute('href', httpsUrl);
      this.document.head.appendChild(linkElement);
    }
  }
} 