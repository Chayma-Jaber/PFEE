import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('search_queries')
export class SearchQuery {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  query: string;

  @Column({ name: 'result_count', type: 'int', default: 0 })
  result_count: number;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  user_id: number | null;

  @Column({ name: 'index_name', type: 'varchar', length: 100, nullable: true })
  index_name: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
