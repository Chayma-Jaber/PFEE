import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum SmsStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  DELIVERED = 'DELIVERED',
}

export enum SmsPurpose {
  OTP = 'OTP',
  ORDER = 'ORDER',
  SHIPPING = 'SHIPPING',
  PROMO = 'PROMO',
  SUPPORT = 'SUPPORT',
  ADMIN_TEST = 'ADMIN_TEST',
  OTHER = 'OTHER',
}

@Entity('sms_messages')
export class SmsMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'user_id', nullable: true })
  user_id: number | null;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  to: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  from: string | null;

  @Column({ type: 'nvarchar', length: 500 })
  body: string;

  @Column({ type: 'varchar', length: 20 })
  purpose: SmsPurpose;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  status: SmsStatus;

  @Column({ type: 'varchar', length: 30 })
  provider: string;

  @Column({ name: 'provider_message_id', type: 'varchar', length: 100, nullable: true })
  provider_message_id: string | null;

  @Column({ name: 'error_message', type: 'nvarchar', length: 500, nullable: true })
  error_message: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @Column({ name: 'sent_at', type: 'datetime', nullable: true })
  sent_at: Date | null;
}
