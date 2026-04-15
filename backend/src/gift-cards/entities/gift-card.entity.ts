import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('gift_cards')
export class GiftCard {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  balance: number;

  @Column({ type: 'varchar', default: 'TND' })
  currency: string;

  @Column({ name: 'sender_id', nullable: true })
  sender_id: number;

  @ManyToOne('User', { onDelete: 'NO ACTION', nullable: true })
  @JoinColumn({ name: 'sender_id' })
  sender: any;

  @Column({ name: 'recipient_email', type: 'varchar' })
  recipient_email: string;

  @Column({ name: 'recipient_name', type: 'varchar' })
  recipient_name: string;

  @Column({ name: 'sender_name', type: 'varchar', nullable: true })
  sender_name: string;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  message: string;

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @Column({ name: 'is_redeemed', default: false })
  is_redeemed: boolean;

  @Column({ name: 'purchased_at', type: 'datetime', nullable: true })
  purchased_at: Date;

  @Column({ name: 'redeemed_at', type: 'datetime', nullable: true })
  redeemed_at: Date;

  @Column({ name: 'redeemed_by', nullable: true })
  redeemed_by: number;

  @ManyToOne('User', { onDelete: 'NO ACTION', nullable: true })
  @JoinColumn({ name: 'redeemed_by' })
  redeemer: any;

  @Column({ name: 'expires_at', type: 'datetime', nullable: true })
  expires_at: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
