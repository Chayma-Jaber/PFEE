import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('stock_alerts')
export class StockAlert {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', nullable: true })
  user_id: number;

  @Column({ name: 'product_id' })
  product_id: number;

  @Column()
  email: string;

  @Column({ nullable: true })
  size: string;

  @Column({ nullable: true })
  color: string;

  @Column({ name: 'product_name', nullable: true })
  product_name: string;

  @Column({ name: 'product_image', nullable: true })
  product_image: string;

  @Column({ name: 'product_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  product_price: number;

  @Column({ name: 'is_notified', default: false })
  is_notified: boolean;

  @Column({ name: 'notified_at', type: 'datetime', nullable: true })
  notified_at: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  // Relations
  @ManyToOne('User', { onDelete: 'NO ACTION', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: any;
}
