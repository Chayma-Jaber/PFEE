import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatMessageDto, UserContextDto } from './dto/ai.dto';
import { SearchService } from '../search/search.service';

// Intent mapping for query cleaning (French fashion context)
const INTENT_MAP: Record<string, string[]> = {
  mariage: ['robe soirée', 'robe cocktail', 'costume', 'tenue habillée'],
  'soirée': ['robe soirée', 'tenue chic', 'robe cocktail'],
  sport: ['tenue sportive', 'jogging', 'basket', 'legging'],
  plage: ['maillot', 'short', 'sandale', 'chapeau', 'robe légère'],
  bureau: ['chemise', 'pantalon', 'blazer', 'tenue formelle'],
  hiver: ['manteau', 'pull', 'écharpe', 'botte'],
  'été': ['t-shirt', 'short', 'robe', 'sandale'],
  casual: ['jean', 't-shirt', 'basket', 'sweat'],
  chic: ['robe', 'blazer', 'chemise', 'tenue habillée'],
  randonnée: ['chaussure randonnée', 'veste', 'pantalon', 'sac à dos'],
  'rendez-vous': ['robe', 'chemise', 'pantalon chino', 'tenue élégante'],
  entretien: ['costume', 'chemise', 'pantalon', 'tenue formelle'],
  festival: ['short', 't-shirt', 'basket', 'chapeau', 'sac'],
  vacances: ['robe', 'short', 'maillot', 'sandale'],
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly aiServiceUrl: string;
  private readonly ollamaUrl: string;
  private readonly ollamaModel: string;
  private readonly geminiApiKey: string;
  private readonly openrouterApiKey: string;
  private readonly ollamaTimeout: number;
  private readonly cloudTimeout: number;
  private readonly maxTokens: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly searchService: SearchService,
  ) {
    this.aiServiceUrl = this.configService.get<string>('ai.aiServiceUrl', 'http://localhost:8001');
    this.ollamaUrl = this.configService.get<string>('ai.ollamaUrl', 'http://localhost:11434');
    this.ollamaModel = this.configService.get<string>('ai.ollamaModel', 'qwen2.5:7b');
    this.geminiApiKey = this.configService.get<string>('ai.geminiApiKey', '');
    this.openrouterApiKey = this.configService.get<string>('ai.openrouterApiKey', '');
    this.ollamaTimeout = 90_000;
    this.cloudTimeout = 30_000;
    this.maxTokens = this.configService.get<number>('ai.maxTokens', 2048);
  }

  // ─── Chat orchestration ──────────────────────────────────────────
  // Priority: Python AI service (Qwen/Ollama) → direct Ollama → Gemini (last resort)
  async chat(
    messages: ChatMessageDto[],
    userContext?: UserContextDto,
  ): Promise<{ text: string; products: any[] }> {
    const fallbackProducts = await this.findCatalogFallbackProducts(messages);

    // 1. Try the local Python AI service (primary)
    try {
      const result = await this.callPythonAiService(messages, userContext);
      return {
        text: result.text,
        products: result.products.length > 0 ? result.products : fallbackProducts,
      };
    } catch (pythonError) {
      this.logger.warn(`Python AI service failed: ${pythonError.message}`);
    }

    // 2. Fallback: call Ollama directly from NestJS
    try {
      const text = await this.callOllamaDirectly(messages);
      return { text, products: fallbackProducts };
    } catch (ollamaError) {
      this.logger.warn(`Direct Ollama fallback failed: ${ollamaError.message}`);
    }

    // 3. Last resort: Gemini (only if API key exists)
    if (this.geminiApiKey) {
      try {
        const text = await this.callGemini(messages);
        return { text, products: fallbackProducts };
      } catch (geminiError) {
        this.logger.error(`Gemini last-resort fallback failed: ${geminiError.message}`);
      }
    }

    // 4. All providers failed — return a static fallback
    return {
      text: this.getFallbackResponse(messages),
      products: fallbackProducts,
    };
  }

  // ─── Python AI Service (PRIMARY) ────────────────────────────────
  private async callPythonAiService(
    messages: ChatMessageDto[],
    userContext?: UserContextDto,
  ): Promise<{ text: string; products: any[] }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.ollamaTimeout);

    try {
      const response = await fetch(`${this.aiServiceUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          user_context: userContext || {},
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Python AI service error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();

      // Transform: Python service returns { choices, catalog_hits }
      // Frontend expects { text, products }
      const text =
        data.choices?.[0]?.message?.content ||
        data.text ||
        'Désolé, je n\'ai pas pu générer de réponse.';

      const products = (data.catalog_hits || data.products || []).map((p: any) =>
        this.normalizeProductCard(p),
      );

      return { text, products };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private normalizeProductCard(product: any): any {
    const id = Number(product?.id ?? product?.product_id ?? 0);
    const name = product?.nom || product?.title || product?.name || 'Produit';
    const rawPrice = product?.prix || product?.currentPrice || product?.price || '';
    const image = product?.image || product?.firstImageUrl || product?.firstImg?.url || '';
    const url = product?.url || product?.slug || `/produit/${id}`;

    return {
      id,
      reference: product?.reference || product?.sku || `ID:${id}`,
      nom: name,
      prix: typeof rawPrice === 'string' && rawPrice.toUpperCase().includes('TND')
        ? rawPrice
        : `${rawPrice} TND`,
      url,
      image,
      color: product?.color || '',
      size: product?.size || '',
    };
  }

  private async findCatalogFallbackProducts(messages: ChatMessageDto[]): Promise<any[]> {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    const query = this.cleanSearchQuery(lastUserMessage?.content || '').trim();

    if (!query) {
      return [];
    }

    try {
      const result = await this.searchService.searchProducts(query, undefined, undefined, 6, 0);
      const hits = Array.isArray(result?.hits) ? result.hits : [];
      return hits.slice(0, 6).map((hit: any) => this.normalizeProductCard(hit));
    } catch (error: any) {
      this.logger.warn(`Catalog fallback search failed: ${error?.message || error}`);
      return [];
    }
  }

  // ─── Direct Ollama call (FALLBACK 1) ─────────────────────────────
  private async callOllamaDirectly(messages: ChatMessageDto[]): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.ollamaTimeout);

    try {
      const ollamaMessages = [
        {
          role: 'system',
          content:
            'Tu es l\'assistant shopping de Barsha, une boutique de mode en ligne tunisienne. ' +
            'Réponds toujours en français. Sois amical, concis et utile.',
        },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const response = await fetch(`${this.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.ollamaModel,
          messages: ollamaMessages,
          stream: false,
          options: {
            num_predict: this.maxTokens,
            temperature: 0.7,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Ollama error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const content = data.message?.content;
      if (!content) {
        throw new Error('No valid response from Ollama');
      }

      return content;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ─── Gemini API (LAST RESORT fallback) ───────────────────────────
  private async callGemini(messages: ChatMessageDto[]): Promise<string> {
    if (!this.geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }

    const geminiMessages = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const contents = [
      {
        role: 'user',
        parts: [
          {
            text:
              'Tu es l\'assistant shopping de Barsha, une boutique de mode en ligne tunisienne. ' +
              'Réponds toujours en français. Sois amical, concis et utile.',
          },
        ],
      },
      { role: 'model', parts: [{ text: 'Compris, je suis prêt à aider.' }] },
      ...geminiMessages,
    ];

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${this.geminiApiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.cloudTimeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            maxOutputTokens: this.maxTokens,
            temperature: 0.7,
            topP: 0.9,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      if (!candidate?.content?.parts?.[0]?.text) {
        throw new Error('No valid response from Gemini');
      }

      return candidate.content.parts[0].text;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ─── Fallback response (all providers down) ──────────────────────
  private getFallbackResponse(messages: ChatMessageDto[]): string {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const query = lastUserMsg?.content?.toLowerCase() || '';

    if (query.includes('bonjour') || query.includes('salut') || query.includes('hello')) {
      return 'Bonjour ! Bienvenue chez Barsha. Comment puis-je vous aider à trouver la tenue parfaite ?';
    }
    if (query.includes('prix') || query.includes('combien')) {
      return 'Je vous invite à consulter la page du produit pour voir le prix exact. Puis-je vous aider à trouver un article en particulier ?';
    }
    if (query.includes('livraison') || query.includes('expédition')) {
      return 'Nous livrons dans toute la Tunisie ! La livraison standard prend généralement 2-5 jours ouvrables. Avez-vous besoin d\'aide pour autre chose ?';
    }
    if (query.includes('retour') || query.includes('échange')) {
      return 'Vous pouvez retourner ou échanger vos articles dans les 14 jours suivant la réception. Consultez notre politique de retour pour plus de détails.';
    }

    return 'Je suis l\'assistant shopping de Barsha. Je peux vous aider à trouver des vêtements, des accessoires et des tenues. Que recherchez-vous ?';
  }

  // ─── Query cleaning ──────────────────────────────────────────────
  cleanSearchQuery(query: string): string {
    const queryLower = query.toLowerCase().trim();

    // Check intent mappings
    for (const [intent, expansions] of Object.entries(INTENT_MAP)) {
      if (queryLower.includes(intent)) {
        return expansions[0];
      }
    }

    // Remove filler words
    const fillers = [
      'je cherche', 'je veux', 'j\'aimerais', 'montre moi', 'montrez moi',
      'je voudrais', 'avez vous', 'est-ce que vous avez', 'un', 'une', 'des',
      'le', 'la', 'les', 'pour', 'en', 'de',
    ];

    let cleaned = queryLower;
    for (const filler of fillers) {
      cleaned = cleaned.replace(new RegExp(`\\b${filler}\\b`, 'gi'), ' ');
    }

    return cleaned.replace(/\s+/g, ' ').trim() || query;
  }

  // ─── Visual search ────────────────────────────────────────────────
  async visualSearch(
    imageBase64: string,
  ): Promise<{ results: Array<{ product_id: number; similarity: number }>; query_description?: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.ollamaTimeout);

    try {
      const response = await fetch(`${this.aiServiceUrl}/api/visual-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64, limit: 12 }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new HttpException(
          `Visual search service error: ${errorBody}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const data = await response.json();

      return {
        results: (data.results || []).map((r: any) => ({
          product_id: r.product_id,
          similarity: r.similarity || r.score || 0,
        })),
        query_description: data.query_description || data.description,
      };
    } catch (error) {
      // Graceful degradation: when AI service is unavailable, return empty results
      // instead of throwing. This keeps the UI usable without a CLIP backend.
      this.logger.warn(
        `Visual search fallback (AI service unavailable): ${error?.message || error}`,
      );
      return {
        results: [],
        query_description: 'Recherche visuelle indisponible — veuillez réessayer plus tard.',
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ─── Like-this (legacy compatibility) ────────────────────────────
  async likeThis(
    imageBase64: string,
    imageUrl?: string,
  ): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.ollamaTimeout);

    try {
      const body: any = { limit: 12 };
      if (imageBase64) body.image = imageBase64;
      if (imageUrl) body.image_url = imageUrl;

      const response = await fetch(`${this.aiServiceUrl}/api/like-this`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.warn(`Like-this service error ${response.status}: ${errorBody}`);
        return this.getLikeThisFallbackResponse();
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        this.logger.warn('Like-this service timed out');
      } else {
        this.logger.warn(`Like-this service unavailable: ${error.message}`);
      }
      return this.getLikeThisFallbackResponse();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private getLikeThisFallbackResponse() {
    return {
      method: 'unavailable',
      similaires: [],
      complements: [],
      detected: {
        title_guess: 'SERVICE_UNAVAILABLE',
        confidence: 0,
      },
      error: 'Visual search service is not running',
    };
  }

  // ─── Health check ────────────────────────────────────────────────
  async getHealth(): Promise<{
    aiService: { status: string; url: string };
    ollama: { status: string; url: string };
  }> {
    const results = {
      aiService: { status: 'unknown', url: this.aiServiceUrl },
      ollama: { status: 'unknown', url: this.ollamaUrl },
    };

    // Check Python AI service
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5_000);
      const res = await fetch(`${this.aiServiceUrl}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      results.aiService.status = res.ok ? 'healthy' : `unhealthy (${res.status})`;
    } catch {
      results.aiService.status = 'unreachable';
    }

    // Check Ollama
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5_000);
      const res = await fetch(`${this.ollamaUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);
      results.ollama.status = res.ok ? 'healthy' : `unhealthy (${res.status})`;
    } catch {
      results.ollama.status = 'unreachable';
    }

    return results;
  }
}
