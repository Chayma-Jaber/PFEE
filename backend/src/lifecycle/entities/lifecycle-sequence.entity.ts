import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// A drip sequence: a series of steps sent to a user after a trigger fires.
// Triggers: user.registered, order.placed (post-purchase), cart.abandoned, customer.churning, order.delivered, subscription.cancelled
export enum LifecycleTrigger {
  WELCOME = 'user.registered',
  POST_PURCHASE = 'order.placed',
  ABANDONED_CART = 'cart.abandoned',
  WINBACK = 'customer.churning',
  POST_DELIVERY = 'order.delivered',
  SUB_CANCELLED = 'subscription.cancelled',
}

@Entity('lifecycle_sequences')
export class LifecycleSequence {
  @PrimaryGeneratedColumn() id: number;

  @Column({ type: 'nvarchar', length: 160 })
  name: string;

  @Column({ type: 'nvarchar', length: 500, nullable: true })
  description: string | null;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  trigger_event: string;

  // Steps: [{ delayHours: 0, channel: 'EMAIL'|'SMS'|'IN_APP', subject, body, couponCode? }, ...]
  @Column({ type: 'simple-json' })
  steps: Array<{
    delayHours: number;
    channel: 'EMAIL' | 'SMS' | 'IN_APP';
    subject?: string;
    body: string;
    actionUrl?: string;
    couponCode?: string;
  }>;

  @Index()
  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
