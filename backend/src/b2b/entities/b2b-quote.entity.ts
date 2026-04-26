import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum QuoteStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CONVERTED = 'CONVERTED',
}

@Entity('b2b_quotes')
export class B2BQuote {
  @PrimaryGeneratedColumn() id: number;

  @Index()
  @Column({ name: 'account_id', type: 'int' })
  account_id: number;

  @Index()
  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  // [{ productId, quantity, unitPrice, title }] — captured at submission for audit
  @Column({ type: 'simple-json' })
  items: Array<{ productId: number; quantity: number; unitPrice: number; title: string; lineTotal: number }>;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  subtotal: number;

  @Column({ name: 'proposed_discount_pct', type: 'int', default: 0 })
  proposed_discount_pct: number;

  @Column({ name: 'approved_discount_pct', type: 'int', nullable: true })
  approved_discount_pct: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  total: number;

  @Index()
  @Column({ type: 'varchar', length: 20, default: QuoteStatus.DRAFT })
  status: QuoteStatus;

  @Column({ name: 'valid_until', type: 'datetime', nullable: true })
  valid_until: Date | null;

  @Column({ type: 'nvarchar', length: 1000, nullable: true })
  notes: string | null;

  @Column({ name: 'admin_notes', type: 'nvarchar', length: 1000, nullable: true })
  admin_notes: string | null;

  @Column({ name: 'converted_order_id', type: 'int', nullable: true })
  converted_order_id: number | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
