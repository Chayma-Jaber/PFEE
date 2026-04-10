import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
import { SeoService } from '../../../services/seo.service';
import { LazyLoadImageDirective } from '../../../directives/lazy-load-image.directive';

@Component({
  selector: 'app-error404',
  standalone: true,
  imports: [RouterModule, CommonModule, LazyLoadImageDirective],
  templateUrl: './error404.component.html',
  styleUrl: './error404.component.scss'
})
export class Error404Component implements OnInit {

  constructor(
    private titleService: Title,
    private metaService: Meta,
    private seoService: SeoService
  ) {}

  ngOnInit(): void {
    // Set page title
    this.titleService.setTitle('Page non trouvée (404) | Barsha');

    // Update meta description
    this.seoService.updateDescription('La page que vous recherchez n\'existe pas ou a été déplacée. Découvrez notre collection de vêtements tendance pour femmes et hommes chez Barsha.');

    // Update keywords
    this.seoService.updateKeywords('erreur 404, page non trouvée, Barsha, vêtements, mode, Tunisie, boutique en ligne');

    // Add structured data
    this.seoService.addStructuredData({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      'name': 'Page non trouvée (404)',
      'description': 'La page que vous recherchez n\'existe pas ou a été déplacée.',
      'publisher': {
        '@type': 'Organization',
        'name': 'Barsha',
        'logo': {
          '@type': 'ImageObject',
          'url': 'https://www.barsha.tn/images/logo.jpg'
        }
      }
    });
  }
}
