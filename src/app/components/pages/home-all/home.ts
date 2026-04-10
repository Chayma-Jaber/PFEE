import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environementDev } from '../../../../environements/environementDev';
@Injectable({
  providedIn: 'root'
})
export class HomeService {
  constructor(private http: HttpClient) { }

  searchHome(query: string = ''): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`
    });   

    return this.http.get(environementDev.apiSearchDev+'/indexes/web-chp/search', { headers});
  }
  subscribeToNewsletter(email: string): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    return this.http.post(environementDev.api+'/api/subscribeToNewsletter', { email }, { headers });
  }
}