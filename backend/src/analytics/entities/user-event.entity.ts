import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum EventType {
  PRODUCT_VIEW = 'PRODUCT_VIEW',
  SEARCH_QUERY = 'SEARCH_QUERY',
  ADD_TO_CART = 'ADD_TO_CART',
  REMOVE_FROM_CART = 'REMOVE_FROM_CART',
  WISHLIST_ADD = 'WISHLIST_ADD',
  WISHLIST_REMOVE = 'WISHLIST_REMOVE',
  PURCHASE_COMPLETE = 'PURCHASE_COMPLETE',
  CHECKOUT_START = 'CHECKOUT_START',
  ASSISTANT_MESSAGE = 'ASSISTANT_MESSAGE',
  VISUAL_SEARCH_UPLOAD = 'VISUAL_SEARCH_UPLOAD',
  PAGE_VIEW = 'PAGE_VIEW',
  CLICK = 'CLICK',
}

@Entity('user_events')
@Index('IDX_user_events_user_id', ['user_id'])
@Index('IDX_user_events_session_id', ['session_id'])
@Index('IDX_user_events_event_type', ['event_type'])
@Index('IDX_user_events_timestamp', ['timestamp'])
export class UserEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', nullable: true })
  user_id: number | null;

  @Column({ name: 'session_id', type: 'varchar', length: 255 })
  session_id: string;

  @Column({
    name: 'event_type',
    type: 'varchar',
    length: 50,
  })
  event_type: string;

  @Column({ name: 'product_id', nullable: true })
  product_id: number | null;

  @Column({ name: 'category_id', nullable: true })
  category_id: number | null;

  @Column({ name: 'search_query', type: 'varchar', length: 500, nullable: true })
  search_query: string | null;

  @Column({ name: 'recommendation_type', type: 'varchar', length: 50, nullable: true })
  recommendation_type: string | null;

  @Column({ name: 'recommendation_position', type: 'int', nullable: true })
  recommendation_position: number | null;

  @Column({ name: 'recommendation_source', type: 'varchar', length: 100, nullable: true })
  recommendation_source: string | null;

  @Column({ name: 'event_data', type: 'simple-json', nullable: true })
  event_data: Record<string, any> | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ip_address: string;

  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  user_agent: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
