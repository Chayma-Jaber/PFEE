import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Seller, SellerStatus } from './entities/seller.entity';
import { SellerFulfillment, SellerFulfillmentStatus } from './entities/seller-fulfillment.entity';
import { Product, Famille } from '../products/entities/product.entity';
import { ProductImage } from '../products/entities/product-image.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { EventBusService } from '../platform/events/event-bus.service';
import { SmsService } from '../sms/sms.service';
import { SmsPurpose } from '../sms/entities/sms-message.entity';
import { EmailService } from '../email/email.service';

// Catalog management for marketplace sellers. Every method enforces ownership
// (the calling user must own the seller profile that owns the product).
@Injectable()
export class SellerCatalogService {
  private readonly logger = new Logger(SellerCatalogService.name);

  constructor(
    @InjectRepository(Seller) private readonly sellerRepo: Repository<Seller>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductImage) private readonly imageRepo: Repository<ProductImage>,
    @InjectRepository(ProductVariant) private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(OrderItem) private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(SellerFulfillment) private readonly fulfillRepo: Repository<SellerFulfillment>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly eventBus: EventBusService,
    private readonly sms: SmsService,
    private readonly email: EmailService,
  ) {}

  // Resolve and authorize: returns the seller for this user or throws 403.
  private async resolveSeller(userId: number): Promise<Seller> {
    const s = await this.sellerRepo.findOne({ where: { owner_user_id: userId } });
    if (!s) throw new ForbiddenException('Pas de profil vendeur');
    if (s.status !== SellerStatus.APPROVED) {
      throw new ForbiddenException(`Profil vendeur non actif (statut: ${s.status})`);
    }
    return s;
  }

  async listMyProducts(userId: number) {
    const seller = await this.resolveSeller(userId);
    return this.productRepo.find({ where: { seller_id: seller.id }, order: { createdAt: 'DESC' } });
  }

  async getMyProduct(userId: number, productId: number) {
    const seller = await this.resolveSeller(userId);
    const p = await this.productRepo.findOne({ where: { id: productId } });
    if (!p) throw new NotFoundException();
    if (p.seller_id !== seller.id) throw new ForbiddenException('Pas votre produit');
    return p;
  }

  async createProduct(userId: number, data: any) {
    const seller = await this.resolveSeller(userId);
    if (!data?.title) throw new BadRequestException('title requis');
    const price = Number(data.price ?? data.currentPrice ?? 0);
    if (!(price > 0)) throw new BadRequestException('Prix > 0 requis');

    // Sanitize: sellers can only set business fields; never touch admin-only flags
    const safeFamille: Famille = ['MEN','WOMEN','KIDS','UNISEX'].includes(data.famille) ? data.famille as Famille : Famille.UNISEX;
    const stock = Math.max(0, Math.floor(Number(data.totalStock ?? 0)));

    const productEntity = this.productRepo.create({
      sku: (data.sku || `S${seller.id}-${Date.now().toString(36).toUpperCase()}`).slice(0, 100),
      title: String(data.title).slice(0, 255),
      slug: this.slugify(data.slug || data.title),
      description: data.description ? String(data.description).slice(0, 5000) : null,
      price,
      currentPrice: Number(data.currentPrice ?? price),
      famille: safeFamille,
      ligne: data.ligne ? String(data.ligne).slice(0, 100) : null,
      totalStock: stock,
      isActive: data.isActive !== false,
      isFeatured: false,
      isBestseller: false,
      // First image: store on the dedicated firstImageUrl column if it exists; otherwise pass through
      ...(data.firstImageUrl ? { firstImageUrl: data.firstImageUrl } : {}),
      seller_id: seller.id,
    } as any) as unknown as Product;

    const saved = await this.productRepo.save(productEntity) as Product;
    this.eventBus.publish('seller.product_created', { sellerId: seller.id, productId: saved.id }, {
      aggregateId: `product:${saved.id}`, actorId: userId,
    }).catch(() => {});
    return saved;
  }

  async updateProduct(userId: number, productId: number, patch: any) {
    const product = await this.getMyProduct(userId, productId);
    // Whitelist of seller-editable fields:
    const allowed = ['title','slug','description','price','currentPrice','famille','ligne','totalStock','isActive','firstImageUrl','sku','keywords'];
    for (const k of allowed) {
      if (patch[k] === undefined) continue;
      if (k === 'price' || k === 'currentPrice') {
        const v = Number(patch[k]);
        if (!isFinite(v) || v < 0) continue;
        (product as any)[k] = v;
      } else if (k === 'totalStock') {
        (product as any)[k] = Math.max(0, Math.floor(Number(patch[k]) || 0));
      } else if (k === 'isActive') {
        (product as any)[k] = !!patch[k];
      } else if (k === 'famille') {
        if (['MEN','WOMEN','KIDS','UNISEX'].includes(patch[k])) (product as any)[k] = patch[k];
      } else if (k === 'slug') {
        (product as any).slug = this.slugify(patch[k]);
      } else if (typeof patch[k] === 'string') {
        (product as any)[k] = patch[k].slice(0, 5000);
      }
    }
    const saved = await this.productRepo.save(product);
    this.eventBus.publish('seller.product_updated', { sellerId: product.seller_id, productId: saved.id }, {
      aggregateId: `product:${saved.id}`, actorId: userId,
    }).catch(() => {});
    return saved;
  }

  async deleteProduct(userId: number, productId: number) {
    const product = await this.getMyProduct(userId, productId);
    // Soft-delete: deactivate so order history stays valid. Hard-delete is admin-only.
    product.isActive = false;
    await this.productRepo.save(product);
    this.eventBus.publish('seller.product_disabled', { sellerId: product.seller_id, productId }, {
      aggregateId: `product:${productId}`, actorId: userId,
    }).catch(() => {});
    return { success: true };
  }

  async stats(userId: number) {
    const seller = await this.resolveSeller(userId);
    const [total, active, lowStock, outOfStock] = await Promise.all([
      this.productRepo.count({ where: { seller_id: seller.id } }),
      this.productRepo.count({ where: { seller_id: seller.id, isActive: true } as any }),
      this.productRepo.createQueryBuilder('p').where('p.seller_id = :s AND p.total_stock > 0 AND p.total_stock <= 5', { s: seller.id }).getCount(),
      this.productRepo.count({ where: { seller_id: seller.id, totalStock: 0 } as any }),
    ]);
    return { total, active, lowStock, outOfStock, sellerName: seller.business_name, sellerSlug: seller.slug, status: seller.status };
  }

  private slugify(s: string): string {
    return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 200) || `p-${Date.now().toString(36)}`;
  }

  // ═══ Seller orders ════════════════════════════════════════════════════
  // Returns the orders that contain at least one product owned by this seller,
  // with per-line aggregation (only the seller's lines count toward the totals).
  async listMyOrders(userId: number, opts: { limit?: number; status?: string } = {}) {
    const seller = await this.resolveSeller(userId);

    const qb = this.orderItemRepo.createQueryBuilder('oi')
      .innerJoin(Product, 'p', 'p.id = oi.product_id')
      .innerJoin(Order, 'o', 'o.id = oi.order_id')
      .where('p.seller_id = :sid', { sid: seller.id })
      .select([
        'oi.id AS itemId', 'oi.order_id AS orderId', 'oi.product_id AS productId',
        'oi.title AS itemTitle', 'oi.unit_price AS unitPrice', 'oi.quantity AS quantity',
        'oi.image_url AS itemImage', 'oi.variant_info AS variantInfo',
        'o.reference AS reference', 'o.status AS orderStatus', 'o.created_at AS orderDate',
        'o.payment_status AS paymentStatus',
      ]);
    if (opts.status) qb.andWhere('o.status = :st', { st: opts.status.toUpperCase() });
    qb.orderBy('o.created_at', 'DESC');
    qb.take(Math.min(500, opts.limit || 100));
    const rows = await qb.getRawMany();

    // Fetch existing fulfillment rows for this seller in one query, then merge per item.
    const itemIds = rows.map((r) => Number(r.itemId));
    const fulfillments = itemIds.length
      ? await this.fulfillRepo.createQueryBuilder('f')
          .where('f.seller_id = :s', { s: seller.id })
          .andWhere('f.order_item_id IN (:...ids)', { ids: itemIds })
          .getMany()
      : [];
    const fulfillByItem = new Map(fulfillments.map((f) => [f.order_item_id, f]));

    // Group by order so the UI shows one row per order with the seller's lines nested.
    const byOrder = new Map<number, any>();
    for (const r of rows) {
      const orderId = Number(r.orderId);
      if (!byOrder.has(orderId)) {
        byOrder.set(orderId, {
          orderId, reference: r.reference, status: r.orderStatus,
          paymentStatus: r.paymentStatus,
          createdAt: r.orderDate,
          items: [], sellerSubtotal: 0, sellerLineCount: 0,
        });
      }
      const o = byOrder.get(orderId);
      const lineTotal = Number(r.unitPrice) * Number(r.quantity);
      const f = fulfillByItem.get(Number(r.itemId));
      o.items.push({
        itemId: r.itemId, productId: r.productId, title: r.itemTitle,
        unitPrice: Number(r.unitPrice), quantity: Number(r.quantity),
        lineTotal, image: r.itemImage, variantInfo: r.variantInfo,
        fulfillment: f ? {
          status: f.status, trackingNumber: f.tracking_number, carrier: f.carrier,
          trackingUrl: f.tracking_url, shippedAt: f.shipped_at, deliveredAt: f.delivered_at,
        } : { status: SellerFulfillmentStatus.PENDING, trackingNumber: null, carrier: null, trackingUrl: null, shippedAt: null, deliveredAt: null },
      });
      o.sellerSubtotal += lineTotal;
      o.sellerLineCount += 1;
    }
    return [...byOrder.values()].map((o) => ({ ...o, sellerSubtotal: Math.round(o.sellerSubtotal * 1000) / 1000 }));
  }

  // ═══ Fulfillment ═════════════════════════════════════════════════════
  // Resolve & authorize: order item must reference one of this seller's products.
  private async resolveSellerOrderItem(userId: number, orderItemId: number) {
    const seller = await this.resolveSeller(userId);
    const item = await this.orderItemRepo.findOne({ where: { id: orderItemId } });
    if (!item) throw new NotFoundException('Order item not found');
    if (!item.product_id) throw new ForbiddenException('Item has no product reference');
    const product = await this.productRepo.findOne({ where: { id: item.product_id } });
    if (!product || product.seller_id !== seller.id) throw new ForbiddenException('Pas votre article');
    return { seller, item, product };
  }

  // Find or create the fulfillment row for a given order item.
  private async getOrInitFulfillment(sellerId: number, orderItemId: number, orderId: number) {
    let f = await this.fulfillRepo.findOne({ where: { order_item_id: orderItemId } });
    if (!f) {
      f = this.fulfillRepo.create({
        order_item_id: orderItemId, order_id: orderId, seller_id: sellerId,
        status: SellerFulfillmentStatus.PENDING,
      });
      f = await this.fulfillRepo.save(f);
    }
    return f;
  }

  // Auto-promote helper. Returns the fulfillment audit for this order:
  // - sellerLines: order_items whose product has a non-null seller_id
  // - merchantLines: order_items whose product is merchant-owned (seller_id IS NULL)
  // - shipped/delivered counts come from joined seller_fulfillments rows
  //
  // We only auto-promote the parent Order when:
  //   - the order has at least one seller line, AND
  //   - all seller lines have a fulfillment in the target terminal state, AND
  //   - the order has zero merchant lines (mixed orders stay under merchant control)
  // This is intentionally conservative — it never overwrites a status the merchant set,
  // and never auto-completes an order while the merchant still owes the customer items.
  private async auditOrderLines(orderId: number) {
    const rows = await this.orderItemRepo.createQueryBuilder('oi')
      .leftJoin(Product, 'p', 'p.id = oi.product_id')
      .leftJoin(SellerFulfillment, 'f', 'f.order_item_id = oi.id')
      .where('oi.order_id = :oid', { oid: orderId })
      .select([
        'oi.id AS itemId',
        'p.seller_id AS sellerId',
        'f.status AS fStatus',
      ])
      .getRawMany();

    let sellerLines = 0, merchantLines = 0, shippedSeller = 0, deliveredSeller = 0;
    for (const r of rows) {
      if (r.sellerId == null) merchantLines++;
      else {
        sellerLines++;
        if (r.fStatus === SellerFulfillmentStatus.SHIPPED) shippedSeller++;
        else if (r.fStatus === SellerFulfillmentStatus.DELIVERED) { shippedSeller++; deliveredSeller++; }
      }
    }
    return { sellerLines, merchantLines, shippedSeller, deliveredSeller };
  }

  // Decision matrix for auto-promote-to-shipped:
  //
  //   sellerLines  merchantLines  shippedSeller==sellerLines  → action
  //   ---------------------------------------------------------------------------------
  //   0            *              n/a                           skip (no marketplace involvement)
  //   N>0          0              false                         skip (some seller items still pending)
  //   N>0          0              true                          promote → SHIPPED
  //   N>0          M>0            false                         skip (still working on seller side)
  //   N>0          M>0            true                          promote → PARTIALLY_SHIPPED (mixed order)
  //
  // The merchant later marks the whole order SHIPPED via /admin/orders, which
  // overrides PARTIALLY_SHIPPED. We never auto-downgrade.
  private async maybePromoteOrderShipped(orderId: number) {
    try {
      const audit = await this.auditOrderLines(orderId);
      if (audit.sellerLines === 0) return;
      if (audit.shippedSeller !== audit.sellerLines) return;

      const order = await this.orderRepo.findOne({ where: { id: orderId } });
      if (!order) return;

      const cur = this.normalizeStatus(order.status);
      // Don't stomp terminal states.
      const terminal = new Set(['CANCELLED', 'FAILED', 'REFUNDED', 'DELIVERED', 'COMPLETED']);
      if (terminal.has(cur)) return;
      // Don't downgrade SHIPPED / IN_TRANSIT / OUT_FOR_DELIVERY / PARTIALLY_DELIVERED.
      const alreadyAtOrPastShipped = new Set([
        'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PARTIALLY_DELIVERED',
      ]);
      if (alreadyAtOrPastShipped.has(cur)) return;
      // Don't accidentally promote a state we don't recognize as pre-shipped.
      const promotable = new Set(['PENDING', 'PAYMENT_PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'PARTIALLY_SHIPPED']);
      if (!promotable.has(cur)) return;

      // Mixed orders: the merchant still owes the customer items, so we go partial.
      const target = audit.merchantLines > 0 ? OrderStatus.PARTIALLY_SHIPPED : OrderStatus.SHIPPED;
      // Don't re-emit if we'd be saving the same state (PARTIALLY_SHIPPED → PARTIALLY_SHIPPED).
      if (cur === target) return;

      order.status = target;
      await this.orderRepo.save(order);
      this.eventBus.publish(target === OrderStatus.SHIPPED ? 'order.shipped' : 'order.partially_shipped', {
        orderId, userId: order.user_id, autoPromoted: true,
        source: 'seller_fulfillment_completion',
        sellerLines: audit.sellerLines, merchantLines: audit.merchantLines,
      }, { aggregateId: `order:${orderId}`, actorId: order.user_id || undefined }).catch(() => {});
      this.logger.log(
        `Order #${orderId} auto-promoted to ${target} ` +
        `(seller=${audit.shippedSeller}/${audit.sellerLines}, merchant=${audit.merchantLines})`,
      );
    } catch (err: any) {
      this.logger.warn(`auto-promote shipped failed for order ${orderId}: ${err?.message || err}`);
    }
  }

  private async maybePromoteOrderDelivered(orderId: number) {
    try {
      const audit = await this.auditOrderLines(orderId);
      if (audit.sellerLines === 0) return;
      if (audit.deliveredSeller !== audit.sellerLines) return;

      const order = await this.orderRepo.findOne({ where: { id: orderId } });
      if (!order) return;

      const cur = this.normalizeStatus(order.status);
      const terminal = new Set(['CANCELLED', 'FAILED', 'REFUNDED', 'COMPLETED']);
      if (terminal.has(cur)) return;
      // Don't downgrade DELIVERED.
      if (cur === 'DELIVERED') return;

      // Mixed orders: merchant items haven't been delivered → partial.
      const target = audit.merchantLines > 0 ? OrderStatus.PARTIALLY_DELIVERED : OrderStatus.DELIVERED;
      if (cur === target) return;

      order.status = target;
      // delivered_at is only stamped on full delivery — partials don't trigger
      // post-delivery flows (review-request cron, return window, etc.) yet.
      if (target === OrderStatus.DELIVERED && !(order as any).delivered_at) {
        (order as any).delivered_at = new Date();
      }
      await this.orderRepo.save(order);
      this.eventBus.publish(target === OrderStatus.DELIVERED ? 'order.delivered' : 'order.partially_delivered', {
        orderId, userId: order.user_id, autoPromoted: true,
        source: 'seller_fulfillment_completion',
        sellerLines: audit.sellerLines, merchantLines: audit.merchantLines,
      }, { aggregateId: `order:${orderId}`, actorId: order.user_id || undefined }).catch(() => {});
      this.logger.log(
        `Order #${orderId} auto-promoted to ${target} ` +
        `(seller=${audit.deliveredSeller}/${audit.sellerLines}, merchant=${audit.merchantLines})`,
      );
    } catch (err: any) {
      this.logger.warn(`auto-promote delivered failed for order ${orderId}: ${err?.message || err}`);
    }
  }

  // Centralized status normalizer — uppercases and trims so the case-insensitive
  // legacy data ('shipped' vs 'SHIPPED') doesn't leak into the comparison logic.
  // Once Migration 2026-04-27_normalize_order_statuses runs in prod, every row is
  // already canonical and this just returns its argument upper-cased — no harm.
  private normalizeStatus(s: any): string {
    return String(s ?? '').trim().toUpperCase();
  }

  async markPreparing(userId: number, orderItemId: number) {
    const { seller, item } = await this.resolveSellerOrderItem(userId, orderItemId);
    const f = await this.getOrInitFulfillment(seller.id, orderItemId, item.order_id);
    if (f.status === SellerFulfillmentStatus.SHIPPED || f.status === SellerFulfillmentStatus.DELIVERED) {
      throw new BadRequestException('Article déjà expédié');
    }
    f.status = SellerFulfillmentStatus.PREPARING;
    const saved = await this.fulfillRepo.save(f);
    this.eventBus.publish('seller.fulfillment.preparing', { fulfillmentId: saved.id, orderItemId, sellerId: seller.id }, {
      aggregateId: `order_item:${orderItemId}`, actorId: userId,
    }).catch(() => {});
    return saved;
  }

  async markShipped(userId: number, orderItemId: number, data: { trackingNumber?: string; carrier?: string; trackingUrl?: string; notes?: string }) {
    const { seller, item, product } = await this.resolveSellerOrderItem(userId, orderItemId);
    const f = await this.getOrInitFulfillment(seller.id, orderItemId, item.order_id);
    if (f.status === SellerFulfillmentStatus.DELIVERED) throw new BadRequestException('Déjà livré');
    if (f.status === SellerFulfillmentStatus.CANCELLED) throw new BadRequestException('Annulé');
    // Light validation — we don't bind to a specific carrier API, just store the values.
    f.status = SellerFulfillmentStatus.SHIPPED;
    f.shipped_at = new Date();
    f.tracking_number = data.trackingNumber ? String(data.trackingNumber).slice(0, 80) : null;
    f.carrier = data.carrier ? String(data.carrier).slice(0, 60) : null;
    f.tracking_url = data.trackingUrl ? String(data.trackingUrl).slice(0, 500) : null;
    if (data.notes) f.notes = String(data.notes).slice(0, 500);
    const saved = await this.fulfillRepo.save(f);

    // Resolve buyer + order metadata once for both notifications and the event payload
    const order = await this.orderRepo.findOne({ where: { id: item.order_id } });
    const buyer = order?.user_id ? await this.userRepo.findOne({ where: { id: order.user_id } }) : null;

    // ─── Immediate transactional notification ─────────────────────────
    // We always send these. Drip campaigns triggered by the event are SEPARATE
    // (handled by lifecycle module) — this one is the "your item shipped" confirmation
    // that every customer expects regardless of admin sequence configuration.
    if (buyer) {
      const ref = order?.reference || `#${item.order_id}`;
      const trackingPart = f.tracking_number
        ? ` Suivi : ${f.carrier || 'transporteur'} ${f.tracking_number}.`
        : '';
      // SMS — short and tracking-first (sellSubject + first 480 chars)
      if (buyer.phone) {
        this.sms.sendSms({
          to: buyer.phone,
          body: `Barsha — Votre article "${item.title}" (cmd ${ref}) est expédié.${trackingPart}`.slice(0, 480),
          purpose: SmsPurpose.SHIPPING,
          userId: buyer.id,
        }).catch((e) => this.logger.warn(`fulfillment SMS failed: ${e?.message || e}`));
      }
      // Email — pass the carrier + tracking URL so the template renders a proper CTA.
      if (buyer.email) {
        this.email.sendShippingNotification(
          {
            id: item.order_id,
            orderNumber: ref,
            customerEmail: buyer.email,
            customerName: `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || undefined,
            items: [{ name: item.title, quantity: item.quantity, price: Number(item.unit_price) }],
          } as any,
          {
            trackingNumber: f.tracking_number || '',
            carrier: f.carrier || '',
            trackingUrl: f.tracking_url || '',
            itemTitle: item.title,
          },
        ).catch((e) => this.logger.warn(`fulfillment email failed: ${e?.message || e}`));
      }
    }

    // Event — richer payload so lifecycle drips + observability sinks have everything they need.
    this.eventBus.publish('seller.fulfillment.shipped', {
      fulfillmentId: saved.id, orderItemId, orderId: item.order_id, sellerId: seller.id,
      sellerName: seller.business_name,
      buyerId: buyer?.id ?? null,
      itemTitle: item.title,
      orderRef: order?.reference || null,
      trackingNumber: f.tracking_number, carrier: f.carrier, trackingUrl: f.tracking_url,
    }, { aggregateId: `order_item:${orderItemId}`, actorId: userId }).catch(() => {});

    // Auto-promote parent order if every line is now shipped (Item 2)
    await this.maybePromoteOrderShipped(item.order_id);

    return saved;
  }

  async markDelivered(userId: number, orderItemId: number) {
    const { seller, item } = await this.resolveSellerOrderItem(userId, orderItemId);
    const f = await this.getOrInitFulfillment(seller.id, orderItemId, item.order_id);
    if (f.status !== SellerFulfillmentStatus.SHIPPED) throw new BadRequestException('Doit être expédié avant d\'être livré');
    f.status = SellerFulfillmentStatus.DELIVERED;
    f.delivered_at = new Date();
    const saved = await this.fulfillRepo.save(f);

    const order = await this.orderRepo.findOne({ where: { id: item.order_id } });
    const buyer = order?.user_id ? await this.userRepo.findOne({ where: { id: order.user_id } }) : null;

    this.eventBus.publish('seller.fulfillment.delivered', {
      fulfillmentId: saved.id, orderItemId, orderId: item.order_id, sellerId: seller.id,
      sellerName: seller.business_name,
      buyerId: buyer?.id ?? null,
      itemTitle: item.title,
      orderRef: order?.reference || null,
    }, { aggregateId: `order_item:${orderItemId}`, actorId: userId }).catch(() => {});

    // Auto-promote to DELIVERED if all lines are delivered
    await this.maybePromoteOrderDelivered(item.order_id);

    return saved;
  }

  async cancelFulfillment(userId: number, orderItemId: number, reason?: string) {
    const { seller, item } = await this.resolveSellerOrderItem(userId, orderItemId);
    const f = await this.getOrInitFulfillment(seller.id, orderItemId, item.order_id);
    if (f.status === SellerFulfillmentStatus.SHIPPED || f.status === SellerFulfillmentStatus.DELIVERED) {
      throw new BadRequestException('Impossible d\'annuler une expédition déjà partie');
    }
    f.status = SellerFulfillmentStatus.CANCELLED;
    f.cancelled_at = new Date();
    if (reason) f.notes = String(reason).slice(0, 500);
    const saved = await this.fulfillRepo.save(f);

    // Resolve buyer + order so the immediate notification + event payload are useful.
    const order = await this.orderRepo.findOne({ where: { id: item.order_id } });
    const buyer = order?.user_id ? await this.userRepo.findOne({ where: { id: order.user_id } }) : null;

    // Immediate transactional notification — the customer must hear about a cancellation
    // even if no admin lifecycle sequence is configured (refund/replacement guidance).
    if (buyer) {
      const ref = order?.reference || `#${item.order_id}`;
      const reasonClause = reason ? ` Motif : ${String(reason).slice(0, 120)}.` : '';
      if (buyer.phone) {
        this.sms.sendSms({
          to: buyer.phone,
          body: `Barsha — L'article "${item.title}" de la cmd ${ref} ne pourra pas être expédié.${reasonClause} Notre support vous recontacte sous 48h.`.slice(0, 480),
          purpose: SmsPurpose.OTHER,
          userId: buyer.id,
        }).catch((e) => this.logger.warn(`fulfillment cancel SMS failed: ${e?.message || e}`));
      }
      if (buyer.email) {
        // Re-use the support-ticket email helper since it has the right tone for
        // service-affecting events. We don't have a dedicated cancellation template yet.
        this.email.sendSupportTicketUpdate({
          id: item.order_id,
          customerEmail: buyer.email,
          customerName: `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || undefined,
          subject: `Article annulé — ${ref}`,
          status: 'CANCELLED',
          latestResponse: `L'article "${item.title}" ne pourra pas être expédié par le vendeur.${reasonClause}\n\nNotre équipe support vous contactera sous 48h pour proposer un remboursement ou un article de remplacement.`,
        } as any).catch((e) => this.logger.warn(`fulfillment cancel email failed: ${e?.message || e}`));
      }
    }

    // Event for downstream consumers (lifecycle drips for "we're sorry" sequences,
    // observability, future analytics on seller cancellation rate per SKU).
    this.eventBus.publish('seller.fulfillment.cancelled', {
      fulfillmentId: saved.id, orderItemId, orderId: item.order_id, sellerId: seller.id,
      sellerName: seller.business_name,
      buyerId: buyer?.id ?? null,
      itemTitle: item.title,
      orderRef: order?.reference || null,
      reason: reason || null,
    }, { aggregateId: `order_item:${orderItemId}`, actorId: userId }).catch(() => {});

    return saved;
  }

  async ordersStats(userId: number) {
    const seller = await this.resolveSeller(userId);
    const since = new Date(Date.now() - 30 * 86400000);
    const rows = await this.orderItemRepo.createQueryBuilder('oi')
      .innerJoin(Product, 'p', 'p.id = oi.product_id')
      .innerJoin(Order, 'o', 'o.id = oi.order_id')
      .where('p.seller_id = :sid', { sid: seller.id })
      .andWhere("o.status NOT IN ('cancelled','failed','CANCELLED','FAILED','draft','DRAFT')")
      .select('SUM(oi.unit_price * oi.quantity)', 'gross')
      .addSelect('COUNT(DISTINCT oi.order_id)', 'orderCount')
      .addSelect('SUM(oi.quantity)', 'units')
      .getRawOne();

    const last30 = await this.orderItemRepo.createQueryBuilder('oi')
      .innerJoin(Product, 'p', 'p.id = oi.product_id')
      .innerJoin(Order, 'o', 'o.id = oi.order_id')
      .where('p.seller_id = :sid AND o.created_at >= :since', { sid: seller.id, since })
      .andWhere("o.status NOT IN ('cancelled','failed','CANCELLED','FAILED','draft','DRAFT')")
      .select('SUM(oi.unit_price * oi.quantity)', 'gross30')
      .addSelect('COUNT(DISTINCT oi.order_id)', 'orderCount30')
      .getRawOne();

    return {
      grossLifetime: Math.round(Number(rows?.gross || 0) * 1000) / 1000,
      orderCountLifetime: Number(rows?.orderCount || 0),
      unitsSold: Number(rows?.units || 0),
      gross30d: Math.round(Number(last30?.gross30 || 0) * 1000) / 1000,
      orders30d: Number(last30?.orderCount30 || 0),
    };
  }

  // ═══ Seller image gallery ═════════════════════════════════════════════

  async listImages(userId: number, productId: number) {
    await this.getMyProduct(userId, productId);
    return this.imageRepo.find({ where: { productId }, order: { position: 'ASC', id: 'ASC' } });
  }

  async addImage(userId: number, productId: number, imageUrl: string, altText?: string) {
    await this.getMyProduct(userId, productId);
    if (!imageUrl) throw new BadRequestException('imageUrl requis');
    const existing = await this.imageRepo.find({ where: { productId } });
    const row = this.imageRepo.create({
      productId,
      imageUrl: imageUrl.slice(0, 500),
      altText: altText ? altText.slice(0, 255) : null,
      position: existing.length,
    } as any) as unknown as ProductImage;
    const saved = await this.imageRepo.save(row) as ProductImage;

    // Promote first image to product.firstImageUrl so list views look right.
    if (existing.length === 0) {
      await this.productRepo.update({ id: productId }, { firstImageUrl: imageUrl } as any);
    }
    return saved;
  }

  async removeImage(userId: number, productId: number, imageId: number) {
    await this.getMyProduct(userId, productId);
    const img = await this.imageRepo.findOne({ where: { id: imageId, productId } });
    if (!img) throw new NotFoundException();
    await this.imageRepo.delete({ id: imageId });
    // If we just deleted the cover, promote the next one (or clear it).
    const remaining = await this.imageRepo.find({ where: { productId }, order: { position: 'ASC', id: 'ASC' } });
    const nextCover = remaining[0]?.imageUrl || null;
    await this.productRepo.update({ id: productId }, { firstImageUrl: nextCover } as any);
    return { success: true };
  }

  async reorderImages(userId: number, productId: number, orderedIds: number[]) {
    await this.getMyProduct(userId, productId);
    for (let i = 0; i < orderedIds.length; i++) {
      await this.imageRepo.update({ id: orderedIds[i], productId }, { position: i });
    }
    const first = await this.imageRepo.findOne({ where: { id: orderedIds[0], productId } });
    if (first) await this.productRepo.update({ id: productId }, { firstImageUrl: first.imageUrl } as any);
    return { success: true };
  }

  // ═══ Seller variants ══════════════════════════════════════════════════

  async listVariants(userId: number, productId: number) {
    await this.getMyProduct(userId, productId);
    return this.variantRepo.find({ where: { productId }, order: { position: 'ASC', id: 'ASC' } });
  }

  async addVariant(userId: number, productId: number, data: any) {
    await this.getMyProduct(userId, productId);
    const stock = Math.max(0, Math.floor(Number(data.stock || 0)));
    const ean = data.ean13 ? String(data.ean13).slice(0, 13) : null;
    if (ean && !/^\d{8,13}$/.test(ean)) throw new BadRequestException('EAN13 invalide');
    const row = this.variantRepo.create({
      productId,
      sku: data.sku ? String(data.sku).slice(0, 100) : null,
      couleur: data.couleur ? String(data.couleur).slice(0, 100) : null,
      taille: data.taille ? String(data.taille).slice(0, 50) : null,
      stock,
      priceAdjust: Number(data.priceAdjust || 0),
      position: Number(data.position || 0),
      ean13: ean,
    } as any) as unknown as ProductVariant;
    const saved = await this.variantRepo.save(row) as ProductVariant;
    await this.recomputeProductStock(productId);
    return saved;
  }

  async updateVariant(userId: number, productId: number, variantId: number, patch: any) {
    await this.getMyProduct(userId, productId);
    const v = await this.variantRepo.findOne({ where: { id: variantId, productId } });
    if (!v) throw new NotFoundException();
    if (patch.sku !== undefined) v.sku = String(patch.sku).slice(0, 100);
    if (patch.couleur !== undefined) v.couleur = String(patch.couleur).slice(0, 100);
    if (patch.taille !== undefined) v.taille = String(patch.taille).slice(0, 50);
    if (patch.stock !== undefined) v.stock = Math.max(0, Math.floor(Number(patch.stock) || 0));
    if (patch.priceAdjust !== undefined) v.priceAdjust = Number(patch.priceAdjust) || 0;
    if (patch.position !== undefined) v.position = Number(patch.position) || 0;
    if (patch.ean13 !== undefined) {
      const ean = patch.ean13 ? String(patch.ean13).slice(0, 13) : null;
      if (ean && !/^\d{8,13}$/.test(ean)) throw new BadRequestException('EAN13 invalide');
      v.ean13 = ean;
    }
    const saved = await this.variantRepo.save(v);
    await this.recomputeProductStock(productId);
    return saved;
  }

  async removeVariant(userId: number, productId: number, variantId: number) {
    await this.getMyProduct(userId, productId);
    // Capture the variant count *before* deletion so the recompute knows whether
    // we just emptied the variant list. beforeCount > 0 means the product had
    // variants when we started — if after delete it has 0, we must reset stock.
    const beforeCount = await this.variantRepo.count({ where: { productId } });
    await this.variantRepo.delete({ id: variantId, productId });
    await this.recomputeProductStock(productId, beforeCount > 0);
    return { success: true };
  }

  // Bulk CSV import — accepts a string body. Schema (header row required):
  //   couleur,taille,sku,ean13,stock,priceAdjust
  // Returns a structured report so the seller can fix bad rows and re-import only those.
  // Hard cap: 500 rows per call. Each row validated independently — one bad row
  // doesn't abort the import.
  async importVariantsCsv(userId: number, productId: number, csv: string) {
    await this.getMyProduct(userId, productId);
    if (!csv || csv.length === 0) throw new BadRequestException('CSV vide');
    if (csv.length > 1024 * 1024) throw new BadRequestException('CSV trop volumineux (1 MB max)');

    const rows = this.parseCsv(csv);
    if (rows.length === 0) throw new BadRequestException('CSV : aucune ligne');
    if (rows.length > 501) throw new BadRequestException('Maximum 500 lignes par import');

    const expectedHeaders = ['couleur', 'taille', 'sku', 'ean13', 'stock', 'priceadjust'];
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const headerIdx: Record<string, number> = {};
    for (const h of expectedHeaders) {
      const idx = header.indexOf(h);
      if (idx === -1) throw new BadRequestException(`Colonne manquante: ${h}. Header attendu: couleur,taille,sku,ean13,stock,priceAdjust`);
      headerIdx[h] = idx;
    }

    const dataRows = rows.slice(1);
    const report = {
      total: dataRows.length, created: 0, updated: 0, skipped: 0,
      errors: [] as Array<{ line: number; reason: string }>,
    };

    const existing = await this.variantRepo.find({ where: { productId } });
    const bySku = new Map(existing.filter(v => v.sku).map(v => [v.sku!.toLowerCase(), v]));
    const byEan = new Map(existing.filter(v => v.ean13).map(v => [v.ean13!, v]));

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const lineNum = i + 2; // human-friendly: header is line 1
      try {
        const couleur = (row[headerIdx['couleur']] || '').trim() || null;
        const taille = (row[headerIdx['taille']] || '').trim() || null;
        const sku = (row[headerIdx['sku']] || '').trim() || null;
        const ean13 = (row[headerIdx['ean13']] || '').trim() || null;
        const stockRaw = (row[headerIdx['stock']] || '0').trim();
        const priceAdjustRaw = (row[headerIdx['priceadjust']] || '0').trim();

        const stock = parseInt(stockRaw, 10);
        const priceAdjust = parseFloat(priceAdjustRaw);
        if (isNaN(stock) || stock < 0) { report.errors.push({ line: lineNum, reason: `stock invalide: "${stockRaw}"` }); report.skipped++; continue; }
        if (isNaN(priceAdjust)) { report.errors.push({ line: lineNum, reason: `priceAdjust invalide: "${priceAdjustRaw}"` }); report.skipped++; continue; }
        if (ean13 && !/^\d{8,13}$/.test(ean13)) { report.errors.push({ line: lineNum, reason: `EAN13 doit être 8-13 chiffres: "${ean13}"` }); report.skipped++; continue; }
        if (!couleur && !taille && !sku && !ean13) { report.errors.push({ line: lineNum, reason: 'ligne vide' }); report.skipped++; continue; }

        // Upsert: match by SKU first, then EAN13. Else create new.
        let target: ProductVariant | null = null;
        if (sku && bySku.has(sku.toLowerCase())) target = bySku.get(sku.toLowerCase())!;
        else if (ean13 && byEan.has(ean13)) target = byEan.get(ean13)!;

        if (target) {
          target.couleur = couleur;
          target.taille = taille;
          target.sku = sku ? sku.slice(0, 100) : null;
          target.ean13 = ean13;
          target.stock = stock;
          target.priceAdjust = priceAdjust;
          await this.variantRepo.save(target);
          report.updated++;
        } else {
          const v = this.variantRepo.create({
            productId,
            couleur, taille,
            sku: sku ? sku.slice(0, 100) : null,
            ean13, stock, priceAdjust,
            position: existing.length + report.created,
          } as any) as unknown as ProductVariant;
          await this.variantRepo.save(v);
          report.created++;
        }
      } catch (err: any) {
        report.errors.push({ line: lineNum, reason: err?.message?.slice(0, 200) || 'erreur inconnue' });
        report.skipped++;
      }
    }

    await this.recomputeProductStock(productId);
    this.eventBus.publish('seller.variants_imported', {
      productId, total: report.total, created: report.created, updated: report.updated, skipped: report.skipped,
    }, { aggregateId: `product:${productId}`, actorId: userId }).catch(() => {});

    return report;
  }

  // Minimal RFC-4180-ish CSV parser. Handles quoted fields with embedded commas
  // and double-quote escaping. Trailing empty rows are dropped.
  private parseCsv(csv: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let i = 0;
    let inQuotes = false;
    const text = csv.replace(/\r\n?/g, '\n');
    while (i < text.length) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += c; i++;
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.length > 0 && r.some((cell) => cell.trim().length > 0));
  }

  // Keep Product.totalStock in sync with the SUM of its variants.
  // hadVariantsBefore=true when the caller knows the product had ≥1 variant
  // before the current operation. If it now has 0, we deliberately reset stock
  // to 0 to avoid selling phantom inventory carried over from the variant era;
  // the seller must explicitly set a new stock value via the product form.
  private async recomputeProductStock(productId: number, hadVariantsBefore = false) {
    const variants = await this.variantRepo.find({ where: { productId } });
    if (variants.length === 0) {
      if (hadVariantsBefore) {
        await this.productRepo.update({ id: productId }, { totalStock: 0 } as any);
      }
      return;
    }
    const total = variants.reduce((s, v) => s + Number(v.stock || 0), 0);
    await this.productRepo.update({ id: productId }, { totalStock: total } as any);
  }
}
