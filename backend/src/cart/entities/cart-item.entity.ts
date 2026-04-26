import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('cart_items')
export class CartItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  user_id: number;

  @Column({ name: 'product_id' })
  product_id: number;

  @Column({ type: 'simple-json', nullable: true })
  variant_info: Record<string, any> | null;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ name: 'saved_for_later', default: false })
  saved_for_later: boolean;

  @CreateDateColumn({ name: 'added_at' })
  added_at: Date;

  @ManyToOne(() => User, (user) => user.cart_items, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
