import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('homepage_blocks')
export class HomepageBlock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  key: string; // unique handle: hero, bestsellers, new-arrivals, featured-femme, etc.

  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({ type: 'varchar', length: 50 })
  type: string; // products_carousel, category_grid, banner, bundles, outfits

  @Column({ type: 'simple-json', nullable: true })
  config: Record<string, any>;
  // { productIds?: number[], categorySlugs?: string[], limit?: number, imageUrl?: string, ctaUrl?: string }

  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @Column({ name: 'start_at', type: 'datetime', nullable: true })
  start_at: Date | null;

  @Column({ name: 'end_at', type: 'datetime', nullable: true })
  end_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
