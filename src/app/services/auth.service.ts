import { HttpClient,HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { environementDev } from '../../environements/environementDev';
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private api="https://test-main.barsha.com.tn"
 
  constructor(private http: HttpClient) {}
  generateOtp(phoneNumber: string): Observable<any> {
    return this.http.post(
      `${ environementDev.api}/api/code-otp/generate`,
      { phone: phoneNumber },

    );
  }
  countPhone(phoneNumber: string): Observable<any> {
    return this.http.post(
      `${environementDev.api}/api/usersCount`,
      { phone: phoneNumber },

    );
  }

  validateOtp(phoneNumber: string, code: string): Observable<any> {
  

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const body = { phone: phoneNumber, code };


    return this.http.post(
      `${environementDev.api}/api/code-otp/validate`,
      body,
      { headers }
    );
  }

  register(user: any): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.post(`${environementDev.api}/api/auth/local/register`, user, { headers });
  }

  // Se connecter
  login(identifier: string, password: string): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    return this.http.post(`${environementDev.api}/api/auth/local`, { identifier, password }, { headers });
  }
  // Mot de passe oublié
  forgotPassword(phone: string,codeOtp: string): Observable<any> {
    return this.http.post(`${environementDev.api}/api/auth/forgot-password`, { phone  ,codeOtp});
  }

  // Réinitialiser le mot de passe
  resetPassword(resetPasswordData: { code: string, password: string, passwordConfirmation: string }): Observable<any> {
    return this.http.post(`${environementDev.api}/api/auth/reset-password`, resetPasswordData);
  }

  // Changer le mot de passe
  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.http.post(`${environementDev.api}/api/auth/change-password`, { currentPassword, newPassword });
  }



  getCurrentUser(): Observable<any> {
    // Récupérer le token depuis le localStorage ou un service d'authentification
    const token = localStorage.getItem('jwt'); // Supposons que le token est stocké ici

    // Vérifier si le token existe
    if (!token) {
      throw new Error('No token available');
    }

    // Ajouter le token dans l'en-tête Authorization
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    // Effectuer la requête GET avec les en-têtes
    return this.http.get(`${environementDev.api}/api/users/me`, { headers });
  }

//delete account
deleteAccount(): Observable<any> {
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${localStorage.getItem('jwt')}`
  });
  return this.http.delete(`${environementDev.api}/api/removeAccount`, { headers });
}
//update account
updateAccount(user: any): Observable<any> {
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${localStorage.getItem('jwt')}`
  });
  return this.http.put(`${environementDev.api}/api/updateAccount`, user, { headers });
}
}