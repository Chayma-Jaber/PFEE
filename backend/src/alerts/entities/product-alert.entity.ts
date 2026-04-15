import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum AlertType {
  PRICE_DROP = 'price_drop',
  BACK_IN_STOCK = 'back_in_stock',
}

@Entity('product_alerts')
export class ProductAlert {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', nullable: true })
  user_id: number;

  @Column({ name: 'product_id' })
  product_id: number;

  @Column({ name: 'alert_type', type: 'varchar' })
  alert_type: AlertType;

  @Column()
  email: string;

  @Column({ name: 'target_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  target_price: number;

  @Column({ name: 'current_price', type: 'decimal', precision: 10, scale: 2 })
  current_price: number;

  @Column({ name: 'is_triggered', default: false })
  is_triggered: boolean;

  @Column({ name: 'triggered_at', type: 'datetime', nullable: true })
  triggered_at: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  // Relations
  @ManyToOne('User', { onDelete: 'NO ACTION', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: any;
}
