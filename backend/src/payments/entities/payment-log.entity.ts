import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Payment } from './payment.entity';

@Entity('payment_logs')
export class PaymentLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'payment_id' })
  payment_id: number;

  @Column({ name: 'event_type' })
  event_type: string;

  @Column({ name: 'status_before', nullable: true })
  status_before: string;

  @Column({ name: 'status_after', nullable: true })
  status_after: string;

  @Column({ name: 'response_code', nullable: true })
  response_code: string;

  @Column({ name: 'response_message', nullable: true })
  response_message: string;

  @CreateDateColumn()
  timestamp: Date;

  @ManyToOne(() => Payment, (payment) => payment.logs, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;
}
