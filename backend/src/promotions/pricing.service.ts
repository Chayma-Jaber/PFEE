import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PricingRule } from './entities/pricing-rule.entity';
import { Product } from '../products/entities/product.entity';

export interface PricingCartItem {
  productId: number;
  quantity: number;
  unitPrice?: number;
}

export interface AppliedRule {
  ruleId: number;
  ruleName: string;
  discount: number;
}

export interface PricingResult {
  subtotal: number;
  rulesApplied: AppliedRule[];
  ruleDiscount: number;
  total: number;
  itemBreakdown: Array<{
    productId: number;
    title: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    lineDiscount: number;
  }>;
}

@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(PricingRule) private readonly ruleRepo: Repository<PricingRule>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
  ) {}

  async computeTotals(items: PricingCartItem[], userSegment?: string): Promise<PricingResult> {
    if (!items || items.length === 0) {
      return { subtotal: 0, rulesApplied: [], ruleDiscount: 0, total: 0, itemBreakdown: [] };
    }

    // Load products with categories
    const productIds = items.map((i) => Number(i.productId)).filter(Boolean);
    const products = productIds.length > 0
      ? await this.productRepo.find({
          where: productIds.map((id) => ({ id })),
          relations: ['categories'],
        })
      : [];
    const productMap = new Map<number, Product>();
    products.forEach((p) => productMap.set(p.id, p));

    // Load active rules (and still valid by date if set)
    const now = new Date();
    const rulesQb = this.ruleRepo
      .createQueryBuilder('r')
      .where('r.is_active = :a', { a: true })
      .andWhere('(r.valid_from IS NULL OR r.valid_from <= :now)', { now })
      .andWhere('(r.valid_to IS NULL OR r.valid_to >= :now)', { now });
    // W3.7 — segment-aware rules: include rules with matching segment OR rules with no segment filter
    if (userSegment) {
      rulesQb.andWhere('(r.segment IS NULL OR r.segment = :seg)', { seg: userSegment });
    } else {
      rulesQb.andWhere('r.segment IS NULL');
    }
    const rules = await rulesQb.orderBy('r.priority', 'DESC').getMany();

    // Build item breakdown using product current_price
    let subtotal = 0;
    const itemBreakdown = items.map((i) => {
      const p = productMap.get(Number(i.productId));
      const unitPrice = i.unitPrice != null ? Number(i.unitPrice) : Number(p?.currentPrice || p?.price || 0);
      const qty = Number(i.quantity) || 1;
      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;
      return {
        productId: Number(i.productId),
        title: p?.title || `#${i.productId}`,
        quantity: qty,
        unitPrice,
        lineTotal,
        lineDiscount: 0,
        _product: p,
      } as any;
    });

    // Apply each rule
    const rulesApplied: AppliedRule[] = [];
    let totalRuleDiscount = 0;

    for (const rule of rules) {
      // Check min-amount gate
      if (rule.min_amount && subtotal < Number(rule.min_amount)) continue;

      let matched: any[] = [];
      const t = (rule.target_type || 'all').toLowerCase();
      const tv = (rule.target_value || '').toLowerCase();

      for (const line of itemBreakdown) {
        const product = line._product as Product | undefined;
        if (!product) continue;

        let match = false;
        if (t === 'all') match = true;
        else if (t === 'category') {
          match = (product.categories || []).some(
            (c) => c.slug?.toLowerCase() === tv || c.name?.toLowerCase() === tv,
          );
        } else if (t === 'famille') {
          match = (product.famille || '').toLowerCase() === tv;
        } else if (t === 'tag') {
          match = Array.isArray(product.tags) && product.tags.some((tag) => tag?.toLowerCase() === tv);
        }

        if (match) matched.push(line);
      }

      if (matched.length === 0) continue;

      // Min-quantity gate (volume discount)
      if (rule.min_quantity) {
        const totalQty = matched.reduce((s, l) => s + l.quantity, 0);
        if (totalQty < rule.min_quantity) continue;
      }

      // Compute discount amount
      let discount = 0;
      const matchedSubtotal = matched.reduce((s, l) => s + l.lineTotal, 0);
      if (rule.discount_type === 'percentage') {
        discount = matchedSubtotal * (Number(rule.discount_value) / 100);
      } else {
        // fixed — apply once
        discount = Math.min(Number(rule.discount_value), matchedSubtotal);
      }
      discount = Math.round(discount * 1000) / 1000;
      if (discount <= 0) continue;

      // Distribute discount proportionally across matched lines
      const ratio = matchedSubtotal > 0 ? discount / matchedSubtotal : 0;
      matched.forEach((line) => {
        const lineCut = Math.round(line.lineTotal * ratio * 1000) / 1000;
        line.lineDiscount += lineCut;
      });

      totalRuleDiscount += discount;
      rulesApplied.push({
        ruleId: rule.id,
        ruleName: rule.name,
        discount,
      });
    }

    // Clean internal fields
    const cleanBreakdown = itemBreakdown.map(({ _product, ...rest }) => rest);

    const total = Math.max(0, Math.round((subtotal - totalRuleDiscount) * 1000) / 1000);

    return {
      subtotal: Math.round(subtotal * 1000) / 1000,
      rulesApplied,
      ruleDiscount: Math.round(totalRuleDiscount * 1000) / 1000,
      total,
      itemBreakdown: cleanBreakdown,
    };
  }
}
