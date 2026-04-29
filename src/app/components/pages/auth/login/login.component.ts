import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../services/auth.service'; // Ajustez le chemin selon votre structure
import { FormsModule } from '@angular/forms'; // Importer FormsModule pour ngModel
import { CommonModule } from '@angular/common'; // Importer CommonModule si nécessaire
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { TitleService } from '../../../../services/title.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule,ToastModule ], // Utiliser FormsModule pour ngModel
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  providers: [MessageService]
})
export class LoginComponent implements OnInit {
  // Modèle pour stocker les données du formulaire
  loginData = {
    identifier: '',
    password: ''
  };
  showPassword = false;
  constructor(private authService: AuthService, private router: Router, private messageService: MessageService, private titleService: TitleService) {}

  ngOnInit(): void {
    // Définir le titre de la page de connexion
    this.titleService.setSpecificTitle('Connexion');
  }

  // Méthode pour vérifier si les champs sont valides
  isFormValid(): boolean {
    return this.loginData.identifier.trim() !== '' && this.loginData.password.trim() !== '';
  }
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }
  // Méthode de connexion
  login() {
    if (!this.isFormValid()) {
      // Si les champs sont vides, afficher un message d'erreur
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Veuillez remplir tous les champs correctement',
        life: 3000
      });
      return;
    }

    this.authService.login(this.loginData.identifier, this.loginData.password).subscribe({
      next: (response) => {
        // Stocker les informations d'authentification
        const token = response.jwt || response.tokens?.access_token || '';
        localStorage.setItem('jwt', token);
        localStorage.setItem('user', JSON.stringify(response.user));

        // Afficher un message de succès
        this.messageService.add({
          severity: 'success',
          summary: 'Connexion réussie',
          detail: 'Vous êtes maintenant connecté',
          life: 3000
        });

        // Rediriger vers la page d'accueil
        this.router.navigate(['/']).then(() => {
          window.location.reload();
        });
      
      },
      error: (error) => {
        const errorMessage =
          error?.message?.trim() || 'Erreur serveur lors de la connexion';

        this.messageService.add({
          severity: 'error',
          summary: 'Erreur de connexion',
          detail: errorMessage,
          life: 3000
        });

        console.error('Erreur de connexion:', error);
      }
    });
  }
}
