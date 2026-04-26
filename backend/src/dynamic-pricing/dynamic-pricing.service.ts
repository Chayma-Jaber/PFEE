import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DynamicPriceRule, DynamicPricingScope, DynamicPricingStrategy } from './entities/dynamic-price-rule.entity';
import { DynamicPriceChange } from './entities/dynamic-price-change.entity';
import { Product } from '../products/entities/product.entity';
import { EventBusService } from '../platform/events/event-bus.service';

export interface SweepResult {
  scanned: number;
  applied: number;
  proposed: number;
  skipped: number;
  changes: Array<{ productId: number; from: number; to: number; pct: number; status: string; reason: string }>;
}

@Injectable()
export class DynamicPricingService {
  private readonly logger = new Logger(DynamicPricingService.name);

  constructor(
    @InjectRepository(DynamicPriceRule) private readonly ruleRepo: Repository<DynamicPriceRule>,
    @InjectRepository(DynamicPriceChange) private readonly changeRepo: Repository<DynamicPriceChange>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    private readonly eventBus: EventBusService,
  ) {}

  // ═══ Rule CRUD ═════════════════════════════════════════════════════════

  listRules() {
    return this.ruleRepo.find({ order: { priority: 'ASC', id: 'ASC' } });
  }

  async createRule(data: Partial<DynamicPriceRule>) {
    if (!data.name || !data.strategy || !data.scope || !data.params) {
      throw new Error('name + strategy + scope + params requis');
    }
    return this.ruleRepo.save(this.ruleRepo.create({
      name: data.name,
      strategy: data.strategy as DynamicPricingStrategy,
      scope: data.scope as DynamicPricingScope,
      scope_value: data.scope_value || null,
      min_price_pct: data.min_price_pct ?? 60,
      max_price_pct: data.max_price_pct ?? 110,
      params: data.params,
      auto_apply_threshold_pct: data.auto_apply_threshold_pct ?? 10,
      priority: data.priority ?? 100,
      is_active: data.is_active !== false,
    }));
  }

  async updateRule(id: number, patch: Partial<DynamicPriceRule>) {
    const r = await this.ruleRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException();
    Object.assign(r, patch);
    return this.ruleRepo.save(r);
  }

  async deleteRule(id: number) { await this.ruleRepo.delete({ id }); return { success: true }; }

  // ═══ Engine ════════════════════════════════════════════════════════════

  // Compute the candidate price for one product against one rule. Returns null if rule
  // doesn't apply or produces no change.
  private computeCandidate(product: Product, rule: DynamicPriceRule): { newPrice: number; reason: string } | null {
    const origPrice = Number((product as any).price || 0);
    const curPrice = Number((product as any).currentPrice || origPrice);
    if (origPrice <= 0) return null;

    const minPrice = Math.round((origPrice * rule.min_price_pct) / 100 * 1000) / 1000;
    const maxPrice = Math.round((origPrice * rule.max_price_pct) / 100 * 1000) / 1000;

    const params = rule.params || {};

    switch (rule.strategy) {
      case DynamicPricingStrategy.INVENTORY_AGE: {
        const startDays = Number(params.startDays ?? 30);
        const pctPerDay = Number(params.pctPerDay ?? 0.5);
        const maxDiscountPct = Number(params.maxDiscountPct ?? 30);
        const createdAt = (product as any).created_at;
        if (!createdAt) return null;
        const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86400000;
        if (ageDays < startDays) return null;
        const daysOverThreshold = ageDays - startDays;
        const discountPct = Math.min(maxDiscountPct, daysOverThreshold * pctPerDay);
        const target = Math.round(origPrice * (1 - discountPct / 100) * 1000) / 1000;
        const final = Math.max(minPrice, Math.min(maxPrice, target));
        if (Math.abs(final - curPrice) < 0.01) return null;
        return { newPrice: final, reason: `Âge inventaire ${Math.round(ageDays)}j — -${discountPct.toFixed(1)}%` };
      }

      case DynamicPricingStrategy.LOW_CONVERSION: {
        const minViews = Number(params.minViews ?? 200);
        const maxConvPct = Number(params.maxConversionPct ?? 1.0); // if views→orders < 1%, discount
        const discountPct = Number(params.discountPct ?? 10);
        const views = Number((product as any).viewCount || 0);
        const orders = Number((product as any).orderCount || 0);
        if (views < minViews) return null;
        const conv = views > 0 ? (orders / views) * 100 : 0;
        if (conv >= maxConvPct) return null;
        const target = Math.round(origPrice * (1 - discountPct / 100) * 1000) / 1000;
        const final = Math.max(minPrice, Math.min(maxPrice, target));
        if (Math.abs(final - curPrice) < 0.01) return null;
        return { newPrice: final, reason: `Conversion faible ${conv.toFixed(2)}% sur ${views} vues — -${discountPct}%` };
      }

      case DynamicPricingStrategy.HIGH_DEMAND: {
        const minViewsPerDay = Number(params.minViewsPerDay ?? 50);
        const markupPct = Number(params.markupPct ?? 5);
        const createdAt = (product as any).created_at;
        if (!createdAt) return null;
        const ageDays = Math.max(1, (Date.now() - new Date(createdAt).getTime()) / 86400000);
        const views = Number((product as any).viewCount || 0);
        const viewsPerDay = views / ageDays;
        if (viewsPerDay < minViewsPerDay) return null;
        const stock = Number((product as any).totalStock || 0);
        if (stock > 50) return null; // markup only when scarce
        const target = Math.round(origPrice * (1 + markupPct / 100) * 1000) / 1000;
        const final = Math.max(minPrice, Math.min(maxPrice, target));
        if (Math.abs(final - curPrice) < 0.01) return null;
        return { newPrice: final, reason: `Demande forte ${viewsPerDay.toFixed(0)} vues/j, stock bas (${stock}) — +${markupPct}%` };
      }

      case DynamicPricingStrategy.CLEARANCE: {
        const ageDaysThreshold = Number(params.ageDaysThreshold ?? 90);
        const maxStockForClearance = Number(params.maxStock ?? 10);
        const discountPct = Number(params.discountPct ?? 25);
        const createdAt = (product as any).created_at;
        if (!createdAt) return null;
        const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86400000;
        const stock = Number((product as any).totalStock || 0);
        if (ageDays < ageDaysThreshold || stock > maxStockForClearance) return null;
        const target = Math.round(origPrice * (1 - discountPct / 100) * 1000) / 1000;
        const final = Math.max(minPrice, Math.min(maxPrice, target));
        if (Math.abs(final - curPrice) < 0.01) return null;
        return { newPrice: final, reason: `Déstockage — ${Math.round(ageDays)}j d'âge, ${stock} en stock — -${discountPct}%` };
      }
    }
    return null;
  }

  private ruleMatchesProduct(rule: DynamicPriceRule, p: Product): boolean {
    switch (rule.scope) {
      case DynamicPricingScope.ALL: return true;
      case DynamicPricingScope.PRODUCT: return rule.scope_value === String(p.id);
      case DynamicPricingScope.CATEGORY: return rule.scope_value === String((p as any).category_id ?? '');
      case DynamicPricingScope.FAMILLE: return rule.scope_value === (p as any).famille;
    }
    return false;
  }

  // Sweep: scan all active products, apply highest-priority matching rule to each.
  // dryRun=true returns what WOULD change without persisting.
  async sweep(opts: { dryRun?: boolean; productId?: number } = {}): Promise<SweepResult> {
    const rules = (await this.ruleRepo.find({ where: { is_active: true }, order: { priority: 'ASC' } }));
    const qb = this.productRepo.createQueryBuilder('p').where('p.is_active = :a', { a: true });
    if (opts.productId) qb.andWhere('p.id = :pid', { pid: opts.productId });
    const products = await qb.take(opts.productId ? 1 : 10_000).getMany();

    const result: SweepResult = { scanned: 0, applied: 0, proposed: 0, skipped: 0, changes: [] };

    for (const p of products) {
      result.scanned++;
      let chosen: { rule: DynamicPriceRule; newPrice: number; reason: string } | null = null;
      for (const rule of rules) {
        if (!this.ruleMatchesProduct(rule, p)) continue;
        const cand = this.computeCandidate(p, rule);
        if (cand) { chosen = { rule, ...cand }; break; }
      }
      if (!chosen) { result.skipped++; continue; }

      const oldPrice = Number((p as any).currentPrice || (p as any).price);
      const origPrice = Number((p as any).price || oldPrice);
      const deltaPct = origPrice > 0 ? ((chosen.newPrice - oldPrice) / origPrice) * 100 : 0;
      const absPct = Math.abs(deltaPct);

      const willAutoApply = absPct <= chosen.rule.auto_apply_threshold_pct;
      const status = willAutoApply ? 'APPLIED' : 'PROPOSED';

      if (!opts.dryRun) {
        await this.changeRepo.save(this.changeRepo.create({
          product_id: p.id,
          rule_id: chosen.rule.id,
          strategy: chosen.rule.strategy,
          old_price: oldPrice,
          new_price: chosen.newPrice,
          delta_pct: Math.round(deltaPct * 100) / 100,
          status,
          reason: chosen.reason,
        }));
        if (willAutoApply) {
          (p as any).currentPrice = chosen.newPrice;
          await this.productRepo.save(p);
          this.eventBus.publish('pricing.adjusted', {
            productId: p.id, oldPrice, newPrice: chosen.newPrice, deltaPct, strategy: chosen.rule.strategy,
          }, { aggregateId: `product:${p.id}` }).catch(() => {});
        }
      }

      result.changes.push({
        productId: p.id,
        from: oldPrice,
        to: chosen.newPrice,
        pct: Math.round(deltaPct * 100) / 100,
        status,
        reason: chosen.reason,
      });
      if (willAutoApply) result.applied++;
      else result.proposed++;
    }

    return result;
  }

  // Admin: approve a PROPOSED change (applies it to the product)
  async approveChange(changeId: number) {
    const c = await this.changeRepo.findOne({ where: { id: changeId } });
    if (!c) throw new NotFoundException();
    if (c.status !== 'PROPOSED') return c;
    const p = await this.productRepo.findOne({ where: { id: c.product_id } });
    if (!p) throw new NotFoundException();
    const oldPrice = Number((p as any).currentPrice);
    (p as any).currentPrice = Number(c.new_price);
    await this.productRepo.save(p);
    c.status = 'APPLIED';
    await this.changeRepo.save(c);
    this.eventBus.publish('pricing.adjusted', {
      productId: p.id, oldPrice, newPrice: Number(c.new_price), manual: true,
    }, { aggregateId: `product:${p.id}` }).catch(() => {});
    return c;
  }

  async rejectChange(changeId: number) {
    const c = await this.changeRepo.findOne({ where: { id: changeId } });
    if (!c) throw new NotFoundException();
    c.status = 'REJECTED';
    return this.changeRepo.save(c);
  }

  listChanges(status?: string, limit = 100) {
    const qb = this.changeRepo.createQueryBuilder('c').orderBy('c.created_at', 'DESC').take(Math.min(500, limit));
    if (status) qb.andWhere('c.status = :s', { s: status.toUpperCase() });
    return qb.getMany();
  }
}
