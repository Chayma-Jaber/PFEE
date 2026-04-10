import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class GiftCardCommunicationService {
  private showFaqPopupSubject = new Subject<void>();
  
  showFaqPopup$ = this.showFaqPopupSubject.asObservable();

  openFaqPopup() {
    this.showFaqPopupSubject.next();
  }
} 
