import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { B2BAccount, B2BPaymentTerms, B2BStatus, B2BTier } from './entities/b2b-account.entity';
import { B2BQuote, QuoteStatus } from './entities/b2b-quote.entity';
import { Product } from '../products/entities/product.entity';
import { EventBusService } from '../platform/events/event-bus.service';

const TIER_DISCOUNT: Record<B2BTier, number> = {
  [B2BTier.BRONZE]: 5,
  [B2BTier.SILVER]: 10,
  [B2BTier.GOLD]: 15,
  [B2BTier.PLATINUM]: 20,
};

@Injectable()
export class B2BService {
  private readonly logger = new Logger(B2BService.name);

  constructor(
    @InjectRepository(B2BAccount) private readonly accRepo: Repository<B2BAccount>,
    @InjectRepository(B2BQuote) private readonly quoteRepo: Repository<B2BQuote>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    private readonly eventBus: EventBusService,
  ) {}

  effectiveDiscountPct(acc: B2BAccount): number {
    if (acc.custom_discount_pct != null) return acc.custom_discount_pct;
    return TIER_DISCOUNT[acc.tier] ?? 0;
  }

  // ═══ Customer-facing ══════════════════════════════════════════════════

  async apply(userId: number, data: {
    companyName: string; contactEmail: string; contactName?: string;
    vatNumber?: string; registryNumber?: string; contactPhone?: string;
    address?: string; city?: string;
  }) {
    if (!data.companyName || !data.contactEmail) throw new BadRequestException('company name + contact email requis');
    const existing = await this.accRepo.findOne({ where: { user_id: userId } });
    if (existing) throw new BadRequestException('Un compte B2B existe déjà pour cet utilisateur');
    const acc = this.accRepo.create({
      user_id: userId,
      company_name: data.companyName,
      contact_email: data.contactEmail,
      contact_name: data.contactName || null,
      vat_number: data.vatNumber || null,
      registry_number: data.registryNumber || null,
      contact_phone: data.contactPhone || null,
      address: data.address || null,
      city: data.city || null,
      tier: B2BTier.BRONZE,
      credit_limit: 0,
      credit_used: 0,
      status: B2BStatus.PENDING,
      payment_terms: B2BPaymentTerms.PREPAID,
      tax_exempt: false,
    });
    const saved = await this.accRepo.save(acc);
    this.eventBus.publish('b2b.applied', { accountId: saved.id, userId }, {
      aggregateId: `b2b:${saved.id}`, actorId: userId,
    }).catch(() => {});
    return saved;
  }

  async getMine(userId: number) {
    return this.accRepo.findOne({ where: { user_id: userId } });
  }

  // Price list — apply effective discount on every product for this user.
  async priceList(userId: number): Promise<Array<{ productId: number; title: string; base: number; b2b: number; discountPct: number }>> {
    const acc = await this.getMine(userId);
    if (!acc || acc.status !== B2BStatus.APPROVED) throw new ForbiddenException();
    const products = await this.productRepo.find({ where: { isActive: true } as any });
    const pct = this.effectiveDiscountPct(acc);
    return products.map((p) => {
      const base = Number((p as any).currentPrice || 0);
      const b2b = Math.round(base * (1 - pct / 100) * 1000) / 1000;
      return { productId: p.id, title: p.title, base, b2b, discountPct: pct };
    });
  }

  async createQuote(userId: number, items: Array<{ productId: number; quantity: number }>, notes?: string) {
    const acc = await this.getMine(userId);
    if (!acc || acc.status !== B2BStatus.APPROVED) throw new ForbiddenException();
    if (!items?.length) throw new BadRequestException('items required');

    const prodIds = items.map((i) => i.productId);
    const prods = await this.productRepo.find({ where: { id: In(prodIds) } });
    const byId = new Map(prods.map((p) => [p.id, p]));

    const pct = this.effectiveDiscountPct(acc);
    const enriched = items.map((i) => {
      const p = byId.get(i.productId);
      if (!p) throw new NotFoundException(`product ${i.productId} not found`);
      const unit = Number((p as any).currentPrice || 0);
      const b2bUnit = Math.round(unit * (1 - pct / 100) * 1000) / 1000;
      const qty = Math.max(1, Number(i.quantity || 1));
      return { productId: p.id, title: p.title, quantity: qty, unitPrice: b2bUnit, lineTotal: b2bUnit * qty };
    });
    const subtotal = enriched.reduce((s, e) => s + e.lineTotal, 0);

    const q = this.quoteRepo.create({
      account_id: acc.id,
      user_id: userId,
      items: enriched,
      subtotal,
      proposed_discount_pct: pct,
      approved_discount_pct: null,
      total: subtotal,
      status: QuoteStatus.SUBMITTED,
      valid_until: new Date(Date.now() + 30 * 86400000),
      notes: notes?.slice(0, 1000) || null,
    });
    const saved = await this.quoteRepo.save(q);
    this.eventBus.publish('b2b.quote.submitted', { quoteId: saved.id, accountId: acc.id, subtotal }, {
      aggregateId: `b2b_quote:${saved.id}`, actorId: userId,
    }).catch(() => {});
    return saved;
  }

  async listMyQuotes(userId: number) {
    const acc = await this.getMine(userId);
    if (!acc) return [];
    return this.quoteRepo.find({ where: { account_id: acc.id }, order: { created_at: 'DESC' } });
  }

  // ═══ Admin ═════════════════════════════════════════════════════════════

  adminList(status?: string) {
    const qb = this.accRepo.createQueryBuilder('a').orderBy('a.created_at', 'DESC');
    if (status) qb.andWhere('a.status = :s', { s: status.toUpperCase() });
    return qb.getMany();
  }

  async approveAccount(id: number, adminId: number, opts: {
    tier?: B2BTier; customDiscountPct?: number; creditLimit?: number; paymentTerms?: B2BPaymentTerms; taxExempt?: boolean;
  }) {
    const a = await this.accRepo.findOne({ where: { id } });
    if (!a) throw new NotFoundException();
    a.status = B2BStatus.APPROVED;
    a.approved_at = new Date();
    a.approved_by = adminId;
    if (opts.tier) a.tier = opts.tier;
    if (opts.customDiscountPct != null) a.custom_discount_pct = Number(opts.customDiscountPct);
    if (opts.creditLimit != null) a.credit_limit = Number(opts.creditLimit);
    if (opts.paymentTerms) a.payment_terms = opts.paymentTerms;
    if (opts.taxExempt != null) a.tax_exempt = !!opts.taxExempt;
    await this.accRepo.save(a);
    this.eventBus.publish('b2b.approved', { accountId: id, adminId, tier: a.tier }, {
      aggregateId: `b2b:${id}`, actorId: adminId,
    }).catch(() => {});
    return a;
  }

  async adminListQuotes(status?: string) {
    const qb = this.quoteRepo.createQueryBuilder('q').orderBy('q.created_at', 'DESC');
    if (status) qb.andWhere('q.status = :s', { s: status.toUpperCase() });
    return qb.getMany();
  }

  async reviewQuote(quoteId: number, adminId: number, action: 'APPROVE' | 'REJECT', patch?: { approvedDiscountPct?: number; adminNotes?: string }) {
    const q = await this.quoteRepo.findOne({ where: { id: quoteId } });
    if (!q) throw new NotFoundException();
    if (action === 'APPROVE') {
      q.status = QuoteStatus.APPROVED;
      if (patch?.approvedDiscountPct != null) {
        q.approved_discount_pct = Number(patch.approvedDiscountPct);
        // Recompute total with the admin's discount
        const baseSubtotal = q.items.reduce((s, it) => s + (it.unitPrice / (1 - q.proposed_discount_pct / 100)) * it.quantity, 0);
        q.total = Math.round(baseSubtotal * (1 - q.approved_discount_pct / 100) * 1000) / 1000;
      }
    } else {
      q.status = QuoteStatus.REJECTED;
    }
    if (patch?.adminNotes) q.admin_notes = patch.adminNotes.slice(0, 1000);
    await this.quoteRepo.save(q);
    this.eventBus.publish(`b2b.quote.${action.toLowerCase()}d`, { quoteId, accountId: q.account_id, adminId }, {
      aggregateId: `b2b_quote:${quoteId}`, actorId: adminId,
    }).catch(() => {});
    return q;
  }

  async stats() {
    const [total, approved, pending, quotesOpen] = await Promise.all([
      this.accRepo.count(),
      this.accRepo.count({ where: { status: B2BStatus.APPROVED } }),
      this.accRepo.count({ where: { status: B2BStatus.PENDING } }),
      this.quoteRepo.count({ where: { status: In([QuoteStatus.SUBMITTED, QuoteStatus.UNDER_REVIEW]) } }),
    ]);
    return { total, approved, pending, quotesOpen };
  }
}
