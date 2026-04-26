import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum DynamicPricingStrategy {
  // Discount deepens as inventory gets older without selling
  INVENTORY_AGE = 'INVENTORY_AGE',
  // Discount kicks in if views are high but orders/views ratio is low
  LOW_CONVERSION = 'LOW_CONVERSION',
  // Hot items: raise price slightly if view_count + order_count surge (scarcity-aware)
  HIGH_DEMAND = 'HIGH_DEMAND',
  // Last-chance clearance: aggressive discount on low-stock + old inventory
  CLEARANCE = 'CLEARANCE',
}

export enum DynamicPricingScope {
  PRODUCT = 'PRODUCT',
  CATEGORY = 'CATEGORY',
  FAMILLE = 'FAMILLE',
  ALL = 'ALL',
}

@Entity('dynamic_price_rules')
export class DynamicPriceRule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Index()
  @Column({ type: 'varchar', length: 30 })
  strategy: DynamicPricingStrategy;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  scope: DynamicPricingScope;

  // null when scope=ALL. product id (number as string), category id, or famille name.
  @Column({ name: 'scope_value', type: 'varchar', length: 80, nullable: true })
  scope_value: string | null;

  // Cap how low / high the engine can go, as a percentage of the original `Product.price`.
  @Column({ name: 'min_price_pct', type: 'int', default: 60 })
  min_price_pct: number;

  @Column({ name: 'max_price_pct', type: 'int', default: 110 })
  max_price_pct: number;

  // Strategy-specific knobs stored as JSON so we don't need schema changes per strategy.
  // e.g. INVENTORY_AGE: { startDays: 30, pctPerDay: 0.5, maxDiscountPct: 30 }
  @Column({ type: 'simple-json' })
  params: Record<string, any>;

  // Safety: require admin approval instead of auto-applying when pct change exceeds this.
  @Column({ name: 'auto_apply_threshold_pct', type: 'int', default: 10 })
  auto_apply_threshold_pct: number;

  @Column({ type: 'int', default: 100 })
  priority: number;

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
