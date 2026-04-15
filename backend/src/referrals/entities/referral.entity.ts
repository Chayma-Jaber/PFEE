import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum ReferralStatus {
  PENDING = 'PENDING',
  SIGNED_UP = 'SIGNED_UP',
  FIRST_PURCHASE = 'FIRST_PURCHASE',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
}

export enum RewardType {
  POINTS = 'POINTS',
  DISCOUNT = 'DISCOUNT',
  CREDIT = 'CREDIT',
}

@Entity('referrals')
export class Referral {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'referrer_id' })
  referrer_id: number;

  @ManyToOne('User', { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'referrer_id' })
  referrer: any;

  @Column({ name: 'referral_code', unique: true })
  referral_code: string;

  @Column({ name: 'referred_user_id', nullable: true })
  referred_user_id: number;

  @ManyToOne('User', { onDelete: 'NO ACTION', nullable: true })
  @JoinColumn({ name: 'referred_user_id' })
  referred_user: any;

  @Column({ name: 'referred_email', type: 'varchar', nullable: true })
  referred_email: string;

  @Column({
    type: 'varchar',
    enum: ReferralStatus,
    default: ReferralStatus.PENDING,
  })
  status: ReferralStatus;

  @Column({
    name: 'reward_type',
    type: 'varchar',
    enum: RewardType,
    default: RewardType.POINTS,
  })
  reward_type: RewardType;

  @Column({
    name: 'reward_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 500,
  })
  reward_amount: number;

  @Column({
    name: 'referrer_reward_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 500,
  })
  referrer_reward_amount: number;

  @Column({ name: 'is_reward_claimed', default: false })
  is_reward_claimed: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completed_at: Date;

  @Column({ name: 'expires_at', type: 'datetime', nullable: true })
  expires_at: Date;
}
