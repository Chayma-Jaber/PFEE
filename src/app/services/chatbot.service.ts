import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, firstValueFrom, BehaviorSubject, Subject } from 'rxjs';

/**
 * ChatService - Barsha AI avec intégration Profil, Commandes, Retours et Coupons.
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  loading?: boolean;
  imagePreview?: string;
  isLikeThis?: boolean;
  products?: ProductCard[];
  complementProducts?: ProductCard[];
}

export interface ProductCard {
  reference: string;
  nom: string;
  prix: string;
  url: string;
  image?: string;
  color?: string;
  size?: string;
}

export interface ChatResponse {
  text: string;
  products?: ProductCard[];
}

export interface LikeThisDetected {
  title_guess: string;
  famille: string;
  colors: string[];
  style_keywords: string[];
  confidence: number;
}

export interface LikeThisResponse {
  detected: LikeThisDetected;
  similaires: ProductCard[];
  complements: ProductCard[];
}

@Injectable({ providedIn: 'root' })
export class ChatService {

  private readonly API_AI_URL = 'http://localhost:8000/api/chat';
  private readonly MAIN_API_URL = 'https://main.barsha.com.tn/api';
  private readonly MEILI_SEARCH_URL = 'https://cache-data.barsha.com.tn/indexes';

  // ─── ÉVÉNEMENTS UI ───
  private chatOpenSubject = new BehaviorSubject<boolean>(false);
  chatOpen$ = this.chatOpenSubject.asObservable();

  private visualSearchTriggerSubject = new Subject<void>();
  visualSearchTrigger$ = this.visualSearchTriggerSubject.asObservable();

  constructor(private http: HttpClient) { }

  toggleChat(open?: boolean): void {
    const nextState = open !== undefined ? open : !this.chatOpenSubject.value;
    this.chatOpenSubject.next(nextState);
  }

  triggerVisualSearch(): void {
    this.toggleChat(true);
    this.visualSearchTriggerSubject.next();
  }

  // ─── AUTHENTIFICATION ───
  private getAuthHeaders(): HttpHeaders {
    const jwt = localStorage.getItem('jwt');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`
    });
  }

  // ─── APIs BARSHA ───

  getUserProfile(): Observable<any> {
    return this.http.get(`${this.MAIN_API_URL}/users/me`, { headers: this.getAuthHeaders() });
  }

  getOrders(): Observable<any> {
    return this.http.get(`${this.MAIN_API_URL}/getOrders`, { headers: this.getAuthHeaders() });
  }

  getValidCoupons(): Observable<any> {
    return this.http.get(`${this.MAIN_API_URL}/getValidCoupons`, { headers: this.getAuthHeaders() });
  }

  getOrdersReturns(): Observable<any> {
    return this.http.get(`${this.MAIN_API_URL}/getOrdersReturns`, { headers: this.getAuthHeaders() });
  }

  getAvailableOrdersForReturn(): Observable<any> {
    return this.http.get(`${this.MAIN_API_URL}/availablesOrdersForReturnRequest`, { headers: this.getAuthHeaders() });
  }

  getReturnMotifs(): Observable<any> {
    // Motif-order-return (Meilisearch)
    return this.http.post(`${this.MEILI_SEARCH_URL}/motif-order-return/search`,
      { q: "" },
      { headers: { 'Authorization': 'Bearer 660ac272a4c62f4138f96bc52d33f1d6de8a182712321c667f516312f2db200c' } }
    );
  }

  getWishListItems(): Observable<any> {
    return this.http.get(`${this.MAIN_API_URL}/getWishListItems`, { headers: this.getAuthHeaders() });
  }

  addWishListItem(productId: string | number): Observable<any> {
    // Adapter le corps de la requête selon ce qu'attend le backend exact
    return this.http.post(`${this.MAIN_API_URL}/addWishListItem`, { produit_id: productId }, { headers: this.getAuthHeaders() });
  }

  // ─── ENVOI MESSAGE CHAT ───

  async sendMessage(
    messages: ChatMessage[],
    userContext: any
  ): Promise<ChatResponse> {

    const body = {
      messages: messages,
      user_context: userContext // Transmettre tout le contexte utilisateur au backend
    };

    try {
      const response = await firstValueFrom(
        this.http.post<any>(this.API_AI_URL, body)
      );

      const text = response?.choices?.[0]?.message?.content || 'Désolé, je n\'ai pas pu répondre.';

      return {
        text,
        products: this.extractProducts(text, response.catalog_hits || [])
      };

    } catch (error: any) {
      console.error('Chat API Error:', error);
      return { text: 'Une erreur est survenue lors de la communication avec Barsha AI.' };
    }
  }

  private extractProducts(text: string, catalogHits: any[] = []): ProductCard[] {
    const products: ProductCard[] = [];
    const seen = new Set<string>();

    const catalogMap = new Map<string, any>();
    for (const item of catalogHits) {
      catalogMap.set(String(item.id), item);
    }

    const simpleIdRegex = /\[ID:(\d+)\]/gi;
    let match;
    while ((match = simpleIdRegex.exec(text)) !== null) {
      const pid = match[1];
      if (seen.has(pid)) continue;
      seen.add(pid);

      const hit = catalogMap.get(pid);
      if (hit) {
        products.push({
          reference: hit.reference || `ID:${pid}`,
          nom: hit.nom || 'Produit',
          prix: hit.prix || '',
          url: hit.url || `https://barsha.com.tn/fr/produit/${pid}`,
          image: hit.image || 'assets/logo.jpg'
        });
        continue;
      }

      // Si pas dans catalogHits, fallback basique via texte
      const contextBefore = text.substring(Math.max(0, match.index - 50), match.index);
      const nameMatch = contextBefore.match(/(?:la|le|un|une)\s+([a-zA-Z\s]+)$|^([a-zA-Z\s]+)$|(\w+)\s*$/i);
      const nom = (nameMatch?.[1] || nameMatch?.[2] || nameMatch?.[3] || 'Produit').trim();

      const contextAfter = text.substring(match.index, Math.min(text.length, match.index + 50));
      const priceMatch = contextAfter.match(/(\d+(?:[.,]\d+)?\s*(?:TND|DT))/i);
      const prix = priceMatch?.[0] || '';

      const lineEnd = text.indexOf('\n', match.index);
      const lineStr = text.substring(match.index, lineEnd !== -1 ? lineEnd : text.length);
      const imgMatch = lineStr.match(/ImgPrincipale:\s*([^|\n]*)\|?\s*(https?:\/\/[^\s\n]+)/i);
      const fallbackImg = imgMatch && imgMatch[1].trim() ? imgMatch[1].trim() : 'assets/logo.jpg';

      products.push({
        reference: `ID:${pid}`,
        nom: nom,
        prix: prix,
        url: `https://barsha.com.tn/fr/produit/${pid}`,
        image: fallbackImg
      });
    }

    // Fallback markdown links
    if (products.length === 0) {
      const fallbackRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
      while ((match = fallbackRegex.exec(text)) !== null) {
        products.push({ reference: '', nom: match[1], url: match[2], prix: '' });
      }
    }
    return products;
  }

  // ─── LIKE THIS — Recherche Visuelle ───

  async analyzeImage(imageBase64: string): Promise<LikeThisResponse> {
    const body = { image_base64: imageBase64 };
    try {
      const raw = await firstValueFrom(
        this.http.post<any>('http://localhost:8000/api/like-this', body)
      );
      return {
        detected: raw.detected,
        similaires: (raw.similaires || []).map((line: string) => this.parseProductLine(line)).filter(Boolean) as ProductCard[],
        complements: (raw.complements || []).map((line: string) => this.parseProductLine(line)).filter(Boolean) as ProductCard[]
      };
    } catch (error) {
      console.error('Like This Error:', error);
      return { detected: { title_guess: '', famille: '', colors: [], style_keywords: [], confidence: 0 }, similaires: [], complements: [] };
    }
  }

  private parseProductLine(line: string): ProductCard | null {
    const regex = /- \[ID:(\d+)\]\s*\[([^\]]+)\]\s+([^|]+)\|\s*([^|]+)\|[^|]*\|\s*Couleurs\+Images:\s*([^|]+)\|\s*ImgPrincipale:\s*([^|\n]*)\|?\s*(https?:\/\/[^\s\n]+)/i;
    const match = regex.exec(line);
    if (!match) return null;
    const pid = match[1]?.trim();
    const colorsRaw = match[5]?.trim() || '';
    let firstImg = match[6]?.trim() || '';
    if (!firstImg && colorsRaw) {
      const parts = colorsRaw.split(',');
      for (const part of parts) {
        const imgPart = part.trim().split(':').slice(1).join(':').trim();
        if (imgPart.startsWith('http')) { firstImg = imgPart; break; }
      }
    }
    const colors = colorsRaw.split(',').map((p: string) => p.trim().split(':')[0].trim()).filter(Boolean).join(', ');
    return {
      reference: match[2]?.trim() || 'N/A',
      nom: match[3]?.trim() || 'Produit',
      prix: match[4]?.trim() || '',
      color: colors,
      image: firstImg,
      url: match[7]?.trim() || `https://barsha.com.tn/fr/produit/${pid}`
    };
  }

  getQuickReplies(lastBotMessage: string): string[] {
    const msg = lastBotMessage.toLowerCase();
    if (msg.includes('retour')) return ['Comment faire un retour ?', 'Délai de remboursement ?'];
    if (msg.includes('livraison')) return ['Délai de livraison ?', 'Suivre mon colis'];
    if (msg.includes('promo') || msg.includes('coupon')) return ['Voir mes coupons', 'Aide code promo'];
    return [
      'Quelles sont les nouveautés ?',
      'Où est ma commande ?',
      'Mes coupons valides',
      'Problème de taille'
    ];
  }
}