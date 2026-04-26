import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('newsletter_campaigns')
export class NewsletterCampaign {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'nvarchar', length: 'MAX' })
  body: string;

  @Column({ name: 'cta_label', type: 'varchar', length: 100, nullable: true })
  cta_label: string;

  @Column({ name: 'cta_url', type: 'varchar', length: 500, nullable: true })
  cta_url: string;

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status: string; // DRAFT, SENT

  @Column({ name: 'sent_count', type: 'int', default: 0 })
  sent_count: number;

  @Column({ name: 'sent_at', type: 'datetime', nullable: true })
  sent_at: Date | null;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  admin_id: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
