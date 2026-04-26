import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

// Size chart per (brand, category, size_label). Admin-maintained; used to compute the best size for a user.
// e.g. ("Zara", "TOP", "M") => chest_min=96, chest_max=100, waist_min=80, ...
@Entity('size_charts')
@Unique('UQ_size_chart', ['brand', 'category', 'size_label'])
export class SizeChart {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 80 })
  brand: string;

  // TOP | BOTTOM | DRESS | SHOES
  @Index()
  @Column({ type: 'varchar', length: 20 })
  category: string;

  @Column({ name: 'size_label', type: 'varchar', length: 10 })
  size_label: string;

  @Column({ name: 'chest_min', type: 'float', nullable: true }) chest_min: number | null;
  @Column({ name: 'chest_max', type: 'float', nullable: true }) chest_max: number | null;
  @Column({ name: 'waist_min', type: 'float', nullable: true }) waist_min: number | null;
  @Column({ name: 'waist_max', type: 'float', nullable: true }) waist_max: number | null;
  @Column({ name: 'hips_min', type: 'float', nullable: true }) hips_min: number | null;
  @Column({ name: 'hips_max', type: 'float', nullable: true }) hips_max: number | null;
  @Column({ name: 'height_min', type: 'float', nullable: true }) height_min: number | null;
  @Column({ name: 'height_max', type: 'float', nullable: true }) height_max: number | null;
  @Column({ name: 'shoe_size_eu', type: 'float', nullable: true }) shoe_size_eu: number | null;

  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
}
