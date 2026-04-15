import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum OrderStatus {
  PENDING = 'PENDING',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  SHIPPED = 'SHIPPED',
  IN_TRANSIT = 'IN_TRANSIT',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
}

export enum PaymentMethodType {
  CTP = 'ctp',
  COD = 'cod',
}

export enum OrderSource {
  WEB = 'web',
  MOBILE = 'mobile',
  ADMIN = 'admin',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  reference: string;

  @Column({ name: 'user_id' })
  user_id: number;

  @Column({
    type: 'varchar',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({
    name: 'payment_status',
    type: 'varchar',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  payment_status: PaymentStatus;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  subtotal: number;

  @Column({
    name: 'discount_amount',
    type: 'decimal',
    precision: 10,
    scale: 3,
    default: 0,
  })
  discount_amount: number;

  @Column({
    name: 'shipping_amount',
    type: 'decimal',
    precision: 10,
    scale: 3,
    default: 0,
  })
  shipping_amount: number;

  @Column({
    name: 'tax_amount',
    type: 'decimal',
    precision: 10,
    scale: 3,
    default: 0,
  })
  tax_amount: number;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 10,
    scale: 3,
    default: 0,
  })
  total_amount: number;

  @Column({ name: 'coupon_code', nullable: true })
  coupon_code: string;

  @Column({ name: 'coupon_id', nullable: true })
  coupon_id: number;

  @Column({ name: 'shipping_address', type: 'simple-json', nullable: true })
  shipping_address: Record<string, any>;

  @Column({ name: 'billing_address', type: 'simple-json', nullable: true })
  billing_address: Record<string, any>;

  @Column({ name: 'shipping_method', nullable: true })
  shipping_method: string;

  @Column({ name: 'tracking_number', nullable: true })
  tracking_number: string;

  @Column({ name: 'customer_email', nullable: true })
  customer_email: string;

  @Column({ name: 'customer_phone', nullable: true })
  customer_phone: string;

  @Column({
    name: 'payment_method',
    type: 'varchar',
    enum: PaymentMethodType,
    nullable: true,
  })
  payment_method: PaymentMethodType;

  @Column({ name: 'payment_reference', nullable: true })
  payment_reference: string;

  @Column({ name: 'ctp_transaction_id', nullable: true })
  ctp_transaction_id: string;

  @Column({ name: 'ip_address', nullable: true })
  ip_address: string;

  @Column({ name: 'user_agent', nullable: true })
  user_agent: string;

  @Column({
    type: 'varchar',
    enum: OrderSource,
    default: OrderSource.WEB,
  })
  source: OrderSource;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  notes: string;

  @Column({ name: 'cancel_reason', nullable: true })
  cancel_reason: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'confirmed_at', type: 'datetime', nullable: true })
  confirmed_at: Date;

  @Column({ name: 'shipped_at', type: 'datetime', nullable: true })
  shipped_at: Date;

  @Column({ name: 'delivered_at', type: 'datetime', nullable: true })
  delivered_at: Date;

  @Column({ name: 'cancelled_at', type: 'datetime', nullable: true })
  cancelled_at: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.orders, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany('OrderItem', 'order', { cascade: true })
  items: any[];

  @OneToMany('Payment', 'order')
  payments: any[];

  @OneToMany('OrderStatusHistory', 'order', { cascade: true })
  status_history: any[];
}
