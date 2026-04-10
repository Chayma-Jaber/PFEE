import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environementDev } from '../../environements/environementDev';

@Injectable({
  providedIn: 'root'
})
export class FooterService {
 
 

  constructor(private http: HttpClient) { }
  getFooterData(): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`
    });
   
    return this.http.get<any>( environementDev.apiSearchDev + '/indexes/footer/search', { headers });
  }
  getSocialLinks(): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`
    });
    return this.http.get<any>( environementDev.apiSearchDev + '/indexes/social-link/search', { headers });
  }
  getAboutBrandData(): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`
    });
    return this.http.get<any>( environementDev.apiSearchDev + '/indexes/about-brand/search', { headers });
  }
  getContactUsData(): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`
    });
    return this.http.get<any>( environementDev.apiSearchDev+ '/indexes/contact-us/search', { headers });
  }
  getCookiesPolicyData(): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`
    });
    return this.http.get<any>( environementDev.apiSearchDev + '/indexes/cookies-policy/search', { headers });
  }
  getFindStoreData(): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`
    });
    return this.http.get<any>( environementDev.apiSearchDev + '/indexes/find-store/search', { headers });
  }
  getOurHistoryData(): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`
    });
    return this.http.get<any>( environementDev.apiSearchDev + '/indexes/our-history/search', { headers });
  }
  getPrivacyData(): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`
    });
    return this.http.get<any>( environementDev.apiSearchDev + '/indexes/privacy/search', { headers });
  }
  getShippingReturnData(): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev }`
    });
    return this.http.get<any>( environementDev.apiSearchDev + '/indexes/shipping-return/search', { headers });
  }
  getSizesGuideData(): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`
    });
    return this.http.get<any>( environementDev.apiSearchDev + '/indexes/sizes-guide/search', { headers });
  }
  subscribeToNewsletter(email: string): Observable<any> {

    return this.http.post( environementDev.api+'/api/subscribeToNewsletter', { email });
  }
}
