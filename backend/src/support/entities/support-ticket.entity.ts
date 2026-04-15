import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

export enum TicketCategory {
  ORDER = 'ORDER',
  PRODUCT = 'PRODUCT',
  PAYMENT = 'PAYMENT',
  SHIPPING = 'SHIPPING',
  RETURN = 'RETURN',
  ACCOUNT = 'ACCOUNT',
  TECHNICAL = 'TECHNICAL',
  OTHER = 'OTHER',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_CUSTOMER = 'WAITING_CUSTOMER',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

@Entity('support_tickets')
export class SupportTicket {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  user_id: number;

  @Column()
  subject: string;

  @Column({ type: 'nvarchar', length: 'MAX' })
  description: string;

  @Column({ type: 'varchar', default: TicketCategory.OTHER })
  category: TicketCategory;

  @Column({ type: 'varchar', default: TicketPriority.MEDIUM })
  priority: TicketPriority;

  @Column({ type: 'varchar', default: TicketStatus.OPEN })
  status: TicketStatus;

  @Column({ nullable: true })
  assigned_to: number;

  @Column({ name: 'contact_email', nullable: true })
  contact_email: string;

  @Column({ name: 'contact_phone', nullable: true })
  contact_phone: string;

  @Column({ name: 'contact_name', nullable: true })
  contact_name: string;

  @Column({ name: 'order_id', nullable: true })
  order_id: number;

  @Column({ name: 'product_id', nullable: true })
  product_id: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
  resolved_at: Date;

  @Column({ name: 'closed_at', type: 'datetime', nullable: true })
  closed_at: Date;

  // Relations
  @ManyToOne('User', { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'user_id' })
  user: any;

  @OneToMany('TicketMessage', 'ticket', { cascade: true })
  messages: any[];
}
