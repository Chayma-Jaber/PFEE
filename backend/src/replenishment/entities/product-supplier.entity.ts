import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

// Mapping product → preferred supplier with cost.
@Entity('product_suppliers')
@Unique('UQ_product_supplier', ['product_id', 'supplier_id'])
export class ProductSupplier {
  @PrimaryGeneratedColumn() id: number;

  @Index()
  @Column({ name: 'product_id', type: 'int' })
  product_id: number;

  @Index()
  @Column({ name: 'supplier_id', type: 'int' })
  supplier_id: number;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 10, scale: 3 })
  unit_cost: number;

  @Column({ name: 'is_primary', default: false })
  is_primary: boolean;

  @Column({ name: 'min_order_qty', type: 'int', default: 1 })
  min_order_qty: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
