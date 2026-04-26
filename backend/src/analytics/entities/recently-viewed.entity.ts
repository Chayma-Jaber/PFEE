import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

@Entity('recently_viewed')
@Unique(['user_id', 'product_id'])
export class RecentlyViewed {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'user_id' })
  user_id: number;

  @Column({ name: 'product_id' })
  product_id: number;

  @Column({ name: 'view_count', type: 'int', default: 1 })
  view_count: number;

  @CreateDateColumn({ name: 'first_viewed_at' })
  first_viewed_at: Date;

  @UpdateDateColumn({ name: 'last_viewed_at' })
  last_viewed_at: Date;
}
