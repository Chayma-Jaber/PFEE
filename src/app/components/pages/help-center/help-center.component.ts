import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FAQService, FAQCategory, FAQ } from '../../../services/faq.service';

@Component({
  selector: 'app-help-center',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './help-center.component.html',
  styleUrls: ['./help-center.component.scss']
})
export class HelpCenterComponent implements OnInit {
  // View state
  currentView: 'home' | 'category' | 'search' = 'home';

  // Data
  categories: FAQCategory[] = [];
  featuredFAQs: FAQ[] = [];
  selectedCategory: FAQCategory | null = null;
  searchResults: FAQ[] = [];

  // Search
  searchQuery = '';
  isSearching = false;

  // UI State
  isLoading = false;
  expandedFAQs: Set<number> = new Set();
  helpfulVotes: Map<number, boolean | null> = new Map();

  // Contact options
  contactOptions = [
    {
      icon: 'bi-headset',
      title: 'Support par ticket',
      description: 'Cr\u00e9ez un ticket et recevez une r\u00e9ponse sous 24h',
      action: '/support',
      actionLabel: 'Cr\u00e9er un ticket'
    },
    {
      icon: 'bi-envelope',
      title: 'Email',
      description: 'contact@barsha.com.tn',
      action: 'mailto:contact@barsha.com.tn',
      actionLabel: 'Envoyer un email'
    },
    {
      icon: 'bi-telephone',
      title: 'T\u00e9l\u00e9phone',
      description: '+216 XX XXX XXX (Lun-Sam 9h-18h)',
      action: 'tel:+21600000000',
      actionLabel: 'Appeler'
    }
  ];

  constructor(
    private faqService: FAQService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Check for category slug in route
    this.route.params.subscribe(params => {
      if (params['slug']) {
        this.loadCategory(params['slug']);
      } else {
        this.loadHomeData();
      }
    });

    // Check for search query
    this.route.queryParams.subscribe(params => {
      if (params['q']) {
        this.searchQuery = params['q'];
        this.performSearch();
      }
    });
  }

  loadHomeData(): void {
    this.currentView = 'home';
    this.isLoading = true;

    // Load categories and featured FAQs in parallel
    this.faqService.getCategories().subscribe({
      next: (response) => {
        this.categories = response.categories || [];
      }
    });

    this.faqService.getFeaturedFAQs(6).subscribe({
      next: (response) => {
        this.featuredFAQs = response.faqs || [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  loadCategory(slug: string): void {
    this.currentView = 'category';
    this.isLoading = true;

    this.faqService.getCategoryWithFAQs(slug).subscribe({
      next: (category) => {
        this.selectedCategory = category;
        this.isLoading = false;
      },
      error: () => {
        this.router.navigate(['/aide']);
        this.isLoading = false;
      }
    });
  }

  performSearch(): void {
    if (!this.searchQuery.trim() || this.searchQuery.length < 2) return;

    this.currentView = 'search';
    this.isSearching = true;

    this.faqService.searchFAQs(this.searchQuery).subscribe({
      next: (response) => {
        this.searchResults = response.results || [];
        this.isSearching = false;
      },
      error: () => {
        this.searchResults = [];
        this.isSearching = false;
      }
    });
  }

  onSearchSubmit(event: Event): void {
    event.preventDefault();
    if (this.searchQuery.trim().length >= 2) {
      this.router.navigate(['/aide'], { queryParams: { q: this.searchQuery } });
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchResults = [];
    this.currentView = 'home';
    this.router.navigate(['/aide']);
  }

  backToHome(): void {
    this.selectedCategory = null;
    this.searchResults = [];
    this.currentView = 'home';
    this.router.navigate(['/aide']);
  }

  viewCategory(category: FAQCategory): void {
    this.router.navigate(['/aide', category.slug]);
  }

  toggleFAQ(faqId: number): void {
    if (this.expandedFAQs.has(faqId)) {
      this.expandedFAQs.delete(faqId);
    } else {
      this.expandedFAQs.add(faqId);
    }
  }

  isFAQExpanded(faqId: number): boolean {
    return this.expandedFAQs.has(faqId);
  }

  markHelpful(faq: FAQ, helpful: boolean, event: Event): void {
    event.stopPropagation();

    // Check if already voted
    if (this.helpfulVotes.has(faq.id)) return;

    this.faqService.markHelpful(faq.id, helpful).subscribe({
      next: () => {
        this.helpfulVotes.set(faq.id, helpful);
        if (helpful) {
          faq.helpfulYes++;
        } else {
          faq.helpfulNo++;
        }
      }
    });
  }

  hasVoted(faqId: number): boolean {
    return this.helpfulVotes.has(faqId);
  }

  getVote(faqId: number): boolean | null {
    return this.helpfulVotes.get(faqId) ?? null;
  }

  navigateToSupport(): void {
    this.router.navigate(['/support'], { queryParams: { create: 'true' } });
  }
}
