import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum NotificationType {
  ORDER = 'ORDER',
  PRODUCT = 'PRODUCT',
  PROMOTION = 'PROMOTION',
  SYSTEM = 'SYSTEM',
  SUPPORT = 'SUPPORT',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  user_id: number;

  @Column({ type: 'varchar' })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: 'nvarchar', length: 'MAX' })
  message: string;

  @Column({ type: 'simple-json', nullable: true })
  data: Record<string, any>;

  @Column({ name: 'is_read', default: false })
  is_read: boolean;

  @Column({ name: 'action_url', nullable: true })
  action_url: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  // Relations
  @ManyToOne('User', { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'user_id' })
  user: any;
}
