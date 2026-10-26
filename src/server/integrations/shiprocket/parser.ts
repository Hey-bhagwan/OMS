import { NormalizedShipmentStatus, ShipmentProvider } from "@prisma/client";
import {
  ShiprocketStandardPayload,
  ShiprocketCargoPayload,
  NormalizedShipmentEvent,
} from "./types";

export function mapToNormalizedStatus(rawStatus?: string): NormalizedShipmentStatus {
  if (!rawStatus) return "UNKNOWN";
  const s = rawStatus.trim().toUpperCase();

  if (/DELIVERED/i.test(s) && !/UNDELIVERED|NOT DELIVERED|REFUSED/i.test(s)) return "DELIVERED";
  if (/OUT FOR DELIVERY|OUT_FOR_DELIVERY/i.test(s)) return "OUT_FOR_DELIVERY";
  if (/IN TRANSIT|IN_TRANSIT|TRANSIT|REACHED/i.test(s)) return "IN_TRANSIT";
  if (/PICKED UP|PICKED_UP|PICKUP DONE/i.test(s)) return "PICKED_UP";
  if (/READY FOR PICKUP|PICKUP SCHEDULED|MANIFEST/i.test(s)) return "READY_FOR_PICKUP";
  if (/RTO DELIVERED|RETURNED/i.test(s)) return "RETURNED";
  if (/RTO|RETURN TO ORIGIN/i.test(s)) return "RTO";
  if (/UNDELIVERED|FAILED DELIVERY|ATTEMPT|REFUSED|REJECTED/i.test(s)) return "UNDELIVERED";
  if (/EXCEPTION|ISSUE|DAMAGED|HOLD/i.test(s)) return "DELIVERY_EXCEPTION";
  if (/CANCELED|CANCELLED/i.test(s)) return "CANCELLED";
  if (/CREATED|NEW/i.test(s)) return "SHIPMENT_CREATED";

  return "UNKNOWN";
}

// Status precedence score to avoid regressions (e.g. an out of order scan regressing Delivered to In Transit)
export const STATUS_PRECEDENCE: Record<NormalizedShipmentStatus, number> = {
  SHIPMENT_CREATED: 10,
  READY_FOR_PICKUP: 20,
  PICKED_UP: 30,
  IN_TRANSIT: 40,
  OUT_FOR_DELIVERY: 50,
  DELIVERY_EXCEPTION: 45,
  UNDELIVERED: 46,
  DELIVERED: 100, // Final terminal positive state
  RTO: 105,       // Legitimate reverse logistics transition
  RETURNED: 110,  // Final return state
  CANCELLED: 90,
  UNKNOWN: 0,
};

export function shouldUpdateShipmentStatus(
  currentStatus: NormalizedShipmentStatus,
  newStatus: NormalizedShipmentStatus
): boolean {
  if (newStatus === "RTO" || newStatus === "RETURNED") {
    return true; // Legitimate return transitions are always permitted
  }
  if (currentStatus === "DELIVERED") {
    return false; // Do not regress from DELIVERED to in-transit or other statuses
  }
  return STATUS_PRECEDENCE[newStatus] >= STATUS_PRECEDENCE[currentStatus];
}

export function parseStandardShiprocketPayload(
  payload: ShiprocketStandardPayload
): NormalizedShipmentEvent {
  const awb = String(payload.awb || "").trim();
  const rawStatus = payload.current_status || "UNKNOWN";
  const normalizedStatus = mapToNormalizedStatus(rawStatus);

  // Extract latest scan safely by sorting timestamps if available
  let latestScan = payload.scans?.[0];
  if (payload.scans && payload.scans.length > 1) {
    const sorted = [...payload.scans].sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da; // Descending
    });
    latestScan = sorted[0];
  }

  const eventTimestamp = latestScan?.date ? new Date(latestScan.date) : new Date();
  const etd = payload.etd ? new Date(payload.etd) : undefined;
  const idempotencyKey = `SR-${awb}-${eventTimestamp.getTime()}-${normalizedStatus}`;

  return {
    provider: "SHIPROCKET",
    awbWaybill: awb,
    providerShipmentId: payload.shipment_id ? String(payload.shipment_id) : undefined,
    providerOrderId: payload.order_id ? String(payload.order_id) : undefined,
    courierName: payload.courier_name || "Shiprocket Courier",
    providerStatus: rawStatus,
    normalizedStatus,
    activityDescription: latestScan?.activity,
    scanLocation: latestScan?.location,
    eventTimestamp,
    estimatedDeliveryDate: etd,
    rawPayload: payload as Record<string, unknown>,
    idempotencyKey,
  };
}

export function parseShiprocketCargoPayload(
  payload: ShiprocketCargoPayload
): NormalizedShipmentEvent {
  const waybill = String(payload.waybill_no || payload.id || "").trim();
  const rawStatus = payload.status || "UNKNOWN";
  const normalizedStatus = mapToNormalizedStatus(rawStatus);

  // Extract latest scan from status_history safely
  let latestHistory = payload.status_history?.[payload.status_history.length - 1];
  if (payload.status_history && payload.status_history.length > 1) {
    const sorted = [...payload.status_history].sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });
    latestHistory = sorted[0];
  }

  const eventTimestamp = latestHistory?.date ? new Date(latestHistory.date) : new Date();
  const edd = payload.edd_date ? new Date(payload.edd_date) : undefined;
  const idempotencyKey = `SR-CARGO-${waybill}-${eventTimestamp.getTime()}-${normalizedStatus}`;

  return {
    provider: "SHIPROCKET_CARGO",
    awbWaybill: waybill,
    providerShipmentId: payload.id ? String(payload.id) : undefined,
    courierName: "Shiprocket Cargo",
    providerStatus: rawStatus,
    normalizedStatus,
    activityDescription: latestHistory?.status || latestHistory?.remark,
    scanLocation: latestHistory?.location || payload.from_city,
    eventTimestamp,
    estimatedDeliveryDate: edd,
    rawPayload: payload as Record<string, unknown>,
    idempotencyKey,
  };
}

export function parseShipmentWebhookPayload(
  body: unknown,
  providerHeader?: string
): NormalizedShipmentEvent {
  const record = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  // Detect Cargo vs Standard
  if (
    providerHeader === "SHIPROCKET_CARGO" ||
    "waybill_no" in record ||
    "status_history" in record
  ) {
    return parseShiprocketCargoPayload(record as ShiprocketCargoPayload);
  }

  return parseStandardShiprocketPayload(record as ShiprocketStandardPayload);
}
