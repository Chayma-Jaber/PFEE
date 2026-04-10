import { Component, OnInit } from '@angular/core';
import { FooterService } from '../../../services/footer.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MarkdownModule, provideMarkdown } from 'ngx-markdown';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faHeart, faLeaf, faStar } from '@fortawesome/free-solid-svg-icons';
import { SeoService } from '../../../services/seo.service';
import { TitleService } from '../../../services/title.service';

@Component({
  standalone: true,
  selector: 'app-about-us',
  imports: [
    CommonModule,
    MarkdownModule,
    FontAwesomeModule,
  ],
  templateUrl: './about-us.component.html',
  styleUrl: './about-us.component.scss',
  providers: [
    provideMarkdown(), // Configurer MarkdownService avec provideMarkdown()
  ],
})
export class AboutUsComponent implements OnInit {
  aboutBrandData: any; // Pour stocker les données de l'API
  isLoading: boolean = true;
  // Icônes FontAwesome
  faHeart = faHeart;
  faLeaf = faLeaf;
  faStar = faStar;

  constructor(
    private footerService: FooterService,
    private seoService: SeoService,
    private titleService: TitleService
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    this.footerService.getAboutBrandData().subscribe(data => {  
      this.aboutBrandData = data.hits[0]; // Récupérer le premier élément de la réponse
      this.isLoading = false;
      
      // SEO optimization
      if (this.aboutBrandData) {
        // Utilisation du service de titres à la place du service SEO pour le titre
        this.titleService.setSpecificTitle(this.aboutBrandData.title);
        
        // Autres optimisations SEO
        this.seoService.updateDescription(this.aboutBrandData.text?.substring(0, 160) || 'À propos de Barsha');
        this.seoService.updateCanonicalUrl(window.location.origin + '/about-us');
        
        // Add structured data
        this.seoService.addStructuredData({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          'name': 'Barsha',
          'description': this.aboutBrandData.text?.substring(0, 160),
          'url': window.location.origin + '/about-us'
        });
      }
    });
  }
}
