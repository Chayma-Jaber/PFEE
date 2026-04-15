import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('addresses')
export class Address {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  user_id: number;

  @Column({ nullable: true })
  label: string;

  @Column({ name: 'first_name', nullable: true })
  first_name: string;

  @Column({ name: 'last_name', nullable: true })
  last_name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  street: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ name: 'postal_code', nullable: true })
  postal_code: string;

  @Column({ default: 'TN' })
  country: string;

  @Column({ name: 'is_default', default: false })
  is_default: boolean;

  @Column({ name: 'is_billing', default: false })
  is_billing: boolean;

  @Column({ name: 'is_shipping', default: false })
  is_shipping: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => User, (user) => user.addresses, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
