import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum SenderType {
  CUSTOMER = 'customer',
  AGENT = 'agent',
  SYSTEM = 'system',
}

@Entity('ticket_messages')
export class TicketMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'ticket_id' })
  ticket_id: number;

  @Column({ name: 'sender_id', nullable: true })
  sender_id: number;

  @Column({ name: 'sender_type', type: 'varchar', default: SenderType.CUSTOMER })
  sender_type: SenderType;

  @Column({ type: 'nvarchar', length: 'MAX' })
  message: string;

  @Column({ type: 'simple-json', nullable: true })
  attachments: string[];

  @Column({ name: 'is_internal', default: false })
  is_internal: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  // Relations
  @ManyToOne('SupportTicket', 'messages', { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: any;
}
