/**
 * Storefront-facing endpoints for wave 2 modules:
 *  1. Save for later, 2. Shipping estimator, 3. Free-ship progress, 4. Wishlist price alerts,
 *  5. Continue browsing, 6. Birthday rewards, 7. VIP perks, 9. Style profile,
 *  10. Exit intent / funnel events
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThan } from 'typeorm';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

import { CartItem } from '../cart/entities/cart-item.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { WishlistItem } from '../wishlist/entities/wishlist-item.entity';
import { LoyaltyAccount, LoyaltyTier } from '../loyalty/entities/loyalty-account.entity';
import { StyleProfile } from '../users/entities/style-profile.entity';
import { FunnelEvent } from '../analytics/entities/funnel-event.entity';
import { Coupon, CouponDiscountType } from '../promotions/entities/coupon.entity';
import { Notification, NotificationType } from '../notifications/entities/notification.entity';
import { RecentlyViewed } from '../analytics/entities/recently-viewed.entity';

const FREE_SHIPPING_THRESHOLD = 150; // TND

@Controller('storefront')
@SkipTransform()
export class StorefrontExtrasController {
  constructor(
    @InjectRepository(CartItem) private readonly cartRepo: Repository<CartItem>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(WishlistItem) private readonly wishlistRepo: Repository<WishlistItem>,
    @InjectRepository(LoyaltyAccount) private readonly loyaltyRepo: Repository<LoyaltyAccount>,
    @InjectRepository(StyleProfile) private readonly styleRepo: Repository<StyleProfile>,
    @InjectRepository(FunnelEvent) private readonly funnelRepo: Repository<FunnelEvent>,
    @InjectRepository(Coupon) private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(Notification) private readonly notifRepo: Repository<Notification>,
    @InjectRepository(RecentlyViewed) private readonly rvRepo: Repository<RecentlyViewed>,
  ) {}

  // ═══ 1. SAVE FOR LATER ═══════════════════════════════════════════════
  @Post('cart/:itemId/save-for-later')
  @UseGuards(JwtAuthGuard)
  async saveForLater(
    @CurrentUser('id') userId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    const item = await this.cartRepo.findOne({ where: { id: itemId, user_id: userId } });
    if (!item) throw new NotFoundException('Cart item not found');
    item.saved_for_later = true;
    await this.cartRepo.save(item);
    return { success: true, itemId };
  }

  @Post('cart/:itemId/move-to-cart')
  @UseGuards(JwtAuthGuard)
  async moveToCart(
    @CurrentUser('id') userId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    const item = await this.cartRepo.findOne({ where: { id: itemId, user_id: userId } });
    if (!item) throw new NotFoundException();
    item.saved_for_later = false;
    await this.cartRepo.save(item);
    return { success: true, itemId };
  }

  @Get('cart/saved')
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
      items: items.map((i) => ({
        itemId: i.id,
        productId: i.product_id,
        quantity: i.quantity,
        variantInfo: i.variant_info,
        product: byId.get(i.product_id) || null,
      })),
    };
  }

  // ═══ 2+3. SHIPPING ESTIMATOR + FREE-SHIP PROGRESS ════════════════════
  @Get('shipping/estimate')
  async estimate(
    @Query('city') city?: string,
    @Query('subtotal') subtotalRaw?: string,
  ) {
    const subtotal = Number(subtotalRaw) || 0;
    const tunisCities = ['tunis', 'ariana', 'manouba', 'ben arous'];
    const baseFee = 7;
    const regionalFee = tunisCities.includes(String(city || '').toLowerCase()) ? 5 : 8;
    const free = subtotal >= FREE_SHIPPING_THRESHOLD;
    const shippingCost = free ? 0 : regionalFee;
    const remainingForFree = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
    const progressPct = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));

    const estimatedDays = tunisCities.includes(String(city || '').toLowerCase()) ? '1-2' : '2-4';

    return {
      subtotal,
      shippingCost,
      freeShipping: free,
      threshold: FREE_SHIPPING_THRESHOLD,
      remainingForFree,
      progressPct,
      estimatedDays,
      total: subtotal + shippingCost,
    };
  }

  // ═══ 4. WISHLIST PRICE DROP ALERTS ═══════════════════════════════════
  @Get('wishlist/price-alerts')
  @UseGuards(JwtAuthGuard)
  async wishlistPriceAlerts(@CurrentUser('id') userId: number) {
    const wl = await this.wishlistRepo.find({ where: { user_id: userId } });
    if (wl.length === 0) return { alerts: [] };
    const pids = wl.map((w) => w.product_id);
    const products = await this.productRepo.find({ where: { id: In(pids) } });
    const alerts = products
      .filter((p) => Number(p.currentPrice) < Number(p.price) && p.price > 0)
      .map((p) => ({
        productId: p.id,
        title: p.title,
        originalPrice: Number(p.price),
        currentPrice: Number(p.currentPrice),
        discountPct: Math.round(((Number(p.price) - Number(p.currentPrice)) / Number(p.price)) * 100),
        firstImageUrl: p.firstImageUrl,
      }));
    return { alerts };
  }

  // ═══ 5. CONTINUE BROWSING (recently viewed) ══════════════════════════
  // Already exposed at /api/recently-viewed, here we add a home-page-friendly variant
  @Get('continue-browsing')
  @UseGuards(JwtAuthGuard)
  async continueBrowsing(
    @CurrentUser('id') userId: number,
    @Query('limit', new DefaultValuePipe(8), ParseIntPipe) limit: number,
  ) {
    const rv = await this.rvRepo.find({
      where: { user_id: userId },
      order: { last_viewed_at: 'DESC' },
      take: limit,
    });
    if (rv.length === 0) return { items: [] };
    const pids = rv.map((r) => r.product_id);
    const products = await this.productRepo.find({ where: { id: In(pids) } });
    const byId = new Map<number, Product>();
    products.forEach((p) => byId.set(p.id, p));
    const items = rv
      .map((r) => {
        const p = byId.get(r.product_id);
        return p ? { id: p.id, title: p.title, slug: p.slug, currentPrice: Number(p.currentPrice), firstImageUrl: p.firstImageUrl } : null;
      })
      .filter(Boolean);
    return { items };
  }

  // ═══ 6. BIRTHDAY REWARDS ═════════════════════════════════════════════
  @Post('loyalty/birthday-check')
  @UseGuards(JwtAuthGuard)
  async birthdayCheck(@CurrentUser('id') userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    if (!user.birth_date) return { eligible: false, reason: 'no_birthday_on_profile' };

    const bd = new Date(user.birth_date);
    const today = new Date();
    const thisBday = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
    const dayDiff = Math.abs((thisBday.getTime() - today.getTime()) / 86400000);
    // Eligible: ±7 days around birthday
    if (dayDiff > 7) return { eligible: false, reason: 'outside_birthday_window', daysUntil: Math.round(dayDiff) };

    // Check if user already got a birthday coupon this year
    const existing = await this.couponRepo.findOne({
      where: {
        code: `BDAY-${user.id}-${today.getFullYear()}`,
      },
    });
    if (existing) {
      return { eligible: true, alreadyIssued: true, couponCode: existing.code };
    }

    const code = `BDAY-${user.id}-${today.getFullYear()}`;
    const validTo = new Date(today);
    validTo.setDate(validTo.getDate() + 14);
    const c = this.couponRepo.create({
      code,
      description: `Joyeux anniversaire ${user.first_name || ''}! 20% offerts.`,
      discount_type: CouponDiscountType.PERCENTAGE,
      discount_value: 20,
      valid_from: new Date(),
      valid_to: validTo,
      usage_limit: 1,
      per_user_limit: 1,
      is_active: true,
    } as any);
    await this.couponRepo.save(c);

    // Also drop a notification
    await this.notifRepo.save(this.notifRepo.create({
      user_id: user.id,
      type: NotificationType.PROMOTION,
      title: `🎂 Joyeux anniversaire ${user.first_name || ''}!`,
      message: `Cadeau Barsha: -20% sur votre prochaine commande avec le code ${code}. Valable 14 jours.`,
      action_url: '/tn/shop',
      is_read: false,
    }));

    return { eligible: true, alreadyIssued: false, couponCode: code, discountPercent: 20, expiresAt: validTo };
  }

  // ═══ 7. VIP PERKS BY TIER ════════════════════════════════════════════
  @Get('loyalty/perks')
  @UseGuards(JwtAuthGuard)
  async vipPerks(@CurrentUser('id') userId: number) {
    const acc = await this.loyaltyRepo.findOne({ where: { user_id: userId } });
    const tier = acc?.tier || LoyaltyTier.BRONZE;

    const PERKS: Record<string, any[]> = {
      BRONZE: [
        { icon: '🎁', label: 'Accumulation points (1 pt / dinar)' },
        { icon: '📦', label: 'Livraison standard' },
      ],
      SILVER: [
        { icon: '🎁', label: 'Points x1.25' },
        { icon: '📦', label: 'Livraison standard gratuite dès 120 TND' },
        { icon: '🎂', label: 'Coupon anniversaire -15%' },
      ],
      GOLD: [
        { icon: '🎁', label: 'Points x1.5' },
        { icon: '🚚', label: 'Livraison gratuite sans minimum' },
        { icon: '🎂', label: 'Coupon anniversaire -20%' },
        { icon: '⏱️', label: 'Accès anticipé aux soldes (24h)' },
        { icon: '🔄', label: 'Retours gratuits' },
      ],
      PLATINUM: [
        { icon: '🎁', label: 'Points x2' },
        { icon: '🚚', label: 'Livraison express gratuite' },
        { icon: '🎂', label: 'Coupon anniversaire -30%' },
        { icon: '⏱️', label: 'Accès anticipé aux soldes (48h)' },
        { icon: '🔄', label: 'Retours gratuits + échange express' },
        { icon: '👑', label: 'Styliste personnel dédié' },
        { icon: '🎫', label: 'Invitations événements privés' },
      ],
    };

    const tierKey = String(tier).toUpperCase();
    return {
      tier: tierKey,
      perks: PERKS[tierKey] || PERKS.BRONZE,
      availablePoints: acc?.available_points || 0,
      lifetimePoints: acc?.lifetime_points || 0,
    };
  }

  // ═══ 9. STYLE PROFILE / QUIZ ═════════════════════════════════════════
  @Get('style-profile')
  @UseGuards(JwtAuthGuard)
  async getStyleProfile(@CurrentUser('id') userId: number) {
    const profile = await this.styleRepo.findOne({ where: { user_id: userId } });
    return profile || { user_id: userId, style: null };
  }

  @Put('style-profile')
  @UseGuards(JwtAuthGuard)
  async setStyleProfile(
    @CurrentUser('id') userId: number,
    @Body() body: any,
  ) {
    let profile = await this.styleRepo.findOne({ where: { user_id: userId } });
    if (!profile) {
      profile = this.styleRepo.create({ user_id: userId });
    }
    if (body.style !== undefined) profile.style = body.style;
    if (body.sizeTop !== undefined) profile.size_top = body.sizeTop;
    if (body.sizeBottom !== undefined) profile.size_bottom = body.sizeBottom;
    if (body.shoeSize !== undefined) profile.shoe_size = body.shoeSize;
    if (body.preferredColors !== undefined) profile.preferred_colors = body.preferredColors;
    if (body.preferredCategories !== undefined) profile.preferred_categories = body.preferredCategories;
    if (body.budgetRange !== undefined) profile.budget_range = body.budgetRange;
    return this.styleRepo.save(profile);
  }

  // ═══ 10. FUNNEL / EXIT INTENT TRACKING ═══════════════════════════════
  @Post('funnel/track')
  @UseGuards(OptionalAuthGuard)
  async trackFunnel(
    @Body() body: { step: string; sessionId?: string; productId?: number; metadata?: any },
    @CurrentUser('id') userId?: number,
  ) {
    const validSteps = ['VIEW_HOME', 'VIEW_PRODUCT', 'ADD_TO_CART', 'START_CHECKOUT', 'COMPLETE_PURCHASE', 'EXIT_INTENT'];
    if (!body.step || !validSteps.includes(body.step)) {
      throw new BadRequestException('Invalid step');
    }
    const event = this.funnelRepo.create({
      step: body.step,
      user_id: userId || null,
      session_id: body.sessionId || null,
      product_id: body.productId || null,
      metadata: body.metadata || null,
    });
    await this.funnelRepo.save(event);
    return { tracked: true };
  }
}
