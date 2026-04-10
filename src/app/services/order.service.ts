import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { CartItem } from './cart.service';
import { environementDev } from '../../environements/environementDev';
@Injectable({
  providedIn: 'root'
})
export class OrderService {
 
  private apiUrl2 = 'https://main.barsha.com.tn'; // Ajout du slash final

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwt');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getOrders(): Observable<any> {
    return this.http.get(`${environementDev.api}/api/getOrders`, { headers: this.getHeaders() });
  }

  placeOrder(orderRequest: { orderData: any, products: any[] }): Observable<any> {
    return this.http.post(`${environementDev.api}/api/placeOrder`, orderRequest, { headers: this.getHeaders() });
  }

  private calculateSubtotal(products: any[]): number {
    return products.reduce((sum, item) => sum + (item.product.currentPrice * item.quantity), 0);
  }

  getOrderById(id: number): Observable<any> {
    return this.http.get(`${environementDev.api}/api/getOrderById/${id}`, { headers: this.getHeaders() });
  }

  getCTPTransaction(orderId: number, redirectUrl: string): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('jwt')}`,
      'Content-Type': 'application/json',
    
    });
    const body = {
      orderId: orderId,
      redirectTo: redirectUrl
    };
    return this.http.post(`${environementDev.api}/api/generateCTPTransaction`, body, { headers: headers });
  }

  checkCTPTransaction(orderId: number): Observable<any> {
    const body = {
      orderId: orderId
    };
    return this.http.post(`${environementDev.api}/api/checkCTPTransaction`, body, { headers: this.getHeaders() });
  }
  
  checkCartProducts(items: any[]): Observable<any> {
    const token = localStorage.getItem('jwt');
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
     
    });

    return this.http.post(`${environementDev.api}/api/checkCartProducts`, items, { headers });
  }

  /**
   * Vérifier les offres disponibles pour les produits du panier
   * @param cartItems - Tableau des articles du panier avec ean13, quantity, unitPrice
   * Cette API n'utilise pas de token (disponible pour les utilisateurs non authentifiés)
   */
  checkCartOffers(cartItems: any[]): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    return this.http.post(
      `${environementDev.api}/api/checkCartOffers`, 
      cartItems, 
      { headers }
    );
  }
  
}