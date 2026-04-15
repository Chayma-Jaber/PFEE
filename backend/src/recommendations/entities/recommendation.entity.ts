import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum RecommendationStrategy {
  SIMILAR = 'SIMILAR',
  COMPLEMENTARY = 'COMPLEMENTARY',
  TRENDING = 'TRENDING',
  NEW_ARRIVALS = 'NEW_ARRIVALS',
  SEASONAL = 'SEASONAL',
  EDITORIAL = 'EDITORIAL',
  FREQUENTLY_BOUGHT_TOGETHER = 'FREQUENTLY_BOUGHT_TOGETHER',
  PREMIUM_ALTERNATIVE = 'PREMIUM_ALTERNATIVE',
  AFFORDABLE_ALTERNATIVE = 'AFFORDABLE_ALTERNATIVE',
  PERSONALIZED = 'PERSONALIZED',
}

@Entity('editorial_recommendations')
export class EditorialRecommendation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  description: string;

  @Column({ name: 'product_ids', type: 'simple-json' })
  productIds: number[];

  @Column({ type: 'varchar', length: 100, nullable: true })
  context: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ name: 'start_date', type: 'datetime', nullable: true })
  startDate: Date;

  @Column({ name: 'end_date', type: 'datetime', nullable: true })
  endDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
