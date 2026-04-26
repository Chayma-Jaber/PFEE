import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// One row per scheduled payout for one seller, covering a given period.
@Entity('seller_payouts')
export class SellerPayout {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'seller_id', type: 'int' })
  seller_id: number;

  @Column({ name: 'period_start', type: 'datetime' })
  period_start: Date;

  @Column({ name: 'period_end', type: 'datetime' })
  period_end: Date;

  @Column({ name: 'gross_sales', type: 'decimal', precision: 12, scale: 3 })
  gross_sales: number;

  @Column({ name: 'commission_amount', type: 'decimal', precision: 12, scale: 3 })
  commission_amount: number;

  @Column({ name: 'refund_amount', type: 'decimal', precision: 12, scale: 3, default: 0 })
  refund_amount: number;

  @Column({ name: 'net_payout', type: 'decimal', precision: 12, scale: 3 })
  net_payout: number;

  @Column({ name: 'order_count', type: 'int' })
  order_count: number;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: 'PENDING' | 'PAID' | 'CANCELLED';

  @Column({ name: 'paid_at', type: 'datetime', nullable: true })
  paid_at: Date | null;

  @Column({ name: 'payment_reference', type: 'varchar', length: 100, nullable: true })
  payment_reference: string | null;

  @Column({ type: 'nvarchar', length: 500, nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
