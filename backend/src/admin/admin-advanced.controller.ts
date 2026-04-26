import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { Response } from 'express';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

import { AdminLog } from '../analytics/entities/admin-log.entity';
import { SearchQuery } from '../analytics/entities/search-query.entity';
import { StockMovement } from '../analytics/entities/stock-movement.entity';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { Category } from '../categories/entities/category.entity';
import { NewsletterSubscriber } from '../newsletter/entities/newsletter-subscriber.entity';
import { NewsletterCampaign } from '../newsletter/entities/newsletter-campaign.entity';
import { PricingRule } from '../promotions/entities/pricing-rule.entity';
import { Notification, NotificationType } from '../notifications/entities/notification.entity';
import { Coupon, CouponDiscountType } from '../promotions/entities/coupon.entity';
import { CouponUsage } from '../promotions/entities/coupon-usage.entity';
import { EmailService } from '../email/email.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class AdminAdvancedController {
  constructor(
    @InjectRepository(AdminLog) private readonly adminLogRepo: Repository<AdminLog>,
    @InjectRepository(SearchQuery) private readonly searchRepo: Repository<SearchQuery>,
    @InjectRepository(StockMovement) private readonly stockMovRepo: Repository<StockMovement>,
    @InjectRepository(CartItem) private readonly cartItemRepo: Repository<CartItem>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Category) private readonly categoryRepo: Repository<Category>,
    @InjectRepository(NewsletterSubscriber) private readonly newsletterRepo: Repository<NewsletterSubscriber>,
    @InjectRepository(NewsletterCampaign) private readonly campaignRepo: Repository<NewsletterCampaign>,
    @InjectRepository(PricingRule) private readonly pricingRepo: Repository<PricingRule>,
    @InjectRepository(Notification) private readonly notifRepo: Repository<Notification>,
    @InjectRepository(Coupon) private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(CouponUsage) private readonly couponUsageRepo: Repository<CouponUsage>,
    private readonly emailService: EmailService,
  ) {}

  // ═══ 2. ACTIVITY LOG ════════════════════════════════════════════════
  @Get('activity-log')
  async activityLog(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
  ) {
    const qb = this.adminLogRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.admin', 'a')
      .orderBy('l.timestamp', 'DESC');
    if (action) qb.andWhere('l.action LIKE :a', { a: `%${action}%` });
    if (resource) qb.andWhere('l.resource_type = :r', { r: resource });

    const total = await qb.getCount();
    const rows = await qb.skip((page - 1) * limit).take(limit).getMany();
    const items = rows.map((l) => ({
      id: l.id,
      adminId: l.admin_id,
      adminName: l.admin ? `${l.admin.first_name || ''} ${l.admin.last_name || ''}`.trim() : '—',
      adminEmail: l.admin?.email,
      action: l.action,
      resourceType: l.resource_type,
      resourceId: l.resource_id,
      oldValues: l.old_values,
      newValues: l.new_values,
      timestamp: l.timestamp,
    }));
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ═══ 3. SEARCH ANALYTICS ═══════════════════════════════════════════
  @Get('search-analytics')
  async searchAnalytics(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const top = await this.searchRepo
      .createQueryBuilder('s')
      .select('s.query', 'query')
      .addSelect('COUNT(s.id)', 'count')
      .addSelect('AVG(CAST(s.result_count AS FLOAT))', 'avgResults')
      .where('s.created_at >= :since', { since })
      .groupBy('s.query')
      .orderBy('COUNT(s.id)', 'DESC')
      .limit(20)
      .getRawMany();

    const noResults = await this.searchRepo
      .createQueryBuilder('s')
      .select('s.query', 'query')
      .addSelect('COUNT(s.id)', 'count')
      .where('s.created_at >= :since', { since })
      .andWhere('s.result_count = 0')
      .groupBy('s.query')
      .orderBy('COUNT(s.id)', 'DESC')
      .limit(20)
      .getRawMany();

    const totalQueries = await this.searchRepo
      .createQueryBuilder('s')
      .where('s.created_at >= :since', { since })
      .getCount();

    return {
      totalQueries,
      topQueries: top.map((r) => ({
        query: r.query,
        count: Number(r.count),
        avgResults: Math.round(Number(r.avgResults || 0)),
      })),
      noResultQueries: noResults.map((r) => ({
        query: r.query,
        count: Number(r.count),
      })),
    };
  }

  @Post('search-analytics/track')
  async trackSearch(
    @Body() body: { query: string; resultCount?: number; indexName?: string; userId?: number },
  ) {
    if (!body.query || !body.query.trim()) return { recorded: false };
    const entry = this.searchRepo.create({
      query: body.query.trim().substring(0, 255),
      result_count: Number(body.resultCount || 0),
      index_name: body.indexName || null,
      user_id: body.userId || null,
    });
    await this.searchRepo.save(entry);
    return { recorded: true };
  }

  // ═══ 4. ABANDONED CART RECOVERY ════════════════════════════════════
  @Get('abandoned-carts')
  async abandonedCarts(
    @Query('hours', new DefaultValuePipe(24), ParseIntPipe) hours: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    const threshold = new Date();
    threshold.setHours(threshold.getHours() - hours);

    // Join cart items with product to compute cart value (cart_item has no unit_price column)
    const rows = await this.cartItemRepo
      .createQueryBuilder('ci')
      .leftJoin('ci.user', 'u')
      .leftJoin(Product, 'p', 'p.id = ci.product_id')
      .select('u.id', 'userId')
      .addSelect('u.email', 'email')
      .addSelect("u.first_name + ' ' + u.last_name", 'name')
      .addSelect('COUNT(ci.id)', 'itemCount')
      .addSelect('SUM(ci.quantity * p.current_price)', 'cartValue')
      .addSelect('MAX(ci.added_at)', 'lastUpdate')
      .where('ci.added_at < :threshold', { threshold })
      .andWhere('u.id IS NOT NULL')
      .groupBy('u.id')
      .addGroupBy('u.email')
      .addGroupBy('u.first_name')
      .addGroupBy('u.last_name')
      .orderBy('SUM(ci.quantity * p.current_price)', 'DESC')
      .limit(limit)
      .getRawMany();

    const items = rows.map((r) => ({
      userId: Number(r.userId),
      email: r.email,
      name: r.name,
      itemCount: Number(r.itemCount),
      cartValue: Math.round(Number(r.cartValue || 0) * 100) / 100,
      lastUpdate: r.lastUpdate,
      hoursSinceUpdate: Math.floor((Date.now() - new Date(r.lastUpdate).getTime()) / 3600000),
    }));

    return {
      items,
      thresholdHours: hours,
      totalValue: items.reduce((s, i) => s + i.cartValue, 0),
    };
  }

  @Post('abandoned-carts/recover')
  async sendCartRecovery(
    @Body() body: { userId: number; discountPercent?: number; message?: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId requis');

    const user = await this.userRepo.findOne({ where: { id: body.userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const pct = Math.max(0, Math.min(50, Number(body.discountPercent) || 10));

    // Generate a single-use coupon for this customer
    const code = 'WB' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const validTo = new Date();
    validTo.setDate(validTo.getDate() + 7); // expires in 7 days

    const coupon = this.couponRepo.create({
      code,
      description: `Panier abandonné — ${user.email}`,
      discount_type: CouponDiscountType.PERCENTAGE,
      discount_value: pct,
      valid_from: new Date(),
      valid_to: validTo,
      usage_limit: 1,
      per_user_limit: 1,
      is_active: true,
    } as any);
    await this.couponRepo.save(coupon);

    // Send notification
    const defaultMsg = body.message ||
      `Votre panier vous attend ! Profitez de -${pct}% avec le code ${code} valable 7 jours.`;
    const notif = this.notifRepo.create({
      user_id: user.id,
      type: NotificationType.PROMOTION,
      title: 'Finalisez votre panier avec une réduction',
      message: defaultMsg,
      action_url: '/tn/panier',
      is_read: false,
    });
    await this.notifRepo.save(notif);

    // Send recovery email (fire-and-forget; doesn't block response)
    let emailSent = false;
    try {
      emailSent = await this.emailService.sendCartRecovery(
        user.email,
        [user.first_name, user.last_name].filter(Boolean).join(' ') || undefined,
        code,
        pct,
        validTo,
      );
    } catch (err) {
      // emailSent stays false
    }

    return {
      success: true,
      couponCode: code,
      discountPercent: pct,
      expiresAt: validTo,
      notificationId: notif.id,
      emailSent,
    };
  }

  // ═══ 5. STOCK MOVEMENT LOG ═════════════════════════════════════════
  @Get('stock-movements')
  async stockMovements(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query('productId') productId?: string,
    @Query('reason') reason?: string,
  ) {
    const qb = this.stockMovRepo
      .createQueryBuilder('m')
      .orderBy('m.created_at', 'DESC');
    if (productId) qb.andWhere('m.product_id = :pid', { pid: Number(productId) });
    if (reason) qb.andWhere('m.reason = :r', { r: reason });

    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  @Post('stock-movements')
  async addStockMovement(
    @Body()
    body: {
      productId: number;
      newStock: number;
      reason?: string;
      notes?: string;
    },
  ) {
    if (!body.productId || body.newStock == null) {
      throw new BadRequestException('productId et newStock requis');
    }
    const product = await this.productRepo.findOne({ where: { id: body.productId } });
    if (!product) throw new NotFoundException('Produit introuvable');

    const prev = product.totalStock;
    const next = Number(body.newStock);
    product.totalStock = next;
    await this.productRepo.save(product);

    const mov = this.stockMovRepo.create({
      product_id: product.id,
      previous_stock: prev,
      new_stock: next,
      delta: next - prev,
      reason: body.reason || 'ADMIN_ADJUSTMENT',
      notes: body.notes || null,
    });
    await this.stockMovRepo.save(mov);
    return { success: true, movement: mov };
  }

  // ═══ 6. PRODUCT CSV EXPORT ═════════════════════════════════════════
  @Get('products/export/csv')
  async exportProductsCsv(@Res() res: Response) {
    const products = await this.productRepo.find({ order: { id: 'ASC' } });
    const headers = [
      'id', 'sku', 'title', 'slug', 'price', 'current_price',
      'famille', 'total_stock', 'is_active', 'is_featured', 'first_image_url',
    ];
    const lines = [headers.join(',')];
    for (const p of products) {
      const esc = (v: any) => {
        if (v == null) return '';
        const s = String(v).replace(/"/g, '""');
        return /[,"\n]/.test(s) ? `"${s}"` : s;
      };
      lines.push([
        p.id, esc(p.sku), esc(p.title), esc(p.slug),
        p.price, p.currentPrice, esc(p.famille),
        p.totalStock, p.isActive ? 1 : 0, p.isFeatured ? 1 : 0,
        esc(p.firstImageUrl),
      ].join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
    res.send(lines.join('\n'));
  }

  @Post('products/import/csv')
  async importProductsCsv(@Body() body: { csv: string }) {
    if (!body.csv) throw new BadRequestException('CSV content required');
    const lines = body.csv.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { imported: 0, updated: 0, errors: ['Empty CSV'] };
    const headers = lines[0].split(',').map((h) => h.trim());
    const errors: string[] = [];
    let imported = 0;
    let updated = 0;
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      const row: any = {};
      headers.forEach((h, idx) => (row[h] = values[idx]));
      try {
        const sku = row.sku;
        if (!sku || !row.title) { errors.push(`Line ${i + 1}: sku/title required`); continue; }
        let product = await this.productRepo.findOne({ where: { sku } });
        const data: any = {
          sku,
          title: row.title,
          slug: row.slug || row.title?.toLowerCase().replace(/\s+/g, '-'),
          price: Number(row.price) || 0,
          currentPrice: Number(row.current_price) || Number(row.price) || 0,
          famille: row.famille || 'UNISEX',
          totalStock: Number(row.total_stock) || 0,
          isActive: row.is_active === '1' || row.is_active === 'true',
          isFeatured: row.is_featured === '1' || row.is_featured === 'true',
          firstImageUrl: row.first_image_url || null,
        };
        if (product) {
          Object.assign(product, data);
          await this.productRepo.save(product);
          updated++;
        } else {
          product = this.productRepo.create(data) as any;
          await this.productRepo.save(product);
          imported++;
        }
      } catch (e: any) {
        errors.push(`Line ${i + 1}: ${e.message}`);
      }
    }
    return { imported, updated, errors };
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) { result.push(cur); cur = ''; }
      else cur += c;
    }
    result.push(cur);
    return result;
  }

  // ═══ 7. NEWSLETTER CAMPAIGNS ═══════════════════════════════════════
  @Get('campaigns')
  async listCampaigns() {
    const items = await this.campaignRepo.find({ order: { created_at: 'DESC' } });
    return { items };
  }

  @Post('campaigns')
  async createCampaign(@Body() body: any) {
    if (!body.name || !body.subject || !body.body) {
      throw new BadRequestException('name, subject, body requis');
    }
    const c = this.campaignRepo.create({
      name: body.name,
      subject: body.subject,
      body: body.body,
      cta_label: body.ctaLabel || null,
      cta_url: body.ctaUrl || null,
      status: 'DRAFT',
    });
    return this.campaignRepo.save(c);
  }

  @Put('campaigns/:id')
  async updateCampaign(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const c = await this.campaignRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Campaign not found');
    if (c.status === 'SENT') throw new BadRequestException('Cannot edit sent campaign');
    if (body.name !== undefined) c.name = body.name;
    if (body.subject !== undefined) c.subject = body.subject;
    if (body.body !== undefined) c.body = body.body;
    if (body.ctaLabel !== undefined) c.cta_label = body.ctaLabel;
    if (body.ctaUrl !== undefined) c.cta_url = body.ctaUrl;
    return this.campaignRepo.save(c);
  }

  @Post('campaigns/:id/send')
  async sendCampaign(@Param('id', ParseIntPipe) id: number) {
    const c = await this.campaignRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Campaign not found');
    if (c.status === 'SENT') throw new BadRequestException('Already sent');
    // Active subscribers: confirmed AND not unsubscribed
    const subs = await this.newsletterRepo
      .createQueryBuilder('n')
      .where('n.is_confirmed = :c', { c: true })
      .andWhere('n.unsubscribed_at IS NULL')
      .getMany();
    c.status = 'SENT';
    c.sent_count = subs.length;
    c.sent_at = new Date();
    await this.campaignRepo.save(c);
    return { success: true, sent: subs.length };
  }

  @Delete('campaigns/:id')
  async deleteCampaign(@Param('id', ParseIntPipe) id: number) {
    const c = await this.campaignRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Campaign not found');
    await this.campaignRepo.remove(c);
    return { success: true };
  }

  // ═══ 8. CUSTOMER SEGMENTATION ══════════════════════════════════════
  @Get('segments')
  async segments() {
    const customers = await this.userRepo
      .createQueryBuilder('u')
      .where('LOWER(u.role) = :role', { role: 'customer' })
      .getMany();

    const segments = { VIP: 0, LOYAL: 0, NEW: 0, AT_RISK: 0, PROSPECT: 0 };

    for (const u of customers) {
      const rows = await this.orderRepo
        .createQueryBuilder('o')
        .select('COUNT(o.id)', 'c')
        .addSelect('SUM(o.total_amount)', 't')
        .addSelect('MAX(o.created_at)', 'last')
        .where('o.user_id = :uid', { uid: u.id })
        // Accept both casings until the normalize-statuses migration has run everywhere.
        .andWhere("UPPER(o.status) NOT IN ('CANCELLED','FAILED')")
        .getRawOne();
      const count = Number(rows.c || 0);
      const total = Number(rows.t || 0);
      const last = rows.last ? new Date(rows.last) : null;
      const daysSince = last ? Math.floor((Date.now() - last.getTime()) / 86400000) : null;

      if (count === 0) segments.PROSPECT++;
      else if (count >= 10 || total >= 2000) segments.VIP++;
      else if (daysSince != null && daysSince > 90) segments.AT_RISK++;
      else if (count >= 3) segments.LOYAL++;
      else segments.NEW++;
    }

    return {
      totalCustomers: customers.length,
      segments,
      definitions: {
        VIP: '10+ orders OR 2000+ TND lifetime spend',
        LOYAL: '3-9 orders, active',
        NEW: '1-2 orders, active',
        AT_RISK: 'has orders, inactive 90+ days',
        PROSPECT: 'registered, never ordered',
      },
    };
  }

  // ═══ 9. SEO MANAGER ════════════════════════════════════════════════
  @Get('seo/products')
  async seoProducts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('missing') missing?: string,
  ) {
    const qb = this.productRepo.createQueryBuilder('p').orderBy('p.id', 'ASC');
    if (missing === 'true') {
      qb.andWhere('(p.metaTitle IS NULL OR p.metaDescription IS NULL)');
    }
    const total = await qb.getCount();
    const rows = await qb.skip((page - 1) * limit).take(limit).getMany();
    const items = rows.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
      keywords: p.keywords,
      score: this.seoScore(p),
    }));
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  @Put('seo/products/:id')
  async updateProductSeo(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { metaTitle?: string; metaDescription?: string; keywords?: string },
  ) {
    const p = await this.productRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Product not found');
    if (body.metaTitle !== undefined) p.metaTitle = body.metaTitle;
    if (body.metaDescription !== undefined) p.metaDescription = body.metaDescription;
    if (body.keywords !== undefined) p.keywords = body.keywords;
    return this.productRepo.save(p);
  }

  @Get('seo/categories')
  async seoCategories() {
    const cats = await this.categoryRepo.find();
    return {
      items: cats.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        metaTitle: c.metaTitle,
        metaDescription: c.metaDescription,
        keywords: c.keywords,
        score: this.seoScore(c),
      })),
    };
  }

  @Put('seo/categories/:id')
  async updateCategorySeo(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { metaTitle?: string; metaDescription?: string; keywords?: string },
  ) {
    const c = await this.categoryRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Category not found');
    if (body.metaTitle !== undefined) c.metaTitle = body.metaTitle;
    if (body.metaDescription !== undefined) c.metaDescription = body.metaDescription;
    if (body.keywords !== undefined) c.keywords = body.keywords;
    return this.categoryRepo.save(c);
  }

  private seoScore(o: any): number {
    let s = 0;
    if (o.metaTitle && String(o.metaTitle).length >= 30 && String(o.metaTitle).length <= 60) s += 40;
    else if (o.metaTitle) s += 20;
    if (o.metaDescription && String(o.metaDescription).length >= 120 && String(o.metaDescription).length <= 160) s += 40;
    else if (o.metaDescription) s += 20;
    if (o.keywords) s += 20;
    return s;
  }

  // ═══ 10. SMART PRICING RULES ═══════════════════════════════════════
  @Get('pricing-rules')
  async listPricingRules() {
    const items = await this.pricingRepo.find({ order: { priority: 'DESC', created_at: 'DESC' } });
    return { items };
  }

  @Post('pricing-rules')
  async createPricingRule(@Body() body: any) {
    if (!body.name || !body.ruleType || body.discountValue == null) {
      throw new BadRequestException('name, ruleType, discountValue requis');
    }
    const rule = this.pricingRepo.create({
      name: body.name,
      rule_type: body.ruleType,
      discount_type: body.discountType || 'percentage',
      discount_value: Number(body.discountValue),
      target_type: body.targetType || null,
      target_value: body.targetValue || null,
      min_quantity: body.minQuantity || null,
      min_amount: body.minAmount || null,
      priority: body.priority || 0,
      segment: body.segment || null,
      is_active: body.isActive !== false,
      valid_from: body.validFrom ? new Date(body.validFrom) : null,
      valid_to: body.validTo ? new Date(body.validTo) : null,
    });
    return this.pricingRepo.save(rule);
  }

  @Put('pricing-rules/:id')
  async updatePricingRule(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const r = await this.pricingRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Rule not found');
    if (body.name !== undefined) r.name = body.name;
    if (body.discountType !== undefined) r.discount_type = body.discountType;
    if (body.discountValue !== undefined) r.discount_value = Number(body.discountValue);
    if (body.targetType !== undefined) r.target_type = body.targetType;
    if (body.targetValue !== undefined) r.target_value = body.targetValue;
    if (body.priority !== undefined) r.priority = body.priority;
    if (body.isActive !== undefined) r.is_active = body.isActive;
    return this.pricingRepo.save(r);
  }

  @Post('pricing-rules/:id/toggle')
  async togglePricingRule(@Param('id', ParseIntPipe) id: number) {
    const r = await this.pricingRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Rule not found');
    r.is_active = !r.is_active;
    await this.pricingRepo.save(r);
    return { id, isActive: r.is_active };
  }

  @Delete('pricing-rules/:id')
  async deletePricingRule(@Param('id', ParseIntPipe) id: number) {
    const r = await this.pricingRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Rule not found');
    await this.pricingRepo.remove(r);
    return { success: true };
  }

  // ═══ 11. COUPON USAGE ANALYTICS ════════════════════════════════════
  @Get('coupons-analytics')
  async couponsAnalytics() {
    const coupons = await this.couponRepo.find({ order: { created_at: 'DESC' } });
    const out: any[] = [];
    for (const c of coupons) {
      const usages = await this.couponUsageRepo.find({ where: { coupon_id: c.id } });
      const totalDiscount = usages.reduce((s, u) => s + Number(u.discount_amount || 0), 0);
      const uniqueCustomers = new Set(usages.map((u) => u.user_id)).size;
      const redemptionRate = c.usage_limit
        ? Math.round(((c.usage_count || 0) / c.usage_limit) * 100)
        : null;
      out.push({
        id: c.id,
        code: c.code,
        description: c.description,
        discountType: c.discount_type,
        discountValue: Number(c.discount_value),
        isActive: c.is_active,
        usageCount: c.usage_count || 0,
        usageLimit: c.usage_limit,
        redemptionRate,
        uniqueCustomers,
        totalDiscount: Math.round(totalDiscount * 100) / 100,
        validTo: c.valid_to,
        createdAt: c.created_at,
      });
    }

    const totalCoupons = coupons.length;
    const activeCoupons = coupons.filter((c) => c.is_active).length;
    const totalRedemptions = coupons.reduce((s, c) => s + (c.usage_count || 0), 0);
    const totalDiscountAllTime = out.reduce((s, c) => s + c.totalDiscount, 0);

    return {
      summary: {
        totalCoupons,
        activeCoupons,
        totalRedemptions,
        totalDiscountAllTime: Math.round(totalDiscountAllTime * 100) / 100,
      },
      coupons: out,
    };
  }
}
