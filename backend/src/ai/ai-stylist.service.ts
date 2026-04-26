import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { Order } from '../orders/entities/order.entity';

// A conversational personal shopper. Builds on the existing Ollama endpoint but with
// a specialized system prompt, user-history grounding, and a JSON contract for
// product mentions so the UI can show live add-to-cart cards.

interface StylistTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface StylistRequest {
  userId: number | null;
  message: string;
  history?: StylistTurn[];
  // Optional hints from the UI (budget, occasion, sizes, colors)
  context?: {
    budget?: number;
    occasion?: string;
    preferredSizes?: string[];
    preferredColors?: string[];
  };
}

export interface StylistReply {
  reply: string;
  suggestions: Array<{
    productId: number;
    title: string;
    price: number;
    image: string | null;
    reason: string;
  }>;
  followUpQuestions: string[];
}

const STYLIST_SYSTEM_PROMPT = `Tu es "Barsha Stylist", un·e conseiller·e de mode expert·e pour une boutique en ligne tunisienne.
Ton rôle : comprendre l'occasion, le style et le budget du client, puis proposer 2 à 4 produits précis du catalogue.

Règles :
- Parle en français, ton chaleureux et professionnel (tu peux utiliser quelques mots en arabe tunisien si le client le fait).
- Pose UNE question précise à la fois si tu manques d'info (budget, occasion, taille, couleur).
- Quand tu recommandes, termine TOUJOURS ta réponse par un bloc JSON exactement comme :
  <STYLIST_JSON>
  {
    "product_ids": [123, 456],
    "follow_ups": ["Préférez-vous une coupe ajustée ou ample ?", "Quelle couleur aimez-vous ?"]
  }
  </STYLIST_JSON>
- Ne recommande QUE des produits présents dans le catalogue fourni. Si aucun produit n'est pertinent, demande plus d'info au lieu d'inventer.
- Évite les bullet points verbeux : une phrase par produit suffit pour expliquer pourquoi tu le recommandes.
`;

@Injectable()
export class AiStylistService {
  private readonly logger = new Logger(AiStylistService.name);
  private readonly ollamaUrl: string;
  private readonly ollamaModel: string;
  private readonly ollamaTimeout: number;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
  ) {
    this.ollamaUrl = this.config.get<string>('ai.ollamaUrl', 'http://localhost:11434');
    this.ollamaModel = this.config.get<string>('ai.ollamaModel', 'qwen2.5:7b');
    this.ollamaTimeout = (this.config.get<number>('ai.modelTimeout', 30) as number) * 1000;
  }

  async chat(req: StylistRequest): Promise<StylistReply> {
    const catalogSnippet = await this.buildCatalogSnippet(req);
    const userPrefs = await this.buildUserPrefs(req.userId);

    const messages = [
      { role: 'system', content: STYLIST_SYSTEM_PROMPT },
      { role: 'system', content: `Catalogue partiel (utilise uniquement ces IDs) :\n${catalogSnippet}` },
    ];
    if (userPrefs) messages.push({ role: 'system', content: userPrefs });
    (req.history || []).forEach((t) => messages.push({ role: t.role, content: t.content }));
    messages.push({ role: 'user', content: req.message });

    let rawText: string;
    try {
      rawText = await this.callOllama(messages);
    } catch (err) {
      this.logger.warn(`Ollama call failed: ${(err as any)?.message || err}`);
      return this.fallbackReply(req);
    }

    return this.parseReply(rawText);
  }

  private async callOllama(messages: any[]): Promise<string> {
    const url = `${this.ollamaUrl}/api/chat`;
    const body = {
      model: this.ollamaModel,
      messages,
      stream: false,
      options: { temperature: 0.55 },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.ollamaTimeout),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const data: any = await res.json();
    return data?.message?.content || '';
  }

  private async buildCatalogSnippet(req: StylistRequest): Promise<string> {
    // Fetch a small relevant slice: products matching message keywords + budget + active.
    const keywords = req.message.toLowerCase().split(/\s+/).filter((w) => w.length >= 3).slice(0, 8);
    const qb = this.productRepo.createQueryBuilder('p').where('p.is_active = :a', { a: true });
    if (keywords.length > 0) {
      qb.andWhere('(' + keywords.map((_, i) => `LOWER(p.title) LIKE :k${i} OR LOWER(p.description) LIKE :k${i}`).join(' OR ') + ')',
        Object.fromEntries(keywords.map((k, i) => [`k${i}`, `%${k}%`])));
    }
    if (req.context?.budget) qb.andWhere('p.current_price <= :b', { b: req.context.budget });
    qb.orderBy('p.view_count', 'DESC').take(15);
    const products = await qb.getMany();
    return products.map((p) =>
      `- id=${p.id} | "${p.title}" | ${(p as any).currentPrice} TND | stock=${(p as any).totalStock}`
    ).join('\n');
  }

  private async buildUserPrefs(userId: number | null): Promise<string | null> {
    if (!userId) return null;
    const recentOrders = await this.orderRepo.find({
      where: { user_id: userId },
      relations: ['items'],
      order: { created_at: 'DESC' },
      take: 5,
    });
    if (recentOrders.length === 0) return null;
    const titles: string[] = [];
    for (const o of recentOrders) {
      for (const it of (o.items || [])) {
        if ((it as any).title) titles.push((it as any).title);
      }
    }
    if (titles.length === 0) return null;
    return `Historique d'achat récent du client (pour personnaliser) : ${titles.slice(0, 10).join(', ')}.`;
  }

  private fallbackReply(req: StylistRequest): StylistReply {
    return {
      reply: "Je rencontre une difficulté technique. En attendant : pouvez-vous me dire l'occasion (bureau / soirée / plage) et votre budget approximatif ?",
      suggestions: [],
      followUpQuestions: ['Quelle est l\'occasion ?', 'Quel est votre budget ?'],
    };
  }

  private async parseReply(raw: string): Promise<StylistReply> {
    const jsonMatch = raw.match(/<STYLIST_JSON>([\s\S]*?)<\/STYLIST_JSON>/i);
    let productIds: number[] = [];
    let followUps: string[] = [];
    if (jsonMatch) {
      try {
        const j = JSON.parse(jsonMatch[1]);
        if (Array.isArray(j.product_ids)) productIds = j.product_ids.filter((x: any) => Number.isInteger(x)).slice(0, 6);
        if (Array.isArray(j.follow_ups)) followUps = j.follow_ups.slice(0, 3).map(String);
      } catch { /* malformed — treat as no ids */ }
    }
    const cleanText = raw.replace(/<STYLIST_JSON>[\s\S]*?<\/STYLIST_JSON>/gi, '').trim();

    let suggestions: StylistReply['suggestions'] = [];
    if (productIds.length > 0) {
      const products = await this.productRepo.find({ where: { id: In(productIds) } });
      const byId = new Map(products.map((p) => [p.id, p]));
      suggestions = productIds
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((p) => ({
          productId: p!.id,
          title: p!.title,
          price: Number((p as any).currentPrice || 0),
          image: (p as any).firstImageUrl || null,
          reason: 'Recommandé par votre styliste IA',
        }));
    }

    return { reply: cleanText, suggestions, followUpQuestions: followUps };
  }
}
