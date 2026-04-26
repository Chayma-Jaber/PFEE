import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

// 1. Customer tags
@Entity('customer_tags')
export class CustomerTag {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column({ name: 'user_id' }) user_id: number;
  @Column({ type: 'varchar', length: 50 }) tag: string; // VIP, WHOLESALE, DIFFICULT, INFLUENCER...
  @Column({ type: 'varchar', length: 30, nullable: true }) color: string;
  @Column({ name: 'added_by', type: 'int', nullable: true }) added_by: number;
  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
}

// 1bis. Customer notes
@Entity('customer_notes')
export class CustomerNote {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column({ name: 'user_id' }) user_id: number;
  @Column({ type: 'nvarchar', length: 'MAX' }) note: string;
  @Column({ name: 'admin_id', type: 'int', nullable: true }) admin_id: number;
  @Column({ name: 'admin_name', type: 'varchar', length: 150, nullable: true }) admin_name: string;
  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
}

// 2. Order internal comments
@Entity('order_comments')
export class OrderComment {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column({ name: 'order_id' }) order_id: number;
  @Column({ type: 'nvarchar', length: 'MAX' }) body: string;
  @Column({ name: 'admin_id', type: 'int' }) admin_id: number;
  @Column({ name: 'admin_name', type: 'varchar', length: 150, nullable: true }) admin_name: string;
  @Column({ name: 'is_pinned', default: false }) is_pinned: boolean;
  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
}

// 4. Admin task board
@Entity('admin_tasks')
export class AdminTask {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'varchar', length: 200 }) title: string;
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true }) description: string;
  @Column({ type: 'varchar', length: 20, default: 'TODO' }) status: string; // TODO, IN_PROGRESS, BLOCKED, DONE
  @Column({ type: 'varchar', length: 20, default: 'MEDIUM' }) priority: string; // LOW, MEDIUM, HIGH, URGENT
  @Column({ type: 'varchar', length: 50, nullable: true }) category: string; // dispute, restock, follow-up, general
  @Column({ name: 'assigned_to', type: 'int', nullable: true }) assigned_to: number;
  @Column({ name: 'due_date', type: 'datetime', nullable: true }) due_date: Date | null;
  @Column({ name: 'related_order_id', type: 'int', nullable: true }) related_order_id: number;
  @Column({ name: 'related_user_id', type: 'int', nullable: true }) related_user_id: number;
  @Column({ name: 'created_by', type: 'int', nullable: true }) created_by: number;
  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updated_at: Date;
  @Column({ name: 'done_at', type: 'datetime', nullable: true }) done_at: Date | null;
}

// 7. Delivery slots (master list)
@Entity('delivery_slots')
export class DeliverySlot {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'varchar', length: 20 }) label: string; // MORNING, AFTERNOON, EVENING
  @Column({ type: 'varchar', length: 10 }) start_time: string; // "09:00"
  @Column({ type: 'varchar', length: 10 }) end_time: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) city: string; // null = all cities
  @Column({ name: 'capacity', type: 'int', default: 50 }) capacity: number;
  @Column({ name: 'is_active', default: true }) is_active: boolean;
}

// 8. Store pickup locations
@Entity('pickup_locations')
export class PickupLocation {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'varchar', length: 150 }) name: string;
  @Column({ type: 'nvarchar', length: 'MAX' }) address: string;
  @Column({ type: 'varchar', length: 100 }) city: string;
  @Column({ type: 'varchar', length: 30, nullable: true }) phone: string;
  @Column({ type: 'varchar', length: 200, nullable: true }) hours: string; // "Mon-Sat 9h-19h"
  @Column({ name: 'is_active', default: true }) is_active: boolean;
  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true }) latitude: number;
  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true }) longitude: number;
}

// 9. Churn score cache
@Entity('customer_signals')
export class CustomerSignal {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column({ name: 'user_id', unique: true }) user_id: number;
  @Column({ name: 'churn_score', type: 'int', default: 0 }) churn_score: number; // 0-100
  @Column({ name: 'clv', type: 'decimal', precision: 10, scale: 2, default: 0 }) clv: number; // lifetime value
  @Column({ name: 'days_since_last_order', type: 'int', nullable: true }) days_since_last_order: number;
  @Column({ name: 'computed_at', type: 'datetime', nullable: true }) computed_at: Date;
}

// 13. Deal of the day
@Entity('daily_deals')
export class DailyDeal {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'product_id' }) product_id: number;
  @Column({ name: 'special_price', type: 'decimal', precision: 10, scale: 3 }) special_price: number;
  @Column({ name: 'start_at', type: 'datetime' }) start_at: Date;
  @Column({ name: 'end_at', type: 'datetime' }) end_at: Date;
  @Column({ name: 'is_active', default: true }) is_active: boolean;
  @Column({ type: 'varchar', length: 200, nullable: true }) headline: string;
  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
}

// 14. Referral attributions
@Entity('referral_shares')
export class ReferralShare {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'referrer_id' }) referrer_id: number;
  @Column({ name: 'product_id', type: 'int', nullable: true }) product_id: number;
  @Column({ name: 'share_code', type: 'varchar', length: 20, unique: true }) share_code: string;
  @Column({ name: 'clicks', type: 'int', default: 0 }) clicks: number;
  @Column({ name: 'conversions', type: 'int', default: 0 }) conversions: number;
  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
}

// 15. UGC
@Entity('ugc_posts')
export class UgcPost {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'user_id' }) user_id: number;
  @Column({ name: 'product_id', type: 'int', nullable: true }) product_id: number;
  @Column({ name: 'image_url', type: 'varchar', length: 500 }) image_url: string;
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true }) caption: string;
  @Column({ type: 'varchar', length: 20, default: 'PENDING' }) status: string; // PENDING, APPROVED, REJECTED
  @Column({ name: 'likes_count', type: 'int', default: 0 }) likes_count: number;
  @CreateDateColumn({ name: 'created_at' }) created_at: Date;
  @Column({ name: 'moderated_at', type: 'datetime', nullable: true }) moderated_at: Date;
}

// 20. Audit trail diff
@Entity('audit_diffs')
export class AuditDiff {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column({ type: 'varchar', length: 50 }) resource: string; // order, product, customer
  @Index() @Column({ name: 'resource_id', type: 'varchar', length: 50 }) resource_id: string;
  @Column({ type: 'varchar', length: 30 }) action: string; // CREATE, UPDATE, DELETE
  @Column({ name: 'before_state', type: 'simple-json', nullable: true }) before_state: any;
  @Column({ name: 'after_state', type: 'simple-json', nullable: true }) after_state: any;
  @Column({ name: 'admin_id', type: 'int', nullable: true }) admin_id: number;
  @Column({ name: 'admin_name', type: 'varchar', length: 150, nullable: true }) admin_name: string;
  @CreateDateColumn({ name: 'timestamp' }) timestamp: Date;
}
