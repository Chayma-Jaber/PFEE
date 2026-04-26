import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum EmailLogStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  FAILED = 'FAILED',
  BOUNCED = 'BOUNCED',
  OPENED = 'OPENED',
  CLICKED = 'CLICKED',
  DISABLED = 'DISABLED',
}

export enum EmailLogKind {
  ORDER_CONFIRMATION = 'ORDER_CONFIRMATION',
  PAYMENT_CONFIRMATION = 'PAYMENT_CONFIRMATION',
  SHIPPING = 'SHIPPING',
  PASSWORD_RESET = 'PASSWORD_RESET',
  SUPPORT = 'SUPPORT',
  CART_RECOVERY = 'CART_RECOVERY',
  NEWSLETTER = 'NEWSLETTER',
  ADMIN_TEST = 'ADMIN_TEST',
  OTHER = 'OTHER',
}

@Entity('email_logs')
export class EmailLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'tracking_id', type: 'varchar', length: 40, unique: true })
  tracking_id: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  recipient: string;

  @Column({ type: 'nvarchar', length: 400 })
  subject: string;

  @Column({ type: 'varchar', length: 40, default: EmailLogKind.OTHER })
  kind: EmailLogKind;

  @Index()
  @Column({ type: 'varchar', length: 20, default: EmailLogStatus.QUEUED })
  status: EmailLogStatus;

  @Column({ name: 'provider_message_id', type: 'varchar', length: 200, nullable: true })
  provider_message_id: string | null;

  @Column({ name: 'error_message', type: 'nvarchar', length: 500, nullable: true })
  error_message: string | null;

  @Column({ name: 'opens_count', type: 'int', default: 0 })
  opens_count: number;

  @Column({ name: 'clicks_count', type: 'int', default: 0 })
  clicks_count: number;

  @Index()
  @Column({ name: 'user_id', type: 'int', nullable: true })
  user_id: number | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @Column({ name: 'sent_at', type: 'datetime', nullable: true })
  sent_at: Date | null;

  @Column({ name: 'first_opened_at', type: 'datetime', nullable: true })
  first_opened_at: Date | null;

  @Column({ name: 'last_opened_at', type: 'datetime', nullable: true })
  last_opened_at: Date | null;
}
