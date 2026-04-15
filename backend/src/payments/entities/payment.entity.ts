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

export enum PaymentMethod {
  CTP = 'CTP',
  COD = 'COD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  GIFT_CARD = 'GIFT_CARD',
}

export enum PaymentState {
  INITIATED = 'INITIATED',
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id' })
  order_id: number;

  @Column({ unique: true })
  reference: string;

  @Column({
    type: 'varchar',
    enum: PaymentMethod,
    default: PaymentMethod.CTP,
  })
  method: PaymentMethod;

  @Column({
    type: 'varchar',
    enum: PaymentState,
    default: PaymentState.INITIATED,
  })
  state: PaymentState;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  amount: number;

  @Column({ default: 'TND' })
  currency: string;

  @Column({
    name: 'refunded_amount',
    type: 'decimal',
    precision: 10,
    scale: 3,
    default: 0,
  })
  refunded_amount: number;

  @Column({ name: 'ctp_transaction_id', nullable: true })
  ctp_transaction_id: string;

  @Column({ name: 'ctp_payment_id', nullable: true })
  ctp_payment_id: string;

  @Column({ name: 'ctp_redirect_url', nullable: true })
  ctp_redirect_url: string;

  @Column({ name: 'gateway_response', type: 'simple-json', nullable: true })
  gateway_response: Record<string, any>;

  @Column({ name: 'error_code', nullable: true })
  error_code: string;

  @Column({ name: 'error_message', nullable: true })
  error_message: string;

  @Column({ name: 'idempotency_key', nullable: true })
  idempotency_key: string;

  @Column({ name: 'attempt_count', default: 0 })
  attempt_count: number;

  @Column({ name: 'ip_address', nullable: true })
  ip_address: string;

  @Column({ name: 'user_agent', nullable: true })
  user_agent: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completed_at: Date;

  @Column({ name: 'failed_at', type: 'datetime', nullable: true })
  failed_at: Date;

  @Column({ name: 'refunded_at', type: 'datetime', nullable: true })
  refunded_at: Date;

  // Relations
  @ManyToOne('Order', 'payments', { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'order_id' })
  order: any;

  @OneToMany('PaymentLog', 'payment', { cascade: true })
  logs: any[];
}
