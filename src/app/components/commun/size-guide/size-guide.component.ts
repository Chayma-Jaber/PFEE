import { Component, OnInit } from '@angular/core';
import { FooterService } from '../../../services/footer.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MarkdownModule, provideMarkdown } from 'ngx-markdown';

@Component({
  selector: 'app-size-guide',
  imports: [CommonModule,MarkdownModule,],
  providers: [provideMarkdown()],
  templateUrl: './size-guide.component.html',
  styleUrl: './size-guide.component.scss'
})
export class SizeGuideComponent implements OnInit {
  sizesGuideData: any; // Pour stocker les données de l'API
  isLoading: boolean = true;
  constructor(private footerService: FooterService) {}

  ngOnInit(): void {
      this.isLoading = true;
      this.footerService.getSizesGuideData().subscribe(data => {
      this.sizesGuideData = data.hits[0]; // Récupérer le premier élément de la réponse
      this.isLoading = false;
    });
  }
}
