import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('feature_flags')
export class FeatureFlag {
  @PrimaryGeneratedColumn() id: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  key: string;

  @Column({ type: 'nvarchar', length: 200 })
  name: string;

  @Column({ type: 'nvarchar', length: 500, nullable: true })
  description: string | null;

  @Index()
  @Column({ name: 'is_enabled', default: false })
  is_enabled: boolean;

  // Percentage rollout 0..100. When < 100, hash userId+key to bucket users deterministically.
  @Column({ name: 'rollout_pct', type: 'int', default: 100 })
  rollout_pct: number;

  // Optional segment whitelist: ["VIP","BETA"]. Empty = no segment restriction.
  @Column({ name: 'segments', type: 'simple-json', nullable: true })
  segments: string[] | null;

  // For multi-arm experiments: variants like [{name:"A",weight:50},{name:"B",weight:50}]
  // When set, rollout returns a variant name instead of a boolean.
  @Column({ type: 'simple-json', nullable: true })
  variants: Array<{ name: string; weight: number }> | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
