import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Bundle } from './bundle.entity';

@Entity('bundle_items')
export class BundleItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'bundle_id' })
  bundle_id: number;

  @Column({ name: 'product_id' })
  product_id: number;

  @Column({ default: 1 })
  quantity: number;

  @Column({ type: 'int', default: 0 })
  position: number;

  @ManyToOne(() => Bundle, (bundle) => bundle.items, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'bundle_id' })
  bundle: Bundle;
}
