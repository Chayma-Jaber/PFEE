import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environementDev } from '../../environements/environementDev';

export interface VisualSearchResult {
  detected: {
    title_guess: string;
    famille: string | null;
    colors: string[];
    style_keywords: string[];
    confidence: number;
  };
  similaires: string[];
  complements: string[];
  method?: string;
  total_searched?: number;
}

export interface ParsedProduct {
  id: number;
  reference: string;
  name: string;
  price: string;
  famille: string;
  colors: string;
  image: string;
  url: string;
}

@Injectable({
  providedIn: 'root'
})
export class VisualSearchService {
  private apiUrl = environementDev.apiChatbot.replace('/api/chat', '');

  constructor(private http: HttpClient) {}

  searchByImage(imageBase64: string, imageUrl?: string): Observable<VisualSearchResult> {
    const payload: any = { image_base64: imageBase64 };
    if (imageUrl) {
      payload.image_url = imageUrl;
    }
    return this.http.post<VisualSearchResult>(`${this.apiUrl}/api/like-this`, payload);
  }

  parseProductLine(line: string): ParsedProduct | null {
    const idMatch = line.match(/\[ID:(\d+)\]/);
    if (!idMatch) return null;

    const id = parseInt(idMatch[1], 10);

    // Try full format: - [ID:123] [REF456] NOM | PRIX | Famille:FAM | Couleurs+Images: ... | ImgPrincipale: URL | URL
    const fullMatch = line.match(/\] ([^|]+) \| ([^|]+) \| Famille:([^|]*) \| Couleurs\+Images: ([^|]*) \| ImgPrincipale: ([^|]*) \| (.+)$/);
    if (fullMatch) {
      const refMatch = line.match(/\[([A-Z0-9-]+)\]/g);
      return {
        id,
        reference: refMatch && refMatch.length > 1 ? refMatch[1].replace(/[\[\]]/g, '') : '',
        name: fullMatch[1].trim(),
        price: fullMatch[2].trim(),
        famille: fullMatch[3].trim(),
        colors: fullMatch[4].trim(),
        image: fullMatch[5].trim(),
        url: fullMatch[6].trim(),
      };
    }

    // Try simplified format: [ID:123] NOM — PRIX TND | IMAGE_URL
    const simpleMatch = line.match(/\[ID:\d+\]\s*(.+?)(?:\s*[—\-]\s*)(\d+[\.,]?\d*\s*TND[^|]*)\|\s*(.+)$/);
    if (simpleMatch) {
      const imageUrl = simpleMatch[3].trim();
      return {
        id,
        reference: '',
        name: simpleMatch[1].trim(),
        price: simpleMatch[2].trim(),
        famille: '',
        colors: '',
        image: imageUrl,
        url: `/produit/${id}`,
      };
    }

    // Fallback: just extract ID and whatever text is after it
    const afterId = line.substring(line.indexOf(']') + 1).trim();
    return {
      id,
      reference: '',
      name: afterId.split('|')[0]?.split('—')[0]?.trim() || `Product ${id}`,
      price: '',
      famille: '',
      colors: '',
      image: '',
      url: `/produit/${id}`,
    };
  }

  parseAllProducts(lines: string[]): ParsedProduct[] {
    return lines
      .map(line => this.parseProductLine(line))
      .filter((p): p is ParsedProduct => p !== null);
  }
}
