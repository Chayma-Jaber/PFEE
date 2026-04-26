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
  // Mixed orders: emitted by the auto-promote when seller items are all shipped
  // but merchant items are still in earlier states. The merchant's normal flow
  // promotes this to SHIPPED once their lines leave the warehouse.
  PARTIALLY_SHIPPED = 'PARTIALLY_SHIPPED',
  SHIPPED = 'SHIPPED',
  IN_TRANSIT = 'IN_TRANSIT',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  // Symmetric partial-delivery state for mixed orders.
  PARTIALLY_DELIVERED = 'PARTIALLY_DELIVERED',
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

  // Wave 4: Premium checkout add-ons
  @Column({ name: 'gift_wrap', default: false })
  gift_wrap: boolean;

  @Column({ name: 'gift_message', type: 'nvarchar', length: 500, nullable: true })
  gift_message: string;

  @Column({ name: 'delivery_slot_id', type: 'int', nullable: true })
  delivery_slot_id: number | null;

  @Column({ name: 'pickup_location_id', type: 'int', nullable: true })
  pickup_location_id: number | null;

  @Column({ name: 'referral_share_code', type: 'varchar', length: 20, nullable: true })
  referral_share_code: string | null;

  @Column({ name: 'review_requested_at', type: 'datetime', nullable: true })
  review_requested_at: Date | null;

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
