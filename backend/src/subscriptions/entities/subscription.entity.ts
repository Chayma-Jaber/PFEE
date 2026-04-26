import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
  PAST_DUE = 'PAST_DUE',
}

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Index()
  @Column({ name: 'product_id', type: 'int' })
  product_id: number;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  // 7, 14, 30, 60, 90 — in days.
  @Column({ name: 'frequency_days', type: 'int' })
  frequency_days: number;

  // Subscriber discount, applied to every recurring order. 0..50.
  @Column({ name: 'discount_pct', type: 'int', default: 10 })
  discount_pct: number;

  @Index()
  @Column({ type: 'varchar', length: 20, default: SubscriptionStatus.ACTIVE })
  status: SubscriptionStatus;

  @Index()
  @Column({ name: 'next_charge_at', type: 'datetime' })
  next_charge_at: Date;

  @Column({ name: 'pause_until', type: 'datetime', nullable: true })
  pause_until: Date | null;

  @Column({ name: 'shipping_address_id', type: 'int', nullable: true })
  shipping_address_id: number | null;

  @Column({ name: 'payment_method_id', type: 'int', nullable: true })
  payment_method_id: number | null;

  @Column({ name: 'total_cycles', type: 'int', default: 0 })
  total_cycles: number;

  @Column({ name: 'failed_attempts', type: 'int', default: 0 })
  failed_attempts: number;

  @Column({ name: 'last_error', type: 'nvarchar', length: 400, nullable: true })
  last_error: string | null;

  @Column({ name: 'cancelled_at', type: 'datetime', nullable: true })
  cancelled_at: Date | null;

  @Column({ name: 'cancel_reason', type: 'nvarchar', length: 400, nullable: true })
  cancel_reason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
