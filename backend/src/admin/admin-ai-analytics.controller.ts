import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { UserEvent } from '../analytics/entities/user-event.entity';

const AI_EVENT_TYPES = [
  'assistant_open',
  'assistant_message',
  'assistant_product_click',
  'assistant_add_to_cart',
  'visual_search_upload',
  'visual_search_result_click',
  'visual_search_add_to_cart',
  'recommendation_impression',
  'recommendation_click',
  'recommendation_add_to_cart',
  'recommendation_purchase',
];

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class AdminAIAnalyticsController {
  constructor(
    @InjectRepository(UserEvent)
    private readonly eventRepo: Repository<UserEvent>,
  ) {}

  @Get('ai-dashboard')
  async getAiDashboard(@Query('days') daysRaw = '30') {
    const days = Math.max(1, Number(daysRaw) || 30);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const events = await this.eventRepo.find({
      where: {
        timestamp: MoreThanOrEqual(since),
      },
      order: { timestamp: 'DESC' },
      take: 5000,
    });

    const aiEvents = events.filter((event) => AI_EVENT_TYPES.includes(event.event_type));

    const assistantSessions = new Set(
      aiEvents.filter((event) => event.event_type === 'assistant_open').map((event) => event.session_id),
    ).size;
    const assistantMessages = aiEvents.filter((event) => event.event_type === 'assistant_message').length;
    const assistantProductClicks = aiEvents.filter((event) => event.event_type === 'assistant_product_click').length;
    const assistantAddToCarts = aiEvents.filter((event) => event.event_type === 'assistant_add_to_cart').length;

    const visualUploads = aiEvents.filter((event) => event.event_type === 'visual_search_upload').length;
    const visualClicks = aiEvents.filter((event) => event.event_type === 'visual_search_result_click').length;
    const visualAddToCarts = aiEvents.filter((event) => event.event_type === 'visual_search_add_to_cart').length;

    const recommendationImpressions = aiEvents.filter((event) => event.event_type === 'recommendation_impression').length;
    const recommendationClicks = aiEvents.filter((event) => event.event_type === 'recommendation_click').length;
    const recommendationAddToCarts = aiEvents.filter((event) => event.event_type === 'recommendation_add_to_cart').length;

    const perfMap = new Map<string, { type: string; impressions: number; clicks: number; add_to_carts: number }>();
    for (const event of aiEvents) {
      if (!event.recommendation_type) continue;
      const row = perfMap.get(event.recommendation_type) || {
        type: event.recommendation_type,
        impressions: 0,
        clicks: 0,
        add_to_carts: 0,
      };
      if (event.event_type === 'recommendation_impression') row.impressions++;
      if (event.event_type === 'recommendation_click') row.clicks++;
      if (event.event_type === 'recommendation_add_to_cart') row.add_to_carts++;
      perfMap.set(event.recommendation_type, row);
    }

    const recommendationPerformance = Array.from(perfMap.values())
      .map((row) => ({
        ...row,
        click_rate: row.impressions > 0 ? Number(((row.clicks / row.impressions) * 100).toFixed(2)) : 0,
        cart_rate: row.impressions > 0 ? Number(((row.add_to_carts / row.impressions) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.impressions - a.impressions);

    const trendMap = new Map<number, number>();
    for (const event of aiEvents) {
      if (!event.product_id) continue;
      let score = 0;
      if (event.event_type === 'assistant_product_click' || event.event_type === 'visual_search_result_click' || event.event_type === 'recommendation_click') score = 3;
      if (event.event_type === 'assistant_add_to_cart' || event.event_type === 'visual_search_add_to_cart' || event.event_type === 'recommendation_add_to_cart') score = 5;
      if (event.event_type === 'recommendation_impression') score = 1;
      trendMap.set(event.product_id, (trendMap.get(event.product_id) || 0) + score);
    }

    const trendingProducts = Array.from(trendMap.entries())
      .map(([product_id, score]) => ({ product_id, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return {
      ai_stats: {
        period_days: days,
        assistant: {
          sessions: assistantSessions,
          messages: assistantMessages,
          product_clicks: assistantProductClicks,
          add_to_carts: assistantAddToCarts,
          click_rate: assistantSessions > 0 ? Number(((assistantProductClicks / assistantSessions) * 100).toFixed(2)) : 0,
        },
        visual_search: {
          uploads: visualUploads,
          result_clicks: visualClicks,
          add_to_carts: visualAddToCarts,
          click_rate: visualUploads > 0 ? Number(((visualClicks / visualUploads) * 100).toFixed(2)) : 0,
        },
        recommendations: {
          impressions: recommendationImpressions,
          clicks: recommendationClicks,
          add_to_carts: recommendationAddToCarts,
          click_rate: recommendationImpressions > 0 ? Number(((recommendationClicks / recommendationImpressions) * 100).toFixed(2)) : 0,
          cart_rate: recommendationImpressions > 0 ? Number(((recommendationAddToCarts / recommendationImpressions) * 100).toFixed(2)) : 0,
        },
        total_events: aiEvents.length,
      },
      recommendation_performance: recommendationPerformance,
      trending_products: trendingProducts,
    };
  }
}
