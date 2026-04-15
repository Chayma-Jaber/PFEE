import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum FitRating {
  TOO_SMALL = 'too_small',
  SLIGHTLY_SMALL = 'slightly_small',
  TRUE_TO_SIZE = 'true_to_size',
  SLIGHTLY_LARGE = 'slightly_large',
  TOO_LARGE = 'too_large',
}

@Entity('product_reviews')
export class ProductReview {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'product_id' })
  product_id: number;

  @Column({ name: 'user_id' })
  user_id: number;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'nvarchar', length: 'MAX' })
  comment: string;

  @Column({ name: 'is_verified_purchase', default: false })
  is_verified_purchase: boolean;

  @Column({ name: 'is_approved', default: true })
  is_approved: boolean;

  @Column({ name: 'is_recommended', nullable: true })
  is_recommended: boolean | null;

  @Column({
    name: 'fit_rating',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  fit_rating: FitRating | null;

  @Column({ type: 'simple-json', nullable: true })
  images: string[] | null;

  @Column({ name: 'helpful_count', type: 'int', default: 0 })
  helpful_count: number;

  @Column({ name: 'not_helpful_count', type: 'int', default: 0 })
  not_helpful_count: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany('ReviewVote', 'review')
  votes: any[];
}
