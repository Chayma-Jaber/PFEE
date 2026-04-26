import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

import { DomainEvent } from './entities/domain-event.entity';

export interface PublishOptions {
  correlationId?: string;
  aggregateId?: string;
  actorId?: number;
}

export type EventHandler = (payload: any, meta: {
  id: number;
  type: string;
  correlationId: string | null;
  aggregateId: string | null;
  occurredAt: Date;
}) => void | Promise<void>;

@Injectable()
export class EventBusService implements OnModuleInit {
  private readonly logger = new Logger(EventBusService.name);
  private readonly emitter = new EventEmitter();
  private readonly recentEventCount = { total: 0, byType: new Map<string, number>() };

  constructor(@InjectRepository(DomainEvent) private readonly repo: Repository<DomainEvent>) {
    this.emitter.setMaxListeners(100);
  }

  async onModuleInit() {
    this.logger.log('EventBus ready (in-process emitter + persistent outbox at domain_events)');
  }

  // Publish an event: persist first, then emit. If persistence fails, still emit so
  // in-process consumers aren't silently dropped. Caller gets the persisted id (or null).
  async publish(type: string, payload: Record<string, any>, opts: PublishOptions = {}): Promise<number | null> {
    const correlationId = opts.correlationId || randomUUID();
    let id: number | null = null;
    try {
      const row = this.repo.create({
        type,
        correlation_id: correlationId,
        payload: payload ?? {},
        aggregate_id: opts.aggregateId || null,
        actor_id: opts.actorId ?? null,
        status: 'UNPUBLISHED',
        attempts: 0,
      });
      const saved = await this.repo.save(row);
      id = saved.id;
      // Mark PUBLISHED immediately since we fan out synchronously in-process
      saved.status = 'PUBLISHED';
      saved.attempts = 1;
      await this.repo.save(saved).catch(() => {});
    } catch (err) {
      this.logger.warn(`domain_events insert failed for ${type}: ${(err as any)?.message || err}`);
    }

    this.recentEventCount.total++;
    this.recentEventCount.byType.set(type, (this.recentEventCount.byType.get(type) || 0) + 1);

    const meta = { id: id || 0, type, correlationId, aggregateId: opts.aggregateId || null, occurredAt: new Date() };
    // Emit on the specific type channel AND the wildcard '*'
    this.emitter.emit(type, payload, meta);
    this.emitter.emit('*', payload, meta);
    return id;
  }

  subscribe(type: string, handler: EventHandler): () => void {
    const wrapped = (p: any, m: any) => {
      try {
        const r = handler(p, m);
        if (r && typeof (r as any).catch === 'function') {
          (r as any).catch((e: any) => this.logger.warn(`handler for ${type} threw: ${e?.message || e}`));
        }
      } catch (err) {
        this.logger.warn(`handler for ${type} threw: ${(err as any)?.message || err}`);
      }
    };
    this.emitter.on(type, wrapped);
    return () => this.emitter.off(type, wrapped);
  }

  // Wildcard subscription for observability / audit sinks.
  onAll(handler: EventHandler): () => void {
    return this.subscribe('*', handler);
  }

  // ═══ Admin read APIs ═════════════════════════════════════════════════

  listRecent(opts: { limit?: number; type?: string; aggregateId?: string } = {}) {
    const qb = this.repo.createQueryBuilder('e').orderBy('e.occurred_at', 'DESC').take(Math.min(200, opts.limit || 100));
    if (opts.type) qb.andWhere('e.type = :t', { t: opts.type });
    if (opts.aggregateId) qb.andWhere('e.aggregate_id = :a', { a: opts.aggregateId });
    return qb.getMany();
  }

  async stats() {
    const since24h = new Date(Date.now() - 24 * 3600 * 1000);
    const [total, last24h, byType, failures] = await Promise.all([
      this.repo.count(),
      this.repo.count({ where: { occurred_at: { $gte: since24h } as any } }).catch(async () => {
        return this.repo.createQueryBuilder('e').where('e.occurred_at >= :s', { s: since24h }).getCount();
      }),
      this.repo
        .createQueryBuilder('e')
        .select('e.type', 'type')
        .addSelect('COUNT(1)', 'count')
        .where('e.occurred_at >= :s', { s: since24h })
        .groupBy('e.type')
        .getRawMany(),
      this.repo.count({ where: { status: 'DEAD' } }),
    ]);
    return {
      total,
      last24h,
      dead: failures,
      inProcessCounters: {
        total: this.recentEventCount.total,
        byType: Object.fromEntries(this.recentEventCount.byType),
      },
      byType24h: byType.map((r) => ({ type: r.type, count: Number(r.count) })).sort((a, b) => b.count - a.count),
    };
  }
}
