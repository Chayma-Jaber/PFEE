import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// One user enrolled in a sequence. Tracks progress through the steps.
@Entity('lifecycle_enrollments')
export class LifecycleEnrollment {
  @PrimaryGeneratedColumn() id: number;

  @Index()
  @Column({ name: 'sequence_id', type: 'int' })
  sequence_id: number;

  @Index()
  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Index()
  @Column({ name: 'next_step_at', type: 'datetime' })
  next_step_at: Date;

  @Column({ name: 'next_step_index', type: 'int', default: 0 })
  next_step_index: number;

  @Column({ name: 'context', type: 'simple-json', nullable: true })
  context: Record<string, any> | null; // e.g. orderId, cartId — available during templating

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'FAILED';

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
