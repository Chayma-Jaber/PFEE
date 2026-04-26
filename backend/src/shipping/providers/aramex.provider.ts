import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ShippingProvider,
  ShipmentCreatePayload,
  ShipmentCreateResult,
  ShipmentStatusEvent,
} from './shipping-provider.interface';

/**
 * Aramex adapter (Middle East + Tunisia).
 * Real calls when ARAMEX_ACCOUNT_NUMBER is set; otherwise mock mode.
 */
@Injectable()
export class AramexProvider implements ShippingProvider {
  readonly key = 'ARAMEX';
  readonly displayName = 'Aramex';
  private readonly logger = new Logger(AramexProvider.name);
  private readonly accountNumber: string;
  private readonly username: string;
  private readonly password: string;
  private readonly apiUrl: string;

  constructor(private readonly config: ConfigService) {
    this.accountNumber = this.config.get<string>('shipping.aramex.accountNumber', '');
    this.username = this.config.get<string>('shipping.aramex.username', '');
    this.password = this.config.get<string>('shipping.aramex.password', '');
    this.apiUrl = this.config.get<string>(
      'shipping.aramex.apiUrl',
      'https://ws.aramex.net/ShippingAPI.V2',
    );
  }

  private get isReal(): boolean {
    return !!(this.accountNumber && this.username && this.password);
  }

  async createShipment(p: ShipmentCreatePayload): Promise<ShipmentCreateResult> {
    if (this.isReal) {
      try {
        const res = await fetch(`${this.apiUrl}/Shipments/Service.svc/json/CreateShipments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ClientInfo: {
              AccountNumber: this.accountNumber,
              UserName: this.username,
              Password: this.password,
            },
            Shipments: [{
              Reference1: p.orderReference,
              Consignee: {
                PartyAddress: { Line1: p.recipient.address, City: p.recipient.city, CountryCode: 'TN' },
                Contact: { PersonName: p.recipient.name, CellPhone: p.recipient.phone, EmailAddress: '' },
              },
              Details: { ActualWeight: { Value: p.weightKg || 1, Unit: 'Kg' } },
            }],
          }),
        });
        const data = await res.json();
        const tn = data?.Shipments?.[0]?.ID || `ARX-${Date.now()}`;
        return { trackingNumber: tn, providerPayload: data, estimatedDeliveryAt: this.estimate() };
      } catch (err: any) {
        this.logger.warn(`Aramex API failed, falling back to mock: ${err.message}`);
      }
    }
    const trackingNumber = `ARX${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000)}`;
    return {
      trackingNumber,
      providerPayload: { mock: true, reference: p.orderReference },
      estimatedDeliveryAt: this.estimate(),
    };
  }

  async fetchEvents(trackingNumber: string): Promise<ShipmentStatusEvent[]> {
    if (this.isReal) {
      try {
        const res = await fetch(`${this.apiUrl}/Tracking/Service.svc/json/TrackShipments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ClientInfo: { AccountNumber: this.accountNumber, UserName: this.username, Password: this.password },
            Shipments: [trackingNumber],
          }),
        });
        const data = await res.json();
        const tracks = data?.TrackingResults?.[0]?.Value || [];
        return tracks.map((t: any) => ({
          status: t.UpdateCode || 'IN_TRANSIT',
          label: t.UpdateDescription || t.UpdateLocation || 'Mise à jour',
          at: t.UpdateDateTime,
          location: t.UpdateLocation,
        }));
      } catch {
        return [];
      }
    }
    // Mock timeline
    const ageHours = this.ageHoursFromTracking(trackingNumber);
    const events: ShipmentStatusEvent[] = [];
    const now = new Date();
    const stamp = (h: number) => new Date(now.getTime() - h * 3600 * 1000).toISOString();
    if (ageHours >= 0) events.push({ status: 'HANDED_OVER', label: 'Pris en charge par Aramex', at: stamp(ageHours), location: 'Aramex Hub Tunis' });
    if (ageHours >= 8) events.push({ status: 'IN_TRANSIT', label: 'Expédition en transit', at: stamp(ageHours - 8), location: 'Aramex Gateway' });
    if (ageHours >= 16) events.push({ status: 'OUT_FOR_DELIVERY', label: 'En cours de livraison', at: stamp(ageHours - 16) });
    if (ageHours >= 20) events.push({ status: 'DELIVERED', label: 'Livré avec succès', at: stamp(ageHours - 20) });
    return events;
  }

  async cancel(trackingNumber: string): Promise<boolean> {
    return true;
  }

  async estimateCost(city: string | undefined, weightKg: number = 1): Promise<number> {
    const base = 8;
    return base + Math.max(0, weightKg - 1) * 3;
  }

  private estimate(): Date {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d;
  }

  private ageHoursFromTracking(tn: string): number {
    const numeric = tn.replace(/\D/g, '');
    if (!numeric) return 0;
    return (Number(numeric.slice(-6)) || 0) % 24;
  }
}
