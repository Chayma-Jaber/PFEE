import { Component, OnInit } from '@angular/core';
import { FooterService } from '../../../services/footer.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MarkdownModule, provideMarkdown } from 'ngx-markdown';

@Component({
  selector: 'app-privacy',
  imports: [CommonModule,MarkdownModule,],
  providers: [provideMarkdown()],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss'
})
export class PrivacyComponent implements OnInit {
  privacyData: any; // Pour stocker les données de l'API
  isLoading: boolean = true;
  constructor(private footerService: FooterService) {}

  ngOnInit(): void {
      this.isLoading = true;
    this.footerService.getPrivacyData().subscribe(data => {
      this.privacyData = data.hits[0]; // Récupérer le premier élément de la réponse
      this.isLoading = false;
    });
  }
}
