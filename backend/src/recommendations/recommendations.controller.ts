import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { RecommendationsService } from './recommendations.service';
import { RecommendationStrategy } from './entities/recommendation.entity';
import {
  RecommendationQueryDto,
  PersonalizedRecommendationDto,
  RecommendationResponse,
} from './dto/recommendation.dto';

// ─── Strategy name mapping ─────────────────────────────────────────
const STRATEGY_MAP: Record<string, RecommendationStrategy> = {
  similar: RecommendationStrategy.SIMILAR,
  complementary: RecommendationStrategy.COMPLEMENTARY,
  'complete-look': RecommendationStrategy.COMPLEMENTARY,
  trending: RecommendationStrategy.TRENDING,
  'new-arrivals': RecommendationStrategy.NEW_ARRIVALS,
  seasonal: RecommendationStrategy.SEASONAL,
  editorial: RecommendationStrategy.EDITORIAL,
  'frequently-bought-together': RecommendationStrategy.FREQUENTLY_BOUGHT_TOGETHER,
  'premium-alternatives': RecommendationStrategy.PREMIUM_ALTERNATIVE,
  'affordable-alternatives': RecommendationStrategy.AFFORDABLE_ALTERNATIVE,
  personalized: RecommendationStrategy.PERSONALIZED,
  'because-you-viewed': RecommendationStrategy.PERSONALIZED,
  'cart-recommendations': RecommendationStrategy.FREQUENTLY_BOUGHT_TOGETHER,
  'customers-also-liked': RecommendationStrategy.SIMILAR,
  'pdp-bundle': RecommendationStrategy.COMPLEMENTARY,
  'homepage-bundle': RecommendationStrategy.TRENDING,
  'by-colors': RecommendationStrategy.SIMILAR,
};

function resolveStrategy(name: string): RecommendationStrategy {
  return STRATEGY_MAP[name] || RecommendationStrategy.TRENDING;
}

const STRATEGY_TITLES: Record<string, string> = {
  similar: 'Dans le même style',
  complementary: 'Pour compléter ce look',
  'complete-look': 'Le look complet',
  'frequently-bought-together': 'Souvent achetés ensemble',
  'premium-alternatives': 'Version premium',
  'affordable-alternatives': 'Alternatives accessibles',
  trending: 'Tendances Barsha',
  'new-arrivals': 'Nouveautés',
  seasonal: 'Sélection de saison',
  editorial: 'Sélection éditoriale',
  personalized: 'Sélectionné pour vous',
  'because-you-viewed': 'Car vous avez consulté',
  'cart-recommendations': 'Souvent achetés ensemble',
  'customers-also-liked': 'Les clients ont aussi aimé',
  'pdp-bundle': 'Le look complet',
  'homepage-bundle': 'Notre sélection',
  'by-colors': 'Par couleurs',
};

/**
 * Transform internal recommendation response to the format the Angular frontend expects.
 * Frontend expects: { strategy, title, products: [...], metadata }
 * Internal format: { recommendations: [...], metadata }
 */
function toFrontendFormat(response: any, strategyName: string): any {
  const items = response?.recommendations || response?.products || [];
  return {
    strategy: strategyName,
    title: STRATEGY_TITLES[strategyName] || strategyName,
    products: items.map((item: any, index: number) => ({
      id: item.product_id || item.id,
      reference: item.reference || item.sku || '',
      name: item.title || item.name || '',
      price: item.current_price || item.price || 0,
      originalPrice: item.price || item.originalPrice || 0,
      discountPercent: item.discount || item.discountPercent || 0,
      image: item.first_image_url || item.image || '',
      secondImage: item.second_image_url || item.secondImage || '',
      url: item.slug || item.url || '',
      family: item.famille || item.family || '',
      category: item.category || '',
      colors: item.colors || [],
      score: item.score || 0,
      confidence: item.confidence || 0.5,
      position: item.position ?? index,
      strategy: strategyName,
      reasonKey: item.reason || strategyName,
      reasonText: item.reason || STRATEGY_TITLES[strategyName] || '',
    })),
    metadata: {
      totalCandidates: response?.metadata?.count || items.length,
      executionTimeMs: 0,
      cacheHit: response?.metadata?.cached || false,
    },
  };
}

function emptyResponse(strategy: string): any {
  return {
    strategy,
    title: STRATEGY_TITLES[strategy] || strategy,
    products: [],
    metadata: {
      totalCandidates: 0,
      executionTimeMs: 0,
      cacheHit: false,
    },
  };
}

@ApiTags('Recommendations')
@SkipTransform()
@Controller('recommendations')
export class RecommendationsController {
  private readonly logger = new Logger(RecommendationsController.name);

  constructor(private readonly recommendationsService: RecommendationsService) {}

  // ═══════════════════════════════════════════════════════════════════
  //  V3 SPECIFIC ROUTES (must come BEFORE wildcard routes)
  // ═══════════════════════════════════════════════════════════════════

  // ─── Health ──────────────────────────────────────────────────────
  @Get('v3/health')
  @ApiOperation({ summary: 'Health check for recommendations service' })
  async health() {
    return { status: 'ok', service: 'recommendations', version: 'v3' };
  }

  // ─── Strategies ──────────────────────────────────────────────────
  @Get('v3/strategies')
  @ApiOperation({ summary: 'List available recommendation strategies' })
  async listStrategies() {
    return {
      strategies: Object.keys(STRATEGY_MAP),
      version: 'v3',
    };
  }

  // ─── Trending (no productId) ─────────────────────────────────────
  @Get('v3/trending')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get trending products (V3)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'family', required: false, type: String })
  async v3Trending(
    @Query('limit') limit?: number,
    @Query('family') family?: string,
  ) {
    try {
      const result = await this.recommendationsService.getRecommendations(
        RecommendationStrategy.TRENDING,
        { limit: limit ? Number(limit) : 12 },
      );
      return toFrontendFormat(result, 'trending');
    } catch (error) {
      this.logger.error(`v3/trending error: ${error.message}`);
      return emptyResponse('trending');
    }
  }

  // ─── New Arrivals (no productId) ─────────────────────────────────
  @Get('v3/new-arrivals')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get new arrivals (V3)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async v3NewArrivals(
    @Query('limit') limit?: number,
  ): Promise<RecommendationResponse> {
    try {
      return await this.recommendationsService.getRecommendations(
        RecommendationStrategy.NEW_ARRIVALS,
        { limit: limit ? Number(limit) : 12 },
      );
    } catch (error) {
      this.logger.error(`v3/new-arrivals error: ${error.message}`);
      return emptyResponse('new-arrivals');
    }
  }

  // ─── Seasonal (no productId) ─────────────────────────────────────
  @Get('v3/seasonal')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get seasonal recommendations (V3)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async v3Seasonal(
    @Query('limit') limit?: number,
  ): Promise<RecommendationResponse> {
    try {
      return await this.recommendationsService.getRecommendations(
        RecommendationStrategy.SEASONAL,
        { limit: limit ? Number(limit) : 12 },
      );
    } catch (error) {
      this.logger.error(`v3/seasonal error: ${error.message}`);
      return emptyResponse('seasonal');
    }
  }

  // ─── Editorial (no productId) ────────────────────────────────────
  @Get('v3/editorial')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get editorial picks (V3)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async v3Editorial(
    @Query('limit') limit?: number,
  ): Promise<RecommendationResponse> {
    try {
      return await this.recommendationsService.getRecommendations(
        RecommendationStrategy.EDITORIAL,
        { limit: limit ? Number(limit) : 12 },
      );
    } catch (error) {
      this.logger.error(`v3/editorial error: ${error.message}`);
      return emptyResponse('editorial');
    }
  }

  // ─── Homepage Bundle (no productId) ──────────────────────────────
  @Get('v3/homepage-bundle')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get homepage recommendation bundle (V3)' })
  async v3HomepageBundle(
    @CurrentUser('id') userId?: number,
  ): Promise<Record<string, RecommendationResponse>> {
    try {
      const [trending, newArrivals, seasonal, editorial] = await Promise.all([
        this.recommendationsService.getRecommendations(RecommendationStrategy.TRENDING, { limit: 8 }),
        this.recommendationsService.getRecommendations(RecommendationStrategy.NEW_ARRIVALS, { limit: 8 }),
        this.recommendationsService.getRecommendations(RecommendationStrategy.SEASONAL, { limit: 8 }),
        this.recommendationsService.getRecommendations(RecommendationStrategy.EDITORIAL, { limit: 8 }),
      ]);
      return { trending, newArrivals, seasonal, editorial };
    } catch (error) {
      this.logger.error(`v3/homepage-bundle error: ${error.message}`);
      return {
        trending: emptyResponse('trending'),
        newArrivals: emptyResponse('new-arrivals'),
        seasonal: emptyResponse('seasonal'),
        editorial: emptyResponse('editorial'),
      };
    }
  }

  // ─── By Colors ───────────────────────────────────────────────────
  @Get('v3/by-colors')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get recommendations by color (V3)' })
  @ApiQuery({ name: 'colors', required: true, type: String, description: 'Comma-separated color names' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'family', required: false, type: String })
  async v3ByColors(
    @Query('colors') colors: string,
    @Query('limit') limit?: number,
    @Query('family') family?: string,
  ): Promise<RecommendationResponse> {
    try {
      return await this.recommendationsService.getRecommendations(
        RecommendationStrategy.SIMILAR,
        {
          limit: limit ? Number(limit) : 12,
          context: `colors:${colors}`,
        },
      );
    } catch (error) {
      this.logger.error(`v3/by-colors error: ${error.message}`);
      return emptyResponse('by-colors');
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  V3 POST SPECIFIC ROUTES (must come BEFORE wildcard POST)
  // ═══════════════════════════════════════════════════════════════════

  // ─── Because You Viewed ──────────────────────────────────────────
  @Post('v3/because-you-viewed')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get recommendations based on viewed products (V3)' })
  async v3BecauseYouViewed(
    @Body() body: { viewed_product_ids?: number[]; limit?: number },
    @CurrentUser('id') userId?: number,
  ): Promise<RecommendationResponse> {
    try {
      return await this.recommendationsService.getRecommendations(
        RecommendationStrategy.PERSONALIZED,
        {
          viewedProductIds: body.viewed_product_ids || [],
          limit: body.limit || 12,
          userId,
        },
      );
    } catch (error) {
      this.logger.error(`v3/because-you-viewed error: ${error.message}`);
      return emptyResponse('because-you-viewed');
    }
  }

  // ─── Personalized ────────────────────────────────────────────────
  @Post('v3/personalized')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get personalized recommendations (V3)' })
  async v3Personalized(
    @Body() body: PersonalizedRecommendationDto & { user_id?: number },
    @CurrentUser('id') userId?: number,
  ): Promise<RecommendationResponse> {
    try {
      return await this.recommendationsService.getRecommendations(
        RecommendationStrategy.PERSONALIZED,
        {
          viewedProductIds: body.viewed_product_ids || [],
          purchasedProductIds: body.purchased_product_ids || [],
          preferredCategoryIds: body.preferred_category_ids || [],
          limit: body.limit || 12,
          userId: userId || body.user_id,
        },
      );
    } catch (error) {
      this.logger.error(`v3/personalized error: ${error.message}`);
      return emptyResponse('personalized');
    }
  }

  // ─── Cart Recommendations ────────────────────────────────────────
  @Post('v3/cart-recommendations')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get recommendations based on cart (V3)' })
  async v3CartRecommendations(
    @Body() body: { cart_product_ids?: number[]; limit?: number },
    @CurrentUser('id') userId?: number,
  ): Promise<RecommendationResponse> {
    try {
      // Use first cart product for frequently-bought-together
      const productId = body.cart_product_ids?.[0];
      return await this.recommendationsService.getRecommendations(
        RecommendationStrategy.FREQUENTLY_BOUGHT_TOGETHER,
        {
          productId,
          limit: body.limit || 12,
          userId,
        },
      );
    } catch (error) {
      this.logger.error(`v3/cart-recommendations error: ${error.message}`);
      return emptyResponse('cart-recommendations');
    }
  }

  // ─── Customers Also Liked ────────────────────────────────────────
  @Post('v3/customers-also-liked')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get customers-also-liked recommendations (V3)' })
  async v3CustomersAlsoLiked(
    @Body() body: { product_ids?: number[]; limit?: number },
    @CurrentUser('id') userId?: number,
  ): Promise<RecommendationResponse> {
    try {
      const productId = body.product_ids?.[0];
      return await this.recommendationsService.getRecommendations(
        RecommendationStrategy.SIMILAR,
        {
          productId,
          limit: body.limit || 12,
          userId,
        },
      );
    } catch (error) {
      this.logger.error(`v3/customers-also-liked error: ${error.message}`);
      return emptyResponse('customers-also-liked');
    }
  }

  // ─── Analytics Tracking ──────────────────────────────────────────
  @Post('v3/track')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Track recommendation interaction event (V3)' })
  async v3Track(
    @Body() body: Record<string, any>,
    @CurrentUser('id') userId?: number,
  ) {
    try {
      this.logger.log(`Recommendation event tracked: ${JSON.stringify({ ...body, userId })}`);
      return { success: true, tracked: true };
    } catch (error) {
      this.logger.error(`v3/track error: ${error.message}`);
      return { success: false, tracked: false };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  V3 WILDCARD ROUTES (must come AFTER all specific routes)
  // ═══════════════════════════════════════════════════════════════════

  // ─── GET v3/:strategy/:productId ─────────────────────────────────
  @Get('v3/:strategy/:productId')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get recommendations by strategy with product context (V3)' })
  @ApiParam({ name: 'strategy', type: String, description: 'Recommendation strategy name' })
  @ApiParam({ name: 'productId', type: Number, description: 'Source product ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'family', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Recommendations list', type: RecommendationResponse })
  async v3StrategyWithProduct(
    @Param('strategy') strategy: string,
    @Param('productId') productId: string,
    @Query('limit') limit?: number,
    @Query('family') family?: string,
    @Query('category') category?: string,
    @CurrentUser('id') userId?: number,
  ) {
    try {
      const mappedStrategy = resolveStrategy(strategy);
      const pid = parseInt(productId, 10);
      const result = await this.recommendationsService.getRecommendations(mappedStrategy, {
        productId: isNaN(pid) ? undefined : pid,
        limit: limit ? Number(limit) : 12,
        context: family ? `family:${family}` : category ? `category:${category}` : undefined,
        userId,
      });
      return toFrontendFormat(result, strategy);
    } catch (error) {
      this.logger.error(`v3/${strategy}/${productId} error: ${error.message}`);
      return emptyResponse(strategy);
    }
  }

  // ─── GET v3/:strategy (catch-all, no productId) ──────────────────
  @Get('v3/:strategy')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get recommendations by strategy (V3)' })
  @ApiParam({ name: 'strategy', type: String, description: 'Recommendation strategy name' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'family', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Recommendations list', type: RecommendationResponse })
  async v3Strategy(
    @Param('strategy') strategy: string,
    @Query() query: RecommendationQueryDto,
    @Query('family') family?: string,
    @CurrentUser('id') userId?: number,
  ) {
    try {
      const mappedStrategy = resolveStrategy(strategy);
      const result = await this.recommendationsService.getRecommendations(mappedStrategy, {
        productId: query.product_id,
        categoryId: query.category_id,
        limit: query.limit || 12,
        context: family ? `family:${family}` : query.context,
        userId,
      });
      return toFrontendFormat(result, strategy);
    } catch (error) {
      this.logger.error(`v3/${strategy} error: ${error.message}`);
      return emptyResponse(strategy);
    }
  }

  // ─── POST v3/:strategy (catch-all POST) ──────────────────────────
  @Post('v3/:strategy')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Post-based recommendations by strategy (V3)' })
  @ApiParam({ name: 'strategy', type: String })
  async v3PostStrategy(
    @Param('strategy') strategy: string,
    @Body() body: any,
    @CurrentUser('id') userId?: number,
  ): Promise<RecommendationResponse> {
    try {
      const mappedStrategy = resolveStrategy(strategy);
      return await this.recommendationsService.getRecommendations(mappedStrategy, {
        productId: body.product_id || body.productId,
        viewedProductIds: body.viewed_product_ids,
        purchasedProductIds: body.purchased_product_ids,
        preferredCategoryIds: body.preferred_category_ids,
        limit: body.limit || 12,
        userId: userId || body.user_id,
      });
    } catch (error) {
      this.logger.error(`POST v3/${strategy} error: ${error.message}`);
      return emptyResponse(strategy);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  LEGACY ENDPOINTS (backward compatibility)
  // ═══════════════════════════════════════════════════════════════════

  @Get('similar/:productId')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get similar products (legacy)' })
  @ApiParam({ name: 'productId', type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getSimilar(
    @Param('productId') productId: string,
    @Query('limit') limit?: number,
  ): Promise<RecommendationResponse> {
    try {
      const pid = parseInt(productId, 10);
      return await this.recommendationsService.getRecommendations(
        RecommendationStrategy.SIMILAR,
        { productId: isNaN(pid) ? undefined : pid, limit: limit ? Number(limit) : 12 },
      );
    } catch (error) {
      this.logger.error(`similar/${productId} error: ${error.message}`);
      return emptyResponse('similar');
    }
  }

  @Get('complementary/:productId')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get complementary products (legacy)' })
  @ApiParam({ name: 'productId', type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getComplementary(
    @Param('productId') productId: string,
    @Query('limit') limit?: number,
  ): Promise<RecommendationResponse> {
    try {
      const pid = parseInt(productId, 10);
      return await this.recommendationsService.getRecommendations(
        RecommendationStrategy.COMPLEMENTARY,
        { productId: isNaN(pid) ? undefined : pid, limit: limit ? Number(limit) : 12 },
      );
    } catch (error) {
      this.logger.error(`complementary/${productId} error: ${error.message}`);
      return emptyResponse('complementary');
    }
  }

  @Get('trending')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get trending products (legacy)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTrending(
    @Query('limit') limit?: number,
  ): Promise<RecommendationResponse> {
    try {
      return await this.recommendationsService.getRecommendations(
        RecommendationStrategy.TRENDING,
        { limit: limit ? Number(limit) : 12 },
      );
    } catch (error) {
      this.logger.error(`trending error: ${error.message}`);
      return emptyResponse('trending');
    }
  }

  @Post('personalized')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get personalized recommendations (legacy)' })
  async getPersonalized(
    @Body() dto: PersonalizedRecommendationDto,
    @CurrentUser('id') userId?: number,
  ): Promise<RecommendationResponse> {
    try {
      return await this.recommendationsService.getRecommendations(
        RecommendationStrategy.PERSONALIZED,
        {
          viewedProductIds: dto.viewed_product_ids || [],
          purchasedProductIds: dto.purchased_product_ids || [],
          preferredCategoryIds: dto.preferred_category_ids || [],
          limit: dto.limit || 12,
          userId,
        },
      );
    } catch (error) {
      this.logger.error(`personalized error: ${error.message}`);
      return emptyResponse('personalized');
    }
  }
}
