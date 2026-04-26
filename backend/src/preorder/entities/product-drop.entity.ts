import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum DropStatus {
  SCHEDULED = 'SCHEDULED',
  PREORDER_OPEN = 'PREORDER_OPEN',
  WAITLIST = 'WAITLIST',   // demand > capacity, still collecting names
  SOLD_OUT = 'SOLD_OUT',
  LIVE = 'LIVE',          // stock has arrived, regular sale
  CLOSED = 'CLOSED',
}

@Entity('product_drops')
export class ProductDrop {
  @PrimaryGeneratedColumn() id: number;

  @Index()
  @Column({ name: 'product_id', type: 'int' })
  product_id: number;

  @Column({ type: 'nvarchar', length: 200, nullable: true })
  headline: string | null;

  @Column({ name: 'capacity', type: 'int' })
  capacity: number;

  @Column({ name: 'reserved_count', type: 'int', default: 0 })
  reserved_count: number;

  // Deposit percent required at preorder checkout (e.g. 20 = 20% down, 80% on fulfillment)
  @Column({ name: 'deposit_pct', type: 'int', default: 20 })
  deposit_pct: number;

  // Window
  @Column({ name: 'preorder_start', type: 'datetime' })
  preorder_start: Date;

  @Column({ name: 'preorder_end', type: 'datetime' })
  preorder_end: Date;

  @Column({ name: 'expected_ship_date', type: 'datetime', nullable: true })
  expected_ship_date: Date | null;

  @Index()
  @Column({ type: 'varchar', length: 20, default: DropStatus.SCHEDULED })
  status: DropStatus;

  // Allow waitlist beyond capacity? If true, demand > capacity → WAITLIST status.
  @Column({ name: 'allow_waitlist', default: true })
  allow_waitlist: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
