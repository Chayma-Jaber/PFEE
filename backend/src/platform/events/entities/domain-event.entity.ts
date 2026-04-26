import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Persistent replayable event log. Every domain event is first appended here, then
// fanned out in-process. If/when we add Redis Streams or Kafka, this table becomes
// the outbox pattern source of truth.
@Entity('domain_events')
export class DomainEvent {
  @PrimaryGeneratedColumn()
  id: number;

  // Stable event name, dot-namespaced. Examples:
  //   order.placed, order.cancelled, order.held
  //   stock.adjusted, stock.reserved
  //   user.registered, user.updated
  //   payment.succeeded, payment.failed
  //   subscription.charged, subscription.paused
  //   fraud.held, fraud.approved
  @Index()
  @Column({ type: 'varchar', length: 80 })
  type: string;

  // Optional correlation id propagated from the request that produced the event.
  @Index()
  @Column({ name: 'correlation_id', type: 'varchar', length: 64, nullable: true })
  correlation_id: string | null;

  // The event payload. Keep it flat JSON, no references to mutable objects.
  @Column({ type: 'simple-json' })
  payload: Record<string, any>;

  // Aggregate identifier (e.g., "order:1234") to allow replay for a single entity.
  @Index()
  @Column({ name: 'aggregate_id', type: 'varchar', length: 80, nullable: true })
  aggregate_id: string | null;

  @Column({ name: 'actor_id', type: 'int', nullable: true })
  actor_id: number | null;

  // Outbox delivery state (for future async publisher). UNPUBLISHED → PUBLISHED → DEAD.
  @Index()
  @Column({ type: 'varchar', length: 20, default: 'UNPUBLISHED' })
  status: 'UNPUBLISHED' | 'PUBLISHED' | 'DEAD';

  @Column({ name: 'attempts', type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'last_error', type: 'nvarchar', length: 500, nullable: true })
  last_error: string | null;

  @CreateDateColumn({ name: 'occurred_at' })
  occurred_at: Date;
}
