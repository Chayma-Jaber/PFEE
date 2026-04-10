import { HttpClient } from '@angular/common/http';
import { HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environementDev } from '../../environements/environementDev';
@Injectable({
  providedIn: 'root'
})
export class ReturnService {

  constructor(private http: HttpClient) { }
  getmotifOrderReturn(): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`
    });

    return this.http.get(environementDev.apiSearchDev+'/indexes/motif-order-return/search', { headers });
  }
  getavailablesOrdersForReturnRequest(): Observable<any> {
    const token = localStorage.getItem('jwt');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get(environementDev.api+'/api/availablesOrdersForReturnRequest', { headers });
  }
  getavailablesOrderProductsForReturn(id:number): Observable<any> {
    const token = localStorage.getItem('jwt');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get(environementDev.api+'/api/availablesOrderProductsForReturn/'+id, { headers });
  }
  createReturnRequest(data: any): Observable<any> {
    const token = localStorage.getItem('jwt');
    let headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    // Si data est un FormData, ne pas définir Content-Type (le navigateur s'en charge)
    // Sinon, ajouter Content-Type: application/json
    const isFormData = (typeof FormData !== 'undefined') && data instanceof FormData;
    if (!isFormData) {
      headers = headers.set('Content-Type', 'application/json');
    }

    return this.http.post(environementDev.api + '/api/createOrderReturnRequest', data, { headers });
  }
  getOrdersReturns(): Observable<any> {
    const token = localStorage.getItem('jwt');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get(environementDev.api+'/api/getOrdersReturns', { headers });
  }
  getOrdersReturnsById(id:number): Observable<any> {
    const token = localStorage.getItem('jwt');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get(environementDev.api+'/api/getOrderReturnById/'+id, { headers });
  }
}
