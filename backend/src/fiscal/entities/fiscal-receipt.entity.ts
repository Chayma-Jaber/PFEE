import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum FiscalReceiptStatus {
  PENDING = 'PENDING',     // not yet stamped by fiscal authority
  SUBMITTED = 'SUBMITTED', // sent to TTN, awaiting confirmation
  STAMPED = 'STAMPED',     // received fiscal id from TTN
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

// Tunisia: every commercial transaction must be backed by a fiscal receipt with a
// matricule fiscale and a unique stamp from TTN (Tunisie Trade Net) once the
// dematerialized invoice ("facture électronique") regime applies.
@Entity('fiscal_receipts')
export class FiscalReceipt {
  @PrimaryGeneratedColumn() id: number;

  @Index({ unique: true })
  @Column({ name: 'fiscal_number', type: 'varchar', length: 30 })
  fiscal_number: string;

  @Index()
  @Column({ name: 'order_id', type: 'int' })
  order_id: number;

  @Column({ name: 'order_reference', type: 'varchar', length: 60, nullable: true })
  order_reference: string | null;

  // Date of the fiscal event (= order finalization date in TZ Africa/Tunis)
  @Column({ name: 'fiscal_date', type: 'datetime' })
  fiscal_date: Date;

  // Issuer fiscal info (the merchant)
  @Column({ name: 'issuer_matricule', type: 'varchar', length: 40 })
  issuer_matricule: string;

  // Customer fiscal id (optional for B2C, mandatory for B2B)
  @Column({ name: 'customer_matricule', type: 'varchar', length: 40, nullable: true })
  customer_matricule: string | null;

  @Column({ name: 'customer_name', type: 'nvarchar', length: 200 })
  customer_name: string;

  @Column({ name: 'total_excl_tax', type: 'decimal', precision: 12, scale: 3 })
  total_excl_tax: number;

  @Column({ name: 'total_tax', type: 'decimal', precision: 12, scale: 3 })
  total_tax: number;

  @Column({ name: 'total_incl_tax', type: 'decimal', precision: 12, scale: 3 })
  total_incl_tax: number;

  // TTN stamp returned after submission
  @Column({ name: 'ttn_stamp', type: 'varchar', length: 80, nullable: true })
  ttn_stamp: string | null;

  @Column({ name: 'ttn_reference', type: 'varchar', length: 80, nullable: true })
  ttn_reference: string | null;

  @Index()
  @Column({ type: 'varchar', length: 20, default: FiscalReceiptStatus.PENDING })
  status: FiscalReceiptStatus;

  @Column({ name: 'submission_payload', type: 'simple-json', nullable: true })
  submission_payload: any;

  @Column({ name: 'last_error', type: 'nvarchar', length: 500, nullable: true })
  last_error: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
