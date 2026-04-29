import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environementDev } from '../../../../environements/environementDev';
@Injectable({
  providedIn: 'root'
})
export class ProfileService {



  constructor(private http: HttpClient) { }

  private normalizeAddress(address: any): any {
    if (!address || typeof address !== 'object') {
      return null;
    }

    return {
      ...address,
      id: Number(address.id ?? 0),
      label: address.label || '',
      firstName: address.firstName || address.first_name || '',
      lastName: address.lastName || address.last_name || '',
      phone: address.phone || '',
      address: address.address || address.street || '',
      street: address.street || address.address || '',
      city: address.city || '',
      state: address.state || '',
      delegation: address.delegation || address.state || '',
      locality: address.locality || '',
      codepost: address.codepost || address.postal_code || address.postalCode || '',
      postalCode: address.postalCode || address.postal_code || address.codepost || '',
      country: address.country || 'Tunisie',
      defaultAddress: Boolean(address.defaultAddress ?? address.is_default),
      isDefault: Boolean(address.isDefault ?? address.defaultAddress ?? address.is_default),
    };
  }

  private normalizeAddressesResponse(response: any): { data: any[] } {
    const rawAddresses = Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response)
        ? response
        : Array.isArray(response?.items)
          ? response.items
          : [];

    return {
      data: rawAddresses
        .map((address: any) => this.normalizeAddress(address))
        .filter((address: any) => address !== null),
    };
  }

  getAddresses(): Observable<any> {
    var userToken = localStorage.getItem('jwt');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${userToken}`
    });

    return this.http.get(environementDev.api + '/api/getAddresses', { headers }).pipe(
      map((response: any) => this.normalizeAddressesResponse(response))
    );
  }

  createAddress(address: any): Observable<any> {
    var userToken = localStorage.getItem('jwt');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${userToken}`
    });

    const payload = {
      label: address.label || '',
      first_name: address.firstName || address.first_name || '',
      last_name: address.lastName || address.last_name || '',
      phone: address.phone || '',
      street: address.address || address.street || '',
      city: address.city || '',
      state: address.state || address.delegation || '',
      postal_code: address.postalCode || address.postal_code || address.codepost || '',
      country: address.country || 'TN',
      is_default: Boolean(address.defaultAddress ?? address.is_default),
      is_shipping: true,
      is_billing: false
    };

    return this.http.post(environementDev.api + '/api/createAddress', payload, { headers }).pipe(
      map((response: any) => ({
        data: this.normalizeAddress(response?.data ?? response),
      }))
    );
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
