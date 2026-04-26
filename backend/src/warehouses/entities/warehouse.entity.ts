import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('warehouses')
export class Warehouse {
  @PrimaryGeneratedColumn()
  id: number;

  // Short uppercase code used in SKUs / UI ("TUN", "SFX", "MAIN").
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 16 })
  code: string;

  @Column({ type: 'nvarchar', length: 120 })
  name: string;

  @Column({ type: 'nvarchar', length: 120, nullable: true })
  city: string | null;

  @Column({ type: 'nvarchar', length: 400, nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  // Lower priority is picked first by the stock allocator.
  @Column({ type: 'int', default: 100 })
  priority: number;

  // If ships_orders=false, the warehouse only holds stock but orders are routed elsewhere.
  @Column({ name: 'ships_orders', default: true })
  ships_orders: boolean;

  @Index()
  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  // Mark exactly one row with is_default=true. Legacy flat totalStock flows through it.
  @Column({ name: 'is_default', default: false })
  is_default: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
