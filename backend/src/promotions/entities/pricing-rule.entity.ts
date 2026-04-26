import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('pricing_rules')
export class PricingRule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  rule_type: string; // CATEGORY_DISCOUNT, VOLUME_DISCOUNT, TAG_DISCOUNT

  @Column({ name: 'discount_type', type: 'varchar', length: 20, default: 'percentage' })
  discount_type: string; // percentage, fixed

  @Column({ name: 'discount_value', type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount_value: number;

  @Column({ name: 'target_type', type: 'varchar', length: 30, nullable: true })
  target_type: string; // category, famille, tag, all

  @Column({ name: 'target_value', type: 'varchar', length: 255, nullable: true })
  target_value: string;

  @Column({ name: 'min_quantity', type: 'int', nullable: true })
  min_quantity: number | null;

  @Column({ name: 'min_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  min_amount: number | null;

  @Column({ name: 'priority', type: 'int', default: 0 })
  priority: number;

  @Column({ name: 'segment', type: 'varchar', length: 30, nullable: true })
  segment: string | null; // VIP, LOYAL, AT_RISK, NEW, PROSPECT, null=all

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @Column({ name: 'valid_from', type: 'datetime', nullable: true })
  valid_from: Date | null;

  @Column({ name: 'valid_to', type: 'datetime', nullable: true })
  valid_to: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
