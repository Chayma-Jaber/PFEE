import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environementDev } from '../../environements/environementDev';
// Interface for contact request body
export interface ContactRequest {
  email: string;
  phone: string;
  codeOtp: string;
  subject: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class ContactService {


  constructor(private http: HttpClient) { }

  sendContactMessage(contactData: ContactRequest): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
 
    return this.http.post<any>(environementDev.api+'/api/addCustomerMsg', contactData, { headers });
  }
}
