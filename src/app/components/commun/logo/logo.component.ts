import { Component, OnInit, Input } from '@angular/core';
import { HomeService } from '../../pages/home-all/home';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-logo',
  imports: [RouterModule, CommonModule],
  templateUrl: './logo.component.html',
  styleUrl: './logo.component.scss'
})
export class LogoComponent implements OnInit {
  searchResults: any;
  isLoading: boolean = true;
  @Input() inNavbar: boolean = false;

  // Header/logo fallback asset
  private readonly DEFAULT_LOGO = '/assets/images/logoBarsha.png';
  private readonly DEFAULT_ALT = 'BARSHA Logo';

  constructor(private homeService: HomeService) { }

  ngOnInit(): void {
    this.isLoading = true;
    this.homeService.searchHome().subscribe(
      (data) => {
        this.searchResults = data;
        this.isLoading = false;
      },
      () => {
        this.isLoading = false;
      }
    );
  }

  /**
   * Get logo URL with proper fallbacks for different API response formats
   */
  get logoUrl(): string {
    if (this.inNavbar) {
      return this.DEFAULT_LOGO;
    }

    if (!this.searchResults?.hits?.length) {
      return this.DEFAULT_LOGO;
    }

    const hit = this.searchResults.hits[0];

    // Try different possible data structures
    // Format 1: hits[0].slides[0].logo.url (old format)
    if (hit?.slides?.[0]?.logo?.url) {
      return hit.slides[0].logo.url;
    }

    // Format 2: hits[0].siteConfig.logo (new backend format)
    if (hit?.siteConfig?.logo) {
      return hit.siteConfig.logo;
    }

    // Format 3: hits[0].logo (direct logo)
    if (hit?.logo) {
      return hit.logo;
    }

    // Format 4: hits[0].desktopImageUrl (banner format from web-chp)
    if (hit?.desktopImageUrl) {
      return hit.desktopImageUrl;
    }

    return this.DEFAULT_LOGO;
  }

  /**
   * Get logo alt text with proper fallbacks
   */
  get logoAlt(): string {
    if (!this.searchResults?.hits?.length) {
      return this.DEFAULT_ALT;
    }

    const hit = this.searchResults.hits[0];

    // Try different possible data structures
    if (hit?.slides?.[0]?.logo?.name) {
      return hit.slides[0].logo.name;
    }

    if (hit?.siteConfig?.siteName) {
      return `${hit.siteConfig.siteName} Logo`;
    }

    if (hit?.title) {
      return hit.title;
    }

    return this.DEFAULT_ALT;
  }

  /**
   * Handle image load errors by falling back to default logo
   */
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && img.src !== this.DEFAULT_LOGO) {
      img.src = this.DEFAULT_LOGO;
    }
  }
}

