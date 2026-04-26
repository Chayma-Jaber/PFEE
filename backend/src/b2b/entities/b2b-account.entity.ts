import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum B2BStatus { PENDING = 'PENDING', APPROVED = 'APPROVED', SUSPENDED = 'SUSPENDED', REJECTED = 'REJECTED' }
export enum B2BTier { BRONZE = 'BRONZE', SILVER = 'SILVER', GOLD = 'GOLD', PLATINUM = 'PLATINUM' }
export enum B2BPaymentTerms { PREPAID = 'PREPAID', NET_15 = 'NET_15', NET_30 = 'NET_30', NET_60 = 'NET_60' }

@Entity('b2b_accounts')
export class B2BAccount {
  @PrimaryGeneratedColumn() id: number;

  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @Column({ name: 'company_name', type: 'nvarchar', length: 200 })
  company_name: string;

  @Column({ name: 'vat_number', type: 'varchar', length: 40, nullable: true })
  vat_number: string | null;

  @Column({ name: 'registry_number', type: 'varchar', length: 40, nullable: true })
  registry_number: string | null;

  @Column({ name: 'contact_name', type: 'nvarchar', length: 150, nullable: true })
  contact_name: string | null;

  @Column({ name: 'contact_email', type: 'varchar', length: 255 })
  contact_email: string;

  @Column({ name: 'contact_phone', type: 'varchar', length: 30, nullable: true })
  contact_phone: string | null;

  @Column({ type: 'nvarchar', length: 400, nullable: true })
  address: string | null;

  @Column({ type: 'nvarchar', length: 100, nullable: true })
  city: string | null;

  // Tier drives default discount: BRONZE=5%, SILVER=10%, GOLD=15%, PLATINUM=20%
  @Index()
  @Column({ type: 'varchar', length: 20, default: B2BTier.BRONZE })
  tier: B2BTier;

  @Column({ name: 'custom_discount_pct', type: 'int', nullable: true })
  custom_discount_pct: number | null;

  @Column({ name: 'credit_limit', type: 'decimal', precision: 12, scale: 3, default: 0 })
  credit_limit: number;

  @Column({ name: 'credit_used', type: 'decimal', precision: 12, scale: 3, default: 0 })
  credit_used: number;

  @Index()
  @Column({ type: 'varchar', length: 20, default: B2BStatus.PENDING })
  status: B2BStatus;

  @Index()
  @Column({ name: 'payment_terms', type: 'varchar', length: 20, default: B2BPaymentTerms.PREPAID })
  payment_terms: B2BPaymentTerms;

  @Column({ name: 'tax_exempt', default: false })
  tax_exempt: boolean;

  @Column({ name: 'approved_at', type: 'datetime', nullable: true })
  approved_at: Date | null;

  @Column({ name: 'approved_by', type: 'int', nullable: true })
  approved_by: number | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
