import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('product_variants')
export class ProductVariant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'product_id', type: 'int' })
  productId: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sku: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  couleur: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  taille: string;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ name: 'price_adjust', type: 'decimal', precision: 10, scale: 3, default: 0 })
  priceAdjust: number;

  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ type: 'varchar', length: 13, nullable: true })
  ean13: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Product, (product) => product.variants, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
