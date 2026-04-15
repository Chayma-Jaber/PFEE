import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('product_qa')
export class ProductQA {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'product_id' })
  product_id: number;

  @Column({ name: 'user_id' })
  user_id: number;

  @Column({ type: 'nvarchar', length: 'MAX' })
  question: string;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  answer: string | null;

  @Column({ name: 'answered_by', nullable: true })
  answered_by: number | null;

  @Column({ name: 'is_published', default: true })
  is_published: boolean;

  @Column({ name: 'helpful_count', type: 'int', default: 0 })
  helpful_count: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @Column({ name: 'answered_at', type: 'datetime', nullable: true })
  answered_at: Date | null;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'answered_by' })
  answeredByUser: User;
}
