import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';
import { PromotionsService } from './promotions.service';
import { ValidateCodeDto } from './dto/promotions.dto';
import { PricingService } from './pricing.service';

@Controller()
export class PromotionsController {
  constructor(
    private readonly promotionsService: PromotionsService,
    private readonly pricingService: PricingService,
  ) {}

  @Post('cart/calculate-pricing')
  async calculatePricing(
    @Body() body: { items: Array<{ productId: number; quantity: number; unitPrice?: number }>; segment?: string },
  ) {
    const result = await this.pricingService.computeTotals(body?.items || [], body?.segment);
    return { success: true, ...result };
  }

  private mapFlashSale(p: any, productCountOverride?: number): any {
    const now = Date.now();
    const start = p.valid_from ? new Date(p.valid_from).getTime() : now;
    const end = p.valid_to ? new Date(p.valid_to).getTime() : now;
    const timeRemainingSeconds = Math.max(0, Math.floor((end - now) / 1000));
    const isCurrentlyActive = !!p.is_active && start <= now && end >= now;
    const baseCount = Array.isArray(p.product_ids) ? p.product_ids.length : 0;
    return {
      id: p.id,
      name: p.name,
      description: p.description || '',
      discountPercentage: Number(p.discount_value) || 0,
      startTime: p.valid_from,
      endTime: p.valid_to,
      isActive: !!p.is_active,
      isCurrentlyActive,
      isUpcoming: start > now,
      isEnded: end < now,
      timeRemainingSeconds,
      bannerImage: p.banner_image_url || '',
      bannerMobileImage: p.banner_image_url || '',
      backgroundColor: '#FF4444',
      textColor: '#FFFFFF',
      showOnHomepage: true,
      priority: p.priority || 0,
      productCount: productCountOverride ?? baseCount,
    };
  }

  // Map a Product entity into the FlashSaleProduct shape the storefront expects.
  // Computes the discounted price using the flash-sale percentage so the UI
  // shows a real "before/after" without depending on Product.discount being set.
  private mapFlashSaleProduct(prod: any, discountPct: number, endTime?: string): any {
    const basePrice = Number(prod.price ?? prod.currentPrice ?? 0);
    const flashPrice = +(basePrice * (1 - discountPct / 100)).toFixed(3);
    const firstImg =
      prod.first_image_url ||
      prod.firstImageUrl ||
      (Array.isArray(prod.images) && prod.images[0]
        ? prod.images[0].image_url || prod.images[0].imageUrl
        : '') ||
      '';
    const secondImg =
      prod.second_image_url ||
      prod.secondImageUrl ||
      (Array.isArray(prod.images) && prod.images[1]
        ? prod.images[1].image_url || prod.images[1].imageUrl
        : '') ||
      '';
    return {
      id: prod.id,
      sku: prod.sku || '',
      title: prod.title || '',
      slug: prod.slug || '',
      description: prod.description || '',
      price: basePrice,
      currentPrice: flashPrice,
      flashSalePrice: flashPrice,
      flashSaleDiscount: discountPct,
      flashSaleEndTime: endTime || '',
      stockRemaining: Number(prod.total_stock ?? prod.totalStock ?? 0),
      firstImageUrl: firstImg,
      secondImageUrl: secondImg,
      discount: true,
      discountValue: discountPct,
      isAvailable: Number(prod.total_stock ?? prod.totalStock ?? 0) > 0,
      totalStock: Number(prod.total_stock ?? prod.totalStock ?? 0),
      variants: Array.isArray(prod.variants)
        ? prod.variants.map((v: any) => ({
            id: v.id,
            sku: v.sku,
            color: v.color,
            size: v.size,
            stock: v.stock,
            ean13: v.ean13,
          }))
        : [],
    };
  }

  @Get('promotions/flash-sales')
  async listFlashSales(
    @Query('include_upcoming') includeUpcoming?: string,
  ) {
    const upcoming =
      includeUpcoming === 'true' || includeUpcoming === '1';
    const flashSales =
      await this.promotionsService.listFlashSales(upcoming);
    const mapped = flashSales.map((p) => this.mapFlashSale(p));
    return { success: true, flashSales: mapped, count: mapped.length };
  }

  @Get('promotions/flash-sales/homepage')
  async homepageFlashSales(@Query('limit') limit?: string) {
    const l = limit ? parseInt(limit, 10) : 4;
    const flashSales =
      await this.promotionsService.getHomepageFlashSales(l);
    const mapped = flashSales.map((p) => this.mapFlashSale(p));
    return { success: true, flashSales: mapped, count: mapped.length };
  }

  @Get('promotions/flash-sales/:id')
  async getFlashSale(@Param('id', ParseIntPipe) id: number) {
    // Embed the first page of products directly so the detail page renders
    // without a follow-up round-trip. Frontend may still call the paginated
    // /products endpoint for additional pages.
    const result = await this.promotionsService.getFlashSaleProducts(id, 1, 24);
    const sale = this.mapFlashSale(result.promotion, result.total);
    sale.products = result.products.map((p) =>
      this.mapFlashSaleProduct(p, sale.discountPercentage, sale.endTime),
    );
    return { success: true, flashSale: sale, flash_sale: sale };
  }

  @Get('promotions/flash-sales/:id/products')
  async getFlashSaleProducts(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 20;
    const result = await this.promotionsService.getFlashSaleProducts(
      id,
      p,
      l,
    );
    const sale = this.mapFlashSale(result.promotion, result.total);
    const products = result.products.map((prod) =>
      this.mapFlashSaleProduct(prod, sale.discountPercentage, sale.endTime),
    );
    return {
      success: true,
      flashSale: {
        id: sale.id,
        name: sale.name,
        discountPercentage: sale.discountPercentage,
        endTime: sale.endTime,
        timeRemainingSeconds: sale.timeRemainingSeconds,
      },
      products,
      product_ids: result.product_ids,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
      },
    };
  }

  @Post('promotions/validate-code')
  @UseGuards(OptionalAuthGuard)
  async validateCode(
    @Body() dto: ValidateCodeDto,
    @CurrentUser('id') userId?: number,
  ) {
    const result = await this.promotionsService.validateCode(
      dto.code,
      dto.order_total,
      userId,
    );
    return { success: true, ...result };
  }

  @Get('promotions/codes/:code')
  async getCodeInfo(@Param('code') code: string) {
    const coupon = await this.promotionsService.getCodeInfo(code);
    return { success: true, coupon };
  }

  @Get('getValidCoupons')
  @UseGuards(JwtAuthGuard)
  async getValidCoupons(@CurrentUser('id') userId: number) {
    const coupons = await this.promotionsService.getValidCoupons(userId);
    return { success: true, coupons };
  }
}
