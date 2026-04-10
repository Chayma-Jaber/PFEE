import { Routes } from '@angular/router';
import { LoginComponent } from '../../components/pages/auth/login/login.component';
import { RegisterComponent } from '../../components/pages/auth/register/register.component';
import { RecoverPasswordComponent } from '../../components/pages/auth/recover-password/recover-password.component';
import { VerifyOtpComponent } from '../../components/pages/auth/verify-otp/verify-otp.component';

export const AUTH_ROUTES: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'recover-password', component: RecoverPasswordComponent },
  { path: 'verify-otp', component: VerifyOtpComponent },
];
