import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
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

    return this.http.get(environementDev.api+'/api/getValidCoupons', { headers}).pipe(
      map((response: any) => ({
        ...response,
        data: (response?.coupons || response?.data || []).map((coupon: any) =>
          this.mapValidCoupon(coupon)
        )
      })),
      catchError(() => of({ data: [] }))
    );
  }
   getCouponsUserPrivate(): Observable<any> {
    if ((environementDev as any).useLocalAuth) {
      return of({ data: [] });
    }

    var userToken = localStorage.getItem('jwt');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${userToken}`
    });

    return this.http.get(environementDev.api+'/api/getPrivatesCoupons', { headers}).pipe(
      catchError(() => of({ data: [] }))
    );
  }
  getCouponsUserPublic(): Observable<any> {
    if ((environementDev as any).useLocalAuth) {
      return of({ data: [] });
    }

    var userToken = localStorage.getItem('jwt');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${userToken}`
    });

    return this.http.get(environementDev.api+'/api/getPublicsCoupons', { headers}).pipe(
      catchError(() => of({ data: [] }))
    );
  }

  private mapValidCoupon(coupon: any): any {
    const discountType = coupon?.discount_type || coupon?.type || '';
    const discountValue = Number(coupon?.discount_value ?? coupon?.value ?? 0);

    return {
      ...coupon,
      date_from: coupon?.date_from || coupon?.valid_from || null,
      date_to: coupon?.date_to || coupon?.valid_to || null,
      min_total: Number(coupon?.min_total ?? coupon?.min_purchase ?? 0),
      discount_amount: discountType === 'FIXED' ? discountValue : 0,
      discount_percent: discountType === 'PERCENTAGE' ? discountValue : 0,
      category: coupon?.category || 'Marketing',
      appliq_method: coupon?.appliq_method || 'Manually',
      type: coupon?.type || discountType,
      details: coupon?.details || coupon?.description || '',
      bar_code: coupon?.bar_code || null
    };
  }
}
