import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum ReservationStatus {
  PENDING = 'PENDING',    // reserved, not yet paid deposit
  DEPOSITED = 'DEPOSITED', // deposit captured
  FULFILLED = 'FULFILLED', // converted to full order
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  WAITLIST = 'WAITLIST',   // beyond capacity, no deposit yet
}

@Entity('preorder_reservations')
export class PreorderReservation {
  @PrimaryGeneratedColumn() id: number;

  @Index()
  @Column({ name: 'drop_id', type: 'int' })
  drop_id: number;

  @Index()
  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ name: 'deposit_amount', type: 'decimal', precision: 10, scale: 3, default: 0 })
  deposit_amount: number;

  @Column({ name: 'balance_amount', type: 'decimal', precision: 10, scale: 3, default: 0 })
  balance_amount: number;

  @Index()
  @Column({ type: 'varchar', length: 20, default: ReservationStatus.PENDING })
  status: ReservationStatus;

  @Column({ name: 'deposit_paid_at', type: 'datetime', nullable: true })
  deposit_paid_at: Date | null;

  @Column({ name: 'fulfilled_at', type: 'datetime', nullable: true })
  fulfilled_at: Date | null;

  @Column({ name: 'converted_order_id', type: 'int', nullable: true })
  converted_order_id: number | null;

  // For waitlist: position at time of joining. 1-indexed, null when not on waitlist.
  @Column({ name: 'waitlist_position', type: 'int', nullable: true })
  waitlist_position: number | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
