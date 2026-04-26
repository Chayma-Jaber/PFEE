import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ShippingProvider,
  ShipmentCreatePayload,
  ShipmentCreateResult,
  ShipmentStatusEvent,
} from './shipping-provider.interface';

/**
 * First Delivery (Tunisia) adapter.
 * When FIRST_DELIVERY_API_KEY is set, calls real API. Otherwise, mock mode.
 */
@Injectable()
export class FirstDeliveryProvider implements ShippingProvider {
  readonly key = 'FIRST_DELIVERY';
  readonly displayName = 'First Delivery';
  private readonly logger = new Logger(FirstDeliveryProvider.name);
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('shipping.firstDelivery.apiKey', '');
    this.apiUrl = this.config.get<string>(
      'shipping.firstDelivery.apiUrl',
      'https://api.firstdelivery.tn/v1',
    );
  }

  private get isReal(): boolean {
    return !!this.apiKey;
  }

  async createShipment(p: ShipmentCreatePayload): Promise<ShipmentCreateResult> {
    if (this.isReal) {
      try {
        const res = await fetch(`${this.apiUrl}/shipments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            reference: p.orderReference,
            recipient_name: p.recipient.name,
            recipient_phone: p.recipient.phone,
            recipient_city: p.recipient.city,
            recipient_address: p.recipient.address,
            weight_kg: p.weightKg || 1,
            cod_amount: p.codAmount || 0,
          }),
        });
        const data = await res.json();
        return {
          trackingNumber: data.tracking_number || `FD-${Date.now()}`,
          providerPayload: data,
          estimatedDeliveryAt: this.estimate(p.recipient.city),
        };
      } catch (err: any) {
        this.logger.warn(`First Delivery API failed, falling back to mock: ${err.message}`);
      }
    }
    // Mock mode
    const trackingNumber = `FD${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000)}`;
    return {
      trackingNumber,
      providerPayload: { mock: true, reference: p.orderReference },
      estimatedDeliveryAt: this.estimate(p.recipient.city),
    };
  }

  async fetchEvents(trackingNumber: string): Promise<ShipmentStatusEvent[]> {
    if (this.isReal) {
      try {
        const res = await fetch(`${this.apiUrl}/shipments/${trackingNumber}/events`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        });
        const data = await res.json();
        return Array.isArray(data.events) ? data.events : [];
      } catch {
        return [];
      }
    }
    // Mock: progressive synthetic events based on "age" of tracking number
    const ageHours = this.ageHoursFromTracking(trackingNumber);
    const events: ShipmentStatusEvent[] = [];
    const now = new Date();
    const stamp = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3600 * 1000).toISOString();
    if (ageHours >= 0) events.push({ status: 'HANDED_OVER', label: 'Colis remis à First Delivery', at: stamp(ageHours), location: 'Tunis - Hub' });
    if (ageHours >= 6) events.push({ status: 'IN_TRANSIT', label: 'En transit vers dépôt destinataire', at: stamp(ageHours - 6), location: 'Sousse - Centre' });
    if (ageHours >= 12) events.push({ status: 'DEPOT_DELIVERY', label: 'Arrivé au dépôt de livraison', at: stamp(ageHours - 12), location: 'Dépôt Sousse' });
    if (ageHours >= 18) events.push({ status: 'OUT_FOR_DELIVERY', label: 'En cours de livraison', at: stamp(ageHours - 18) });
    if (ageHours >= 22) events.push({ status: 'DELIVERED', label: 'Colis livré', at: stamp(ageHours - 22) });
    return events;
  }

  async cancel(trackingNumber: string): Promise<boolean> {
    if (this.isReal) {
      try {
        await fetch(`${this.apiUrl}/shipments/${trackingNumber}/cancel`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.apiKey}` },
        });
        return true;
      } catch {
        return false;
      }
    }
    return true;
  }

  async estimateCost(city: string | undefined, weightKg: number = 1): Promise<number> {
    const tunisZone = ['tunis', 'ariana', 'manouba', 'ben arous'];
    const base = tunisZone.includes((city || '').toLowerCase()) ? 6 : 9;
    const weightExtra = Math.max(0, weightKg - 1) * 2;
    return base + weightExtra;
  }

  private estimate(city?: string): Date {
    const tunisZone = ['tunis', 'ariana', 'manouba', 'ben arous'];
    const days = tunisZone.includes((city || '').toLowerCase()) ? 2 : 4;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  }

  private ageHoursFromTracking(tn: string): number {
    // Extract a pseudo-timestamp from the tracking number for reproducible mock events
    const numeric = tn.replace(/\D/g, '');
    if (!numeric) return 0;
    const seed = Number(numeric.slice(-6)) || 0;
    return seed % 26; // 0..25h progression
  }
}
