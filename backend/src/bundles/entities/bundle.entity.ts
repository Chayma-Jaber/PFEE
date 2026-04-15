import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { BundleItem } from './bundle-item.entity';

@Entity('bundles')
export class Bundle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  description: string;

  @Column({ name: 'image_url', nullable: true })
  image_url: string;

  @Column({
    name: 'bundle_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  bundle_price: number;

  @Column({
    name: 'original_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  original_price: number;

  @Column({
    name: 'savings_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  savings_amount: number;

  @Column({
    name: 'discount_percentage',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  discount_percentage: number;

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @Column({ name: 'valid_from', type: 'datetime', nullable: true })
  valid_from: Date;

  @Column({ name: 'valid_to', type: 'datetime', nullable: true })
  valid_to: Date;

  @Column({ name: 'max_purchases', type: 'int', nullable: true })
  max_purchases: number;

  @Column({ name: 'purchase_count', default: 0 })
  purchase_count: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @OneToMany(() => BundleItem, (item) => item.bundle, {
    cascade: true,
    eager: true,
  })
  items: BundleItem[];
}
