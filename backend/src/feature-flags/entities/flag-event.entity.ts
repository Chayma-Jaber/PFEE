import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Records exposure (when a user saw a variant) and conversion (when a goal fires).
// This is what makes A/B test math possible.
@Entity('feature_flag_events')
export class FeatureFlagEvent {
  @PrimaryGeneratedColumn() id: number;

  @Index()
  @Column({ name: 'flag_key', type: 'varchar', length: 80 })
  flag_key: string;

  @Index()
  @Column({ name: 'user_id', type: 'int', nullable: true })
  user_id: number | null;

  @Index()
  @Column({ type: 'varchar', length: 60 })
  variant: string;

  // EXPOSURE | CONVERSION
  @Column({ type: 'varchar', length: 20 })
  kind: string;

  @Column({ name: 'goal', type: 'varchar', length: 60, nullable: true })
  goal: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ name: 'occurred_at' })
  occurred_at: Date;
}
