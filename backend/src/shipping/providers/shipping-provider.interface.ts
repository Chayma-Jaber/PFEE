/**
 * Shipping provider abstraction — one interface, many adapters.
 * Real adapters (First Delivery, Aramex, …) call external APIs when credentials
 * are configured. When credentials are missing, the adapter falls back to a
 * deterministic mock that returns realistic tracking numbers and events,
 * so the full UX works end-to-end without blocking on external integrations.
 */
export interface ShipmentCreatePayload {
  orderId: number;
  orderReference: string;
  recipient: { name: string; phone?: string; city?: string; address?: string };
  weightKg?: number;
  codAmount?: number;
  note?: string;
}

export interface ShipmentCreateResult {
  trackingNumber: string;
  providerPayload?: Record<string, any>;
  estimatedDeliveryAt?: Date;
}

export interface ShipmentStatusEvent {
  status: string;
  label: string;
  at: string;
  location?: string;
  note?: string;
}

export interface ShippingProvider {
  readonly key: string;
  readonly displayName: string;

  createShipment(payload: ShipmentCreatePayload): Promise<ShipmentCreateResult>;
  fetchEvents(trackingNumber: string): Promise<ShipmentStatusEvent[]>;
  cancel(trackingNumber: string): Promise<boolean>;
  estimateCost(city: string | undefined, weightKg?: number): Promise<number>;
}
