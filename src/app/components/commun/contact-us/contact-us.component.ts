import { Component, OnInit } from '@angular/core';
import { FooterService } from '../../../services/footer.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faMapMarker, faPhone, faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { FormGroup, FormBuilder, Validators  } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { AuthService } from './../../../services/auth.service';
import { TitleService } from '../../../services/title.service';
import { ContactService, ContactRequest } from '../../../services/contact.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
@Component({
  selector: 'app-contact-us',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, ReactiveFormsModule,ToastModule],
templateUrl: './contact-us.component.html',
  styleUrl: './contact-us.component.scss',
  providers:[MessageService]
})
export class ContactUsComponent implements OnInit {

  contactUsData: any;
  socialLinks: any;
  // Form properties
  contactForm!: FormGroup;
  submitted = false;
  loading = false;


  constructor(
    private formBuilder: FormBuilder,
    private footerService: FooterService,
    private authService: AuthService,
    private contactService: ContactService,
    private titleService: TitleService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.initForm();

    this.footerService.getContactUsData().subscribe({
      next: (data: any) => {
        if (data.hits && data.hits.length > 0) {
          this.contactUsData = data.hits[0];
        }
      },
      error: (error) => {
        console.error('Erreur lors de la récupération des données de contact :', error);
      }
    });

    this.footerService.getSocialLinks().subscribe({
      next: (data) => {
        this.socialLinks = data.hits[0].links; // Récupérer les liens des réseaux sociaux
      },
      error: (error) => {
        console.error('Erreur lors de la récupération des liens des réseaux sociaux :', error);
      }
    });

    this.titleService.setSpecificTitle('Contactez-nous');
  }

  // Initialize the form with validators
  initForm(): void {
    this.contactForm = this.formBuilder.group({
      subject: ['', [Validators.required, Validators.minLength(5)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{8}$/)]],
      codeOtp: ['', [Validators.required]], // Temporarily removed pattern validation
      message: ['', [Validators.required, Validators.minLength(10)]]

    });
  }

  // Getter for easy access to form fields
  get f() { return this.contactForm.controls; }

  // Send verification code to the provided phone number
  sendVerificationCode(): void {
    if (!this.contactForm.get('phone')?.valid) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Veuillez entrer un numéro de téléphone valide',
        life: 3000
      });
      return;
    }

    this.authService.generateOtp(this.contactForm.value.phone).subscribe({
      next: (data: any) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Code envoyé',
          detail: 'Un code de vérification a été envoyé à votre numéro de téléphone',
          life: 3000
        });
      },
      error: (error) => {
        console.error('Erreur lors de l\'envoi du code OTP:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Erreur lors de l\'envoi du code de vérification. Veuillez réessayer.',
          life: 3000
        });
      }
    });
  }

  // Handle form submission
  onSubmit(): void {

    this.submitted = true;

    // Log form validity and values for debugging


    // Check each control's validity
    Object.keys(this.contactForm.controls).forEach(key => {
      // Just mark the control as touched to trigger validation messages
      const control = this.contactForm.get(key);
      if (control) {
        control.markAsTouched();
      }
    });

    // Check for specific validations
    const subjectControl = this.contactForm.get('subject');
    if (subjectControl && subjectControl.value && subjectControl.value.length < 5) {
    
      subjectControl.setErrors({ 'minlength': true });
      this.loading = false;
      return;
    }

    // Stop if form is invalid
    if (this.contactForm.invalid) {
      this.messageService.add({
        severity: 'error',
        summary: 'Formulaire invalide',
        detail: 'Veuillez corriger les erreurs dans le formulaire',
        life: 3000
      });
      return;
    }

    this.loading = true;
    const phone = this.contactForm.value.phone;
    const code = this.contactForm.value.codeOtp;




    this.authService.validateOtp(phone, code).subscribe({
      next: (otpResponse) => {


        // Check if OTP is valid based on the actual API response structure
        if (otpResponse && otpResponse.message && otpResponse.message.isValid) {
          // OTP is valid, proceed with sending the contact message
          const contactRequest: ContactRequest = {
            email: this.contactForm.value.email,
            phone: this.contactForm.value.phone,
            codeOtp: this.contactForm.value.codeOtp,
            subject: this.contactForm.value.subject,
            message: this.contactForm.value.message
          };



          // Send contact message using the service
          this.contactService.sendContactMessage(contactRequest).subscribe({
            next: (response) => {
             
              this.loading = false;
              this.messageService.add({
                severity: 'success',
                summary: 'Message envoyé',
                detail: 'Votre message a été envoyé avec succès. Nous vous contacterons bientôt.',
                life: 3000
              });
              this.contactForm.reset();
              this.submitted = false;
            },
            error: (error) => {
              console.error('Erreur lors de l\'envoi du message:', error);
              this.loading = false;

              // Check for specific validation error
              if (error?.error?.error?.name === 'ValidationError') {
                // Display the specific validation error message
                this.messageService.add({
                  severity: 'error',
                  summary: 'Erreur de validation',
                  detail: error.error.error.message || 'Veuillez vérifier les informations saisies',
                  life: 3000
                });

                // If it's a subject length error, focus on the subject field
                if (error.error.error.message?.includes('subject')) {
                  const subjectControl = this.contactForm.get('subject');
                  if (subjectControl) {
                    subjectControl.setErrors({ 'minlength': true });
                    subjectControl.markAsTouched();
                  }
                }
              } else {
                // Generic error message
                this.messageService.add({
                  severity: 'error',
                  summary: 'Erreur',
                  detail: 'Une erreur est survenue lors de l\'envoi du message. Veuillez réessayer.',
                  life: 3000
                });
              }
            }
          });
        } else {
          // OTP is invalid
          this.loading = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Code invalide',
            detail: 'Le code de vérification est invalide. Veuillez réessayer.',
            life: 3000
          });
        }
      },
      error: (error) => {
        console.error('Erreur lors de la validation OTP:', error);
        this.loading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Erreur lors de la vérification du code. Veuillez réessayer.',
          life: 3000
        });
      }
    });
  }

  // Handle button click event
  onButtonClick(event: Event): void {


    event.preventDefault();

    // Call onSubmit manually
    this.onSubmit();
  }
}