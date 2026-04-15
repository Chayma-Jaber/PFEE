import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('admin_logs')
export class AdminLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id' })
  admin_id: number;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ name: 'resource_type', type: 'varchar', length: 100 })
  resource_type: string;

  @Column({ name: 'resource_id', type: 'varchar', length: 100, nullable: true })
  resource_id: string;

  @Column({ name: 'old_values', type: 'simple-json', nullable: true })
  old_values: Record<string, any> | null;

  @Column({ name: 'new_values', type: 'simple-json', nullable: true })
  new_values: Record<string, any> | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ip_address: string;

  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  user_agent: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'admin_id' })
  admin: User;
}
