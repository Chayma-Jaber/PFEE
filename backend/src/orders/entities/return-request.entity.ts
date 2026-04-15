import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ReturnStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SHIPPED = 'shipped',
  RECEIVED = 'received',
  REFUNDED = 'refunded',
  CLOSED = 'closed',
}

@Entity('return_requests')
export class ReturnRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  order_id: number;

  @Column()
  user_id: number;

  @Column({ type: 'varchar', default: ReturnStatus.PENDING })
  status: ReturnStatus;

  @Column({ nullable: true })
  reason: string;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  description: string;

  @Column({ type: 'simple-json', nullable: true })
  items: any[];

  @Column({ type: 'simple-json', nullable: true })
  photos: string[];

  @Column({ type: 'simple-json', nullable: true })
  return_address: any;

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true })
  refund_amount: number;

  @Column({ nullable: true })
  refund_method: string;

  @Column({ nullable: true })
  admin_notes: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'datetime', nullable: true })
  resolved_at: Date;
}
