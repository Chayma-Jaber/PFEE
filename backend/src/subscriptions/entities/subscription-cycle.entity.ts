import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Each scheduled charge attempt. Built as a log so we can reason about dunning history.
@Entity('subscription_cycles')
export class SubscriptionCycle {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'subscription_id', type: 'int' })
  subscription_id: number;

  @Column({ name: 'cycle_number', type: 'int' })
  cycle_number: number;

  @Column({ name: 'order_id', type: 'int', nullable: true })
  order_id: number | null;

  // SUCCESS, FAILED, SKIPPED, PENDING
  @Index()
  @Column({ type: 'varchar', length: 20 })
  status: string;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  amount: number;

  @Column({ name: 'error_message', type: 'nvarchar', length: 400, nullable: true })
  error_message: string | null;

  @Column({ name: 'scheduled_for', type: 'datetime' })
  scheduled_for: Date;

  @Column({ name: 'attempted_at', type: 'datetime', nullable: true })
  attempted_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
