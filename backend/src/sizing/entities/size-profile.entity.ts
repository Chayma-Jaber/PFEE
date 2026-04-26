import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Per-user measurements + fit prefs. One row per user; updated when user fills the sizing wizard.
@Entity('size_profiles')
export class SizeProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  // All measurements in cm. Nullable — user may only fill some.
  @Column({ type: 'float', nullable: true }) height: number | null;
  @Column({ type: 'float', nullable: true }) weight: number | null;
  @Column({ type: 'float', nullable: true }) chest: number | null;
  @Column({ type: 'float', nullable: true }) waist: number | null;
  @Column({ type: 'float', nullable: true }) hips: number | null;
  @Column({ name: 'shoulder_width', type: 'float', nullable: true }) shoulder_width: number | null;
  @Column({ name: 'inseam', type: 'float', nullable: true }) inseam: number | null;
  @Column({ name: 'shoe_size_eu', type: 'float', nullable: true }) shoe_size_eu: number | null;

  // Fit preference: TIGHT | REGULAR | LOOSE
  @Column({ name: 'fit_preference', type: 'varchar', length: 20, default: 'REGULAR' })
  fit_preference: string;

  // Usual size label (auto-inferred from measurements, user can override): XS/S/M/L/XL/XXL, or numeric
  @Column({ name: 'usual_size_top', type: 'varchar', length: 10, nullable: true }) usual_size_top: string | null;
  @Column({ name: 'usual_size_bottom', type: 'varchar', length: 10, nullable: true }) usual_size_bottom: string | null;

  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updated_at: Date;
}
