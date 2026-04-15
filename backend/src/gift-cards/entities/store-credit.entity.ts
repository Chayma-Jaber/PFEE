import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('store_credits')
export class StoreCredit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', unique: true })
  user_id: number;

  @ManyToOne('User', { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'user_id' })
  user: any;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balance: number;

  @Column({ type: 'varchar', default: 'TND' })
  currency: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
