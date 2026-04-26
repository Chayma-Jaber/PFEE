import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('style_profiles')
@Unique(['user_id'])
export class StyleProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  user_id: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  style: string; // casual, chic, sport, boho, street, classic

  @Column({ name: 'size_top', type: 'varchar', length: 10, nullable: true })
  size_top: string; // XS, S, M, L, XL, XXL

  @Column({ name: 'size_bottom', type: 'varchar', length: 10, nullable: true })
  size_bottom: string;

  @Column({ name: 'shoe_size', type: 'varchar', length: 10, nullable: true })
  shoe_size: string;

  @Column({ type: 'simple-json', nullable: true })
  preferred_colors: string[];

  @Column({ type: 'simple-json', nullable: true })
  preferred_categories: string[]; // category slugs

  @Column({ name: 'budget_range', type: 'varchar', length: 20, nullable: true })
  budget_range: string; // economy, mid, premium, luxury

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
