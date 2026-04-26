import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('funnel_events')
export class FunnelEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  step: string; // VIEW_HOME, VIEW_PRODUCT, ADD_TO_CART, START_CHECKOUT, COMPLETE_PURCHASE, EXIT_INTENT

  @Column({ name: 'user_id', type: 'int', nullable: true })
  user_id: number | null;

  @Column({ name: 'session_id', type: 'varchar', length: 100, nullable: true })
  session_id: string | null;

  @Column({ name: 'product_id', type: 'int', nullable: true })
  product_id: number | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
