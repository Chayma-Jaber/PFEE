import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// A gift-box / outfit-builder template. Defines the slot structure and pricing rules.
@Entity('configurators')
export class Configurator {
  @PrimaryGeneratedColumn() id: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  slug: string;

  @Column({ type: 'nvarchar', length: 200 })
  title: string;

  @Column({ type: 'nvarchar', length: 800, nullable: true })
  description: string | null;

  @Column({ name: 'cover_image', type: 'varchar', length: 500, nullable: true })
  cover_image: string | null;

  // Bundle discount applied when the customer fills all required slots.
  @Column({ name: 'bundle_discount_pct', type: 'int', default: 10 })
  bundle_discount_pct: number;

  // Theme tag for UI grouping (GIFT_BOX, OUTFIT, STARTER_KIT, ...)
  @Column({ type: 'varchar', length: 30, default: 'GIFT_BOX' })
  kind: string;

  @Index()
  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
