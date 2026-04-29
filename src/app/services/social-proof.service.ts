import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, interval, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environementDev } from '../../environements/environementDev';

export type ActivityType = 'purchase' | 'review' | 'wishlist' | 'viewing';

export interface SocialProofActivity {
  id: string;
  type: ActivityType;
  userName: string;
  userCity: string;
  productName: string;
  productImage: string;
  productId: number;
  timestamp: Date;
  rating?: number; // For reviews
  viewerCount?: number; // For viewing
}

export interface ViewerData {
  productId: number;
  viewerCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class SocialProofService implements OnDestroy {
  private readonly STORAGE_KEY = 'barsha_social_proof_dismissed';
  private readonly POPUP_INTERVAL_KEY = 'barsha_social_proof_interval';

  // Tunisian cities for realistic mock data
  private readonly tunisianCities = [
    'Tunis', 'Sfax', 'Sousse', 'Kairouan', 'Bizerte',
    'Gabes', 'Ariana', 'Gafsa', 'Monastir', 'Ben Arous',
    'Kasserine', 'Medenine', 'Nabeul', 'Tataouine', 'Beja',
    'Jendouba', 'Mahdia', 'Sidi Bouzid', 'Tozeur', 'Siliana',
    'Kebili', 'Kef', 'Zaghouan', 'Manouba'
  ];

  // Common Tunisian first names
  private readonly firstNames = [
    'Sarah', 'Amira', 'Yasmine', 'Fatma', 'Mariem',
    'Ines', 'Nour', 'Sarra', 'Emna', 'Rania',
    'Ahmed', 'Mohamed', 'Youssef', 'Ali', 'Omar',
    'Karim', 'Slim', 'Mehdi', 'Amine', 'Hamza'
  ];

  // Sample product names (fashion items)
  private readonly productNames = [
    'Robe Elegante', 'Chemise en Lin', 'Pantalon Chino',
    'Veste en Jean', 'Pull en Cachemire', 'Jupe Plissee',
    'Blazer Classique', 'T-shirt Premium', 'Short en Coton',
    'Cardigan Tricote', 'Manteau d\'Hiver', 'Combinaison Chic',
    'Top Boheme', 'Bermuda Casual', 'Robe Maxi Fleurie',
    'Chemisier Satin', 'Jean Slim', 'Tunique Brodee',
    'Polo Sport', 'Gilet Sans Manches'
  ];

  // Sample product images (placeholder paths)
  private readonly productImages = [
    '/assets/images/placeholder.jpg',
    '/assets/images/placeholder.png',
    '/assets/images/placeholder.jpg'
  ];
  private readonly realProducts: Array<{ id: number; name: string; image: string }> = [];

  // Activity messages in French
  private readonly activityMessages = {
    purchase: 'vient d\'acheter',
    review: 'vient de laisser un avis sur',
    wishlist: 'vient d\'ajouter a ses favoris',
    viewing: 'personnes regardent ce produit'
  };

  // BehaviorSubjects for reactive data
  private activitiesSubject = new BehaviorSubject<SocialProofActivity[]>([]);
  private latestActivitySubject = new BehaviorSubject<SocialProofActivity | null>(null);
  private viewerCountSubject = new BehaviorSubject<ViewerData | null>(null);
  private isPopupEnabledSubject = new BehaviorSubject<boolean>(true);

  // Observables
  activities$ = this.activitiesSubject.asObservable();
  latestActivity$ = this.latestActivitySubject.asObservable();
  viewerCount$ = this.viewerCountSubject.asObservable();
  isPopupEnabled$ = this.isPopupEnabledSubject.asObservable();

  // Subscriptions
  private feedSubscription: Subscription | null = null;
  private viewerSubscription: Subscription | null = null;

  // Configuration
  private feedIntervalMs = 30000; // 30 seconds between activities
  private viewerUpdateIntervalMs = 15000; // 15 seconds for viewer count updates

  constructor(private http: HttpClient) {
    this.loadPreferences();
    this.initializeActivities();
    this.loadRealProducts();
  }

  ngOnDestroy(): void {
    this.stopLiveFeed();
    this.stopViewerUpdates();
  }

  /**
   * Load user preferences from localStorage
   */
  private loadPreferences(): void {
    const dismissed = localStorage.getItem(this.STORAGE_KEY);
    if (dismissed === 'true') {
      this.isPopupEnabledSubject.next(false);
    }

    const customInterval = localStorage.getItem(this.POPUP_INTERVAL_KEY);
    if (customInterval) {
      this.feedIntervalMs = parseInt(customInterval, 10);
    }
  }

  /**
   * Initialize with some mock activities
   */
  private initializeActivities(): void {
    const initialActivities: SocialProofActivity[] = [];
    for (let i = 0; i < 10; i++) {
      initialActivities.push(this.generateRandomActivity(i));
    }
    this.activitiesSubject.next(initialActivities);
  }

  /**
   * Generate a random activity
   */
  private generateRandomActivity(index: number = 0): SocialProofActivity {
    const types: ActivityType[] = ['purchase', 'review', 'wishlist'];
    const type = types[Math.floor(Math.random() * types.length)];
    const minutesAgo = Math.floor(Math.random() * 30) + index;

    const realProduct = this.getRandomRealProduct();
    return {
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      userName: this.getRandomItem(this.firstNames),
      userCity: this.getRandomItem(this.tunisianCities),
      productName: realProduct?.name || this.getRandomItem(this.productNames),
      productImage: realProduct?.image || this.getRandomItem(this.productImages),
      productId: realProduct?.id || Math.floor(Math.random() * 1000) + 1,
      timestamp: new Date(Date.now() - minutesAgo * 60000),
      rating: type === 'review' ? Math.floor(Math.random() * 2) + 4 : undefined // 4 or 5 stars
    };
  }

  private loadRealProducts(): void {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`,
      'Content-Type': 'application/json'
    });
    const body = {
      q: '',
      filter: 'disponible = true',
      sort: ['id:desc'],
      limit: 20
    };

    this.http.post<any>(`${environementDev.apiSearchDev}/indexes/products/search`, body, { headers }).subscribe({
      next: (response) => {
        const hits = Array.isArray(response?.hits) ? response.hits : [];
        this.realProducts.splice(
          0,
          this.realProducts.length,
          ...hits
            .map((product: any) => ({
              id: Number(product.id),
              name: product.nom || product.title || product.name || `Produit #${product.id}`,
              image: product.firstImageUrl || product.firstImg?.url || product.image?.url || product.image || '/assets/images/placeholder.jpg'
            }))
            .filter((product: any) => product.id)
        );

        if (this.realProducts.length > 0) {
          const refreshedActivities = Array.from({ length: 10 }, (_, index) => this.generateRandomActivity(index));
          this.activitiesSubject.next(refreshedActivities);
        }
      },
      error: () => {
        // Keep mock fallback silently in local dev
      }
    });
  }

  private getRandomRealProduct(): { id: number; name: string; image: string } | null {
    if (this.realProducts.length === 0) {
      return null;
    }
    return this.getRandomItem(this.realProducts);
  }

  /**
   * Get a random item from an array
   */
  private getRandomItem<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Get recent activities
   */
  getRecentActivity(limit: number = 10): Observable<SocialProofActivity[]> {
    return this.activities$.pipe(
      map(activities => activities.slice(0, limit))
    );
  }

  /**
   * Start live feed with interval updates
   */
  startLiveFeed(intervalMs?: number): void {
    if (this.feedSubscription) {
      return; // Already running
    }

    const feedInterval = intervalMs || this.feedIntervalMs;

    this.feedSubscription = interval(feedInterval).subscribe(() => {
      if (this.isPopupEnabledSubject.value) {
        const newActivity = this.generateRandomActivity();

        // Add to activities list
        const currentActivities = this.activitiesSubject.value;
        this.activitiesSubject.next([newActivity, ...currentActivities.slice(0, 19)]);

        // Emit latest activity for popup
        this.latestActivitySubject.next(newActivity);
      }
    });
  }

  /**
   * Stop live feed
   */
  stopLiveFeed(): void {
    if (this.feedSubscription) {
      this.feedSubscription.unsubscribe();
      this.feedSubscription = null;
    }
  }

  /**
   * Set feed interval
   */
  setFeedInterval(intervalMs: number): void {
    this.feedIntervalMs = intervalMs;
    localStorage.setItem(this.POPUP_INTERVAL_KEY, intervalMs.toString());

    // Restart feed with new interval if running
    if (this.feedSubscription) {
      this.stopLiveFeed();
      this.startLiveFeed(intervalMs);
    }
  }

  /**
   * Get viewer count for a product
   */
  getViewerCount(productId: number): Observable<number> {
    // Generate initial random viewer count (5-25)
    const baseCount = Math.floor(Math.random() * 20) + 5;
    this.viewerCountSubject.next({ productId, viewerCount: baseCount });

    return this.viewerCount$.pipe(
      map(data => data?.productId === productId ? data.viewerCount : 0)
    );
  }

  /**
   * Start viewer count updates for a product
   */
  startViewerUpdates(productId: number): void {
    if (this.viewerSubscription) {
      this.viewerSubscription.unsubscribe();
    }

    // Initial count
    const baseCount = Math.floor(Math.random() * 20) + 5;
    this.viewerCountSubject.next({ productId, viewerCount: baseCount });

    this.viewerSubscription = interval(this.viewerUpdateIntervalMs).subscribe(() => {
      const currentData = this.viewerCountSubject.value;
      if (currentData && currentData.productId === productId) {
        // Fluctuate count by -2 to +3
        const change = Math.floor(Math.random() * 6) - 2;
        const newCount = Math.max(3, Math.min(50, currentData.viewerCount + change));
        this.viewerCountSubject.next({ productId, viewerCount: newCount });
      }
    });
  }

  /**
   * Stop viewer count updates
   */
  stopViewerUpdates(): void {
    if (this.viewerSubscription) {
      this.viewerSubscription.unsubscribe();
      this.viewerSubscription = null;
    }
  }

  /**
   * Disable popup permanently
   */
  disablePopup(): void {
    localStorage.setItem(this.STORAGE_KEY, 'true');
    this.isPopupEnabledSubject.next(false);
  }

  /**
   * Enable popup
   */
  enablePopup(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.isPopupEnabledSubject.next(true);
  }

  /**
   * Check if popup is enabled
   */
  isPopupEnabled(): boolean {
    return this.isPopupEnabledSubject.value;
  }

  /**
   * Format time ago in French
   */
  formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'A l\'instant';
    if (diffMins === 1) return 'Il y a 1 minute';
    if (diffMins < 60) return `Il y a ${diffMins} minutes`;
    if (diffHours === 1) return 'Il y a 1 heure';
    if (diffHours < 24) return `Il y a ${diffHours} heures`;
    if (diffDays === 1) return 'Hier';
    return `Il y a ${diffDays} jours`;
  }

  /**
   * Get activity message based on type
   */
  getActivityMessage(type: ActivityType): string {
    return this.activityMessages[type];
  }

  /**
   * Get icon class for activity type
   */
  getActivityIcon(type: ActivityType): string {
    const icons: Record<ActivityType, string> = {
      purchase: 'bi-bag-check',
      review: 'bi-star',
      wishlist: 'bi-heart',
      viewing: 'bi-eye'
    };
    return icons[type];
  }

  /**
   * Get color for activity type
   */
  getActivityColor(type: ActivityType): string {
    const colors: Record<ActivityType, string> = {
      purchase: '#10b981', // Green
      review: '#f59e0b', // Amber
      wishlist: '#ec4899', // Pink
      viewing: '#6366f1' // Indigo
    };
    return colors[type];
  }
}
