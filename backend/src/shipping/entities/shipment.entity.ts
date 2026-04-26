import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ShipmentStatus {
  PREPARING = 'PREPARING',          // Préparation chez Barsha
  DEPOT_BARSHA = 'DEPOT_BARSHA',    // Dépôt Barsha
  HANDED_OVER = 'HANDED_OVER',      // Remis au transporteur
  IN_TRANSIT = 'IN_TRANSIT',        // En transit
  DEPOT_DELIVERY = 'DEPOT_DELIVERY',// Dépôt livraison
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY', // En cours de livraison
  DELIVERED = 'DELIVERED',          // Livré
  FAILED = 'FAILED',                // Échec
  RETURNED = 'RETURNED',            // Retour reçu
  CANCELLED = 'CANCELLED',
}

@Entity('shipments')
export class Shipment {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'order_id' })
  order_id: number;

  @Column({ type: 'varchar', length: 30 })
  provider: string; // FIRST_DELIVERY, ARAMEX, INTERNAL, etc.

  @Index()
  @Column({ name: 'tracking_number', type: 'varchar', length: 100, unique: true })
  tracking_number: string;

  @Column({ type: 'varchar', length: 30, default: ShipmentStatus.PREPARING })
  status: ShipmentStatus;

  @Column({ type: 'simple-json', nullable: true })
  events: Array<{ status: string; label: string; at: string; location?: string; note?: string }>;

  @Column({ name: 'recipient_name', type: 'varchar', length: 150 })
  recipient_name: string;

  @Column({ name: 'recipient_phone', type: 'varchar', length: 30, nullable: true })
  recipient_phone: string;

  @Column({ name: 'recipient_city', type: 'varchar', length: 100, nullable: true })
  recipient_city: string;

  @Column({ name: 'recipient_address', type: 'nvarchar', length: 'MAX', nullable: true })
  recipient_address: string;

  @Column({ name: 'shipping_cost', type: 'decimal', precision: 10, scale: 2, default: 0 })
  shipping_cost: number;

  @Column({ name: 'estimated_delivery_at', type: 'datetime', nullable: true })
  estimated_delivery_at: Date | null;

  @Column({ name: 'delivered_at', type: 'datetime', nullable: true })
  delivered_at: Date | null;

  @Column({ name: 'provider_payload', type: 'simple-json', nullable: true })
  provider_payload: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
