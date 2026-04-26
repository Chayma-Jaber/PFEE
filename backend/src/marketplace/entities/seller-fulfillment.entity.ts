import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum SellerFulfillmentStatus {
  PENDING = 'PENDING',
  PREPARING = 'PREPARING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

// Per-order-item fulfillment state owned by the seller. We keep this on a
// dedicated table (rather than mutating order_items) because:
//   - sellers are not the merchant, so they shouldn't write to merchant tables;
//   - a single order can have items from multiple sellers, each progressing
//     independently (one seller's items can ship before another's).
@Entity('seller_fulfillments')
export class SellerFulfillment {
  @PrimaryGeneratedColumn() id: number;

  @Index('IDX_seller_fulfillments_order_item', { unique: true })
  @Column({ name: 'order_item_id', type: 'int' })
  order_item_id: number;

  @Index()
  @Column({ name: 'order_id', type: 'int' })
  order_id: number;

  @Index()
  @Column({ name: 'seller_id', type: 'int' })
  seller_id: number;

  @Index()
  @Column({ type: 'varchar', length: 20, default: SellerFulfillmentStatus.PENDING })
  status: SellerFulfillmentStatus;

  // Tracking — only populated once the seller marks the line shipped.
  @Column({ name: 'tracking_number', type: 'varchar', length: 80, nullable: true })
  tracking_number: string | null;

  @Column({ name: 'carrier', type: 'varchar', length: 60, nullable: true })
  carrier: string | null;

  @Column({ name: 'tracking_url', type: 'varchar', length: 500, nullable: true })
  tracking_url: string | null;

  @Column({ type: 'nvarchar', length: 500, nullable: true })
  notes: string | null;

  @Column({ name: 'shipped_at', type: 'datetime', nullable: true })
  shipped_at: Date | null;

  @Column({ name: 'delivered_at', type: 'datetime', nullable: true })
  delivered_at: Date | null;

  @Column({ name: 'cancelled_at', type: 'datetime', nullable: true })
  cancelled_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
