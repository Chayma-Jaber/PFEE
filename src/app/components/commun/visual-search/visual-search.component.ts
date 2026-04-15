import { Component, EventEmitter, Output, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { VisualSearchService, ParsedProduct } from '../../../services/visual-search.service';

@Component({
  selector: 'app-visual-search',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './visual-search.component.html',
  styleUrl: './visual-search.component.scss'
})
export class VisualSearchComponent {
  @Output() closeEvent = new EventEmitter<void>();
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('dropZone') dropZone!: ElementRef;

  isLoading = false;
  errorMessage = '';
  previewImage: string | null = null;
  searchResults: ParsedProduct[] = [];
  detectedInfo: any = null;
  isDragOver = false;

  constructor(private visualSearchService: VisualSearchService) {}

  openFileSelector(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.processFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      this.processFile(event.dataTransfer.files[0]);
    }
  }

  private processFile(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Veuillez sélectionner une image valide.';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.errorMessage = 'L\'image ne doit pas dépasser 10 Mo.';
      return;
    }

    this.errorMessage = '';
    this.searchResults = [];
    this.detectedInfo = null;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      this.previewImage = result;
      this.performSearch(result);
    };
    reader.readAsDataURL(file);
  }

  private performSearch(imageBase64: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.visualSearchService.searchByImage(imageBase64).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.detectedInfo = response.detected;
        this.searchResults = this.visualSearchService.parseAllProducts(response.similaires || []);

        if (this.searchResults.length === 0) {
          this.errorMessage = 'Aucun article similaire trouvé. Essayez avec une autre image.';
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Visual search error:', err);
        this.errorMessage = 'Erreur lors de la recherche. Veuillez réessayer.';
      }
    });
  }

  resetSearch(): void {
    this.previewImage = null;
    this.searchResults = [];
    this.detectedInfo = null;
    this.errorMessage = '';
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  close(): void {
    this.closeEvent.emit();
  }

  getConfidenceLabel(confidence: number): string {
    if (confidence >= 0.8) return 'Très confiant';
    if (confidence >= 0.6) return 'Confiant';
    if (confidence >= 0.4) return 'Modéré';
    return 'Faible';
  }

  getConfidenceClass(confidence: number): string {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  }
}
