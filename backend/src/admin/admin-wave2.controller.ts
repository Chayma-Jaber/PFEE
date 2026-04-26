/**
 * Wave 2 — 20 advanced real-work modules.
 * All admin-facing endpoints are grouped in one controller to keep the app
 * module graph tight. Storefront-facing endpoints live in StorefrontExtrasController.
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, Not, IsNull, In } from 'typeorm';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

import { Product } from '../products/entities/product.entity';
import { Order, OrderStatus, PaymentStatus } from '../orders/entities/order.entity';
import { FunnelEvent } from '../analytics/entities/funnel-event.entity';
import { StockMovement } from '../analytics/entities/stock-movement.entity';
import { CannedResponse } from '../support/entities/canned-response.entity';
import { SearchSynonym } from '../search/entities/search-synonym.entity';
import { NewsletterCampaign } from '../newsletter/entities/newsletter-campaign.entity';

@Controller('admin/wave2')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class AdminWave2Controller {
  constructor(
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(FunnelEvent) private readonly funnelRepo: Repository<FunnelEvent>,
    @InjectRepository(StockMovement) private readonly stockMovRepo: Repository<StockMovement>,
    @InjectRepository(CannedResponse) private readonly cannedRepo: Repository<CannedResponse>,
    @InjectRepository(SearchSynonym) private readonly synonymRepo: Repository<SearchSynonym>,
    @InjectRepository(NewsletterCampaign) private readonly campaignRepo: Repository<NewsletterCampaign>,
  ) {}

  // ═══ 8. TRENDING PRODUCTS ═══════════════════════════════════════════
  @Get('trending')
  async trending(
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
  ) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Rank by recent orders ordering; fallback to view_count if no orders
    const rows = await this.productRepo
      .createQueryBuilder('p')
      .leftJoin('order_items', 'oi', 'oi.product_id = p.id')
      .leftJoin('orders', 'o', 'o.id = oi.order_id AND o.created_at >= :since', { since })
      .select('p.id', 'id')
      .addSelect('p.title', 'title')
      .addSelect('p.sku', 'sku')
      .addSelect('p.first_image_url', 'firstImageUrl')
      .addSelect('p.current_price', 'currentPrice')
      .addSelect('COUNT(oi.id)', 'recentOrders')
      .addSelect('p.view_count', 'viewCount')
      .where('p.is_active = :a', { a: true })
      .groupBy('p.id')
      .addGroupBy('p.title')
      .addGroupBy('p.sku')
      .addGroupBy('p.first_image_url')
      .addGroupBy('p.current_price')
      .addGroupBy('p.view_count')
      .orderBy('COUNT(oi.id)', 'DESC')
      .addOrderBy('p.view_count', 'DESC')
      .limit(limit)
      .getRawMany();

    const items = rows.map((r, i) => ({
      rank: i + 1,
      id: Number(r.id),
      title: r.title,
      sku: r.sku,
      firstImageUrl: r.firstImageUrl,
      currentPrice: Number(r.currentPrice) || 0,
      recentOrders: Number(r.recentOrders) || 0,
      viewCount: Number(r.viewCount) || 0,
      trendingScore: Number(r.recentOrders) * 10 + Number(r.viewCount) * 0.1,
    }));

    return { items, windowDays: days };
  }

  // ═══ 13. LOW-STOCK REORDER SUGGESTIONS ═══════════════════════════════
  @Get('reorder-suggestions')
  async reorderSuggestions(@Query('threshold', new DefaultValuePipe(10), ParseIntPipe) threshold: number) {
    // Products with low stock, ranked by recent sales velocity
    const lowStock = await this.productRepo
      .createQueryBuilder('p')
      .leftJoin('order_items', 'oi', 'oi.product_id = p.id')
      .leftJoin('orders', 'o', 'o.id = oi.order_id AND o.created_at >= DATEADD(day, -30, GETDATE())')
      .select('p.id', 'id')
      .addSelect('p.title', 'title')
      .addSelect('p.sku', 'sku')
      .addSelect('p.total_stock', 'currentStock')
      .addSelect('p.first_image_url', 'firstImageUrl')
      .addSelect('COALESCE(SUM(oi.quantity), 0)', 'salesLast30Days')
      .where('p.is_active = :a', { a: true })
      .andWhere('p.total_stock <= :t', { t: threshold })
      .groupBy('p.id')
      .addGroupBy('p.title')
      .addGroupBy('p.sku')
      .addGroupBy('p.total_stock')
      .addGroupBy('p.first_image_url')
      .orderBy('COALESCE(SUM(oi.quantity), 0)', 'DESC')
      .limit(30)
      .getRawMany();

    const items = lowStock.map((r) => {
      const sold = Number(r.salesLast30Days) || 0;
      const current = Number(r.currentStock) || 0;
      const dailyVelocity = sold / 30;
      const daysLeft = dailyVelocity > 0 ? Math.floor(current / dailyVelocity) : null;
      const suggestedReorder = Math.max(10, Math.round(sold * 2)); // 2 months of sales
      return {
        id: Number(r.id),
        title: r.title,
        sku: r.sku,
        firstImageUrl: r.firstImageUrl,
        currentStock: current,
        salesLast30Days: sold,
        daysLeft,
        urgency: current === 0 ? 'CRITICAL' : (daysLeft != null && daysLeft <= 7 ? 'HIGH' : (daysLeft != null && daysLeft <= 14 ? 'MEDIUM' : 'LOW')),
        suggestedReorder,
      };
    });

    return { items, threshold };
  }

  // ═══ 14. IMAGE HEALTH CHECKER ════════════════════════════════════════
  @Get('image-health')
  async imageHealth() {
    const products = await this.productRepo.find();
    const missing: any[] = [];
    const placeholder: any[] = [];
    for (const p of products) {
      if (!p.firstImageUrl || p.firstImageUrl.trim() === '') {
        missing.push({ id: p.id, title: p.title, sku: p.sku });
      } else if (p.firstImageUrl.includes('placeholder')) {
        placeholder.push({ id: p.id, title: p.title, sku: p.sku, url: p.firstImageUrl });
      }
    }
    return {
      totalProducts: products.length,
      missingImages: missing.length,
      placeholderImages: placeholder.length,
      healthy: products.length - missing.length - placeholder.length,
      missing: missing.slice(0, 50),
      placeholder: placeholder.slice(0, 50),
    };
  }

  // ═══ 11. CANNED RESPONSES (support) ══════════════════════════════════
  @Get('canned-responses')
  async listCanned(@Query('category') category?: string) {
    const where: any = {};
    if (category) where.category = category;
    const items = await this.cannedRepo.find({ where, order: { usage_count: 'DESC', title: 'ASC' } });
    return { items };
  }

  @Post('canned-responses')
  async createCanned(@Body() body: { title: string; body: string; category?: string }) {
    if (!body.title || !body.body) throw new BadRequestException('title + body requis');
    const c = this.cannedRepo.create({
      title: body.title,
      body: body.body,
      category: body.category || null,
      is_active: true,
    });
    return this.cannedRepo.save(c);
  }

  @Put('canned-responses/:id')
  async updateCanned(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const c = await this.cannedRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException();
    if (body.title !== undefined) c.title = body.title;
    if (body.body !== undefined) c.body = body.body;
    if (body.category !== undefined) c.category = body.category;
    if (body.isActive !== undefined) c.is_active = body.isActive;
    return this.cannedRepo.save(c);
  }

  @Post('canned-responses/:id/use')
  async markUsed(@Param('id', ParseIntPipe) id: number) {
    const c = await this.cannedRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException();
    c.usage_count = (c.usage_count || 0) + 1;
    await this.cannedRepo.save(c);
    return { success: true, usageCount: c.usage_count };
  }

  @Delete('canned-responses/:id')
  async deleteCanned(@Param('id', ParseIntPipe) id: number) {
    const c = await this.cannedRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException();
    await this.cannedRepo.remove(c);
    return { success: true };
  }

  // ═══ 12. SEARCH SYNONYMS ═════════════════════════════════════════════
  @Get('synonyms')
  async listSynonyms() {
    const items = await this.synonymRepo.find({ order: { term: 'ASC' } });
    return { items };
  }

  @Post('synonyms')
  async createSynonym(@Body() body: { term: string; synonyms: string[] }) {
    if (!body.term || !Array.isArray(body.synonyms) || body.synonyms.length === 0) {
      throw new BadRequestException('term + synonyms[] requis');
    }
    const s = this.synonymRepo.create({
      term: body.term.toLowerCase().trim(),
      synonyms: body.synonyms.map((x) => String(x).toLowerCase().trim()),
      is_active: true,
    });
    return this.synonymRepo.save(s);
  }

  @Put('synonyms/:id')
  async updateSynonym(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const s = await this.synonymRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException();
    if (body.term !== undefined) s.term = String(body.term).toLowerCase().trim();
    if (Array.isArray(body.synonyms)) s.synonyms = body.synonyms.map((x: any) => String(x).toLowerCase().trim());
    if (body.isActive !== undefined) s.is_active = body.isActive;
    return this.synonymRepo.save(s);
  }

  @Delete('synonyms/:id')
  async deleteSynonym(@Param('id', ParseIntPipe) id: number) {
    const s = await this.synonymRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException();
    await this.synonymRepo.remove(s);
    return { success: true };
  }

  // ═══ 15. FEATURED ROTATION SCHEDULE ══════════════════════════════════
  @Post('featured/rotate')
  async rotateFeatured(@Body() body: { count?: number }) {
    const count = Number(body?.count) || 6;
    // Un-feature everything, then pick top N by view_count + rating
    await this.productRepo
      .createQueryBuilder()
      .update(Product)
      .set({ isFeatured: false })
      .where('is_featured = :v', { v: true })
      .execute();

    const candidates = await this.productRepo
      .createQueryBuilder('p')
      .where('p.is_active = :a', { a: true })
      .andWhere('p.total_stock > 0')
      .orderBy('p.view_count', 'DESC')
      .addOrderBy('p.order_count', 'DESC')
      .limit(count)
      .getMany();

    for (const p of candidates) {
      p.isFeatured = true;
      await this.productRepo.save(p);
    }

    return {
      success: true,
      featured: candidates.map((p) => ({ id: p.id, title: p.title, views: p.viewCount })),
    };
  }

  // ═══ 16. CONVERSION FUNNEL ANALYTICS ═════════════════════════════════
  @Get('funnel')
  async funnel(@Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const steps = [
      'VIEW_HOME',
      'VIEW_PRODUCT',
      'ADD_TO_CART',
      'START_CHECKOUT',
      'COMPLETE_PURCHASE',
      'EXIT_INTENT',
    ];

    const counts: Record<string, number> = {};
    for (const s of steps) {
      counts[s] = await this.funnelRepo
        .createQueryBuilder('f')
        .where('f.step = :s', { s })
        .andWhere('f.created_at >= :since', { since })
        .getCount();
    }

    const viewToCart = counts['VIEW_PRODUCT'] > 0
      ? Math.round((counts['ADD_TO_CART'] / counts['VIEW_PRODUCT']) * 1000) / 10
      : 0;
    const cartToCheckout = counts['ADD_TO_CART'] > 0
      ? Math.round((counts['START_CHECKOUT'] / counts['ADD_TO_CART']) * 1000) / 10
      : 0;
    const checkoutToPurchase = counts['START_CHECKOUT'] > 0
      ? Math.round((counts['COMPLETE_PURCHASE'] / counts['START_CHECKOUT']) * 1000) / 10
      : 0;
    const overall = counts['VIEW_HOME'] > 0
      ? Math.round((counts['COMPLETE_PURCHASE'] / counts['VIEW_HOME']) * 1000) / 10
      : 0;

    return {
      windowDays: days,
      steps: counts,
      rates: {
        viewProductToCart: viewToCart,
        cartToCheckout,
        checkoutToPurchase,
        overallConversion: overall,
      },
    };
  }

  // ═══ 17. AUTO-CANCEL STALE ORDERS ════════════════════════════════════
  @Post('orders/cancel-stale')
  async cancelStaleOrders(@Body() body: { olderThanHours?: number }) {
    const hours = Number(body?.olderThanHours) || 24;
    const threshold = new Date();
    threshold.setHours(threshold.getHours() - hours);

    const stale = await this.orderRepo.find({
      where: {
        status: OrderStatus.PENDING,
        created_at: LessThan(threshold),
      },
    });

    let cancelled = 0;
    for (const o of stale) {
      o.status = OrderStatus.CANCELLED;
      o.cancelled_at = new Date();
      o.cancel_reason = `Auto-cancelled: pending > ${hours}h`;
      await this.orderRepo.save(o);
      cancelled++;
    }
    return { success: true, cancelled, thresholdHours: hours };
  }

  // ═══ 18. AI PRODUCT DESCRIPTION GENERATOR ════════════════════════════
  @Post('products/:id/generate-description')
  async generateDescription(@Param('id', ParseIntPipe) id: number) {
    const p = await this.productRepo.findOne({ where: { id }, relations: ['categories'] });
    if (!p) throw new NotFoundException('Product not found');

    // Template-based generator (works without AI service); falls back if AI unavailable
    const familyLabel = { WOMEN: 'femme', MEN: 'homme', KIDS: 'enfant', UNISEX: 'mixte' }[p.famille] || 'mode';
    const categoriesList = (p.categories || []).map((c) => c.name).join(', ') || 'mode';
    const brandLine = p.brand ? ` signée ${p.brand}` : '';
    const priceLine = p.currentPrice ? `À ${Number(p.currentPrice).toFixed(2)} TND,` : '';

    const description =
      `Découvrez ce ${p.title}${brandLine}, une pièce ${familyLabel} incontournable de notre collection ${categoriesList}. ` +
      `${priceLine} ce produit combine qualité premium et style intemporel. ` +
      `Conçu avec des matériaux soigneusement sélectionnés, il s'adapte à toutes les occasions — ` +
      `casual au quotidien, ou plus habillé pour vos sorties. Livraison rapide en Tunisie.`;

    const metaTitle = `${p.title} — Mode ${familyLabel} chez Barsha`;
    const metaDescription = `Achetez ${p.title} chez Barsha. ${p.description?.substring(0, 80) || 'Pièce premium, confortable et élégante.'} Livraison Tunisie.`;

    // Optionally persist if requested
    if (!p.description) {
      p.description = description;
      p.metaTitle = metaTitle;
      p.metaDescription = metaDescription;
      await this.productRepo.save(p);
    }

    return {
      generated: true,
      description,
      metaTitle,
      metaDescription,
      persisted: !p.description || p.description === description,
    };
  }

  // ═══ 19. SEASONAL / COLLECTION TAGGING ═══════════════════════════════
  @Post('products/bulk-tag')
  async bulkTag(@Body() body: { productIds: number[]; addTags?: string[]; removeTags?: string[] }) {
    if (!Array.isArray(body.productIds) || body.productIds.length === 0) {
      throw new BadRequestException('productIds[] requis');
    }
    const products = await this.productRepo.find({ where: { id: In(body.productIds) } });
    let updated = 0;
    for (const p of products) {
      const tags = new Set((p.tags || []).map((t) => String(t).toLowerCase()));
      (body.addTags || []).forEach((t) => tags.add(String(t).toLowerCase().trim()));
      (body.removeTags || []).forEach((t) => tags.delete(String(t).toLowerCase().trim()));
      p.tags = Array.from(tags);
      await this.productRepo.save(p);
      updated++;
    }
    return { success: true, updated };
  }

  @Get('products/by-tag')
  async productsByTag(@Query('tag') tag: string) {
    if (!tag) throw new BadRequestException('tag requis');
    // simple-json column; must scan
    const all = await this.productRepo.find({ where: { isActive: true } });
    const items = all
      .filter((p) => Array.isArray(p.tags) && p.tags.some((t) => String(t).toLowerCase() === tag.toLowerCase()))
      .map((p) => ({ id: p.id, title: p.title, sku: p.sku, firstImageUrl: p.firstImageUrl }));
    return { tag, count: items.length, items: items.slice(0, 50) };
  }

  // ═══ 20. SCHEDULED CAMPAIGNS (STORE SCHEDULED_AT) ════════════════════
  @Post('campaigns/:id/schedule')
  async scheduleCampaign(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { sendAt: string },
  ) {
    const c = await this.campaignRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException();
    if (!body.sendAt) throw new BadRequestException('sendAt requis');
    c.status = 'SCHEDULED';
    c.sent_at = new Date(body.sendAt); // reuse sent_at as scheduled_at
    await this.campaignRepo.save(c);
    return { success: true, scheduledFor: c.sent_at };
  }

  @Get('campaigns/scheduled')
  async listScheduledCampaigns() {
    const items = await this.campaignRepo.find({
      where: { status: 'SCHEDULED' },
      order: { sent_at: 'ASC' },
    });
    return { items };
  }
}
