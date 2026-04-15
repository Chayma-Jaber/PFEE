import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-verify-otp',
  standalone: true,
  imports: [FormsModule, CommonModule, ToastModule, RouterModule],
  templateUrl: './verify-otp.component.html',
  styleUrls: ['./verify-otp.component.scss'],
  providers: [MessageService],
})
export class VerifyOtpComponent implements OnInit {
  user: any = {};
  codeOtp: string = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private messageService: MessageService
  ) {}

  // Méthode pour n'accepter que les chiffres (empêcher la frappe non numérique)
  onlyNumbers(event: KeyboardEvent): boolean {
    const charCode = (event.which) ? event.which : event.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  // Méthode pour nettoyer l'entrée OTP : supprimer espaces, caractères non numériques
  // et limiter la longueur à 6 caractères
  sanitizeOtpInput(value: string | null | undefined): void {
    if (value === null || value === undefined) {
      this.codeOtp = '';
      return;
    }

    // Supprimer tous les espaces et caractères non numériques
    let clean = value.replace(/\s+/g, '');
    clean = clean.replace(/\D+/g, '');

    // Limiter la longueur à 6 chiffres
    if (clean.length > 6) {
      clean = clean.slice(0, 6);
    }

    // Mettre à jour la variable liée au modèle
    this.codeOtp = clean;
  }

  // Helper to read the value from input event reliably (avoids template type error)
  sanitizeOtpInputFromEvent(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    const val = target?.value ?? '';
    this.sanitizeOtpInput(val);
  }

  ngOnInit() {
    // Récupérer les données utilisateur du localStorage
    const userData = localStorage.getItem('registrationData');
    if (userData) {
      this.user = JSON.parse(userData);
      // console.log('Données utilisateur récupérées:', this.user); // Ajoutez ce log pour vérifier
    } else {
      // Rediriger vers la page d'inscription si aucune donnée n'est trouvée
      this.messageService.add({
        severity: 'warn',
        summary: 'Données manquantes',
        detail: 'Veuillez compléter le formulaire d\'inscription',
        life: 3000,
      });
      this.router.navigate(['/register']);
    }
  }

  verifyOtp() {
    // Ensure the input is sanitized before validating
    this.sanitizeOtpInput(this.codeOtp);
    if (!this.codeOtp) {
      this.messageService.add({
        severity: 'error',
        summary: 'Code OTP manquant',
        detail: 'Veuillez entrer le code OTP',
        life: 3000,
      });
      return;
    }

    // Vérifier que le code OTP contient exactement 6 chiffres
    if (!/^\d{6}$/.test(this.codeOtp)) {
      this.messageService.add({
        severity: 'error',
        summary: 'Format invalide',
        detail: 'Le code OTP doit contenir exactement 6 chiffres',
        life: 3000,
      });
      return;
    }

    this.authService.validateOtp(this.user.phone, this.codeOtp).subscribe({
      next: (response) => {
        // Mettre à jour le code OTP dans l'objet utilisateur
        this.user.codeOtp = this.codeOtp;

        // Appeler l'API d'inscription
        this.submitRegistration();
      },
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur OTP',
          detail: 'Code OTP invalide ou expiré',
          life: 3000,
        });
        console.error('Erreur validation OTP:', error);
      },
    });
  }

  // Enregistrer l'utilisateur et connecter automatiquement
  private submitRegistration() {
    // console.log('User data being sent for registration:', this.user); // Log user data

    this.authService.register(this.user).subscribe({
      next: (response) => {
        // console.log('Registration response:', response); // Log the response

        // Vérifier si la réponse contient un JWT et des informations utilisateur
        const token = response?.jwt || response?.tokens?.access_token;
        if (response && token && response.user) {
          // Stocker directement les informations d'authentification
          localStorage.setItem('jwt', token);
          localStorage.setItem('user', JSON.stringify(response.user));

          this.messageService.add({
            severity: 'success',
            summary: 'Inscription réussie',
            detail: 'Votre compte a été créé avec succès et vous êtes maintenant connecté',
            life: 3000,
          });

          // Nettoyer les données du localStorage
          localStorage.removeItem('registrationData');

          // Rediriger vers la page d'accueil
          this.router.navigate(['/']);
        } else {
          // Si la réponse ne contient pas de JWT, connecter manuellement
          this.messageService.add({
            severity: 'success',
            summary: 'Inscription réussie',
            detail: 'Votre compte a été créé avec succès',
            life: 3000,
          });

          // Nettoyer les données du localStorage
          localStorage.removeItem('registrationData');

          // Connecter automatiquement l'utilisateur après l'inscription
          this.loginAfterRegistration(this.user.email, this.user.password);
        }
      },
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur inscription',
          detail: 'Le téléphone déja utilisé',
          life: 3000,
        });
        console.error('Erreur inscription:', error);
        console.error('Response from server:', error.error); // Log the error response from the server
        console.error('Full error response:', error); // Log the full error response for more details
      },
    });
  }

  // Renvoyer le code OTP
  resendOtp() {
    this.authService.generateOtp(this.user.phone).subscribe({
      next: (response) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Code OTP renvoyé',
          detail: 'Veuillez vérifier votre téléphone',
          life: 3000,
        });
      },
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Échec envoi OTP',
          detail: 'Veuillez réessayer',
          life: 3000,
        });
        console.error('Erreur envoi OTP:', error);
      },
    });
  }

  // Méthode pour connecter l'utilisateur après l'inscription
  private loginAfterRegistration(identifier: string, password: string) {
    this.authService.login(identifier, password).subscribe({
      next: (response) => {
        // Stocker les informations d'authentification
        const token = response.jwt || response.tokens?.access_token || '';
        localStorage.setItem('jwt', token);
        localStorage.setItem('user', JSON.stringify(response.user));

        this.messageService.add({
          severity: 'success',
          summary: 'Connexion réussie',
          detail: 'Vous êtes maintenant connecté',
          life: 3000,
        });

        // Rediriger vers la page d'accueil
        this.router.navigate(['/']);
      },
      error: (error) => {
        console.error('Erreur lors de la connexion automatique:', error);
        // En cas d'échec de connexion automatique, rediriger vers la page de connexion
        this.router.navigate(['/login']);
      }
    });
  }
}