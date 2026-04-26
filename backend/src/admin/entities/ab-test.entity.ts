import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ab_tests')
export class AbTest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  key: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'simple-json' })
  variants: Array<{ id: string; label: string; weight: number; config?: any }>;

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @Column({ name: 'goal_event', type: 'varchar', length: 50, default: 'COMPLETE_PURCHASE' })
  goal_event: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}

@Entity('ab_test_events')
export class AbTestEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  test_key: string;

  @Column({ type: 'varchar', length: 50 })
  variant_id: string;

  @Column({ type: 'varchar', length: 30 })
  kind: string; // IMPRESSION, GOAL

  @Column({ name: 'user_id', type: 'int', nullable: true })
  user_id: number | null;

  @Column({ name: 'session_id', type: 'varchar', length: 100, nullable: true })
  session_id: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
