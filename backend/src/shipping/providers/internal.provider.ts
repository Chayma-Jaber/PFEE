import { Injectable } from '@nestjs/common';
import {
  ShippingProvider,
  ShipmentCreatePayload,
  ShipmentCreateResult,
  ShipmentStatusEvent,
} from './shipping-provider.interface';

/**
 * Internal provider — for Barsha-managed deliveries (livraison interne / boutique).
 * No external API, status is advanced manually by admin.
 */
@Injectable()
export class InternalProvider implements ShippingProvider {
  readonly key = 'INTERNAL';
  readonly displayName = 'Barsha (livraison interne)';

  async createShipment(p: ShipmentCreatePayload): Promise<ShipmentCreateResult> {
    const trackingNumber = `BSH${Date.now().toString().slice(-10)}`;
    const est = new Date();
    est.setDate(est.getDate() + 2);
    return {
      trackingNumber,
      providerPayload: { reference: p.orderReference, internal: true },
      estimatedDeliveryAt: est,
    };
  }

  async fetchEvents(trackingNumber: string): Promise<ShipmentStatusEvent[]> {
    // Internal provider doesn't push events — admin updates manually via admin UI
    return [];
  }

  async cancel(trackingNumber: string): Promise<boolean> { return true; }

  async estimateCost(city: string | undefined, weightKg: number = 1): Promise<number> {
    const tunisZone = ['tunis', 'ariana', 'manouba', 'ben arous'];
    return tunisZone.includes((city || '').toLowerCase()) ? 5 : 7;
  }
}
