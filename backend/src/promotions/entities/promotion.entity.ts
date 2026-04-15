import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PromotionType {
  FLASH_SALE = 'FLASH_SALE',
  SEASONAL = 'SEASONAL',
  CLEARANCE = 'CLEARANCE',
}

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

@Entity('promotions')
export class Promotion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  description: string;

  @Column({
    type: 'varchar',
    enum: PromotionType,
  })
  type: PromotionType;

  @Column({
    name: 'discount_type',
    type: 'varchar',
    enum: DiscountType,
  })
  discount_type: DiscountType;

  @Column({
    name: 'discount_value',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  discount_value: number;

  @Column({ name: 'valid_from', type: 'datetime', nullable: true })
  valid_from: Date;

  @Column({ name: 'valid_to', type: 'datetime', nullable: true })
  valid_to: Date;

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ name: 'product_ids', type: 'simple-json', nullable: true })
  product_ids: number[];

  @Column({ name: 'category_ids', type: 'simple-json', nullable: true })
  category_ids: number[];

  @Column({ name: 'banner_image_url', nullable: true })
  banner_image_url: string;

  @Column({
    name: 'min_purchase',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  min_purchase: number;

  @Column({
    name: 'max_discount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  max_discount: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
