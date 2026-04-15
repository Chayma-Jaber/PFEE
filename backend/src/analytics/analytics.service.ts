import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { UserEvent, EventType } from './entities/user-event.entity';
import { AdminLog } from './entities/admin-log.entity';
import { TrackEventDto } from './dto/analytics.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(UserEvent)
    private readonly eventRepo: Repository<UserEvent>,
    @InjectRepository(AdminLog)
    private readonly adminLogRepo: Repository<AdminLog>,
  ) {}

  async trackEvent(
    dto: TrackEventDto,
    userId: number | null,
    ipAddress: string,
    userAgent: string,
  ): Promise<UserEvent> {
    const event = this.eventRepo.create({
      user_id: userId,
      session_id: dto.session_id,
      event_type: dto.event_type,
      product_id: dto.product_id || null,
      category_id: dto.category_id || null,
      search_query: dto.search_query || null,
      recommendation_type: dto.recommendation_type || null,
      recommendation_position: dto.recommendation_position || null,
      recommendation_source: dto.recommendation_source || null,
      event_data: dto.event_data || null,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return this.eventRepo.save(event);
  }

  async trackBatchEvents(
    events: TrackEventDto[],
    userId: number | null,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ tracked: number }> {
    const entities = events.map((dto) =>
      this.eventRepo.create({
        user_id: userId,
        session_id: dto.session_id,
        event_type: dto.event_type,
        product_id: dto.product_id || null,
        category_id: dto.category_id || null,
        search_query: dto.search_query || null,
        recommendation_type: dto.recommendation_type || null,
        recommendation_position: dto.recommendation_position || null,
        recommendation_source: dto.recommendation_source || null,
        event_data: dto.event_data || null,
        ip_address: ipAddress,
        user_agent: userAgent,
      }),
    );

    const saved = await this.eventRepo.save(entities);
    return { tracked: saved.length };
  }

  async getProductViewCount(productId: number): Promise<number> {
    return this.eventRepo.count({
      where: {
        product_id: productId,
        event_type: EventType.PRODUCT_VIEW,
      },
    });
  }

  async getUserBehavior(userId: number, limit = 50) {
    return this.eventRepo.find({
      where: { user_id: userId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  async getPopularProducts(period: string, limit = 10) {
    const since = this.parsePeriod(period);

    const results = await this.eventRepo
      .createQueryBuilder('event')
      .select('event.product_id', 'product_id')
      .addSelect('COUNT(event.id)', 'view_count')
      .where('event.event_type = :type', { type: EventType.PRODUCT_VIEW })
      .andWhere('event.product_id IS NOT NULL')
      .andWhere('event.timestamp >= :since', { since })
      .groupBy('event.product_id')
      .orderBy('view_count', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map((r) => ({
      product_id: r.product_id,
      view_count: parseInt(r.view_count, 10),
    }));
  }

  async getSearchAnalytics(period: string) {
    const since = this.parsePeriod(period);

    const topSearches = await this.eventRepo
      .createQueryBuilder('event')
      .select('event.search_query', 'query')
      .addSelect('COUNT(event.id)', 'count')
      .where('event.event_type = :type', { type: EventType.SEARCH_QUERY })
      .andWhere('event.search_query IS NOT NULL')
      .andWhere('event.timestamp >= :since', { since })
      .groupBy('event.search_query')
      .orderBy('count', 'DESC')
      .limit(20)
      .getRawMany();

    const totalSearches = await this.eventRepo.count({
      where: {
        event_type: EventType.SEARCH_QUERY,
        timestamp: MoreThanOrEqual(since),
      },
    });

    return {
      total_searches: totalSearches,
      top_queries: topSearches.map((s) => ({
        query: s.query,
        count: parseInt(s.count, 10),
      })),
    };
  }

  async logAdminAction(
    adminId: number,
    action: string,
    resourceType: string,
    resourceId: string | null,
    oldValues: Record<string, any> | null,
    newValues: Record<string, any> | null,
    ipAddress: string,
    userAgent: string,
  ): Promise<AdminLog> {
    const log = this.adminLogRepo.create({
      admin_id: adminId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return this.adminLogRepo.save(log);
  }

  private parsePeriod(period: string): Date {
    const now = new Date();
    const match = period.match(/^(\d+)(d|h|w|m)$/);

    if (!match) {
      // Default to 7 days
      now.setDate(now.getDate() - 7);
      return now;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'h':
        now.setHours(now.getHours() - value);
        break;
      case 'd':
        now.setDate(now.getDate() - value);
        break;
      case 'w':
        now.setDate(now.getDate() - value * 7);
        break;
      case 'm':
        now.setMonth(now.getMonth() - value);
        break;
    }

    return now;
  }
}
