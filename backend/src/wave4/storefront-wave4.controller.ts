/**
 * Wave 4 — Customer-facing endpoints.
 * Order edit window, delivery slots, pickup locations, referral sharing, UGC upload,
 * search autocomplete, daily deal, review submission.
 */
import {
  Controller, Get, Post, Body, Param, Query, UseGuards, ParseIntPipe, BadRequestException, NotFoundException,
  DefaultValuePipe,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThan, LessThan } from 'typeorm';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

import { DeliverySlot, PickupLocation, DailyDeal, ReferralShare, UgcPost } from './wave4.entities';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { Notification, NotificationType } from '../notifications/entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { SmsService } from '../sms/sms.service';
import { FraudService } from '../fraud/fraud.service';

const ORDER_EDIT_WINDOW_MINUTES = 60; // 1 hour

@Controller('storefront/w4')
@SkipTransform()
export class StorefrontWave4Controller {
  constructor(
    @InjectRepository(DeliverySlot) private readonly slotRepo: Repository<DeliverySlot>,
    @InjectRepository(PickupLocation) private readonly pickupRepo: Repository<PickupLocation>,
    @InjectRepository(DailyDeal) private readonly dealRepo: Repository<DailyDeal>,
    @InjectRepository(ReferralShare) private readonly refRepo: Repository<ReferralShare>,
    @InjectRepository(UgcPost) private readonly ugcRepo: Repository<UgcPost>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Notification) private readonly notifRepo: Repository<Notification>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly sms: SmsService,
    private readonly fraud: FraudService,
  ) {}

  // ═══ 6. ORDER EDIT/CANCEL WINDOW ═════════════════════════════════════
  @Get('orders/:id/can-edit')
  @UseGuards(JwtAuthGuard)
  async canEdit(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
    const o = await this.orderRepo.findOne({ where: { id, user_id: userId } });
    if (!o) throw new NotFoundException();
    const minsSince = (Date.now() - new Date(o.created_at).getTime()) / 60000;
    const canEdit = minsSince <= ORDER_EDIT_WINDOW_MINUTES
      && ['PENDING', 'PAYMENT_PENDING', 'CONFIRMED'].includes(String(o.status).toUpperCase());
    const minsLeft = Math.max(0, Math.round(ORDER_EDIT_WINDOW_MINUTES - minsSince));
    return { canEdit, minutesLeft: minsLeft, status: o.status };
  }

  // Attach premium checkout add-ons (gift wrap, delivery slot, pickup) to an existing order.
  // Called by the frontend right after the legacy /api/placeOrder returns, so the chosen
  // options land on the already-persisted Order row.
  @Post('orders/:id/premium-options')
  @UseGuards(JwtAuthGuard)
  async attachPremiumOptions(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @Body() body: { giftWrap?: boolean; giftMessage?: string; deliverySlotId?: number | null; pickupLocationId?: number | null },
  ) {
    const o = await this.orderRepo.findOne({ where: { id, user_id: userId } });
    if (!o) throw new NotFoundException();
    if (body.giftWrap !== undefined) o.gift_wrap = !!body.giftWrap;
    if (body.giftMessage !== undefined) o.gift_message = (body.giftMessage || '').slice(0, 500);
    if (body.deliverySlotId !== undefined) o.delivery_slot_id = body.deliverySlotId ?? null;
    if (body.pickupLocationId !== undefined) o.pickup_location_id = body.pickupLocationId ?? null;
    await this.orderRepo.save(o);

    // Fraud scoring — triggered right after the order is finalized + premium options attached.
    // If high risk, the order is automatically held and this endpoint returns holdStatus=true.
    let holdStatus = false;
    try {
      const { held } = await this.fraud.record(id, {
        orderId: id,
        userId,
        totalAmount: Number((o as any).total_amount || 0),
        fingerprint: (body as any)?.fingerprint || null,
      });
      holdStatus = held;
    } catch { /* never break order flow on fraud error */ }

    // SMS: only send if NOT held — no point confirming a held order.
    if (!holdStatus) {
      try {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (user?.phone && o.reference) {
          await this.sms.sendOrderConfirmation(user.phone, o.reference, user.id);
        }
      } catch { /* best-effort */ }
    }

    return {
      success: true,
      orderId: o.id,
      giftWrap: o.gift_wrap,
      giftMessage: o.gift_message,
      deliverySlotId: o.delivery_slot_id,
      pickupLocationId: o.pickup_location_id,
    };
  }

  @Post('orders/:id/self-cancel')
  @UseGuards(JwtAuthGuard)
  async selfCancel(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
    const o = await this.orderRepo.findOne({ where: { id, user_id: userId } });
    if (!o) throw new NotFoundException();
    const minsSince = (Date.now() - new Date(o.created_at).getTime()) / 60000;
    if (minsSince > ORDER_EDIT_WINDOW_MINUTES) {
      throw new BadRequestException('Délai d\'annulation dépassé. Contactez le support.');
    }
    if (!['PENDING', 'PAYMENT_PENDING', 'CONFIRMED'].includes(String(o.status).toUpperCase())) {
      throw new BadRequestException('Cette commande ne peut plus être annulée.');
    }
    o.status = OrderStatus.CANCELLED;
    o.cancelled_at = new Date();
    o.cancel_reason = 'Customer self-cancel';
    await this.orderRepo.save(o);
    return { success: true, status: o.status };
  }

  // ═══ 7. DELIVERY SLOTS (public list) ══════════════════════════════════
  @Get('delivery-slots')
  async publicSlots(@Query('city') city?: string) {
    const qb = this.slotRepo.createQueryBuilder('s').where('s.is_active = :a', { a: true });
    if (city) qb.andWhere('(s.city IS NULL OR s.city = :c)', { c: city });
    const items = await qb.orderBy('s.start_time').getMany();
    return { items };
  }

  // ═══ 8. PICKUP LOCATIONS (public list) ════════════════════════════════
  @Get('pickup-locations')
  async publicPickups(@Query('city') city?: string) {
    const qb = this.pickupRepo.createQueryBuilder('p').where('p.is_active = :a', { a: true });
    if (city) qb.andWhere('p.city = :c', { c: city });
    return { items: await qb.getMany() };
  }

  // ═══ 13. DAILY DEAL (public) ══════════════════════════════════════════
  @Get('daily-deal/current')
  async currentDeal() {
    const now = new Date();
    const deal = await this.dealRepo.findOne({
      where: { is_active: true, start_at: LessThan(now), end_at: MoreThan(now) },
      order: { start_at: 'DESC' },
    });
    if (!deal) return { active: false };
    const product = await this.productRepo.findOne({ where: { id: deal.product_id } });
    return {
      active: true,
      deal: {
        id: deal.id,
        specialPrice: Number(deal.special_price),
        headline: deal.headline,
        endAt: deal.end_at,
      },
      product: product ? {
        id: product.id, title: product.title, slug: product.slug,
        originalPrice: Number(product.price), currentPrice: Number(product.currentPrice),
        firstImageUrl: product.firstImageUrl,
      } : null,
    };
  }

  // ═══ 14. REFERRAL SHARING ═════════════════════════════════════════════
  @Post('referral/share')
  @UseGuards(JwtAuthGuard)
  async createShare(@CurrentUser('id') userId: number, @Body() body: { productId?: number }) {
    const code = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const r = this.refRepo.create({
      referrer_id: userId,
      product_id: body?.productId || null,
      share_code: code,
    });
    await this.refRepo.save(r);
    return { code, shareUrl: `/r/${code}` };
  }

  @Get('referral/:code/track-click')
  async trackClick(@Param('code') code: string) {
    const r = await this.refRepo.findOne({ where: { share_code: code } });
    if (!r) return { found: false };
    r.clicks += 1;
    await this.refRepo.save(r);
    return { found: true, productId: r.product_id, referrerId: r.referrer_id };
  }

  // ═══ 15. UGC UPLOAD ═══════════════════════════════════════════════════
  @Post('ugc')
  @UseGuards(JwtAuthGuard)
  async uploadUgc(@CurrentUser('id') userId: number, @Body() body: { imageUrl: string; caption?: string; productId?: number }) {
    if (!body?.imageUrl) throw new BadRequestException('imageUrl requis');
    const p = this.ugcRepo.create({
      user_id: userId,
      image_url: body.imageUrl,
      caption: body.caption || null,
      product_id: body.productId || null,
      status: 'PENDING',
    });
    return this.ugcRepo.save(p);
  }

  @Get('ugc/feed')
  async ugcFeed(@Query('productId') productIdRaw?: string, @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20) {
    const qb = this.ugcRepo.createQueryBuilder('p').where('p.status = :s', { s: 'APPROVED' });
    if (productIdRaw) qb.andWhere('p.product_id = :pid', { pid: Number(productIdRaw) });
    qb.orderBy('p.created_at', 'DESC').limit(limit);
    return { items: await qb.getMany() };
  }

  @Post('ugc/:id/like')
  async likeUgc(@Param('id', ParseIntPipe) id: number) {
    const p = await this.ugcRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException();
    p.likes_count += 1;
    await this.ugcRepo.save(p);
    return { likes: p.likes_count };
  }

  // ═══ 18. SEARCH AUTOCOMPLETE ══════════════════════════════════════════
  @Get('autocomplete')
  async autocomplete(@Query('q') q: string, @Query('limit', new DefaultValuePipe(8), ParseIntPipe) limit: number) {
    if (!q || q.trim().length < 2) return { suggestions: [] };
    const term = `%${q.trim().toLowerCase()}%`;
    const products = await this.productRepo
      .createQueryBuilder('p')
      .where('p.is_active = :a', { a: true })
      .andWhere('(LOWER(p.title) LIKE :t OR LOWER(p.sku) LIKE :t)', { t: term })
      .orderBy('p.view_count', 'DESC')
      .take(limit)
      .getMany();
    return {
      suggestions: products.map((p) => ({
        type: 'product',
        id: p.id,
        title: p.title,
        slug: p.slug,
        price: Number(p.currentPrice),
        image: p.firstImageUrl,
      })),
    };
  }
}
