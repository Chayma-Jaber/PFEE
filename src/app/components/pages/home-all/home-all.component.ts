import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { HomeService } from './home';
import { CommonModule } from '@angular/common';
import { TitleService } from '../../../services/title.service';
import { WelcomePopupComponent } from '../../shared/welcome-popup.component';
import { FeaturedProductsService, FeaturedProduct, FeaturedCategory } from '../../../services/featured-products.service';
import { HomepageRecommendationsComponent } from '../../commun/next-gen-recommendations';
import { RecentlyViewedComponent } from '../../commun/recently-viewed/recently-viewed.component';
import { FeaturedOutfitsComponent } from '../../commun/featured-outfits/featured-outfits.component';
import { BundlesSectionComponent } from '../../commun/bundles-section/bundles-section.component';
import { FlashSalesSectionComponent } from '../../commun/flash-sales-section/flash-sales-section.component';

@Component({
  selector: 'app-home-all',
  standalone: true,
  imports: [RouterModule, CommonModule, WelcomePopupComponent, HomepageRecommendationsComponent, RecentlyViewedComponent, FeaturedOutfitsComponent, BundlesSectionComponent, FlashSalesSectionComponent],
  templateUrl: './home-all.component.html',
  styleUrl: './home-all.component.scss'
})
export class HomeAllComponent implements OnInit, OnDestroy {
  searchResults: any;
  isLoading: boolean = true;
  showWelcomePopup: boolean = false;
  popupData: any;
  promoSection: any = null;
  isMobile: boolean = false;

  // Featured content
  newArrivals: FeaturedProduct[] = [];
  trendingProducts: FeaturedProduct[] = [];
  featuredCategories: FeaturedCategory[] = [];
  isLoadingFeatured: boolean = true;

  // Track user logged in status for AI recommendations
  isUserLoggedIn: boolean = false;

  // Selected gender for recommendations filtering
  selectedGender: string | undefined;

  // Recently viewed product IDs for AI recommendations
  viewedProductIds: number[] = [];

  private resizeListener: () => void;

  constructor(
    private homeService: HomeService,
    private titleService: TitleService,
    private featuredService: FeaturedProductsService,
    private router: Router
  ) {
    this.resizeListener = () => this.checkIfMobile();
  }

  ngAfterViewInit(): void {
    this.checkIfMobile();
    window.addEventListener('resize', this.resizeListener);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeListener);
  }

  checkIfMobile(): void {
    this.isMobile = window.innerWidth <= 767;
  }

  ngOnInit(): void {
    this.titleService.setSpecificTitle('Accueil');
    this.checkIfMobile();
    this.isUserLoggedIn = !!localStorage.getItem('jwt');

    // Get selected gender for filtering recommendations
    const gender = localStorage.getItem('selectedGender');
    if (gender) {
      this.selectedGender = gender === 'Femme' ? 'WOMEN' : gender === 'Homme' ? 'MEN' : undefined;
    }

    // Load recently viewed product IDs for recommendations
    const viewedStr = localStorage.getItem('recentlyViewed');
    if (viewedStr) {
      try {
        this.viewedProductIds = JSON.parse(viewedStr);
      } catch (e) {
        this.viewedProductIds = [];
      }
    }

    this.isLoading = true;

    // Load hero and promo data
    this.homeService.searchHome().subscribe(
      (data) => {
        this.searchResults = data;
        this.isLoading = false;

        // Safe access with defensive checks
        const firstHit = data?.hits?.[0];

        if (firstHit?.popup) {
          this.popupData = firstHit.popup;
          setTimeout(() => {
            this.showWelcomePopup = true;
          }, 300);
        } else {
          this.showWelcomePopup = false;
        }

        if (firstHit?.promoSection) {
          this.promoSection = firstHit.promoSection;
        } else if (firstHit?.promos?.[0]) {
          // Fallback to promos array from backend
          this.promoSection = firstHit.promos[0];
        } else {
          this.promoSection = null;
        }
      },
      (error) => {
        console.error('Erreur lors de la récupération des données', error);
        this.isLoading = false;
      }
    );

    // Load featured products
    this.loadFeaturedContent();
  }

  private loadFeaturedContent(): void {
    this.isLoadingFeatured = true;

    this.featuredService.getAllHomeData({
      newArrivals: 8,
      trending: 8,
      categories: 6
    }).subscribe({
      next: (data) => {
        this.newArrivals = data.newArrivals || [];
        this.trendingProducts = data.trending || [];
        this.featuredCategories = data.categories || [];
        this.isLoadingFeatured = false;
      },
      error: (err) => {
        console.error('Error loading featured content:', err);
        this.isLoadingFeatured = false;
      }
    });
  }

  onGenderButtonClick(button: any): void {
    let selectedGender: string = '';

    if (button.text && button.text.toLowerCase().includes('elle')) {
      selectedGender = 'Femme';
    } else if (button.text && button.text.toLowerCase().includes('lui')) {
      selectedGender = 'Homme';
    }

    if (selectedGender) {
      localStorage.setItem('selectedGender', selectedGender);
    }
  }

  onCloseWelcomePopup() {
    this.showWelcomePopup = false;
  }

  navigateToProduct(productId: number, title: string): void {
    const slug = this.slugify(title);
    this.router.navigate(['/produit', `${productId}-${slug}`]);
  }

  navigateToCategory(category: FeaturedCategory): void {
    // Navigate directly to the link - use navigateByUrl to avoid encoding issues
    const cleanLink = category.link?.startsWith('/') ? category.link : `/${category.link}`;
    this.router.navigateByUrl(cleanLink);
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  trackByProductId(index: number, product: FeaturedProduct): number {
    return product.id;
  }

  trackByCategoryId(index: number, category: FeaturedCategory): number {
    return category.id;
  }

  get window(): Window {
    return window;
  }
}
