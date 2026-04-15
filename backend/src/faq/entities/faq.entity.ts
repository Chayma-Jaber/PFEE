import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('faqs')
export class FAQ {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'category_slug' })
  category_slug: string;

  @Column({ name: 'category_name' })
  category_name: string;

  @Column({ type: 'nvarchar', length: 'MAX' })
  question: string;

  @Column({ type: 'nvarchar', length: 'MAX' })
  answer: string;

  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @Column({ name: 'is_featured', default: false })
  is_featured: boolean;

  @Column({ name: 'helpful_count', type: 'int', default: 0 })
  helpful_count: number;

  @Column({ name: 'not_helpful_count', type: 'int', default: 0 })
  not_helpful_count: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
