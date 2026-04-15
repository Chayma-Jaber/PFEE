import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, ElementRef, ViewChild, HostListener, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { MenuService } from '../../../services/menu.service';
import { Category } from '../../../models/menu';
import { SeoService } from '../../../services/seo.service';
import { TitleService } from '../../../services/title.service';
import { AnalyticsService } from '../../../services/analytics.service';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss',
  providers: [AnalyticsService]
})
export class MenuComponent implements OnInit, AfterViewInit, OnDestroy {
  @Output() closeMenuEvent = new EventEmitter<void>();
  @ViewChild('menuRef') menuRef!: ElementRef;

  categories: Category[] = [];
  selectedGender: string | null = null;
  genders: string[] = [];
  openSubMenus: Set<string> = new Set();

  private scrollPosition = 0;

  constructor(
    private categoryService: MenuService,
    private router: Router,
    private route: ActivatedRoute,
    private seoService: SeoService,
    private titleService: TitleService,
    private analytics: AnalyticsService
  ) { }

  ngOnInit(): void {
    // Fix the body when menu is open
    this.disableBodyScroll();

    this.categoryService.getCategories().subscribe(data => {
      this.categories = data;
      this.extractGenders();
      if (this.genders.length > 0) {
        // Vérifier s'il y a un genre sauvegardé dans localStorage
        const savedGender = localStorage.getItem('selectedGender');
        if (savedGender && this.genders.includes(savedGender)) {
          this.selectedGender = savedGender;
        } else {
          this.selectedGender = this.genders[0];
        }
      }

      // Check if we need to redirect from old URL
      this.checkForOldUrlRedirect();
    });
  }

  ngAfterViewInit(): void {
    // Focus menu for keyboard navigation and accessibility
    if (this.menuRef && this.menuRef.nativeElement) {
      this.menuRef.nativeElement.focus();
    }
    // Compute and apply the top position of the menu and overlay based on the header/nav height
    this.setMenuTopPosition();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.setMenuTopPosition();
  }

  ngOnDestroy(): void {
    // Re-enable body scroll when component is destroyed
    this.enableBodyScroll();
  }

  /**
   * Disables scrolling on the body element and stores current scroll position
   */
  private disableBodyScroll(): void {
    // Store current scroll position
    this.scrollPosition = window.scrollY;

    // Measure scrollbar width and compensate to avoid layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    // Add a class to the body to fix its position
    document.body.classList.add('menu-open');

    // Set the body position to fixed and adjust top to maintain visual position
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${this.scrollPosition}px`;
    document.body.style.overflow = 'hidden'; // Hide scrollbar

    // Ensure overlay and menu sit below the navbar when opened
    this.setMenuTopPosition();
  }

  /**
   * Re-enables scrolling on the body element
   */
  private enableBodyScroll(): void {
    // Remove the class from body
    document.body.classList.remove('menu-open');

    // Reset the body position
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.top = '';
    document.body.style.overflow = ''; // Restore scrollbar
    document.body.style.paddingRight = ''; // Remove scrollbar compensation

    // Restore scroll position
    window.scrollTo(0, this.scrollPosition);
  }

  /**
   * Compute top offset of the fixed navbar header and apply it to the menu and overlay
   */
  private setMenuTopPosition(): void {
    try {
      const nav = document.querySelector('nav.navbar.fixed-top') as HTMLElement | null;
      const overlay = document.querySelector('.menu-overlay') as HTMLElement | null;
      const menuEl = this.menuRef && this.menuRef.nativeElement ? this.menuRef.nativeElement as HTMLElement : null;

      // Use getBoundingClientRect.bottom to support any extra top band that may exist
      const topOffset = nav ? Math.round(nav.getBoundingClientRect().bottom) : 0;

      if (menuEl) {
        // set CSS variable and inline styles as a fallback
        menuEl.style.setProperty('--menuTop', `${topOffset}px`);
        menuEl.style.top = `${topOffset}px`;
        menuEl.style.height = `calc(100vh - ${topOffset}px)`;
      }
      if (overlay) {
        overlay.style.setProperty('--menuTop', `${topOffset}px`);
        overlay.style.top = `${topOffset}px`;
        overlay.style.height = `calc(100vh - ${topOffset}px)`;
      }
    } catch (e) {
      // If we cannot compute or apply, silently fail and use default CSS fallbacks
      // (We keep the default top:0 fallback in CSS)
    }
  }

  // Check for old URL format and redirect if needed
  private checkForOldUrlRedirect(): void {
    this.route.url.subscribe(segments => {
      if (segments.length > 0) {
        const firstSegment = segments[0].path;

        // Handle all possible category URL formats
        let categorySlug: string | null = null;

        if (firstSegment === 'shop' && segments.length > 1) {
          // Old format: /shop/categoryId-name
          categorySlug = segments[1].path;
        } else if (firstSegment === 'tn' && segments.length > 1) {
          // New format: /tn/categoryId-name
          categorySlug = segments[1].path;
        } else if (firstSegment.includes('-')) {
          // Direct format: /categoryId-name
          categorySlug = firstSegment;
        }

        // If we found a category slug, check if it uses idOrigin format
        if (categorySlug && categorySlug.includes('-')) {
          const idOriginStr = categorySlug.split('-')[0];
          const idOrigin = parseInt(idOriginStr, 10);
          if (!isNaN(idOrigin)) {
            // Look for the category with this idOrigin to redirect
            this.redirectCategoryByIdOrigin(idOrigin);
          }
        }
      }
    });
  }

  // Redirect from idOrigin URL to current ID URL
  private redirectCategoryByIdOrigin(idOrigin: number): void {
    this.categoryService.getCategoryByIdOrigin(idOrigin).subscribe(category => {
      if (category) {
        // Navigate directly to the link - remove leading slash if present to avoid double encoding
        const cleanLink = category.link?.startsWith('/') ? category.link : `/${category.link}`;
        this.router.navigateByUrl(cleanLink, { replaceUrl: true });
      }
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Handle menu closing
    if (this.menuRef && !this.menuRef.nativeElement.contains(event.target as Node)) {
      this.closeMenu();
    }
  }

  extractGenders(): void {
    this.genders = this.categories
      .map(category => category.name)
      .filter((name, index, self) => self.indexOf(name) === index);

    // Normalize gender names to ensure consistent casing
    this.genders = this.genders.map(gender => {
      if (gender.toUpperCase() === 'FEMME') return 'Femme';
      if (gender.toUpperCase() === 'HOMME') return 'Homme';
      return gender;
    });
  }

  getFilteredCategories(): Category[] {
    if (!this.selectedGender) {
      return [];
    }

    const selectedGenderUpper = this.selectedGender.toUpperCase();

    return this.categories.filter(category => {
      // Case-insensitive comparison to handle different casings
      return category.name && category.name.toUpperCase() === selectedGenderUpper;
    });
  }

  switchGender(gender: string) {
    // Normalize gender to ensure consistent casing
    if (gender.toUpperCase() === 'FEMME') {
      this.selectedGender = 'Femme';
    } else if (gender.toUpperCase() === 'HOMME') {
      this.selectedGender = 'Homme';
    } else {
      this.selectedGender = gender;
    }
  }

  getSubCategoryKey(subCategory: any): string {
    return `${subCategory.name || subCategory.publicName}-${subCategory.id || Math.random()}`;
  }

  toggleSubMenu(subCategory: any): void {
    const key = this.getSubCategoryKey(subCategory);
    if (this.openSubMenus.has(key)) {
      this.openSubMenus.delete(key);
    } else {
      this.openSubMenus.add(key);
      // Tracking ouverture menu
      this.analytics.openMenu({
        id: subCategory.id?.toString() || key,
        name: subCategory.name || subCategory.publicName || key
      });
    }
  }

  isSubMenuOpen(subCategory: any): boolean {
    return this.openSubMenus.has(this.getSubCategoryKey(subCategory));
  }

  closeMenu() {
    // Re-enable body scroll when menu is closed
    this.enableBodyScroll();
    this.closeMenuEvent.emit();
  }

  // Updated method to navigate to shop with category URL
  navigateToShop(category: Category) {
    // Apply SEO metadata before navigation
    this.applySeoMetadata(category);

    // Re-enable body scroll before navigation
    this.enableBodyScroll();

    // Navigate to shop page with category link
    // Routes are defined as 'tn/:categoryId' in shop.routes.ts
    const categoryLink = category.link || `${category.id}`;
    this.router.navigateByUrl(`/tn/${categoryLink}`);
    this.closeMenu(); // Close the menu after navigation
  }

  // Apply SEO metadata from the category data
  private applySeoMetadata(category: Category): void {
    // Set page title from metaTitle or name
    const title = category.metaTitle || category.name;
    this.titleService.setSpecificTitle(title);

    // Set meta description
    if (category.metaDescription) {
      this.seoService.updateDescription(category.metaDescription);
    } else {
      // Fallback description
      this.seoService.updateDescription(`Découvrez notre collection ${category.name} chez Barsha. Retrouvez les dernières tendances mode.`);
    }

    // Set keywords
    if (category.keywords) {
      this.seoService.updateKeywords(category.keywords);
    } else {
      // Fallback keywords
      this.seoService.updateKeywords(`${category.name}, barsha, vêtements, collection, mode`);
    }
  }
}