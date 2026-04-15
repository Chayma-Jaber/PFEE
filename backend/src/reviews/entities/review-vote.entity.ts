import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ProductReview } from './product-review.entity';

@Entity('review_votes')
@Unique('UQ_review_user', ['review_id', 'user_id'])
export class ReviewVote {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'review_id' })
  review_id: number;

  @Column({ name: 'user_id' })
  user_id: number;

  @Column({ name: 'is_helpful' })
  is_helpful: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @ManyToOne(() => ProductReview, (review) => review.votes, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'review_id' })
  review: ProductReview;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
