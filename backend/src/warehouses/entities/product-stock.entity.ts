import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity('product_stock')
@Unique('UQ_product_warehouse', ['product_id', 'warehouse_id'])
export class ProductStock {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'product_id', type: 'int' })
  product_id: number;

  @Index()
  @Column({ name: 'warehouse_id', type: 'int' })
  warehouse_id: number;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  // Quantity reserved against pending orders but not yet shipped.
  @Column({ name: 'reserved', type: 'int', default: 0 })
  reserved: number;

  // Low-water mark — below this the item appears in the "low stock" admin view.
  @Column({ name: 'safety_stock', type: 'int', default: 0 })
  safety_stock: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
