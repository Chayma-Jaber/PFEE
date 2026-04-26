import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum GdprRequestType { EXPORT = 'EXPORT', ERASURE = 'ERASURE', RECTIFICATION = 'RECTIFICATION' }
export enum GdprRequestStatus {
  RECEIVED = 'RECEIVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

@Entity('gdpr_requests')
export class GdprRequest {
  @PrimaryGeneratedColumn() id: number;

  @Index()
  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  type: GdprRequestType;

  @Index()
  @Column({ type: 'varchar', length: 20, default: GdprRequestStatus.RECEIVED })
  status: GdprRequestStatus;

  @Column({ name: 'verification_token', type: 'varchar', length: 80, nullable: true })
  verification_token: string | null;

  @Column({ name: 'verified_at', type: 'datetime', nullable: true })
  verified_at: Date | null;

  // For export requests: the URL where the JSON zip is reachable for 7 days.
  @Column({ name: 'export_payload', type: 'simple-json', nullable: true })
  export_payload: any;

  @Column({ name: 'erasure_summary', type: 'simple-json', nullable: true })
  erasure_summary: any;

  @Column({ name: 'reason_text', type: 'nvarchar', length: 500, nullable: true })
  reason_text: string | null;

  @Column({ name: 'admin_note', type: 'nvarchar', length: 1000, nullable: true })
  admin_note: string | null;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completed_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
