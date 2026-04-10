import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environementDev } from '../../../../environements/environementDev';
@Injectable({
  providedIn: 'root'
})
export class GiftCardService {
  
  constructor(private http: HttpClient) { }
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`
    });
  }

  // Get gift card prices
  getGiftCardPrices(): Observable<any> {
    const url = `${environementDev.apiSearchDev}/indexes/gift-card-prices/search`;
    return this.http.get(url,  { headers: this.getHeaders() });
  }

  // Get gift card events
  getGiftCardEvents(): Observable<any> {
    const url = `${environementDev.apiSearchDev}/indexes/gift-card-events/search`;
    return this.http.get(url,  { headers: this.getHeaders() });
  }

  // Get FAQ
  getGiftCardFaq(): Observable<any> {
    const url = `${environementDev.apiSearchDev}/indexes/faq-gift-card/search`;
    return this.http.get(url, { headers: this.getHeaders() });
  }
  createGiftCardOrder(payload: any): Observable<any> {
    const url = `${environementDev.api}/api/buyGiftCard`;
    const token = localStorage.getItem('jwt');
    
    if (!token) {
      throw new Error('Token JWT manquant');
    }

    // console.log('API URL:', url);
    // console.log('Request Payload:', payload);

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    return this.http.post(url, payload, { headers });
  }
  getCoupons(): Observable<any> {
    var userToken = localStorage.getItem('jwt');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${userToken}`
    });

    return this.http.get(environementDev.api+'/api/getValidCoupons', { headers});
  }
   getCouponsUserPrivate(): Observable<any> {
    var userToken = localStorage.getItem('jwt');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${userToken}`
    });

    return this.http.get(environementDev.api+'/api/getPrivatesCoupons', { headers});
  }
  getCouponsUserPublic(): Observable<any> {
    var userToken = localStorage.getItem('jwt');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${userToken}`
    });

    return this.http.get(environementDev.api+'/api/getPublicsCoupons', { headers});
  } 
}
