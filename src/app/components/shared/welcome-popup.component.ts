import { Component, EventEmitter, Output, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-welcome-popup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './welcome-popup.component.html',
  styleUrls: ['./welcome-popup.component.scss']
})
export class WelcomePopupComponent implements OnInit, OnDestroy {
  @Input() popupData: any;
  @Output() close = new EventEmitter<void>();

  imageLoaded: boolean = false;
  showContent: boolean = false;
  private imageLoadTimeout: any;

  ngOnInit() {
    // Délai initial pour permettre au DOM de se stabiliser
    setTimeout(() => {
      this.showContent = true;
    }, 100);

    // Précharger l'image si elle existe
    if (this.popupData?.bg_img?.url) {
      this.preloadImage(this.popupData.bg_img.url);
    }
  }

  ngOnDestroy() {
    if (this.imageLoadTimeout) {
      clearTimeout(this.imageLoadTimeout);
    }
  }

  private preloadImage(src: string): void {
    const img = new Image();
    img.onload = () => {
      // Image chargée avec succès
      this.imageLoaded = true;
    };
    img.onerror = () => {
      // En cas d'erreur, on affiche quand même le contenu
      this.imageLoaded = true;
    };
    img.src = src;
  }

  onClose() {
    this.close.emit();
  }
} 