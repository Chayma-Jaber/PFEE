import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';

@Entity('order_status_history')
export class OrderStatusHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id' })
  order_id: number;

  @Column({ name: 'old_status', nullable: true })
  old_status: string;

  @Column({ name: 'new_status' })
  new_status: string;

  @Column({ nullable: true })
  reason: string;

  @Column({ name: 'changed_by', nullable: true })
  changed_by: string;

  @CreateDateColumn()
  timestamp: Date;

  @ManyToOne(() => Order, (order) => order.status_history, {
    onDelete: 'NO ACTION',
  })
  @JoinColumn({ name: 'order_id' })
  order: Order;
}
