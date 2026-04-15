import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  CATALOG_MANAGER = 'CATALOG_MANAGER',
  ORDER_MANAGER = 'ORDER_MANAGER',
  MARKETING_MANAGER = 'MARKETING_MANAGER',
  SUPPORT_AGENT = 'SUPPORT_AGENT',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ name: 'password_hash' })
  password_hash: string;

  @Column({ name: 'first_name', nullable: true })
  first_name: string;

  @Column({ name: 'last_name', nullable: true })
  last_name: string;

  @Column({ nullable: true })
  gender: string;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birth_date: string;

  @Column({
    type: 'varchar',
    enum: UserRole,
    default: UserRole.CUSTOMER,
  })
  role: UserRole;

  @Column({ name: 'avatar_url', nullable: true })
  avatar_url: string;

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @Column({ name: 'is_verified', default: false })
  is_verified: boolean;

  @Column({ name: 'last_login', type: 'datetime', nullable: true })
  last_login: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  // Relations - use lazy strings to avoid circular imports
  @OneToMany('Address', 'user')
  addresses: any[];

  @OneToMany('Order', 'user')
  orders: any[];

  @OneToMany('WishlistItem', 'user')
  wishlist_items: any[];

  @OneToMany('CartItem', 'user')
  cart_items: any[];
}
