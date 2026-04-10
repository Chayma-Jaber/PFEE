import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-recover-password',
  standalone: true,
  imports: [CommonModule, FormsModule,],
  templateUrl: './recover-password.component.html',
  styleUrl: './recover-password.component.scss'
})
export class RecoverPasswordComponent implements OnDestroy {
  phoneNumber: string = '';
  otpCode: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  otpSent: boolean = false;
  otpVerified: boolean = false;
  countdown: number = 50;
  countdownInterval: any;
  currentPassword: string = '';
  hashedToken: string = '';
  constructor(private router: Router, private authService: AuthService) {}

  sendOtp() {
    if (this.phoneNumber) {
      this.authService.generateOtp(this.phoneNumber).subscribe({
        next: (response) => {
          this.otpSent = true;
          this.startCountdown();
          //alert('Code OTP envoyé avec succès !');
        },
        error: (err) => {
         // alert('Erreur lors de l\'envoi du code OTP. Veuillez réessayer.');
        }
      });
    } else {
     // alert('Veuillez entrer votre numéro de téléphone');
    }
  }

  forgotPassword() {
    if (this.otpCode) {
      this.authService.forgotPassword(this.phoneNumber, this.otpCode).subscribe({
        next: (response) => {
          this.otpVerified = true; // Marquer le code OTP comme vérifié
          this.hashedToken = response.token; // Stocker le token haché
          // console.log(this.hashedToken);
          //alert('Code OTP vérifié avec succès !');
        },
        error: (err) => {
          //alert('Code OTP invalide. Veuillez réessayer.');
        }
      });
    } else {
      //alert('Veuillez entrer le code de vérification');
    }
  }

 resetPassword() {
  if (!this.otpCode) {
    return;
  }

  if (!this.newPassword || !this.confirmPassword) {
    return;
  }

  if (this.newPassword !== this.confirmPassword) {
    return;
  }
  const resetPasswordData = {
    code: this.hashedToken, 
    password: this.newPassword,
    passwordConfirmation: this.confirmPassword
  };


  this.authService.resetPassword(resetPasswordData).subscribe({
    next: (response) => {

      this.router.navigate(['/login']); 
    },
    error: (err) => {

    }
  });
}
  
  startCountdown() {
    this.countdown = 50;
    this.countdownInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(this.countdownInterval);
      }
    }, 1000);
  }

  ngOnDestroy() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }
}