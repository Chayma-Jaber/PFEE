/**
 * Wave 3 — storefront public endpoints.
 * Also fills Wave 2 gaps: saved items move-back-to-cart, price snapshot on wishlist,
 * funnel metadata enrichment already supported.
 */
import {
  Controller,
  Get,
  Post,
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
import { Repository, In, MoreThan } from 'typeorm';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

import { HomepageBlock } from '../admin/entities/homepage-block.entity';
import { AbTest, AbTestEvent } from '../admin/entities/ab-test.entity';
import { ProductPosition } from '../admin/entities/product-position.entity';
import { Product } from '../products/entities/product.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { WishlistItem } from '../wishlist/entities/wishlist-item.entity';
import { LoyaltyAccount, LoyaltyTier } from '../loyalty/entities/loyalty-account.entity';
import { StyleProfile } from '../users/entities/style-profile.entity';
import { CartItem } from '../cart/entities/cart-item.entity';
import { StockAlert } from '../alerts/entities/stock-alert.entity';
import { Notification, NotificationType } from '../notifications/entities/notification.entity';
import { Bundle } from '../bundles/entities/bundle.entity';

@Controller('storefront/w3')
@SkipTransform()
export class StorefrontWave3Controller {
  constructor(
    @InjectRepository(HomepageBlock) private readonly blockRepo: Repository<HomepageBlock>,
    @InjectRepository(AbTest) private readonly testRepo: Repository<AbTest>,
    @InjectRepository(AbTestEvent) private readonly testEventRepo: Repository<AbTestEvent>,
    @InjectRepository(ProductPosition) private readonly posRepo: Repository<ProductPosition>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(WishlistItem) private readonly wishRepo: Repository<WishlistItem>,
    @InjectRepository(LoyaltyAccount) private readonly loyaltyRepo: Repository<LoyaltyAccount>,
    @InjectRepository(StyleProfile) private readonly styleRepo: Repository<StyleProfile>,
    @InjectRepository(CartItem) private readonly cartRepo: Repository<CartItem>,
    @InjectRepository(StockAlert) private readonly stockAlertRepo: Repository<StockAlert>,
    @InjectRepository(Notification) private readonly notifRepo: Repository<Notification>,
    @InjectRepository(Bundle) private readonly bundleRepo: Repository<Bundle>,
  ) {}

  // ═══ W3.1 — DYNAMIC HOMEPAGE BLOCKS (public read) ════════════════════
  @Get('homepage-blocks')
  async publicBlocks() {
    const now = new Date();
    const all = await this.blockRepo.find({
      where: { is_active: true },
      order: { position: 'ASC' },
    });
    // Filter by scheduled window
    const items = all.filter((b) =>
      (!b.start_at || new Date(b.start_at) <= now) && (!b.end_at || new Date(b.end_at) >= now),
    );
    return { items };
  }

  // ═══ W3.2 — A/B ASSIGN + TRACK ═══════════════════════════════════════
  @Get('ab/:key/assign')
  @UseGuards(OptionalAuthGuard)
  async assignVariant(
    @Param('key') key: string,
    @Query('sessionId') sessionId: string,
    @CurrentUser('id') userId?: number,
  ) {
    const test = await this.testRepo.findOne({ where: { key, is_active: true } });
    if (!test) return { assigned: false, variantId: null };

    // Sticky assignment by sessionId/userId hash
    const seed = (userId || sessionId || 'anon') + '|' + key;
    const hash = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0);
    const variants = test.variants || [];
    const totalWeight = variants.reduce((s, v) => s + (v.weight || 1), 0);
    const point = hash % Math.max(1, totalWeight);
    let acc = 0;
    let chosen = variants[0];
    for (const v of variants) {
      acc += v.weight || 1;
      if (point < acc) { chosen = v; break; }
    }
    // Record impression
    try {
      await this.testEventRepo.save(this.testEventRepo.create({
        test_key: key,
        variant_id: chosen.id,
        kind: 'IMPRESSION',
        user_id: userId || null,
        session_id: sessionId || null,
      }));
    } catch {}

    return { assigned: true, variantId: chosen.id, variant: chosen };
  }

  @Post('ab/:key/goal')
  @UseGuards(OptionalAuthGuard)
  async trackGoal(
    @Param('key') key: string,
    @Body() body: { variantId: string; sessionId?: string },
    @CurrentUser('id') userId?: number,
  ) {
    if (!body?.variantId) throw new BadRequestException('variantId required');
    await this.testEventRepo.save(this.testEventRepo.create({
      test_key: key,
      variant_id: body.variantId,
      kind: 'GOAL',
      user_id: userId || null,
      session_id: body.sessionId || null,
    }));
    return { tracked: true };
  }

  // ═══ W3.4 — AI "COMPLETE THIS OUTFIT" ═════════════════════════════════
  @Get('complete-outfit/:productId')
  @UseGuards(OptionalAuthGuard)
  async completeOutfit(
    @Param('productId', ParseIntPipe) productId: number,
    @CurrentUser('id') userId?: number,
  ) {
    const base = await this.productRepo.findOne({ where: { id: productId }, relations: ['categories'] });
    if (!base) throw new NotFoundException('Product not found');

    // Strategy: bundles that contain this product, else complementary-family items
    const bundles = await this.bundleRepo
      .createQueryBuilder('b')
      .innerJoin('bundle_items', 'bi', 'bi.bundle_id = b.id')
      .where('bi.product_id = :pid', { pid: productId })
      .andWhere('b.is_active = :a', { a: true })
      .limit(3)
      .getMany();

    const style = userId ? await this.styleRepo.findOne({ where: { user_id: userId } }) : null;

    // Find complementary products: same famille, different categories
    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.categories', 'c')
      .where('p.is_active = :a', { a: true })
      .andWhere('p.id != :pid', { pid: productId })
      .andWhere('p.famille = :fam', { fam: base.famille || 'UNISEX' })
      .orderBy('p.view_count', 'DESC');

    if (style?.budget_range === 'economy') qb.andWhere('p.current_price <= 50');
    else if (style?.budget_range === 'premium' || style?.budget_range === 'luxury') qb.andWhere('p.current_price >= 80');

    const candidates = await qb.limit(12).getMany();

    // Diversify: prefer products with at least one different category,
    // but if that filter empties the result, fall back to any candidate.
    const baseCategoryIds = new Set((base.categories || []).map((c) => c.id));
    let outfit = candidates.filter((p) => {
      const cats = p.categories || [];
      if (cats.length === 0) return true; // uncategorized products allowed
      return cats.some((c) => !baseCategoryIds.has(c.id));
    }).slice(0, 4);
    if (outfit.length === 0) outfit = candidates.slice(0, 4);

    return {
      base: { id: base.id, title: base.title, firstImageUrl: base.firstImageUrl, currentPrice: base.currentPrice },
      bundles: bundles.map((b) => ({ id: b.id, name: b.name, bundlePrice: b.bundle_price, imageUrl: b.image_url })),
      outfit: outfit.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        firstImageUrl: p.firstImageUrl,
        currentPrice: Number(p.currentPrice),
      })),
      reason: style ? `Sélectionné pour votre style ${style.style || ''}`.trim() : 'Ce look va bien ensemble',
    };
  }

  // ═══ W3.6 — CHECKOUT CROSS-SELL ══════════════════════════════════════
  @Post('cross-sell')
  async crossSell(@Body() body: { productIds: number[]; limit?: number }) {
    const ids = Array.isArray(body?.productIds) ? body.productIds.map(Number).filter(Boolean) : [];
    const limit = Math.min(8, Number(body?.limit) || 4);
    if (ids.length === 0) return { items: [] };

    // Find orders that contain any of these products → what else did they contain?
    const coOccurRows = await this.orderItemRepo
      .createQueryBuilder('oi')
      .innerJoin('order_items', 'oi2', 'oi2.order_id = oi.order_id')
      .select('oi2.product_id', 'productId')
      .addSelect('COUNT(DISTINCT oi.order_id)', 'score')
      .where('oi.product_id IN (:...ids)', { ids })
      .andWhere('oi2.product_id NOT IN (:...ids)', { ids })
      .andWhere('oi2.product_id IS NOT NULL')
      .groupBy('oi2.product_id')
      .orderBy('COUNT(DISTINCT oi.order_id)', 'DESC')
      .limit(limit * 2)
      .getRawMany();

    const pids = coOccurRows.map((r) => Number(r.productId)).filter(Boolean);
    if (pids.length === 0) return { items: [] };

    const products = await this.productRepo.find({ where: { id: In(pids), isActive: true } });
    const byId = new Map<number, Product>();
    products.forEach((p) => byId.set(p.id, p));

    const items = coOccurRows
      .map((r) => byId.get(Number(r.productId)))
      .filter(Boolean)
      .slice(0, limit)
      .map((p: any) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        firstImageUrl: p.firstImageUrl,
        currentPrice: Number(p.currentPrice),
      }));

    return { items };
  }

  // ═══ W3.10 — LOYALTY GAMIFICATION / TIER PROGRESS ════════════════════
  @Get('loyalty/progress')
  @UseGuards(JwtAuthGuard)
  async tierProgress(@CurrentUser('id') userId: number) {
    const acc = await this.loyaltyRepo.findOne({ where: { user_id: userId } });
    const lifetime = acc?.lifetime_points || 0;
    const tier = (acc?.tier || 'BRONZE') as string;

    const THRESHOLDS: Record<string, { min: number; next: string | null; nextMin: number | null }> = {
      BRONZE: { min: 0, next: 'SILVER', nextMin: 2000 },
      SILVER: { min: 2000, next: 'GOLD', nextMin: 5000 },
      GOLD: { min: 5000, next: 'PLATINUM', nextMin: 10000 },
      PLATINUM: { min: 10000, next: null, nextMin: null },
    };
    const info = THRESHOLDS[tier] || THRESHOLDS.BRONZE;
    const next = info.next;
    const nextMin = info.nextMin;
    const progressPct = nextMin ? Math.min(100, Math.round(((lifetime - info.min) / (nextMin - info.min)) * 100)) : 100;
    const pointsToNext = nextMin ? Math.max(0, nextMin - lifetime) : 0;

    const UNLOCKS: Record<string, string[]> = {
      SILVER: ['Points x1.25', 'Livraison gratuite dès 120 TND', 'Coupon anniversaire -15%'],
      GOLD: ['Points x1.5', 'Livraison gratuite', 'Accès soldes 24h en avance', 'Retours gratuits'],
      PLATINUM: ['Points x2', 'Livraison express gratuite', 'Accès soldes 48h en avance', 'Styliste personnel'],
    };

    return {
      tier,
      lifetimePoints: lifetime,
      availablePoints: acc?.available_points || 0,
      nextTier: next,
      pointsToNext,
      progressPct,
      nextUnlocks: next ? UNLOCKS[next] || [] : [],
    };
  }

  // ═══ W2-Gap: SAVED ITEMS MOVE-BACK-TO-CART ═══════════════════════════
  // (move-to-cart endpoint already exists in storefront-extras at /storefront/cart/:id/move-to-cart;
  //  re-expose a friendlier listing with product details here)
  @Get('saved-cart')
  @UseGuards(JwtAuthGuard)
  async listSaved(@CurrentUser('id') userId: number) {
    const items = await this.cartRepo.find({
      where: { user_id: userId, saved_for_later: true },
      order: { added_at: 'DESC' },
    });
    const pids = items.map((i) => i.product_id);
    const products = pids.length ? await this.productRepo.find({ where: { id: In(pids) } }) : [];
    const byId = new Map<number, Product>();
    products.forEach((p) => byId.set(p.id, p));
    return {
      items: items.map((i) => {
        const p = byId.get(i.product_id);
        return {
          itemId: i.id,
          productId: i.product_id,
          quantity: i.quantity,
          title: p?.title,
          slug: p?.slug,
          firstImageUrl: p?.firstImageUrl,
          currentPrice: Number(p?.currentPrice || 0),
        };
      }),
    };
  }

  // ═══ W2-Gap: Price-snapshot on wishlist ADD ═══════════════════════════
  @Post('wishlist/track-price')
  @UseGuards(JwtAuthGuard)
  async trackWishlistPrice(
    @CurrentUser('id') userId: number,
    @Body() body: { productId: number },
  ) {
    if (!body?.productId) throw new BadRequestException();
    const existing = await this.wishRepo.findOne({ where: { user_id: userId, product_id: body.productId } });
    const product = await this.productRepo.findOne({ where: { id: body.productId } });
    if (!product) throw new NotFoundException();
    if (existing && existing.price_at_add == null) {
      existing.price_at_add = Number(product.currentPrice) || null;
      await this.wishRepo.save(existing);
    }
    return { tracked: true, priceAtAdd: existing?.price_at_add };
  }
}
