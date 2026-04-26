import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

/**
 * V2 compatibility layer.
 *
 * The v2 recommendation service was deprecated in favor of v3, but the
 * premium-recommendations.service.ts in the frontend still references /v2/*
 * routes in older code paths. This controller returns valid empty shapes
 * instead of 404s so the UI degrades gracefully — loading states resolve
 * and no red console errors appear. Real traffic goes through v3.
 */
@SkipTransform()
@Controller('recommendations/v2')
export class RecommendationsV2CompatController {
  private emptyBundle(strategy: string, limit?: number) {
    return {
      products: [],
      strategy,
      totalAvailable: 0,
      limit: limit ? Number(limit) : 12,
      metadata: { version: 'v2-compat', executionTimeMs: 0, cacheHit: false },
    };
  }

  @Get('trending')
  trending(@Query('limit') limit?: number) { return this.emptyBundle('trending', limit); }

  @Get('new-arrivals')
  newArrivals(@Query('limit') limit?: number) { return this.emptyBundle('new-arrivals', limit); }

  @Get('seasonal')
  seasonal(@Query('limit') limit?: number) { return this.emptyBundle('seasonal', limit); }

  @Get('editorial')
  editorial(@Query('limit') limit?: number) { return this.emptyBundle('editorial', limit); }

  @Get('similar/:productId')
  similar(@Param('productId') id: string, @Query('limit') limit?: number) {
    return this.emptyBundle('similar', limit);
  }

  @Get('complementary/:productId')
  complementary(@Param('productId') id: string, @Query('limit') limit?: number) {
    return this.emptyBundle('complementary', limit);
  }

  @Get('complete-look/:productId')
  completeLook(@Param('productId') id: string, @Query('limit') limit?: number) {
    return this.emptyBundle('complete-look', limit);
  }

  @Get('premium-alternatives/:productId')
  premiumAlt(@Param('productId') id: string, @Query('limit') limit?: number) {
    return this.emptyBundle('premium-alternatives', limit);
  }

  @Get('affordable-alternatives/:productId')
  affordableAlt(@Param('productId') id: string, @Query('limit') limit?: number) {
    return this.emptyBundle('affordable-alternatives', limit);
  }

  @Get('style/:style')
  byStyle(@Param('style') style: string, @Query('limit') limit?: number) {
    return this.emptyBundle(`style-${style}`, limit);
  }

  @Post('personalized')
  personalized(@Body() body: any) { return this.emptyBundle('personalized', body?.limit); }

  @Post('cart-recommendations')
  cart(@Body() body: any) { return this.emptyBundle('cart-recommendations', body?.limit); }

  @Post('multi')
  multi(@Body() body: any) { return { results: {}, metadata: { version: 'v2-compat' } }; }
}
