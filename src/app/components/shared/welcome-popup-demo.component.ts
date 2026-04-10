import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WelcomePopupComponent } from './welcome-popup.component';

@Component({
  selector: 'app-welcome-popup-demo',
  standalone: true,
  imports: [CommonModule, WelcomePopupComponent],
  template: `
    <div class="demo-container">
      <h2>Démonstration du Popup Optimisé</h2>
      
      <button (click)="showPopup = true" class="demo-btn">
        Afficher le Popup
      </button>
      
      <app-welcome-popup 
        *ngIf="showPopup" 
        [popupData]="demoData" 
        (close)="showPopup = false">
      </app-welcome-popup>
    </div>
  `,
  styles: [`
    .demo-container {
      padding: 20px;
      text-align: center;
      font-family: Arial, sans-serif;
    }
    
    .demo-btn {
      background: #007bff;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 16px;
      cursor: pointer;
      transition: background 0.3s;
    }
    
    .demo-btn:hover {
      background: #0056b3;
    }
  `]
})
export class WelcomePopupDemoComponent {
  showPopup = false;
  
  demoData = {
    bg_img: {
      url: 'https://picsum.photos/400/600?random=1',
      name: 'Image de démonstration'
    },
    appStoreLink: '#',
    playStoreLink: '#'
  };
}
