import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shipment, ShipmentStatus } from './entities/shipment.entity';
import { Order } from '../orders/entities/order.entity';
import { FirstDeliveryProvider } from './providers/first-delivery.provider';
import { AramexProvider } from './providers/aramex.provider';
import { InternalProvider } from './providers/internal.provider';
import { ShippingProvider } from './providers/shipping-provider.interface';
import { Notification, NotificationType } from '../notifications/entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { SmsService } from '../sms/sms.service';

const STATUS_LABELS: Record<string, string> = {
  PREPARING: 'Préparation chez Barsha',
  DEPOT_BARSHA: 'Dépôt Barsha',
  HANDED_OVER: 'Remis au transporteur',
  IN_TRANSIT: 'En transit',
  DEPOT_DELIVERY: 'Dépôt livraison',
  OUT_FOR_DELIVERY: 'En cours de livraison',
  DELIVERED: 'Livré',
  FAILED: 'Échec de livraison',
  RETURNED: 'Retour reçu',
  CANCELLED: 'Annulé',
};

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);
  private providers: Map<string, ShippingProvider> = new Map();

  constructor(
    @InjectRepository(Shipment) private readonly shipRepo: Repository<Shipment>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Notification) private readonly notifRepo: Repository<Notification>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly sms: SmsService,
    private readonly firstDelivery: FirstDeliveryProvider,
    private readonly aramex: AramexProvider,
    private readonly internal: InternalProvider,
  ) {
    this.providers.set(firstDelivery.key, firstDelivery);
    this.providers.set(aramex.key, aramex);
    this.providers.set(internal.key, internal);
  }

  getProvider(key: string): ShippingProvider {
    const p = this.providers.get((key || '').toUpperCase());
    if (!p) throw new BadRequestException(`Unknown shipping provider: ${key}`);
    return p;
  }

  listProviders() {
    return Array.from(this.providers.values()).map((p) => ({ key: p.key, displayName: p.displayName }));
  }

  async estimateAll(city: string, weightKg = 1) {
    const out: Array<{ provider: string; displayName: string; cost: number }> = [];
    for (const p of this.providers.values()) {
      out.push({ provider: p.key, displayName: p.displayName, cost: await p.estimateCost(city, weightKg) });
    }
    return out;
  }

  async create(orderId: number, providerKey: string, opts?: { weightKg?: number; note?: string }) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    const existing = await this.shipRepo.findOne({ where: { order_id: orderId } });
    if (existing) throw new BadRequestException('Shipment already exists for this order');

    const provider = this.getProvider(providerKey);
    const addr = (order.shipping_address as any) || {};
    const recipient = {
      name: [addr.firstName, addr.lastName].filter(Boolean).join(' ') || order.customer_phone || `Client #${order.user_id}`,
      phone: addr.phone || order.customer_phone,
      city: addr.city,
      address: [addr.street, addr.complement].filter(Boolean).join(', '),
    };

    const result = await provider.createShipment({
      orderId: order.id,
      orderReference: order.reference,
      recipient,
      weightKg: opts?.weightKg,
      note: opts?.note,
      codAmount: order.payment_method === 'cod' ? Number(order.total_amount) : 0,
    });

    const now = new Date();
    const initialEvent = {
      status: ShipmentStatus.PREPARING,
      label: STATUS_LABELS.PREPARING,
      at: now.toISOString(),
      note: 'Commande créée et en préparation',
    };

    const shipment = this.shipRepo.create({
      order_id: order.id,
      provider: provider.key,
      tracking_number: result.trackingNumber,
      status: ShipmentStatus.PREPARING,
      events: [initialEvent],
      recipient_name: recipient.name,
      recipient_phone: recipient.phone || null,
      recipient_city: recipient.city || null,
      recipient_address: recipient.address || null,
      shipping_cost: Number(order.shipping_amount) || 0,
      estimated_delivery_at: result.estimatedDeliveryAt || null,
      provider_payload: result.providerPayload || null,
    });
    return this.shipRepo.save(shipment);
  }

  async get(shipmentId: number) {
    const s = await this.shipRepo.findOne({ where: { id: shipmentId } });
    if (!s) throw new NotFoundException();
    return s;
  }

  async getByOrder(orderId: number) {
    return this.shipRepo.findOne({ where: { order_id: orderId } });
  }

  async getByTracking(trackingNumber: string) {
    const s = await this.shipRepo.findOne({ where: { tracking_number: trackingNumber } });
    if (!s) throw new NotFoundException('Shipment not found');
    return s;
  }

  async list(opts: { page?: number; limit?: number; status?: string; provider?: string } = {}) {
    const page = opts.page || 1;
    const limit = opts.limit || 30;
    const qb = this.shipRepo.createQueryBuilder('s').orderBy('s.created_at', 'DESC');
    if (opts.status) qb.andWhere('s.status = :st', { st: opts.status });
    if (opts.provider) qb.andWhere('s.provider = :p', { p: opts.provider });
    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  /** Push a new status event (admin manual override or provider sync). */
  async pushEvent(shipmentId: number, status: ShipmentStatus, opts?: { note?: string; location?: string }) {
    const s = await this.get(shipmentId);
    const now = new Date();
    const event = {
      status,
      label: STATUS_LABELS[status] || status,
      at: now.toISOString(),
      location: opts?.location,
      note: opts?.note,
    };
    s.events = [...(s.events || []), event];
    s.status = status;
    if (status === ShipmentStatus.DELIVERED) s.delivered_at = now;
    await this.shipRepo.save(s);

    // Notify customer (in-app + SMS on key transitions)
    try {
      const order = await this.orderRepo.findOne({ where: { id: s.order_id } });
      if (order && order.user_id) {
        await this.notifRepo.save(this.notifRepo.create({
          user_id: order.user_id,
          type: NotificationType.ORDER,
          title: `Commande ${order.reference} — ${STATUS_LABELS[status]}`,
          message: opts?.note || `Statut mis à jour: ${STATUS_LABELS[status]}`,
          action_url: `/account/orders/${order.id}`,
          is_read: false,
        }));

        const SMS_TRIGGERS: ShipmentStatus[] = [
          ShipmentStatus.HANDED_OVER,
          ShipmentStatus.OUT_FOR_DELIVERY,
          ShipmentStatus.DELIVERED,
        ];
        if (SMS_TRIGGERS.includes(status)) {
          const user = await this.userRepo.findOne({ where: { id: order.user_id } });
          if (user?.phone) {
            await this.sms.sendShippingUpdate(
              user.phone,
              order.reference,
              s.tracking_number || `#${s.id}`,
              user.id,
            ).catch((e) => this.logger.warn(`SMS shipping update failed: ${e?.message || e}`));
          }
        }
      }
    } catch {}

    return s;
  }

  /** Pull events from provider and reconcile. */
  async syncFromProvider(shipmentId: number) {
    const s = await this.get(shipmentId);
    const provider = this.getProvider(s.provider);
    const providerEvents = await provider.fetchEvents(s.tracking_number);
    if (!providerEvents || providerEvents.length === 0) return s;

    const known = new Set((s.events || []).map((e) => `${e.status}|${e.at}`));
    const merged = [...(s.events || [])];
    let latest = s.status;
    for (const e of providerEvents) {
      const key = `${e.status}|${e.at}`;
      if (!known.has(key)) {
        merged.push({ status: e.status, label: e.label, at: e.at, location: e.location, note: e.note });
        if (Object.values(ShipmentStatus).includes(e.status as ShipmentStatus)) {
          latest = e.status as ShipmentStatus;
        }
      }
    }
    merged.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    s.events = merged;
    s.status = latest;
    if (latest === ShipmentStatus.DELIVERED && !s.delivered_at) s.delivered_at = new Date();
    return this.shipRepo.save(s);
  }

  async cancel(shipmentId: number) {
    const s = await this.get(shipmentId);
    const provider = this.getProvider(s.provider);
    await provider.cancel(s.tracking_number);
    return this.pushEvent(shipmentId, ShipmentStatus.CANCELLED, { note: 'Expédition annulée' });
  }
}
