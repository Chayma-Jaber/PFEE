import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Promotion } from './entities/promotion.entity';
import { Coupon } from './entities/coupon.entity';
import { CouponUsage } from './entities/coupon-usage.entity';
import { PricingRule } from './entities/pricing-rule.entity';
import { Product } from '../products/entities/product.entity';
import { PromotionsService } from './promotions.service';
import { PromotionsController } from './promotions.controller';
import { PricingService } from './pricing.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Promotion, Coupon, CouponUsage, PricingRule, Product]),
  ],
  controllers: [PromotionsController],
  providers: [PromotionsService, PricingService],
  exports: [PromotionsService, PricingService],
})
export class PromotionsModule {}
