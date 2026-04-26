import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'product_id' })
  product_id: number;

  @Column({ name: 'variant_id', type: 'int', nullable: true })
  variant_id: number | null;

  @Column({ name: 'previous_stock', type: 'int' })
  previous_stock: number;

  @Column({ name: 'new_stock', type: 'int' })
  new_stock: number;

  @Column({ name: 'delta', type: 'int' })
  delta: number;

  @Column({ type: 'varchar', length: 50 })
  reason: string; // ORDER, RETURN, ADMIN_ADJUSTMENT, RESTOCK, CORRECTION

  @Column({ name: 'reference_id', type: 'varchar', length: 100, nullable: true })
  reference_id: string | null;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  admin_id: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
