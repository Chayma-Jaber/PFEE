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

  constructor(private homeService: HomeService) { }

  ngOnInit(): void {
    this.isLoading = true; // Activer le chargement avant l'appel API
    this.homeService.searchHome().subscribe(
      (data) => {
        this.searchResults = data;
        this.isLoading = false; // Désactiver le chargement une fois les données reçues
        // console.log(this.searchResults);
      },
      (error) => {
        console.error('Erreur lors de la récupération des données', error);
        this.isLoading = false; // Désactiver le chargement en cas d'erreur
      }
    );
  }
}

