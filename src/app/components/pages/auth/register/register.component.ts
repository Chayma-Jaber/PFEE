import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../../services/auth.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { ReactiveFormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { TitleService } from '../../../../services/title.service';
import { DialogModule } from 'primeng/dialog';
import { FooterService } from '../../../../services/footer.service';
import { MarkdownModule, provideMarkdown } from 'ngx-markdown';
import { AnalyticsService } from '../../../../services/analytics.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, DatePickerModule, ToastModule, RouterLink, DialogModule, MarkdownModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  providers: [MessageService, provideMarkdown()],
})
export class RegisterComponent implements OnInit {
  registrationForm: FormGroup;
  otpSent = false;
  showPassword = false;
  showPrivacyDialog = false;
  privacyData: any;
  isPrivacyLoading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private messageService: MessageService,
    private fb: FormBuilder,
    private titleService: TitleService,
    private footerService: FooterService,
    private analyticsService: AnalyticsService
  ) {
    this.registrationForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      birthday: ['', [Validators.required, this.birthdayValidator]],
      gender: ['', Validators.required],
      firebaseToken: [''],
      // Le champ privacyAccepted est utilisé uniquement pour la validation côté frontend
      // et ne sera pas envoyé dans la requête d'inscription
      privacyAccepted: [false, Validators.requiredTrue],
    });

    // Définir le titre de la page d'inscription
    this.titleService.setSpecificTitle('Inscription');
  }

  ngOnInit(): void {

    this.loadPrivacyData();
  }

  loadPrivacyData(): void {
    this.isPrivacyLoading = true;
    this.footerService.getPrivacyData().subscribe({
      next: (data) => {
        this.privacyData = data.hits[0];
        this.isPrivacyLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement de la politique de confidentialité:', error);
        this.isPrivacyLoading = false;
      }
    });
  }

  openPrivacyDialog(): void {
    this.showPrivacyDialog = true;
  }

  closePrivacyDialog(): void {
    this.showPrivacyDialog = false;
  }
togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }
  // Validateur personnalisé pour la date de naissance
  birthdayValidator(control:any) {
    const selectedDate = new Date(control.value);
    const today = new Date();
    return selectedDate < today ? null : { invalidBirthday: true };
  }

  // Envoyer l'OTP
  // Envoyer l'OTP
  sendOtp() {
    if (this.registrationForm.invalid) {
      this.messageService.add({
        severity: 'error',
        summary: 'Formulaire invalide',
        detail: 'Veuillez remplir tous les champs correctement',
        life: 3000,
      });
      return;
    }

    // Vérifier d'abord si le numéro de téléphone est déjà utilisé
    this.authService.countPhone(this.registrationForm.value.phone).subscribe({
      next: (response) => {
        // Vérifier si le téléphone est déjà utilisé (count > 0)
        if (response && response.count > 0) {
          this.messageService.add({
            severity: 'error',
            summary: 'Téléphone déjà utilisé',
            detail: 'Ce numéro de téléphone est déjà associé à un compte',
            life: 3000,
          });
          return;
        }

        // Si le téléphone n'est pas utilisé, continuer avec l'envoi de l'OTP
        // Stocker les données du formulaire dans le localStorage sans inclure privacyAccepted
        const { firstName, lastName, phone, email, password, birthday, gender, firebaseToken } = this.registrationForm.value;
        const registrationDataForStorage = {
          firstName,
          lastName,
          phone,
          email,
          password,
          birthday,
          gender,
          firebaseToken
        };
        localStorage.setItem('registrationData', JSON.stringify(registrationDataForStorage));

        this.authService.generateOtp(this.registrationForm.value.phone).subscribe({
          next: (_) => {
            this.otpSent = true;
            this.messageService.add({
              severity: 'success',
              summary: 'Code OTP envoyé',
              detail: 'Veuillez vérifier votre téléphone',
              life: 3000,
            });
            // Naviguer vers la page de vérification OTP après l'envoi réussi
            this.router.navigate(['/verify-otp']);
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
      },
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur de vérification',
          detail: 'Impossible de vérifier la disponibilité du numéro de téléphone',
          life: 3000,
        });
        console.error('Erreur vérification téléphone:', error);
      }
    });
  }
  // Vérifier l'OTP
  verifyOtp() {
    if (!this.registrationForm.value.codeOtp) {
      this.messageService.add({
        severity: 'error',
        summary: 'Code OTP manquant',
        detail: 'Veuillez entrer le code OTP',
        life: 3000,
      });
      return;
    }

    this.authService.validateOtp(this.registrationForm.value.phone, this.registrationForm.value.codeOtp).subscribe({
      next: (_) => {
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
    // Créer une copie des données du formulaire sans inclure privacyAccepted
    const { firstName, lastName, phone, email, password, birthday, gender, firebaseToken } = this.registrationForm.value;

    // Créer l'objet de données d'inscription avec seulement les champs nécessaires
    const registrationData = {
      firstName,
      lastName,
      phone,
      email,
      password,
      birthday,
      gender,
      firebaseToken,
      codeOtp: this.registrationForm.value.codeOtp // Inclure le code OTP
    };

    this.authService.register(registrationData).subscribe({
      next: (response) => {
        // Utiliser la nouvelle méthode Analytics pour la création de compte utilisateur
        if (response && response.user) {
          this.analyticsService.trackUserAccountCreation({
            id: response.user.id,
            codeErp: response.user.codeErp,
            phone: response.user.phone,
            firstName: response.user.firstName,
            lastName: response.user.lastName,
            email: response.user.email
          });
        }
        // console.log('Registration response:', response); // Log the response

        // Vérifier si la réponse contient un JWT et des informations utilisateur
        if (response && response.jwt && response.user) {
          // Stocker directement les informations d'authentification
          localStorage.setItem('jwt', response.jwt);
          localStorage.setItem('user', JSON.stringify(response.user));

          this.messageService.add({
            severity: 'success',
            summary: 'Inscription réussie',
            detail: 'Votre compte a été créé avec succès et vous êtes maintenant connecté',
            life: 3000,
          });

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

          // Connecter automatiquement l'utilisateur après l'inscription
          this.loginAfterRegistration(this.registrationForm.value.email, this.registrationForm.value.password);
        }
      },
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur inscription',
          detail: 'Une erreur est survenue lors de l\'inscription',
          life: 3000,
        });
        console.error('Erreur inscription:', error);
      },
    });
  }

  // Méthode pour connecter l'utilisateur après l'inscription
  private loginAfterRegistration(identifier: string, password: string) {
    this.authService.login(identifier, password).subscribe({
      next: (response) => {
        // Stocker les informations d'authentification
        localStorage.setItem('jwt', response.jwt);
        localStorage.setItem('user', JSON.stringify(response.user));

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

  // Gérer le genre
  setGender(gender: string) {
    this.registrationForm.patchValue({ gender });
  }

  // Gérer le clic sur le bouton "Créer le compte"
  register() {
    if (this.registrationForm.invalid) {
      this.messageService.add({
        severity: 'error',
        summary: 'Formulaire invalide',
        detail: 'Veuillez remplir tous les champs correctement',
        life: 3000,
      });
      return;
    }

    // Tracking du clic sur le formulaire d'inscription
    this.analyticsService.trackFormClick('registerForm');

    this.sendOtp();
  }
//ajouter un controle sur le nombre de telephone

}
