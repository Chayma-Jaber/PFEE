import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';
@Injectable({
  providedIn: 'root'
})
export class CategorieService {




  constructor(private http: HttpClient) { }

  getHomePageData(): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`
    });

    return this.http.get(environementDev.apiSearchDev+'/indexes/web-hp/search', { headers });
  }

  getCategoryById(id: string): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`
    });

    return this.http.get(`${environementDev.apiSearchDev}/indexes/categories/${id}`, { headers });
  }

  getCategoryByName(name: string): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environementDev.tokenSearchDev}`
    });
    
    return this.http.post(`${environementDev.apiSearchDev}/indexes/categories/search`, 
      { q: name, limit: 1 },
      { headers }
    ).pipe(
      map((response: any) => {
        if (response.hits && response.hits.length > 0) {
          return response.hits[0];
        }
        throw new Error('Category not found');
      }),
      catchError(error => {
        console.error('Error finding category by name', error);
        return of(null);
      })
    );
  }

  isNumericId(value: string): boolean {
    return /^\d+$/.test(value);
  }
}