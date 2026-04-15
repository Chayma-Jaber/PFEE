import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id' })
  order_id: number;

  @Column({ name: 'product_id', nullable: true })
  product_id: number;

  @Column({ nullable: true })
  sku: string;

  @Column()
  title: string;

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 10,
    scale: 3,
    default: 0,
  })
  unit_price: number;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({
    name: 'discount_amount',
    type: 'decimal',
    precision: 10,
    scale: 3,
    default: 0,
  })
  discount_amount: number;

  @Column({ name: 'variant_info', type: 'simple-json', nullable: true })
  variant_info: Record<string, any> | null;

  @Column({ name: 'image_url', nullable: true })
  image_url: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'order_id' })
  order: Order;
}
