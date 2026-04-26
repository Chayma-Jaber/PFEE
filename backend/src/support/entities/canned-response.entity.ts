import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('canned_responses')
export class CannedResponse {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({ type: 'nvarchar', length: 'MAX' })
  body: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category: string;

  @Column({ name: 'usage_count', type: 'int', default: 0 })
  usage_count: number;

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
