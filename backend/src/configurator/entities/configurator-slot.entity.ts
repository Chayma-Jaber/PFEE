import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// One slot in a configurator. Slots are ordered and can be required or optional.
// Each slot has a pool of allowed product IDs (or a category/famille filter).
@Entity('configurator_slots')
export class ConfiguratorSlot {
  @PrimaryGeneratedColumn() id: number;

  @Index()
  @Column({ name: 'configurator_id', type: 'int' })
  configurator_id: number;

  @Column({ type: 'nvarchar', length: 120 })
  name: string;

  @Column({ type: 'int' })
  position: number;

  @Column({ name: 'required', default: true })
  required: boolean;

  @Column({ name: 'max_items', type: 'int', default: 1 })
  max_items: number;

  // Pool: array of product IDs allowed in this slot (empty = fall back to filter)
  @Column({ name: 'allowed_product_ids', type: 'simple-json', nullable: true })
  allowed_product_ids: number[] | null;

  // If allowed_product_ids is empty, pool comes from these filters
  @Column({ name: 'filter_category_id', type: 'int', nullable: true })
  filter_category_id: number | null;

  @Column({ name: 'filter_famille', type: 'varchar', length: 80, nullable: true })
  filter_famille: string | null;

  @Column({ name: 'filter_tag', type: 'varchar', length: 80, nullable: true })
  filter_tag: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
