import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThan, Between } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Category } from '../categories/entities/category.entity';
import {
  EditorialRecommendation,
  RecommendationStrategy,
} from './entities/recommendation.entity';
import {
  RecommendationItemResponse,
  RecommendationResponse,
} from './dto/recommendation.dto';

// ─── Fashion semantic groups ───────────────────────────────────────
const FASHION_GROUPS: Record<string, string[]> = {
  TOPS: ['t-shirt', 'chemise', 'blouse', 'pull', 'sweat', 'veste', 'blouson'],
  BOTTOMS: ['pantalon', 'jean', 'short', 'jupe'],
  DRESSES: ['robe'],
  OUTERWEAR: ['manteau', 'veste', 'blouson', 'parka'],
  FOOTWEAR: ['chaussure', 'basket', 'botte', 'sandale'],
  BAGS: ['sac'],
  ACCESSORIES: ['ceinture', 'echarpe', 'chapeau', 'bijou', 'montre', 'lunette'],
};

// Cross-category complement map: if source product is in group X, suggest from groups Y
const COMPLEMENT_MAP: Record<string, string[]> = {
  TOPS: ['BOTTOMS', 'ACCESSORIES', 'FOOTWEAR', 'BAGS'],
  BOTTOMS: ['TOPS', 'FOOTWEAR', 'ACCESSORIES'],
  DRESSES: ['ACCESSORIES', 'FOOTWEAR', 'BAGS', 'OUTERWEAR'],
  OUTERWEAR: ['TOPS', 'BOTTOMS', 'ACCESSORIES'],
  FOOTWEAR: ['BAGS', 'ACCESSORIES'],
  BAGS: ['ACCESSORIES', 'FOOTWEAR'],
  ACCESSORIES: ['TOPS', 'DRESSES', 'BAGS'],
};

// Color harmony (complementary pairs)
const COLOR_COMPLEMENTS: Record<string, string[]> = {
  noir: ['blanc', 'rouge', 'or', 'argent', 'beige'],
  blanc: ['noir', 'bleu', 'rouge', 'marine'],
  rouge: ['noir', 'blanc', 'gris', 'marine'],
  bleu: ['blanc', 'beige', 'camel', 'orange'],
  marine: ['blanc', 'rouge', 'beige', 'or'],
  vert: ['blanc', 'beige', 'marron', 'or'],
  rose: ['gris', 'blanc', 'noir', 'marine'],
  beige: ['noir', 'marine', 'marron', 'blanc'],
  gris: ['rose', 'rouge', 'blanc', 'noir'],
  marron: ['beige', 'vert', 'blanc', 'or'],
  camel: ['bleu', 'blanc', 'noir', 'marine'],
  or: ['noir', 'marine', 'vert', 'marron'],
  argent: ['noir', 'blanc', 'bleu', 'rose'],
  orange: ['bleu', 'marine', 'blanc', 'noir'],
  jaune: ['bleu', 'marine', 'gris', 'noir'],
  violet: ['blanc', 'gris', 'or', 'beige'],
};

// Season → category/tag keywords
const SEASON_KEYWORDS: Record<string, string[]> = {
  winter: ['manteau', 'pull', 'sweat', 'parka', 'botte', 'echarpe', 'laine', 'chaud'],
  spring: ['veste', 'chemise', 'blouse', 'robe', 'basket', 'leger'],
  summer: ['t-shirt', 'short', 'robe', 'sandale', 'chapeau', 'maillot', 'lin'],
  autumn: ['blouson', 'pull', 'jean', 'botte', 'veste', 'echarpe'],
};

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  // Simple in-memory cache with TTL
  private cache = new Map<string, { data: RecommendationResponse; expires: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private readonly aiServiceUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(EditorialRecommendation)
    private readonly editorialRepo: Repository<EditorialRecommendation>,
  ) {
    this.aiServiceUrl = this.configService.get<string>('ai.aiServiceUrl', 'http://localhost:8001');
  }

  /**
   * Proxy to the Python AI service for advanced recommendation strategies.
   * Falls back to local NestJS implementation if the service is unreachable.
   */
  async getFromAiService(
    strategy: string,
    options: Record<string, any> = {},
  ): Promise<RecommendationItemResponse[] | null> {
    try {
      const params = new URLSearchParams();
      if (options.productId) params.set('product_id', String(options.productId));
      if (options.userId) params.set('user_id', String(options.userId));
      if (options.limit) params.set('limit', String(options.limit));
      if (options.context) params.set('context', options.context);

      const url = `${this.aiServiceUrl}/api/recommendations/${strategy}?${params}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(3000), // 3s timeout - don't slow down page loads
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data.recommendations || data.items || [];
    } catch (error) {
      // Expected when AI service is not running - local fallback handles this
      this.logger.debug(`AI service not available, using local recommendations: ${error.message}`);
      return null;
    }
  }

  // ─── Main dispatcher ─────────────────────────────────────────────
  async getRecommendations(
    strategy: RecommendationStrategy,
    options: {
      productId?: number;
      categoryId?: number;
      limit?: number;
      context?: string;
      userId?: number;
      viewedProductIds?: number[];
      purchasedProductIds?: number[];
      preferredCategoryIds?: number[];
    } = {},
  ): Promise<RecommendationResponse> {
    const limit = options.limit || 12;
    const cacheKey = `${strategy}:${JSON.stringify(options)}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return { ...cached.data, metadata: { ...cached.data.metadata, cached: true } };
    }

    let items: RecommendationItemResponse[];

    // Try Python AI service first for advanced strategies
    const aiItems = await this.getFromAiService(strategy, { ...options, limit });
    if (aiItems && aiItems.length > 0) {
      items = aiItems;
    } else {
      // Local NestJS fallback implementation
      switch (strategy) {
        case RecommendationStrategy.SIMILAR:
          items = await this.getSimilarProducts(options.productId, limit);
          break;
        case RecommendationStrategy.COMPLEMENTARY:
          items = await this.getComplementaryProducts(options.productId, limit);
          break;
        case RecommendationStrategy.TRENDING:
          items = await this.getTrendingProducts(limit);
          break;
        case RecommendationStrategy.NEW_ARRIVALS:
          items = await this.getNewArrivals(limit);
          break;
        case RecommendationStrategy.SEASONAL:
          items = await this.getSeasonalProducts(limit);
          break;
        case RecommendationStrategy.EDITORIAL:
          items = await this.getEditorialRecommendations(options.context, limit);
          break;
        case RecommendationStrategy.FREQUENTLY_BOUGHT_TOGETHER:
          items = await this.getFrequentlyBoughtTogether(options.productId, limit);
          break;
        case RecommendationStrategy.PREMIUM_ALTERNATIVE:
          items = await this.getPremiumAlternatives(options.productId, limit);
          break;
        case RecommendationStrategy.AFFORDABLE_ALTERNATIVE:
          items = await this.getAffordableAlternatives(options.productId, limit);
          break;
        case RecommendationStrategy.PERSONALIZED:
          items = await this.getPersonalizedRecommendations(
            {
              viewedProductIds: options.viewedProductIds || [],
              purchasedProductIds: options.purchasedProductIds || [],
              preferredCategoryIds: options.preferredCategoryIds || [],
            },
            limit,
          );
          break;
        default:
          items = [];
      }
    }

    const response: RecommendationResponse = {
      recommendations: items,
      metadata: {
        strategy,
        count: items.length,
        cached: false,
      },
    };

    // Store in cache
    this.cache.set(cacheKey, { data: response, expires: Date.now() + this.CACHE_TTL });

    return response;
  }

  // ─── SIMILAR ──────────────────────────────────────────────────────
  private async getSimilarProducts(
    productId: number | undefined,
    limit: number,
  ): Promise<RecommendationItemResponse[]> {
    if (!productId) return [];

    const source = await this.productRepo.findOne({
      where: { id: productId },
      relations: ['categories', 'variants'],
    });
    if (!source) return [];

    const categoryIds = source.categories?.map((c) => c.id) || [];
    const sourceColors = this.extractColors(source);
    const priceMin = Number(source.price) * 0.5;
    const priceMax = Number(source.price) * 1.5;

    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.categories', 'cat')
      .leftJoinAndSelect('p.variants', 'v')
      .where('p.id != :pid', { pid: productId })
      .andWhere('p.is_active = :active', { active: true });

    const candidates = await qb.take(200).getMany();

    const scored = candidates.map((p) => {
      let score = 0;
      const reasons: string[] = [];

      // Category match
      const pCatIds = p.categories?.map((c) => c.id) || [];
      const catOverlap = pCatIds.filter((id) => categoryIds.includes(id)).length;
      if (catOverlap > 0) {
        score += catOverlap * 25;
        reasons.push('same category');
      }

      // Famille match
      if (p.famille && p.famille === source.famille) {
        score += 15;
        reasons.push('same famille');
      }

      // Color overlap
      const pColors = this.extractColors(p);
      const colorOverlap = pColors.filter((c) => sourceColors.includes(c)).length;
      if (colorOverlap > 0) {
        score += colorOverlap * 10;
        reasons.push('matching colors');
      }

      // Price range proximity
      const pPrice = Number(p.currentPrice || p.price);
      if (pPrice >= priceMin && pPrice <= priceMax) {
        const priceProximity = 1 - Math.abs(pPrice - Number(source.price)) / Number(source.price);
        score += Math.round(priceProximity * 20);
        reasons.push('similar price range');
      }

      // Tags overlap
      if (source.tags?.length && p.tags?.length) {
        const tagOverlap = p.tags.filter((t) => source.tags.includes(t)).length;
        score += tagOverlap * 5;
        if (tagOverlap > 0) reasons.push('shared tags');
      }

      return {
        product: p,
        score: Math.min(score, 100),
        reason: reasons.join(', ') || 'related product',
      };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s, idx) => ({
        id: idx + 1,
        product_id: s.product.id,
        score: s.score,
        reason: s.reason,
        strategy: RecommendationStrategy.SIMILAR,
      }));
  }

  // ─── COMPLEMENTARY ────────────────────────────────────────────────
  private async getComplementaryProducts(
    productId: number | undefined,
    limit: number,
  ): Promise<RecommendationItemResponse[]> {
    if (!productId) return [];

    const source = await this.productRepo.findOne({
      where: { id: productId },
      relations: ['categories', 'variants'],
    });
    if (!source) return [];

    // Determine the source group
    const sourceGroup = this.detectFashionGroup(source);
    if (!sourceGroup) {
      // Fallback: return similar products
      return this.getSimilarProducts(productId, limit);
    }

    const targetGroups = COMPLEMENT_MAP[sourceGroup] || [];
    const targetKeywords = targetGroups.flatMap((g) => FASHION_GROUPS[g] || []);
    const sourceColors = this.extractColors(source);
    const complementColors = sourceColors.flatMap((c) => COLOR_COMPLEMENTS[c.toLowerCase()] || []);

    const candidates = await this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.categories', 'cat')
      .leftJoinAndSelect('p.variants', 'v')
      .where('p.id != :pid', { pid: productId })
      .andWhere('p.is_active = :active', { active: true })
      .take(300)
      .getMany();

    const scored = candidates.map((p) => {
      let score = 0;
      const reasons: string[] = [];

      // Check if product belongs to a target fashion group
      const pGroup = this.detectFashionGroup(p);
      if (pGroup && targetGroups.includes(pGroup)) {
        score += 35;
        reasons.push(`complements ${sourceGroup.toLowerCase()} with ${pGroup.toLowerCase()}`);
      }

      // Title/category keyword matching against target keywords
      const pTitle = (p.title || '').toLowerCase();
      const pCatNames = (p.categories || []).map((c) => c.name.toLowerCase());
      const allText = [pTitle, ...pCatNames].join(' ');
      for (const kw of targetKeywords) {
        if (allText.includes(kw)) {
          score += 10;
          break;
        }
      }

      // Famille match (same audience)
      if (p.famille && p.famille === source.famille) {
        score += 10;
        reasons.push('same audience');
      }

      // Color harmony
      const pColors = this.extractColors(p);
      const harmonyColors = pColors.filter((c) =>
        complementColors.includes(c.toLowerCase()),
      );
      if (harmonyColors.length > 0) {
        score += 15;
        reasons.push('color harmony');
      }

      return {
        product: p,
        score: Math.min(score, 100),
        reason: reasons.join(', ') || 'complementary item',
      };
    });

    return scored
      .filter((s) => s.score > 10)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s, idx) => ({
        id: idx + 1,
        product_id: s.product.id,
        score: s.score,
        reason: s.reason,
        strategy: RecommendationStrategy.COMPLEMENTARY,
      }));
  }

  // ─── TRENDING ─────────────────────────────────────────────────────
  private async getTrendingProducts(limit: number): Promise<RecommendationItemResponse[]> {
    // Products sorted by (view_count + order_count * 5) in the recent period
    const products = await this.productRepo
      .createQueryBuilder('p')
      .where('p.is_active = :active', { active: true })
      .orderBy('(p.view_count + p.order_count * 5)', 'DESC')
      .take(limit)
      .getMany();

    return products.map((p, idx) => {
      const engagementScore = Math.min(
        100,
        Math.round(((Number(p.viewCount) + Number(p.orderCount) * 5) / 500) * 100),
      );
      return {
        id: idx + 1,
        product_id: p.id,
        score: engagementScore || 1,
        reason: `${p.viewCount} views, ${p.orderCount} orders`,
        strategy: RecommendationStrategy.TRENDING,
      };
    });
  }

  // ─── NEW ARRIVALS ─────────────────────────────────────────────────
  private async getNewArrivals(limit: number): Promise<RecommendationItemResponse[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const products = await this.productRepo.find({
      where: { isActive: true, createdAt: MoreThan(thirtyDaysAgo) },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    // Fallback to isNew flag if no recent products
    if (products.length === 0) {
      const newProducts = await this.productRepo.find({
        where: { isActive: true, isNew: true },
        order: { createdAt: 'DESC' },
        take: limit,
      });
      return newProducts.map((p, idx) => ({
        id: idx + 1,
        product_id: p.id,
        score: 80,
        reason: 'marked as new',
        strategy: RecommendationStrategy.NEW_ARRIVALS,
      }));
    }

    return products.map((p, idx) => {
      const daysOld = Math.max(
        1,
        Math.floor((Date.now() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      );
      const freshnessScore = Math.max(10, 100 - daysOld * 3);
      return {
        id: idx + 1,
        product_id: p.id,
        score: freshnessScore,
        reason: `added ${daysOld} day(s) ago`,
        strategy: RecommendationStrategy.NEW_ARRIVALS,
      };
    });
  }

  // ─── SEASONAL ─────────────────────────────────────────────────────
  private async getSeasonalProducts(limit: number): Promise<RecommendationItemResponse[]> {
    const season = this.getCurrentSeason();
    const keywords = SEASON_KEYWORDS[season] || [];

    const products = await this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.categories', 'cat')
      .where('p.is_active = :active', { active: true })
      .take(300)
      .getMany();

    const scored = products.map((p) => {
      let score = 0;
      const titleLower = (p.title || '').toLowerCase();
      const catNames = (p.categories || []).map((c) => c.name.toLowerCase()).join(' ');
      const tagsStr = (p.tags || []).join(' ').toLowerCase();
      const allText = `${titleLower} ${catNames} ${tagsStr}`;

      for (const kw of keywords) {
        if (allText.includes(kw)) {
          score += 15;
        }
      }

      return { product: p, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s, idx) => ({
        id: idx + 1,
        product_id: s.product.id,
        score: Math.min(s.score, 100),
        reason: `perfect for ${season}`,
        strategy: RecommendationStrategy.SEASONAL,
      }));
  }

  // ─── EDITORIAL ────────────────────────────────────────────────────
  private async getEditorialRecommendations(
    context: string | undefined,
    limit: number,
  ): Promise<RecommendationItemResponse[]> {
    const qb = this.editorialRepo
      .createQueryBuilder('e')
      .where('e.is_active = :active', { active: true });

    if (context) {
      qb.andWhere('(e.context = :context OR e.context IS NULL)', { context });
    }

    const now = new Date();
    qb.andWhere('(e.start_date IS NULL OR e.start_date <= :now)', { now });
    qb.andWhere('(e.end_date IS NULL OR e.end_date >= :now)', { now });
    qb.orderBy('e.position', 'ASC');

    const editorials = await qb.getMany();

    const allProductIds = editorials.flatMap((e) => e.productIds || []);
    const uniqueIds = [...new Set(allProductIds)].slice(0, limit);

    return uniqueIds.map((pid, idx) => ({
      id: idx + 1,
      product_id: pid,
      score: 90 - idx,
      reason: 'editor pick',
      strategy: RecommendationStrategy.EDITORIAL,
    }));
  }

  // ─── FREQUENTLY BOUGHT TOGETHER ──────────────────────────────────
  private async getFrequentlyBoughtTogether(
    productId: number | undefined,
    limit: number,
  ): Promise<RecommendationItemResponse[]> {
    if (!productId) return [];

    // Find orders containing this product
    const orderItems = await this.orderItemRepo.find({
      where: { product_id: productId },
      select: ['order_id'],
    });

    if (orderItems.length === 0) return [];

    const orderIds = [...new Set(orderItems.map((oi) => oi.order_id))];

    // Find other products in those orders
    const coItems = await this.orderItemRepo
      .createQueryBuilder('oi')
      .where('oi.order_id IN (:...orderIds)', { orderIds: orderIds.slice(0, 100) })
      .andWhere('oi.product_id != :pid', { pid: productId })
      .andWhere('oi.product_id IS NOT NULL')
      .getMany();

    // Count co-occurrence frequency
    const freqMap = new Map<number, number>();
    for (const item of coItems) {
      if (item.product_id) {
        freqMap.set(item.product_id, (freqMap.get(item.product_id) || 0) + 1);
      }
    }

    const sorted = [...freqMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    const maxFreq = sorted.length > 0 ? sorted[0][1] : 1;

    return sorted.map(([pid, freq], idx) => ({
      id: idx + 1,
      product_id: pid,
      score: Math.round((freq / maxFreq) * 100),
      reason: `bought together ${freq} time(s)`,
      strategy: RecommendationStrategy.FREQUENTLY_BOUGHT_TOGETHER,
    }));
  }

  // ─── PREMIUM ALTERNATIVE ─────────────────────────────────────────
  private async getPremiumAlternatives(
    productId: number | undefined,
    limit: number,
  ): Promise<RecommendationItemResponse[]> {
    if (!productId) return [];

    const source = await this.productRepo.findOne({
      where: { id: productId },
      relations: ['categories'],
    });
    if (!source) return [];

    const categoryIds = source.categories?.map((c) => c.id) || [];
    const sourcePrice = Number(source.currentPrice || source.price);

    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.categories', 'cat')
      .where('p.id != :pid', { pid: productId })
      .andWhere('p.is_active = :active', { active: true })
      .andWhere('COALESCE(p.current_price, p.price) > :minPrice', {
        minPrice: sourcePrice,
      });

    if (categoryIds.length > 0) {
      qb.andWhere('cat.id IN (:...catIds)', { catIds: categoryIds });
    }

    if (source.famille) {
      qb.andWhere('p.famille = :famille', { famille: source.famille });
    }

    qb.orderBy('COALESCE(p.current_price, p.price)', 'ASC').take(limit);

    const products = await qb.getMany();

    return products.map((p, idx) => {
      const pPrice = Number(p.currentPrice || p.price);
      const priceDiff = pPrice - sourcePrice;
      return {
        id: idx + 1,
        product_id: p.id,
        score: Math.max(10, 100 - Math.round((priceDiff / sourcePrice) * 50)),
        reason: `+${priceDiff.toFixed(2)} TND premium option`,
        strategy: RecommendationStrategy.PREMIUM_ALTERNATIVE,
      };
    });
  }

  // ─── AFFORDABLE ALTERNATIVE ───────────────────────────────────────
  private async getAffordableAlternatives(
    productId: number | undefined,
    limit: number,
  ): Promise<RecommendationItemResponse[]> {
    if (!productId) return [];

    const source = await this.productRepo.findOne({
      where: { id: productId },
      relations: ['categories'],
    });
    if (!source) return [];

    const categoryIds = source.categories?.map((c) => c.id) || [];
    const sourcePrice = Number(source.currentPrice || source.price);

    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.categories', 'cat')
      .where('p.id != :pid', { pid: productId })
      .andWhere('p.is_active = :active', { active: true })
      .andWhere('COALESCE(p.current_price, p.price) < :maxPrice', {
        maxPrice: sourcePrice,
      })
      .andWhere('COALESCE(p.current_price, p.price) > :floor', {
        floor: sourcePrice * 0.2,
      });

    if (categoryIds.length > 0) {
      qb.andWhere('cat.id IN (:...catIds)', { catIds: categoryIds });
    }

    if (source.famille) {
      qb.andWhere('p.famille = :famille', { famille: source.famille });
    }

    qb.orderBy('COALESCE(p.current_price, p.price)', 'DESC').take(limit);

    const products = await qb.getMany();

    return products.map((p, idx) => {
      const pPrice = Number(p.currentPrice || p.price);
      const savings = sourcePrice - pPrice;
      return {
        id: idx + 1,
        product_id: p.id,
        score: Math.min(100, Math.round((savings / sourcePrice) * 100) + 50),
        reason: `save ${savings.toFixed(2)} TND`,
        strategy: RecommendationStrategy.AFFORDABLE_ALTERNATIVE,
      };
    });
  }

  // ─── PERSONALIZED ─────────────────────────────────────────────────
  private async getPersonalizedRecommendations(
    profile: {
      viewedProductIds: number[];
      purchasedProductIds: number[];
      preferredCategoryIds: number[];
    },
    limit: number,
  ): Promise<RecommendationItemResponse[]> {
    const { viewedProductIds, purchasedProductIds, preferredCategoryIds } = profile;
    const excludeIds = [
      ...new Set([...viewedProductIds, ...purchasedProductIds]),
    ];

    // Gather category preferences from viewed/purchased products
    const allInteractionIds = [...viewedProductIds, ...purchasedProductIds].slice(0, 50);
    let derivedCategoryIds: number[] = [...preferredCategoryIds];

    if (allInteractionIds.length > 0) {
      const interactionProducts = await this.productRepo.find({
        where: { id: In(allInteractionIds) },
        relations: ['categories'],
      });

      for (const p of interactionProducts) {
        const catIds = (p.categories || []).map((c) => c.id);
        derivedCategoryIds.push(...catIds);
      }
    }

    // Count category frequency to weight preferences
    const catFreq = new Map<number, number>();
    for (const cid of derivedCategoryIds) {
      catFreq.set(cid, (catFreq.get(cid) || 0) + 1);
    }

    // Gather famille preferences
    const famillePrefs = new Map<string, number>();
    if (allInteractionIds.length > 0) {
      const products = await this.productRepo.find({
        where: { id: In(allInteractionIds) },
      });
      for (const p of products) {
        if (p.famille) {
          famillePrefs.set(p.famille, (famillePrefs.get(p.famille) || 0) + 1);
        }
      }
    }

    // Fetch candidate products
    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.categories', 'cat')
      .where('p.is_active = :active', { active: true });

    if (excludeIds.length > 0) {
      qb.andWhere('p.id NOT IN (:...excludeIds)', { excludeIds });
    }

    const candidates = await qb.take(300).getMany();

    const scored = candidates.map((p) => {
      let score = 0;
      const reasons: string[] = [];

      // Category affinity
      const pCatIds = (p.categories || []).map((c) => c.id);
      for (const cid of pCatIds) {
        const freq = catFreq.get(cid) || 0;
        if (freq > 0) {
          score += freq * 10;
          reasons.push('matches your interests');
        }
      }

      // Famille affinity
      if (p.famille && famillePrefs.has(p.famille)) {
        score += (famillePrefs.get(p.famille) || 0) * 8;
        reasons.push('preferred collection');
      }

      // Popularity boost
      score += Math.min(20, (Number(p.orderCount) || 0) * 2);

      // New product boost
      if (p.isNew) {
        score += 5;
        reasons.push('new arrival');
      }

      // Featured boost
      if (p.isFeatured) {
        score += 5;
      }

      return {
        product: p,
        score: Math.min(score, 100),
        reason: [...new Set(reasons)].join(', ') || 'recommended for you',
      };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s, idx) => ({
        id: idx + 1,
        product_id: s.product.id,
        score: s.score,
        reason: s.reason,
        strategy: RecommendationStrategy.PERSONALIZED,
      }));
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private extractColors(product: Product): string[] {
    const colors: string[] = [];
    if (product.variants) {
      for (const v of product.variants) {
        if (v.couleur) {
          colors.push(v.couleur.toLowerCase());
        }
      }
    }
    // Also check title for color keywords
    const titleLower = (product.title || '').toLowerCase();
    for (const color of Object.keys(COLOR_COMPLEMENTS)) {
      if (titleLower.includes(color)) {
        colors.push(color);
      }
    }
    return [...new Set(colors)];
  }

  private detectFashionGroup(product: Product): string | null {
    const titleLower = (product.title || '').toLowerCase();
    const catNames = (product.categories || []).map((c) => c.name.toLowerCase());
    const tagsLower = (product.tags || []).map((t) => t.toLowerCase());
    const allText = [titleLower, ...catNames, ...tagsLower].join(' ');

    for (const [group, keywords] of Object.entries(FASHION_GROUPS)) {
      for (const kw of keywords) {
        if (allText.includes(kw)) {
          return group;
        }
      }
    }
    return null;
  }

  private getCurrentSeason(): string {
    const month = new Date().getMonth() + 1; // 1-12
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
  }
}
