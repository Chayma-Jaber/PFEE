import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CarouselModule } from 'primeng/carousel';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { CategorieService } from '../../../services/categorie.service';
import { Carousel } from 'primeng/carousel';
import { SeoService } from '../../../services/seo.service';
import { filter, switchMap } from 'rxjs/operators';
import { TitleService } from '../../../services/title.service';
import { AnalyticsService } from '../../../services/analytics.service';
import { BreadcrumbComponent } from '../../commun/breadcrumb/breadcrumb.component';

interface Category {
  image: string;
  nom: string;
  linkTo: string;
}

@Component({
  selector: 'app-categorie',
  standalone: true,
  imports: [CommonModule, CarouselModule, RouterModule, BreadcrumbComponent],
  templateUrl: './categorie.component.html',
  styleUrls: ['./categorie.component.scss']
})
export class CategorieComponent implements OnInit {
  @ViewChild('carousel') carousel!: Carousel;
  currentPage: number = 0;
  homePageData: any;
  selectedPage: any;
  isLoading: boolean = true;
  categories: Category[] = [];
  categoryId: string | null = null;
  categoryName: string | null = null;

  constructor(
    private categorieService: CategorieService,
    private route: ActivatedRoute,
    private router: Router,
    private seoService: SeoService,
    private titleService: TitleService,
    private analytics: AnalyticsService
  ) { }

  ngOnInit(): void {
    // Get the parameter from the route
    this.route.paramMap.subscribe(params => {
      const idOrName = params.get('id');
      this.isLoading = true;

      if (!idOrName) {
        this.router.navigate(['/404']);
        return;
      }

      // Check if the parameter is a numeric ID or a name
      if (this.categorieService.isNumericId(idOrName)) {
        // It's a numeric ID (e.g., "1")
        this.loadCategoryById(idOrName);
      } else if (/^\d+-/.test(idOrName)) {
        // It's an {id}-{slug} format (e.g., "1-femme") — extract the numeric ID
        const numericId = idOrName.split('-')[0];
        this.loadCategoryById(numericId);
      } else {
        // It's a category name/slug (e.g., "femme")
        this.loadCategoryByName(idOrName);
      }
    });
  }

  private loadCategoryById(id: string): void {
    this.categoryId = id;

    // First try to get category details directly
    this.categorieService.getCategoryById(id).subscribe(
      (categoryData) => {
        if (categoryData && !categoryData.error) {
          // Use direct category data
          this.selectedPage = {
            title: categoryData.name,
            relatedTo: id,
            bannerUrl: categoryData.bannerUrl,
            imageUrl: categoryData.imageUrl,
            description: categoryData.description,
            heroSections: [],
            collections: []
          };

          this.titleService.setSpecificTitle(categoryData.name);

          // Apply backend SEO fields (metaTitle, metaDescription, keywords)
          this.titleService.setSeo({
            metaTitle: (categoryData as any).metaTitle || null,
            metaDescription: (categoryData as any).metaDescription || null,
            keywords: (categoryData as any).keywords || null,
            fallbackTitle: `${categoryData.name} - Mode Tunisie`,
            fallbackDescription: categoryData.description || `Découvrez notre sélection ${categoryData.name} chez Barsha Tunisie.`,
            imageUrl: categoryData.bannerUrl || categoryData.imageUrl,
            url: typeof window !== 'undefined' ? window.location.href : undefined,
          });

          this.isLoading = false;

          // Apply SEO optimizations
          this.applySeoOptimizations();

          // Tracking
          this.analytics.viewCategory({
            id: this.categoryId!,
            name: categoryData.name
          });

          // Now load subcategories from homepage data for the category grid
          this.loadSubcategories();
        } else {
          // Fallback to homepage data approach
          this.loadCategoryFromHomepage();
        }
      },
      (error) => {
        console.error('Error loading category by ID, falling back to homepage data', error);
        this.loadCategoryFromHomepage();
      }
    );
  }

  private loadSubcategories(): void {
    // Load homepage data for subcategories
    this.categorieService.getHomePageData().subscribe(
      (data) => {
        this.homePageData = data;

        // Try to extract subcategories from featuredCategories
        if (data?.hits?.[0]?.featuredCategories) {
          this.categories = data.hits[0].featuredCategories
            .filter((cat: any) => cat.parent_id?.toString() === this.categoryId || !cat.parent_id)
            .map((cat: any) => ({
              image: cat.imageUrl || cat.image_url || '/assets/images/placeholder.jpg',
              nom: cat.name || cat.title,
              linkTo: cat.link || `/shop?category=${cat.id}`
            }));
        }
      },
      (error) => {
        console.error('Error loading subcategories', error);
        // Continue without subcategories
      }
    );
  }

  private loadCategoryFromHomepage(): void {
    // Fallback: Load homepage data
    this.categorieService.getHomePageData().subscribe(
      (data) => {
        this.homePageData = data;
        this.isLoading = false;

        // Safe access with defensive checks
        const hits = data?.hits;
        if (!hits || !hits.length) {
          this.router.navigate(['/404']);
          return;
        }

        const firstHit = hits[0];

        // Try different data structures
        // Format 1: pages array (old format)
        if (firstHit?.pages) {
          this.selectedPage = firstHit.pages.find(
            (p: any) => p.relatedTo === this.categoryId
          );
        }

        // Format 2: Use featuredCategories to find the category
        if (!this.selectedPage && firstHit?.featuredCategories) {
          const cat = firstHit.featuredCategories.find(
            (c: any) => c.id?.toString() === this.categoryId
          );
          if (cat) {
            this.selectedPage = {
              title: cat.name,
              relatedTo: this.categoryId,
              categories: [],
              heroSections: [],
              collections: []
            };
          }
        }

        if (this.selectedPage) {
          // Populate categories dynamically from the API
          if (this.selectedPage.categories) {
            this.categories = this.selectedPage.categories.map((cat: any) => ({
              image: cat.media?.url || cat.imageUrl || '/assets/images/placeholder.jpg',
              nom: cat.title || cat.name,
              linkTo: cat.linkTo || cat.link
            }));
          }

          // Update the page title with the category name
          if (this.selectedPage.title) {
            this.titleService.setSpecificTitle(this.selectedPage.title);
          }

          // Apply SEO optimizations
          this.applySeoOptimizations();

          // Tracking consultation catégorie
          this.analytics.viewCategory({
            id: this.categoryId!,
            name: this.selectedPage.title
          });
        } else {
          // Category not found - redirect to shop instead of 404
          this.router.navigate(['/shop'], { queryParams: { category: this.categoryId } });
        }
      },
      (error) => {
        console.error('Erreur lors de la récupération des données', error);
        this.isLoading = false;
        this.router.navigate(['/shop']);
      }
    );
  }

  private loadCategoryByName(name: string): void {
    this.categoryName = name;

    // First, get the category info from the name
    this.categorieService.getCategoryByName(name).subscribe(
      (category) => {
        if (category && category.id) {
          this.categoryId = category.id.toString();

          // Set selected page from the category data directly
          this.selectedPage = {
            title: category.name || category.publicName || name,
            relatedTo: this.categoryId,
            bannerUrl: category.bannerUrl,
            imageUrl: category.imageUrl,
            description: category.htmlDescription || category.metaDescription,
            heroSections: [],
            collections: []
          };

          this.titleService.setSpecificTitle(this.selectedPage.title);
          this.isLoading = false;

          // Apply SEO optimizations
          this.applySeoOptimizations();

          // Tracking consultation catégorie
          this.analytics.viewCategory({
            id: this.categoryId!,
            name: this.selectedPage.title
          });

          // Load subcategories for the grid
          this.loadSubcategories();
        } else {
          // Category not found - redirect to shop
          this.isLoading = false;
          this.router.navigate(['/shop']);
        }
      },
      (error) => {
        console.error('Erreur lors de la recherche de la catégorie par nom', error);
        this.isLoading = false;
        this.router.navigate(['/shop']);
      }
    );
  }

  /**
   * Apply comprehensive SEO optimizations based on current page data
   * This enhances search engine visibility and understanding of category pages
   */
  private applySeoOptimizations(): void {
    if (this.selectedPage && this.selectedPage.title) {
      // Title is already set in ngOnInit, don't update it here

      // Generate a detailed, SEO-friendly description
      const categoryType = this.getCategoryType(this.selectedPage.title);
      const description = `Découvrez notre collection ${this.selectedPage.title} ${categoryType} chez Barsha. Retrouvez les dernières tendances mode, des vêtements de qualité et un large choix de styles. Livraison disponible partout en Tunisie.`;
      this.seoService.updateDescription(description);

      // Generate comprehensive keywords
      const keywords = [
        this.selectedPage.title,
        `${this.selectedPage.title} ${categoryType}`,
        `vêtements ${this.selectedPage.title}`,
        `mode ${this.selectedPage.title}`,
        `collection ${this.selectedPage.title}`,
        'barsha',
        'vêtements',
        'collection',
        'mode',
        'tunisie',
        'achat en ligne'
      ].join(', ');
      this.seoService.updateKeywords(keywords);

      // Set canonical URL to ensure proper indexing
      this.seoService.updateCanonicalUrl(window.location.href);

      // Add enhanced structured data
      this.addCategoryStructuredData();
    }
  }

  /**
   * Helper method to determine category type based on name
   * @param categoryName The name of the category
   * @returns A string describing the category type
   */
  private getCategoryType(categoryName: string): string {
    const name = categoryName.toLowerCase();

    if (name.includes('femme')) {
      return 'pour femme';
    } else if (name.includes('homme')) {
      return 'pour homme';

    }
    return '';
  }

  /**
   * Add comprehensive structured data for category pages
   * This improves search engine understanding of the category content
   */
  private addCategoryStructuredData(): void {
    if (!this.selectedPage) return;

    // Get the category type for better descriptions
    const categoryType = this.getCategoryType(this.selectedPage.title);

    // Get the number of subcategories if available
    const numberOfItems = this.categories?.length || 0;

    // Create enhanced structured data with more detailed information
    const categoryData: any = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      'name': this.selectedPage.title || '',
      'description': `Collection ${this.selectedPage.title} ${categoryType} chez Barsha. Découvrez notre sélection de vêtements et accessoires de qualité.`,
      'url': window.location.href,
      'provider': {
        '@type': 'Organization',
        'name': 'Barsha',
        'url': 'https://www.barsha.com.tn',
        'logo': 'https://www.barsha.com.tn/assets/images/logo.jpg'
      },
      // Add breadcrumb information for better navigation understanding
      'breadcrumb': {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Accueil',
            'item': 'https://www.barsha.com.tn'
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': this.selectedPage.title,
            'item': window.location.href
          }
        ]
      }
    };

    // Add information about number of items if available
    if (numberOfItems > 0) {
      categoryData.numberOfItems = numberOfItems;
    }

    // Add subcategory information if available
    if (this.categories && this.categories.length > 0) {
      categoryData.hasPart = this.categories.map(category => ({
        '@type': 'CollectionPage',
        'name': category.nom,
        'url': `${window.location.origin}${category.linkTo}`
      }));
    }

    this.seoService.addStructuredData(categoryData);
  }

  responsiveOptions = [
    { breakpoint: '1400px', numVisible: 4, numScroll: 1 },
    { breakpoint: '1024px', numVisible: 3, numScroll: 1 },
    { breakpoint: '768px', numVisible: 2, numScroll: 1 },
    { breakpoint: '560px', numVisible: 2, numScroll: 1 }
  ];

  prevSlide(event: MouseEvent) {
    if (this.carousel) {
      this.carousel.navBackward(event);
    }
  }

  nextSlide(event: MouseEvent) {
    if (this.carousel) {
      this.carousel.navForward(event);
    }
  }

  onCategoryClick(category: Category, event: MouseEvent) {
    if (category.linkTo) {
      // Navigate directly to the link - use navigateByUrl to avoid encoding issues
      const cleanLink = category.linkTo.startsWith('/') ? category.linkTo : `/${category.linkTo}`;
      this.router.navigateByUrl(cleanLink);
    }
  }
}
