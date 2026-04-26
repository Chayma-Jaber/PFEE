import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { WishlistCollection } from './wishlist-collection.entity';

@Entity('wishlist_items')
export class WishlistItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  user_id: number;

  @Column({ name: 'product_id' })
  product_id: number;

  @Column({ name: 'collection_id', nullable: true })
  collection_id: number;

  @Column({ name: 'price_at_add', type: 'decimal', precision: 10, scale: 3, nullable: true })
  price_at_add: number | null;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'added_at' })
  added_at: Date;

  @ManyToOne(() => User, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => WishlistCollection, (collection) => collection.items, {
    onDelete: 'NO ACTION',
    nullable: true,
  })
  @JoinColumn({ name: 'collection_id' })
  collection: WishlistCollection;
}
