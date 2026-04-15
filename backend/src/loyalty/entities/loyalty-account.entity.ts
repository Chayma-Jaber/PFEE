import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum LoyaltyTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

@Entity('loyalty_accounts')
export class LoyaltyAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', unique: true })
  user_id: number;

  @ManyToOne('User', { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'user_id' })
  user: any;

  @Column({ name: 'total_points', type: 'int', default: 0 })
  total_points: number;

  @Column({ name: 'available_points', type: 'int', default: 0 })
  available_points: number;

  @Column({ name: 'lifetime_points', type: 'int', default: 0 })
  lifetime_points: number;

  @Column({
    type: 'varchar',
    enum: LoyaltyTier,
    default: LoyaltyTier.BRONZE,
  })
  tier: LoyaltyTier;

  @Column({ name: 'tier_updated_at', type: 'datetime', nullable: true })
  tier_updated_at: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @OneToMany('LoyaltyTransaction', 'account')
  transactions: any[];
}
