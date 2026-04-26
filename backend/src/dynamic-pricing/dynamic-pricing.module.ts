import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DynamicPriceRule } from './entities/dynamic-price-rule.entity';
import { DynamicPriceChange } from './entities/dynamic-price-change.entity';
import { Product } from '../products/entities/product.entity';
import { DynamicPricingService } from './dynamic-pricing.service';
import { DynamicPricingAdminController } from './dynamic-pricing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DynamicPriceRule, DynamicPriceChange, Product])],
  controllers: [DynamicPricingAdminController],
  providers: [DynamicPricingService],
  exports: [DynamicPricingService],
})
export class DynamicPricingModule {}
