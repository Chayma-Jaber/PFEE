import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environementDev } from '../../../../environements/environementDev';
@Injectable({
  providedIn: 'root'
})
export class ProfileService {



  constructor(private http: HttpClient) { }

  getAddresses(): Observable<any> {
    var userToken = localStorage.getItem('jwt');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${userToken}`
    });

    return this.http.get(environementDev.api + '/api/getAddresses', { headers});
  }

  createAddress(address: any): Observable<any> {
    var userToken = localStorage.getItem('jwt');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${userToken}`
    });

    return this.http.post(environementDev.api + '/api/createAddress', address, { headers });
  }

  getCities(): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${ environementDev.tokenSearchDev}`
    });

    const payload = {
      limit: 100
    };

    return this.http.post(environementDev.apiSearchDev+'/indexes/cities/search', payload, { headers });
  }


}