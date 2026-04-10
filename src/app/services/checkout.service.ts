import { HttpHeaders } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { environementDev } from '../../environements/environementDev';
@Injectable({
  providedIn: 'root'
})
export class CheckoutService {


  constructor(private http: HttpClient) { }
  getShippingMethods(): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`
    });
    return this.http.get(environementDev.apiSearchDev+'/indexes/shipping-methods/search', { headers });
  }
  getPaymentMethods(): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`
    });
    return this.http.get(environementDev.apiSearchDev+'/indexes/payment-methods/search', { headers });
  }
  getStores(): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`,
      'Content-Type': 'application/json'
    });
    
    const body = {
      limit: 100
    };
    
    return this.http.post(environementDev.apiSearchDev + '/indexes/stores/search', body, { headers });
  }
  
  
}
