import { NormalizedShipmentStatus, ShipmentProvider } from "@prisma/client";

export interface ShiprocketStandardScan {
  date?: string;
  activity?: string;
  location?: string;
  "sr-status"?: string | number;
}

export interface ShiprocketStandardPayload {
  order_id?: string | number;
  shipment_id?: string | number;
  awb?: string;
  courier_name?: string;
  current_status?: string;
  current_status_id?: number;
  etd?: string;
  scans?: ShiprocketStandardScan[];
  [key: string]: unknown;
}

export interface ShiprocketCargoStatusHistory {
  date?: string;
  status?: string;
  location?: string;
  remark?: string;
}

export interface ShiprocketCargoPayload {
  id?: string | number;
  waybill_no?: string;
  status?: string;
  edd_date?: string;
  from_city?: string;
  status_history?: ShiprocketCargoStatusHistory[];
  [key: string]: unknown;
}

export interface NormalizedShipmentEvent {
  provider: ShipmentProvider;
  awbWaybill: string;
  providerShipmentId?: string;
  providerOrderId?: string;
  courierName: string;
  providerStatus: string;
  normalizedStatus: NormalizedShipmentStatus;
  activityDescription?: string;
  scanLocation?: string;
  eventTimestamp: Date;
  estimatedDeliveryDate?: Date;
  rawPayload: Record<string, unknown>;
  idempotencyKey: string;
}
