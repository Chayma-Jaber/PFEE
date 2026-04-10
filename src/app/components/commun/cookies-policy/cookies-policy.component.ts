import { Component, OnInit } from '@angular/core';
import { FooterService } from '../../../services/footer.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { MarkdownModule, provideMarkdown } from 'ngx-markdown';


@Component({
  selector: 'app-cookies-policy',
    imports: [CommonModule,FontAwesomeModule,MarkdownModule, ],
  providers: [provideMarkdown()],
  templateUrl: './cookies-policy.component.html',
  styleUrl: './cookies-policy.component.scss'
})
export class CookiesPolicyComponent implements OnInit {
  cookiesPolicyData: any; // Pour stocker les données de l'API
  isLoading: boolean = true;
  constructor(private footerService: FooterService) {}

  ngOnInit(): void {
    this.isLoading = true;
    this.footerService.getCookiesPolicyData().subscribe(data => {
      this.cookiesPolicyData = data.hits[0]; // Récupérer le premier élément de la réponse
      this.isLoading = false;
    });
  }
}
