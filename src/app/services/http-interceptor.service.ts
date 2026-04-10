import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable()
export class HttpLoggingInterceptor implements HttpInterceptor {
  
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Log outgoing request
    if (request.url.includes('idOrigin')) {
      // console.log('Outgoing request', {
      //   url: request.url,
      //   headers: request.headers.keys().map(key => `${key}: ${request.headers.get(key)}`),
      //   params: request.params.toString(),
      //   body: request.body
      // });
    }
    
    return next.handle(request).pipe(
      tap(event => {
        if (request.url.includes('idOrigin') && event instanceof HttpResponse) {
          // console.log('Response', {
          //   status: event.status,
          //   statusText: event.statusText,
          //   url: event.url,
          //   body: event.body
          // });
        }
      }),
      catchError((error: HttpErrorResponse) => {
        if (request.url.includes('idOrigin')) {
          console.error('Error response', {
            error: error.error,
            status: error.status,
            message: error.message
          });
        }
        return throwError(() => error);
      })
    );
  }
} 