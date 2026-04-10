import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environementDev } from '../../environements/environementDev';
@Injectable({
  providedIn: 'root'
})
export class CancelService {




  constructor(private http: HttpClient) { }

  getmotifCancelOrder(): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`
    });

    return this.http.get(environementDev.apiSearchDev+'/indexes/motif-cancel-order/search', { headers });
  }

  cancelOrder(
    orderId: number,
    motif: number,
    refundType?: string,
    rib?: string,
    holderName?: string,
    document?: File
  ): Observable<any> {
  
    
    // Création du FormData pour le multipart/form-data
    const formData = new FormData();
    formData.append('orderId', orderId.toString());
    formData.append('motif', motif.toString());

    if (refundType) {
      formData.append('refundType', refundType);
    }

    if (rib) {
      formData.append('rib', rib);
    }

    if (holderName) {
      formData.append('holderName', holderName);
    }

    if (document) {
      formData.append('document', document);
    }

    const token = localStorage.getItem('jwt');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.post(environementDev.api + '/api/cancelOrder', formData, { headers });
  }
}
