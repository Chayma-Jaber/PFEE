import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Audit log of every price adjustment produced by the engine. Also used to pause
// further changes on a product when it already got touched recently.
@Entity('dynamic_price_changes')
export class DynamicPriceChange {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'product_id', type: 'int' })
  product_id: number;

  @Column({ name: 'rule_id', type: 'int', nullable: true })
  rule_id: number | null;

  @Column({ name: 'strategy', type: 'varchar', length: 30 })
  strategy: string;

  @Column({ name: 'old_price', type: 'decimal', precision: 10, scale: 3 })
  old_price: number;

  @Column({ name: 'new_price', type: 'decimal', precision: 10, scale: 3 })
  new_price: number;

  @Column({ name: 'delta_pct', type: 'decimal', precision: 6, scale: 2 })
  delta_pct: number;

  // APPLIED, PROPOSED (awaiting approval), REJECTED
  @Index()
  @Column({ type: 'varchar', length: 20, default: 'APPLIED' })
  status: string;

  @Column({ type: 'nvarchar', length: 400, nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
