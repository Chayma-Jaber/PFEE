import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum TransactionType {
  EARN = 'EARN',
  REDEEM = 'REDEEM',
  ADJUST = 'ADJUST',
  BONUS = 'BONUS',
  EXPIRE = 'EXPIRE',
}

@Entity('loyalty_transactions')
export class LoyaltyTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id' })
  account_id: number;

  @ManyToOne('LoyaltyAccount', 'transactions', { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'account_id' })
  account: any;

  @Column({ type: 'int' })
  points: number;

  @Column({ type: 'varchar', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'varchar', nullable: true })
  description: string;

  @Column({ name: 'order_id', nullable: true })
  order_id: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
