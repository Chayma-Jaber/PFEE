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

  private mapFlashSale(p: any): any {
    const now = Date.now();
    const start = p.valid_from ? new Date(p.valid_from).getTime() : now;
    const end = p.valid_to ? new Date(p.valid_to).getTime() : now;
    const timeRemainingSeconds = Math.max(0, Math.floor((end - now) / 1000));
    const isCurrentlyActive = !!p.is_active && start <= now && end >= now;
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
      productCount: Array.isArray(p.product_ids) ? p.product_ids.length : 0,
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
    const flashSale = await this.promotionsService.getFlashSaleById(id);
    return { success: true, flash_sale: this.mapFlashSale(flashSale) };
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
    return { success: true, ...result };
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
