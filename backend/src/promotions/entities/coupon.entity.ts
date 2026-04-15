import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

export enum CouponDiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

export enum CouponAppliesTo {
  ALL = 'ALL',
  SPECIFIC_PRODUCTS = 'SPECIFIC_PRODUCTS',
  SPECIFIC_CATEGORIES = 'SPECIFIC_CATEGORIES',
}

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  description: string;

  @Column({
    name: 'discount_type',
    type: 'varchar',
    enum: CouponDiscountType,
  })
  discount_type: CouponDiscountType;

  @Column({
    name: 'discount_value',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  discount_value: number;

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

  @Column({ name: 'usage_limit', type: 'int', nullable: true })
  usage_limit: number;

  @Column({ name: 'usage_count', default: 0 })
  usage_count: number;

  @Column({ name: 'per_user_limit', default: 1 })
  per_user_limit: number;

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @Column({ name: 'valid_from', type: 'datetime', nullable: true })
  valid_from: Date;

  @Column({ name: 'valid_to', type: 'datetime', nullable: true })
  valid_to: Date;

  @Column({
    name: 'applies_to',
    type: 'varchar',
    enum: CouponAppliesTo,
    default: CouponAppliesTo.ALL,
  })
  applies_to: CouponAppliesTo;

  @Column({ name: 'product_ids', type: 'simple-json', nullable: true })
  product_ids: number[];

  @Column({ name: 'category_ids', type: 'simple-json', nullable: true })
  category_ids: number[];

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @OneToMany('CouponUsage', 'coupon')
  usages: any[];
}
