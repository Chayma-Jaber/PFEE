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

interface Category {
  image: string;
  nom: string;
  linkTo: string;
}

@Component({
  selector: 'app-categorie',
  standalone: true,
  imports: [CommonModule, CarouselModule, RouterModule],
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
        // It's a numeric ID
        this.loadCategoryById(idOrName);
      } else {
        // It's a category name
        this.loadCategoryByName(idOrName);
      }
    });
  }

  private loadCategoryById(id: string): void {
    this.categoryId = id;
    // Load homepage data
    this.categorieService.getHomePageData().subscribe(
      (data) => {
        this.homePageData = data;
        this.isLoading = false;
        this.selectedPage = this.homePageData.hits[0].pages.find(
          (p: any) => p.relatedTo === this.categoryId
        );

        if (this.selectedPage) {
          // Populate categories dynamically from the API
          this.categories = this.selectedPage.categories.map((cat: any) => ({
            image: cat.media.url,
            nom: cat.title,
            linkTo: cat.linkTo
          }));

          // Update the page title with the category name
          if (this.selectedPage.title) {
            this.titleService.setSpecificTitle(this.selectedPage.title);
            // Update the URL to use the SEO-friendly name without refreshing the page
            this.router.navigate(['/categorie', this.selectedPage.title], {
              replaceUrl: true,
              skipLocationChange: false
            });
          }

          // Apply SEO optimizations
          this.applySeoOptimizations();

          // Tracking consultation catégorie
          this.analytics.viewCategory({
            id: this.categoryId!,
            name: this.selectedPage.title
          });
        } else {
          // Category not found
          this.router.navigate(['/404']);
        }
      },
      (error) => {
        console.error('Erreur lors de la récupération des données', error);
        this.isLoading = false;
        this.router.navigate(['/404']);
      }
    );
  }

  private loadCategoryByName(name: string): void {
    this.categoryName = name;

    // First, get the category ID from the name
    this.categorieService.getCategoryByName(name).subscribe(
      (category) => {
        if (category && category.id) {
          this.categoryId = category.id.toString();

          // Now load the homepage data with the found ID
          this.categorieService.getHomePageData().subscribe(
            (data) => {
              this.homePageData = data;
              this.isLoading = false;
              this.selectedPage = this.homePageData.hits[0].pages.find(
                (p: any) => p.relatedTo === this.categoryId
              );

              if (this.selectedPage) {
                // Populate categories dynamically from the API
                this.categories = this.selectedPage.categories.map((cat: any) => ({
                  image: cat.media.url,
                  nom: cat.title,
                  linkTo: cat.linkTo
                }));

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
                // Category not found
                this.router.navigate(['/404']);
              }
            },
            (error) => {
              console.error('Erreur lors de la récupération des données', error);
              this.isLoading = false;
              this.router.navigate(['/404']);
            }
          );
        } else {
          // Category not found
          this.isLoading = false;
          this.router.navigate(['/404']);
        }
      },
      (error) => {
        console.error('Erreur lors de la recherche de la catégorie par nom', error);
        this.isLoading = false;
        this.router.navigate(['/404']);
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
      this.router.navigate(['/tn', category.linkTo]);
    }
  }
}
