import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environementDev } from '../../../../../../environements/environementDev';

@Injectable({
  providedIn: 'root'
})
export class FideliteService {


  constructor(private http: HttpClient) { }

  getFaq(): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`
    });

    return this.http.get<any>(  environementDev.apiSearchDev + '/indexes/faq-loyalty/search', { headers });
  }
  getCard(): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`
    });

    return this.http.get<any>(  environementDev.apiSearchDev + '/indexes/loyalty-card-models/search', { headers });
  }
  getLoyaltyCardParams(): Observable<any> {
 
    const jwt = localStorage.getItem('jwt');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${jwt}`
    });

    return this.http.get<any>(  environementDev.api + '/api/getLoyaltyCardParams', { headers });
  }
  fetchLoyaltyCard(): Observable<any> {
 
    const jwt = localStorage.getItem('jwt');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${jwt}`
    });

    return this.http.get<any>(  environementDev.api + '/api/fetchLoyaltyCard', { headers });
  }
  fetchLoyaltyCardTransactions(): Observable<any> {
 
    const jwt = localStorage.getItem('jwt');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${jwt}`
    });

    return this.http.get<any>(  environementDev.api + '/api/fetchLoyaltyCardTransactions', { headers });
  }

  convertLoyaltyPoints(data: any = {}): Observable<any> {
 
    const jwt = localStorage.getItem('jwt');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${jwt}`
    });
    

    return this.http.post<any>(  environementDev.api + '/api/convertLoyaltyPoints', data, { headers });
  }
}
