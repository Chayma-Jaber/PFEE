import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  OneToMany,
  JoinTable,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { ProductVariant } from './product-variant.entity';
import { ProductImage } from './product-image.entity';

export enum Famille {
  MEN = 'MEN',
  WOMEN = 'WOMEN',
  KIDS = 'KIDS',
  UNISEX = 'UNISEX',
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sku: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  slug: string;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  price: number;

  @Column({ name: 'current_price', type: 'decimal', precision: 10, scale: 3, default: 0 })
  currentPrice: number;

  @Column({ name: 'cost_price', type: 'decimal', precision: 10, scale: 3, nullable: true })
  costPrice: number;

  @Column({ type: 'int', default: 0 })
  discount: number;

  @Column({ type: 'varchar', length: 10, default: Famille.UNISEX })
  famille: Famille;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ligne: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  persona: string;

  @Column({ name: 'total_stock', type: 'int', default: 0 })
  totalStock: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_featured', default: false })
  isFeatured: boolean;

  @Column({ name: 'is_bestseller', default: false })
  isBestseller: boolean;

  @Column({ name: 'is_new', default: false })
  isNew: boolean;

  @Column({ name: 'first_image_url', type: 'varchar', length: 500, nullable: true })
  firstImageUrl: string;

  @Column({ name: 'second_image_url', type: 'varchar', length: 500, nullable: true })
  secondImageUrl: string;

  @Column({ name: 'external_id', type: 'varchar', length: 100, nullable: true })
  externalId: string;

  @Column({ name: 'view_count', type: 'int', default: 0 })
  viewCount: number;

  @Column({ name: 'order_count', type: 'int', default: 0 })
  orderCount: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  composition: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand: string;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  weight: number;

  @Column({ type: 'simple-json', nullable: true })
  tags: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToMany(() => Category, (category) => category.products, { eager: false })
  @JoinTable({
    name: 'product_categories',
    joinColumn: { name: 'product_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'category_id', referencedColumnName: 'id' },
  })
  categories: Category[];

  @OneToMany(() => ProductVariant, (variant) => variant.product, { eager: false })
  variants: ProductVariant[];

  @OneToMany(() => ProductImage, (image) => image.product, { eager: false })
  images: ProductImage[];
}
