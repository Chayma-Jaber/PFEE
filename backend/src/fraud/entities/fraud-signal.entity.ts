import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum FraudStatus {
  CLEAR = 'CLEAR',
  REVIEW = 'REVIEW',
  HELD = 'HELD',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('fraud_signals')
export class FraudSignal {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'order_id', type: 'int' })
  order_id: number;

  @Index()
  @Column({ name: 'user_id', type: 'int', nullable: true })
  user_id: number | null;

  // 0..100 (higher = more suspicious)
  @Column({ type: 'int' })
  score: number;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  status: FraudStatus;

  // Array of triggered rule codes: ['VELOCITY_10_1H', 'GEO_MISMATCH', 'HIGH_VALUE_NEW_USER', ...]
  @Column({ name: 'rules_triggered', type: 'simple-json' })
  rules_triggered: string[];

  @Column({ type: 'simple-json', nullable: true })
  details: Record<string, any> | null;

  @Column({ name: 'reviewed_by', type: 'int', nullable: true })
  reviewed_by: number | null;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewed_at: Date | null;

  @Column({ name: 'review_note', type: 'nvarchar', length: 500, nullable: true })
  review_note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
