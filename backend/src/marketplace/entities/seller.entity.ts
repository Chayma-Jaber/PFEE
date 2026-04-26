import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum SellerStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  SUSPENDED = 'SUSPENDED',
  REJECTED = 'REJECTED',
}

@Entity('sellers')
export class Seller {
  @PrimaryGeneratedColumn()
  id: number;

  // The Barsha user account that owns this seller profile (admin user with role=SELLER)
  @Index({ unique: true })
  @Column({ name: 'owner_user_id', type: 'int' })
  owner_user_id: number;

  @Index({ unique: true })
  @Column({ name: 'slug', type: 'varchar', length: 80 })
  slug: string;

  @Column({ name: 'business_name', type: 'nvarchar', length: 200 })
  business_name: string;

  @Column({ name: 'legal_name', type: 'nvarchar', length: 200, nullable: true })
  legal_name: string | null;

  @Column({ name: 'vat_number', type: 'varchar', length: 40, nullable: true })
  vat_number: string | null;

  @Column({ type: 'nvarchar', length: 500, nullable: true })
  description: string | null;

  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logo_url: string | null;

  @Column({ name: 'contact_email', type: 'varchar', length: 255 })
  contact_email: string;

  @Column({ name: 'contact_phone', type: 'varchar', length: 30, nullable: true })
  contact_phone: string | null;

  // Default commission rate (percentage) taken by the marketplace. Overridable per product.
  @Column({ name: 'commission_pct', type: 'decimal', precision: 5, scale: 2, default: 15 })
  commission_pct: number;

  // Bank details for payout — stored encrypted-at-rest in prod; here simple string.
  @Column({ name: 'payout_iban', type: 'varchar', length: 80, nullable: true })
  payout_iban: string | null;

  @Column({ name: 'payout_bank_name', type: 'nvarchar', length: 120, nullable: true })
  payout_bank_name: string | null;

  @Index()
  @Column({ type: 'varchar', length: 20, default: SellerStatus.PENDING })
  status: SellerStatus;

  @Column({ name: 'approved_at', type: 'datetime', nullable: true })
  approved_at: Date | null;

  @Column({ name: 'approved_by', type: 'int', nullable: true })
  approved_by: number | null;

  @Column({ name: 'rejection_reason', type: 'nvarchar', length: 500, nullable: true })
  rejection_reason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
