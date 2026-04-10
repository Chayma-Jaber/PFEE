import { Injectable } from '@angular/core';
import { Router, NavigationEnd, NavigationStart } from '@angular/router';
import { ViewportScroller } from '@angular/common';
import { filter } from 'rxjs/operators';

interface ScrollPosition {
  url: string;
  scrollTop: number;
  timestamp: number;
}

interface NavigationState {
  fromUrl: string;
  toUrl: string;
  isBackNavigation: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ScrollPositionService {
  private scrollPositions = new Map<string, ScrollPosition>();
  private readonly STORAGE_KEY = 'barsha_scroll_positions';
  private readonly MAX_STORED_POSITIONS = 50;
  private readonly POSITION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

  // Track navigation state to detect back navigation
  private navigationState: NavigationState | null = null;
  private previousUrl: string = '';

  // Routes that should always scroll to top (like home, auth pages)
  private readonly SCROLL_TO_TOP_ROUTES = [
    '/',
    '/home',
    '/login',
    '/register',
    '/checkout',
    '/cart',
    '/sign',
    '/profile',
    '/categorie/Femme',
    '/categorie/Homme',
    '/produit/'

  ];

  // Routes that should preserve scroll position (product listing pages)
  private readonly PRESERVE_SCROLL_ROUTES = [
    '/tn/',
    '/shop/',
    '/favoris',
   
  ];

  constructor(
    private router: Router,
    private viewportScroller: ViewportScroller
  ) {
    this.loadStoredPositions();
    this.setupScrollTracking();
  }

  /**
   * Set up scroll position tracking on route changes
   */
  private setupScrollTracking(): void {
    this.router.events
      .pipe(filter(event => event instanceof NavigationStart || event instanceof NavigationEnd))
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          this.handleNavigationStart(event);
        } else if (event instanceof NavigationEnd) {
          this.handleRouteChange(event);
        }
      });
  }

  /**
   * Handle navigation start to track where we're coming from
   */
  private handleNavigationStart(event: NavigationStart): void {
    this.navigationState = {
      fromUrl: this.router.url,
      toUrl: event.url,
      isBackNavigation: this.isBackNavigation(this.router.url, event.url)
    };

    // Save current scroll position before navigation
    if (this.shouldPreserveScrollPosition(this.router.url)) {
      this.saveScrollPosition(this.router.url);
    }
  }

  /**
   * Detect if this is a back navigation (from product detail to listing page)
   */
  private isBackNavigation(fromUrl: string, toUrl: string): boolean {
    // Check if we're going from a product detail page to a listing page
    const isFromProductDetail = fromUrl.includes('/produit/');
    const isToListingPage = this.shouldPreserveScrollPosition(toUrl);

    return isFromProductDetail && isToListingPage;
  }

  /**
   * Handle route changes and decide whether to restore scroll position or scroll to top
   */
  private handleRouteChange(event: NavigationEnd): void {
    const currentUrl = event.urlAfterRedirects || event.url;

    // Longer delay to ensure the page has fully rendered, especially for dynamic content
    setTimeout(() => {
      if (this.shouldScrollToTop(currentUrl)) {
        this.scrollToTop();
      } else if (this.shouldPreserveScrollPosition(currentUrl)) {
        // For shop pages, restore position after a longer delay
        setTimeout(() => {
          this.restoreScrollPosition(currentUrl);
        }, 500);
      } else {
        // For product detail pages, check if we're coming from a listing page
        this.handleProductDetailNavigation(currentUrl);
      }

      // Update previous URL for next navigation
      this.previousUrl = currentUrl;
      // Clear navigation state after handling
      this.navigationState = null;
    }, 300);
  }

  /**
   * Check if the route should always scroll to top
   */
  private shouldScrollToTop(url: string): boolean {
    return this.SCROLL_TO_TOP_ROUTES.some(route =>
      url === route || url.startsWith(route + '?') || url.startsWith(route + '#')
    );
  }

  /**
   * Check if the route should preserve scroll position
   */
  private shouldPreserveScrollPosition(url: string): boolean {
    return this.PRESERVE_SCROLL_ROUTES.some(route => url.includes(route));
  }

  /**
   * Handle navigation to product detail pages
   */
  private handleProductDetailNavigation(currentUrl: string): void {
    // Check if this is a product detail page
    if (currentUrl.includes('/produit/')) {
      // For product detail pages, always scroll to top
      // This ensures users start at the top when viewing product details
      this.scrollToTop();
    } else {
      // For other pages, try to restore scroll position
      this.restoreScrollPosition(currentUrl);
    }
  }

  /**
   * Save current scroll position for the given URL
   */
  saveScrollPosition(url: string): void {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

    if (scrollTop > 0) { // Only save if user has scrolled
      const position: ScrollPosition = {
        url,
        scrollTop,
        timestamp: Date.now()
      };

      this.scrollPositions.set(url, position);
      this.persistScrollPositions();
    }
  }

  /**
   * Restore scroll position for the given URL
   */
  private restoreScrollPosition(url: string): void {
    const position = this.scrollPositions.get(url);
    if (!position) {
      this.viewportScroller.scrollToPosition([0, 0]);
      return;
    }


    // First attempt: Use viewportScroller
    this.viewportScroller.scrollToPosition([0, position.scrollTop]);

    // Second attempt: Use window.scrollTo after a short delay
    setTimeout(() => {
      window.scrollTo({
        top: position.scrollTop,
        behavior: 'instant'
      });

      // Verify and correct position if needed
      setTimeout(() => {
        const currentPosition = window.scrollY;
        if (Math.abs(currentPosition - position.scrollTop) > 50) {
         
          
          window.scrollTo({
            top: position.scrollTop,
            behavior: 'instant'
          });
        }
      }, 50);
    }, 50);

    // Backup attempt after a longer delay
    setTimeout(() => {
      const currentPosition = window.scrollY;
      if (Math.abs(currentPosition - position.scrollTop) > 50) {
       
        
        window.scrollTo({
          top: position.scrollTop,
          behavior: 'instant'
        });
      }
    }, 300);
  }

  /**
   * Scroll to top of the page
   */
  private scrollToTop(): void {
    this.viewportScroller.scrollToPosition([0, 0]);
  }

  /**
   * Check if a stored position is still valid (not expired)
   */
  private isPositionValid(position: ScrollPosition): boolean {
    return (Date.now() - position.timestamp) < this.POSITION_EXPIRY_MS;
  }

  /**
   * Save scroll position before navigating to product detail
   * This method is called when user clicks on a product in listing pages
   */
  savePositionBeforeProductNavigation(): void {
    const currentUrl = this.router.url;
    if (this.shouldPreserveScrollPosition(currentUrl)) {
      // Force save the current scroll position immediately
      const scrollTop = this.getCurrentScrollPosition();
      if (scrollTop > 0) {
        const position: ScrollPosition = {
          url: currentUrl,
          scrollTop,
          timestamp: Date.now()
        };
        this.scrollPositions.set(currentUrl, position);
        this.persistScrollPositions();
        
        // Log the saved position for debugging
       
      }
    }
  }

  /**
   * Load stored scroll positions from sessionStorage
   */
  private loadStoredPositions(): void {
    try {
      const stored = sessionStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const positions: ScrollPosition[] = JSON.parse(stored);
        positions.forEach(pos => {
          if (this.isPositionValid(pos)) {
            this.scrollPositions.set(pos.url, pos);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to load stored scroll positions:', error);
    }
  }

  /**
   * Persist scroll positions to sessionStorage
   */
  private persistScrollPositions(): void {
    try {
      // Clean up expired positions
      this.cleanupExpiredPositions();

      // Convert Map to Array for storage
      const positions = Array.from(this.scrollPositions.values());

      // Limit the number of stored positions
      if (positions.length > this.MAX_STORED_POSITIONS) {
        positions.sort((a, b) => b.timestamp - a.timestamp);
        positions.splice(this.MAX_STORED_POSITIONS);

        // Rebuild the Map with limited positions
        this.scrollPositions.clear();
        positions.forEach(pos => this.scrollPositions.set(pos.url, pos));
      }

      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(positions));
    } catch (error) {
      console.warn('Failed to persist scroll positions:', error);
    }
  }

  /**
   * Remove expired scroll positions
   */
  private cleanupExpiredPositions(): void {
    const now = Date.now();
    for (const [url, position] of this.scrollPositions.entries()) {
      if ((now - position.timestamp) > this.POSITION_EXPIRY_MS) {
        this.scrollPositions.delete(url);
      }
    }
  }

  /**
   * Clear all stored scroll positions
   */
  clearAllPositions(): void {
    this.scrollPositions.clear();
    sessionStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Get current scroll position
   */
  getCurrentScrollPosition(): number {
    return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  /**
   * Debug method to check stored scroll positions
   */
  debugScrollPositions(): void {

    this.scrollPositions.forEach((position, url) => {
      
    });
   
  }

  /**
   * Force restore scroll position for debugging
   */
  forceRestorePosition(url: string): void {
    const position = this.scrollPositions.get(url);
    if (!position) {
      this.viewportScroller.scrollToPosition([0, 0]);
      return;
    }

 

    // Multiple attempts with increasing delays
    const attempts = [
      { delay: 0, behavior: 'instant' },
      { delay: 100, behavior: 'instant' },
      { delay: 300, behavior: 'instant' },
      { delay: 500, behavior: 'instant' },
      { delay: 800, behavior: 'instant' }  // Added longer delay for final attempt
    ];

    attempts.forEach(attempt => {
      setTimeout(() => {
        window.scrollTo({
          top: position.scrollTop,
          behavior: attempt.behavior as ScrollBehavior
        });

       
      }, attempt.delay);
    });
  }
}
