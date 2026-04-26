import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Unique,
  CreateDateColumn,
} from 'typeorm';

/**
 * Visual merchandising: per-category manual ordering of products.
 * If a product has a position here, it overrides default sort.
 */
@Entity('product_positions')
@Unique(['category_id', 'product_id'])
export class ProductPosition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'category_id' })
  category_id: number;

  @Column({ name: 'product_id' })
  product_id: number;

  @Column({ type: 'int', default: 0 })
  position: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
