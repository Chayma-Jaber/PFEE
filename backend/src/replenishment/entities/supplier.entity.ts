import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('suppliers')
export class Supplier {
  @PrimaryGeneratedColumn() id: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  code: string;

  @Column({ type: 'nvarchar', length: 200 })
  name: string;

  @Column({ name: 'contact_email', type: 'varchar', length: 255, nullable: true })
  contact_email: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', length: 30, nullable: true })
  contact_phone: string | null;

  @Column({ type: 'nvarchar', length: 400, nullable: true })
  address: string | null;

  // Average lead time (days) for orders from this supplier
  @Column({ name: 'lead_time_days', type: 'int', default: 14 })
  lead_time_days: number;

  // MOQ (minimum order qty) defaults applied when generating PO drafts
  @Column({ name: 'min_order_qty', type: 'int', default: 1 })
  min_order_qty: number;

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
