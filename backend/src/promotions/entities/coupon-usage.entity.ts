import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Coupon } from './coupon.entity';
import { User } from '../../users/entities/user.entity';

@Entity('coupon_usages')
export class CouponUsage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'coupon_id' })
  coupon_id: number;

  @Column({ name: 'user_id' })
  user_id: number;

  @Column({ name: 'order_id' })
  order_id: number;

  @Column({
    name: 'discount_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  discount_amount: number;

  @CreateDateColumn({ name: 'used_at' })
  used_at: Date;

  @ManyToOne(() => Coupon, (coupon) => coupon.usages, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'coupon_id' })
  coupon: Coupon;

  @ManyToOne(() => User, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
