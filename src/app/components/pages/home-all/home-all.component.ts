import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { HomeService } from './home';
import { CommonModule } from '@angular/common';
import { TitleService } from '../../../services/title.service';
import { FunnelService } from '../../../services/funnel.service';
import { WelcomePopupComponent } from '../../shared/welcome-popup.component';
import { FeaturedProductsService, FeaturedProduct, FeaturedCategory } from '../../../services/featured-products.service';
import { RecentlyViewedComponent } from '../../commun/recently-viewed/recently-viewed.component';
import { FeaturedOutfitsComponent } from '../../commun/featured-outfits/featured-outfits.component';
import { BundlesSectionComponent } from '../../commun/bundles-section/bundles-section.component';
import { FlashSalesSectionComponent } from '../../commun/flash-sales-section/flash-sales-section.component';
import { DynamicHomepageBlocksComponent } from '../../commun/dynamic-homepage-blocks/dynamic-homepage-blocks.component';
import { DailyDealBannerComponent } from '../../commun/daily-deal-banner/daily-deal-banner.component';

@Component({
  selector: 'app-home-all',
  standalone: true,
  imports: [RouterModule, CommonModule, WelcomePopupComponent, RecentlyViewedComponent, FeaturedOutfitsComponent, BundlesSectionComponent, FlashSalesSectionComponent, DynamicHomepageBlocksComponent, DailyDealBannerComponent],
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

  private readonly fallbackDesktopHero = this.createHeroSvgDataUri(
    'Nouvelle collection',
    'BARSHA',
    'Decouvrez les nouveautes pensees pour elle et pour lui.'
  );
  private readonly fallbackMobileHero = this.createHeroSvgDataUri(
    'Nouvelle collection',
    'BARSHA',
    'Decouvrez les nouveautes.'
  );
  private readonly fallbackHomeData = {
    hits: [{
      slides: [{
        media: {
          url: this.fallbackDesktopHero,
          medium: { url: this.fallbackDesktopHero },
          name: 'Barsha hero banner'
        },
        mob_media: {
          url: this.fallbackMobileHero,
          medium: { url: this.fallbackMobileHero }
        }
      }],
      navBtns: [
        { text: 'Pour Elle', linkTo: '3-femme', bgColor: '#000000' },
        { text: 'Pour Lui', linkTo: '4-homme', bgColor: '#ffffff' }
      ],
      promoSection: {
        text: 'Livraison offerte des 199 TND',
        subText: 'Profitez de nos essentiels du moment en quelques clics.',
        btnText: 'Voir les nouveautes',
        btnLink: '/tn/1-nouveautes',
        bgColor: '#111111',
        textColor: '#ffffff',
        btnBgColor: '#f3e7d3',
        btnTextColor: '#111111'
      }
    }]
  };

  private resizeListener: () => void;

  constructor(
    private homeService: HomeService,
    private titleService: TitleService,
    private featuredService: FeaturedProductsService,
    private router: Router,
    private funnel: FunnelService
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
    this.funnel.track('VIEW_HOME');

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
        this.searchResults = this.normalizeHomeData(data);
        this.isLoading = false;

        // Safe access with defensive checks
        const firstHit = this.searchResults?.hits?.[0];

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

  get heroSlide(): any {
    return this.searchResults?.hits?.[0]?.slides?.[0] ?? null;
  }

  get heroImageUrl(): string | null {
    return this.heroSlide?.media?.url ?? null;
  }

  get heroMobileImageUrl(): string | null {
    return this.heroSlide?.mob_media?.url || this.heroImageUrl;
  }

  get heroDesktopSrcset(): string | null {
    const media = this.heroSlide?.media;
    if (!media?.url) {
      return null;
    }

    return media?.medium?.url
      ? `${media.medium.url} 750w, ${media.url} 1905w`
      : media.url;
  }

  get heroMobileSrcset(): string | null {
    const media = this.heroSlide?.mob_media;
    if (!media?.url) {
      return this.heroDesktopSrcset;
    }

    return media?.medium?.url
      ? `${media.medium.url} 501w, ${media.url} 1200w`
      : media.url;
  }

  get heroAlt(): string {
    return this.heroSlide?.media?.name || 'BARSHA Fashion';
  }

  get navButtons(): any[] {
    return this.searchResults?.hits?.[0]?.navBtns || [];
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
      this.selectedGender = selectedGender === 'Femme' ? 'WOMEN' : 'MEN';
    }

    const route = this.resolveNavButtonRoute(button, selectedGender);
    this.router.navigate(route.commands, route.extras);
  }

  private resolveNavButtonRoute(button: any, selectedGender: string): { commands: any[]; extras?: any } {
    if (selectedGender === 'Femme') {
      return { commands: ['/categorie', 'femme'] };
    }

    if (selectedGender === 'Homme') {
      return { commands: ['/categorie', 'homme'] };
    }

    const rawLink = String(button?.linkTo || '').trim();

    if (rawLink.startsWith('/tn/')) {
      return { commands: ['/categorie', rawLink.split('/').pop()] };
    }

    if (rawLink.startsWith('/categorie/')) {
      return { commands: ['/categorie', rawLink.split('/').pop()] };
    }

    if (rawLink.startsWith('tn/')) {
      return { commands: ['/categorie', rawLink.split('/').pop()] };
    }

    if (rawLink.startsWith('categorie/')) {
      return { commands: ['/categorie', rawLink.split('/').pop()] };
    }

    if (rawLink) {
      return { commands: ['/categorie', rawLink] };
    }

    return { commands: ['/categorie', 'femme'] };
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

  private normalizeHomeData(data: any): any {
    const firstHit = data?.hits?.[0];

    if (firstHit?.slides?.[0]?.media?.url) {
      return data;
    }

    if (firstHit?.desktopImageUrl) {
      return {
        ...data,
        hits: [{
          ...firstHit,
          slides: [{
            media: {
              url: firstHit.desktopImageUrl,
              medium: { url: firstHit.desktopImageUrl },
              name: firstHit.name || firstHit.title || 'Barsha hero banner'
            },
            mob_media: {
              url: firstHit.mobileImageUrl || firstHit.desktopImageUrl,
              medium: {
                url: firstHit.mobileImageUrl || firstHit.desktopImageUrl
              }
            }
          }]
        }]
      };
    }

    return this.fallbackHomeData;
  }

  private createHeroSvgDataUri(kicker: string, title: string, subtitle: string): string {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 760">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f7efe4" />
            <stop offset="45%" stop-color="#e9dcc8" />
            <stop offset="100%" stop-color="#ccb69a" />
          </linearGradient>
        </defs>
        <rect width="1600" height="760" fill="url(#bg)" />
        <circle cx="1240" cy="180" r="220" fill="rgba(255,255,255,0.28)" />
        <circle cx="220" cy="620" r="260" fill="rgba(17,17,17,0.08)" />
        <text x="120" y="220" fill="#111111" font-family="Arial, sans-serif" font-size="28" letter-spacing="6">${kicker}</text>
        <text x="120" y="330" fill="#111111" font-family="Arial, sans-serif" font-size="96" font-weight="700">${title}</text>
        <text x="120" y="410" fill="#111111" font-family="Arial, sans-serif" font-size="34">${subtitle}</text>
        <rect x="120" y="470" width="260" height="64" rx="32" fill="#111111" />
        <text x="250" y="512" text-anchor="middle" fill="#f7efe4" font-family="Arial, sans-serif" font-size="24">SHOP NOW</text>
      </svg>
    `;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }
}
