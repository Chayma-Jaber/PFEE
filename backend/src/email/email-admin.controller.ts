import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

import { EmailLog, EmailLogKind, EmailLogStatus } from './entities/email-log.entity';

@Controller('admin/email-analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class EmailAdminController {
  constructor(@InjectRepository(EmailLog) private readonly repo: Repository<EmailLog>) {}

  @Get('stats')
  async stats(@Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number) {
    const since = new Date();
    since.setDate(since.getDate() - Math.max(1, Math.min(days, 365)));

    const base = () =>
      this.repo.createQueryBuilder('e').where('e.created_at >= :since', { since });

    const [total, sent, failed, disabled, opened, clicked] = await Promise.all([
      base().getCount(),
      base().andWhere('e.status != :d', { d: EmailLogStatus.DISABLED }).andWhere('e.status != :q', { q: EmailLogStatus.QUEUED }).andWhere('e.status != :f', { f: EmailLogStatus.FAILED }).getCount(),
      base().andWhere('e.status = :s', { s: EmailLogStatus.FAILED }).getCount(),
      base().andWhere('e.status = :s', { s: EmailLogStatus.DISABLED }).getCount(),
      base().andWhere('e.opens_count > 0').getCount(),
      base().andWhere('e.clicks_count > 0').getCount(),
    ]);

    const deliveryRate = total > 0 ? Math.round((sent / total) * 1000) / 10 : 0;
    const openRate = sent > 0 ? Math.round((opened / sent) * 1000) / 10 : 0;
    const clickRate = sent > 0 ? Math.round((clicked / sent) * 1000) / 10 : 0;

    // Breakdown per kind (last N days)
    const byKindRaw = await this.repo
      .createQueryBuilder('e')
      .select('e.kind', 'kind')
      .addSelect('COUNT(1)', 'count')
      .addSelect('SUM(CASE WHEN e.opens_count > 0 THEN 1 ELSE 0 END)', 'openCount')
      .where('e.created_at >= :since', { since })
      .groupBy('e.kind')
      .getRawMany();
    const byKind = byKindRaw.map((r) => ({
      kind: r.kind as EmailLogKind,
      count: Number(r.count),
      openCount: Number(r.openCount || 0),
    }));

    return {
      windowDays: days,
      total, sent, failed, disabled, opened, clicked,
      deliveryRate, openRate, clickRate,
      byKind,
    };
  }

  @Get('recent')
  async recent(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('kind') kind?: string,
    @Query('q') q?: string,
  ) {
    const qb = this.repo.createQueryBuilder('e').orderBy('e.created_at', 'DESC').take(limit);
    if (status) qb.andWhere('e.status = :st', { st: status.toUpperCase() });
    if (kind) qb.andWhere('e.kind = :k', { k: kind.toUpperCase() });
    if (q) qb.andWhere('(LOWER(e.recipient) LIKE :q OR LOWER(e.subject) LIKE :q)', { q: `%${q.toLowerCase()}%` });
    const items = await qb.getMany();
    return { items };
  }
}
