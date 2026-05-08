import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, In } from 'typeorm';
import { Promotion, PromotionType } from './entities/promotion.entity';
import { Coupon, CouponDiscountType } from './entities/coupon.entity';
import { CouponUsage } from './entities/coupon-usage.entity';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(Promotion)
    private readonly promoRepo: Repository<Promotion>,
    @InjectRepository(Coupon)
    private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(CouponUsage)
    private readonly couponUsageRepo: Repository<CouponUsage>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  // ── Flash Sales ──────────────────────────────────────────────

  async listFlashSales(includeUpcoming: boolean = false): Promise<Promotion[]> {
    const now = new Date();

    const qb = this.promoRepo.createQueryBuilder('p')
      .where('p.type = :type', { type: PromotionType.FLASH_SALE })
      .andWhere('p.is_active = :active', { active: true });

    if (includeUpcoming) {
      // Include current and upcoming
      qb.andWhere('p.valid_to >= :now', { now });
    } else {
      // Only current (active right now)
      qb.andWhere('p.valid_from <= :now', { now })
        .andWhere('p.valid_to >= :now', { now });
    }

    qb.orderBy('p.priority', 'DESC')
      .addOrderBy('p.valid_from', 'ASC');

    return qb.getMany();
  }

  async getHomepageFlashSales(limit: number = 4): Promise<Promotion[]> {
    const now = new Date();

    return this.promoRepo.find({
      where: {
        type: PromotionType.FLASH_SALE,
        is_active: true,
        valid_from: LessThanOrEqual(now),
        valid_to: MoreThanOrEqual(now),
      },
      order: { priority: 'DESC', valid_to: 'ASC' },
      take: limit,
    });
  }

  async getFlashSaleById(id: number): Promise<Promotion> {
    const promo = await this.promoRepo.findOne({
      where: { id, type: PromotionType.FLASH_SALE },
    });
    if (!promo) {
      throw new NotFoundException('Flash sale not found');
    }
    return promo;
  }

  async getFlashSaleProducts(
    id: number,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    promotion: Promotion;
    products: Product[];
    product_ids: number[];
    total: number;
    page: number;
    limit: number;
  }> {
    const promo = await this.getFlashSaleById(id);
    let allIds = (promo.product_ids || []).map((n) => Number(n)).filter((n) => !isNaN(n));

    // Fallback when the flash sale wasn't explicitly populated: pick the most
    // attractive subset of the live catalogue (active products, sorted by
    // existing discount then bestseller). Stock is enforced at order time
    // via the warehouse module, not on this discovery page.
    if (allIds.length === 0) {
      const fallback = await this.productRepo
        .createQueryBuilder('p')
        .where('p.is_active = :a', { a: true })
        .orderBy('p.discount', 'DESC')
        .addOrderBy('p.is_bestseller', 'DESC')
        .addOrderBy('p.is_featured', 'DESC')
        .addOrderBy('p.id', 'ASC')
        .take(48)
        .getMany();
      allIds = fallback.map((p) => p.id);
    }

    const total = allIds.length;
    const offset = (page - 1) * limit;
    const pageIds = allIds.slice(offset, offset + limit);

    let products: Product[] = [];
    if (pageIds.length > 0) {
      // Preserve the order of pageIds by sorting after the fetch.
      const fetched = await this.productRepo.find({
        where: { id: In(pageIds), isActive: true },
        relations: ['images', 'variants'],
      });
      const map = new Map(fetched.map((p) => [p.id, p]));
      products = pageIds.map((pid) => map.get(pid)).filter((p): p is Product => !!p);
    }

    return {
      promotion: promo,
      products,
      product_ids: pageIds,
      total,
      page,
      limit,
    };
  }

  // ── Promo Code Validation ────────────────────────────────────

  async validateCode(
    code: string,
    orderTotal: number,
    userId?: number,
  ): Promise<{
    valid: boolean;
    coupon?: Coupon;
    discount_amount?: number;
    message?: string;
  }> {
    const coupon = await this.couponRepo.findOne({
      where: { code: code.toUpperCase() },
    });

    if (!coupon) {
      return { valid: false, message: 'Promo code not found' };
    }

    if (!coupon.is_active) {
      return { valid: false, message: 'Promo code is no longer active' };
    }

    const now = new Date();
    if (new Date(coupon.valid_from) > now) {
      return { valid: false, message: 'Promo code is not yet valid' };
    }
    if (new Date(coupon.valid_to) < now) {
      return { valid: false, message: 'Promo code has expired' };
    }

    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      return { valid: false, message: 'Promo code usage limit reached' };
    }

    if (coupon.min_purchase && orderTotal < coupon.min_purchase) {
      return {
        valid: false,
        message: `Minimum purchase of ${coupon.min_purchase} required`,
      };
    }

    // Check per-user limit
    if (userId && coupon.per_user_limit) {
      const userUsageCount = await this.couponUsageRepo.count({
        where: { coupon_id: coupon.id, user_id: userId },
      });
      if (userUsageCount >= coupon.per_user_limit) {
        return {
          valid: false,
          message: 'You have already used this promo code the maximum number of times',
        };
      }
    }

    // Calculate discount
    let discountAmount: number;
    if (coupon.discount_type === CouponDiscountType.PERCENTAGE) {
      discountAmount = (orderTotal * Number(coupon.discount_value)) / 100;
      if (coupon.max_discount && discountAmount > Number(coupon.max_discount)) {
        discountAmount = Number(coupon.max_discount);
      }
    } else {
      discountAmount = Number(coupon.discount_value);
    }

    // Ensure discount does not exceed order total
    if (discountAmount > orderTotal) {
      discountAmount = orderTotal;
    }

    return {
      valid: true,
      coupon,
      discount_amount: Math.round(discountAmount * 100) / 100,
    };
  }

  async getCodeInfo(code: string): Promise<Coupon> {
    const coupon = await this.couponRepo.findOne({
      where: { code: code.toUpperCase() },
    });
    if (!coupon) {
      throw new NotFoundException('Promo code not found');
    }
    return coupon;
  }

  // ── Valid Coupons for User ───────────────────────────────────

  async getValidCoupons(userId: number): Promise<Coupon[]> {
    const now = new Date();

    const coupons = await this.couponRepo
      .createQueryBuilder('c')
      .where('c.is_active = :active', { active: true })
      .andWhere('c.valid_from <= :now', { now })
      .andWhere('c.valid_to >= :now', { now })
      .andWhere(
        '(c.usage_limit IS NULL OR c.usage_count < c.usage_limit)',
      )
      .orderBy('c.discount_value', 'DESC')
      .getMany();

    // Filter by per-user limit
    const validCoupons: Coupon[] = [];
    for (const coupon of coupons) {
      if (coupon.per_user_limit) {
        const userUsageCount = await this.couponUsageRepo.count({
          where: { coupon_id: coupon.id, user_id: userId },
        });
        if (userUsageCount < coupon.per_user_limit) {
          validCoupons.push(coupon);
        }
      } else {
        validCoupons.push(coupon);
      }
    }

    return validCoupons;
  }
}
