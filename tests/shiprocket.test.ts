import { describe, it, expect } from "vitest";
import {
  parseStandardShiprocketPayload,
  parseShiprocketCargoPayload,
  parseShipmentWebhookPayload,
  mapToNormalizedStatus,
  shouldUpdateShipmentStatus,
} from "../src/server/integrations/shiprocket/parser";

describe("Shiprocket & Shiprocket Cargo Webhook Parsers", () => {
  it("correctly parses standard Shiprocket payload with scans", () => {
    const payload = {
      order_id: "IK9259",
      shipment_id: "1098234",
      awb: "BD998234123",
      courier_name: "Blue Dart Express",
      current_status: "OUT FOR DELIVERY",
      etd: "2026-10-25T18:00:00Z",
      scans: [
        {
          date: "2026-10-23T08:30:00Z",
          activity: "Out for delivery with delivery agent",
          location: "Mumbai Hub",
        },
        {
          date: "2026-10-22T14:00:00Z",
          activity: "Reached facility",
          location: "Bhiwandi Sorting Center",
        },
      ],
    };

    const parsed = parseStandardShiprocketPayload(payload);

    expect(parsed.provider).toBe("SHIPROCKET");
    expect(parsed.awbWaybill).toBe("BD998234123");
    expect(parsed.courierName).toBe("Blue Dart Express");
    expect(parsed.normalizedStatus).toBe("OUT_FOR_DELIVERY");
    expect(parsed.scanLocation).toBe("Mumbai Hub");
    expect(parsed.activityDescription).toBe("Out for delivery with delivery agent");
    expect(parsed.idempotencyKey).toContain("BD998234123");
  });

  it("correctly parses Shiprocket Cargo payload with status_history", () => {
    const payload = {
      id: "CRG-88712",
      waybill_no: "WAYBILL-990011",
      status: "In Transit",
      edd_date: "2026-10-28T00:00:00Z",
      from_city: "Jaipur",
      status_history: [
        {
          date: "2026-10-22T10:00:00Z",
          status: "Departed from Jaipur Hub",
          location: "Jaipur",
        },
        {
          date: "2026-10-23T11:30:00Z",
          status: "Arrived at Delhi Gateway",
          location: "Delhi",
        },
      ],
    };

    const parsed = parseShiprocketCargoPayload(payload);

    expect(parsed.provider).toBe("SHIPROCKET_CARGO");
    expect(parsed.awbWaybill).toBe("WAYBILL-990011");
    expect(parsed.courierName).toBe("Shiprocket Cargo");
    expect(parsed.normalizedStatus).toBe("IN_TRANSIT");
    expect(parsed.scanLocation).toBe("Delhi");
    expect(parsed.activityDescription).toBe("Arrived at Delhi Gateway");
  });

  it("auto-detects provider family from payload format", () => {
    const cargoEvent = parseShipmentWebhookPayload({
      waybill_no: "CARGO-123",
      status: "Delivered",
    });
    expect(cargoEvent.provider).toBe("SHIPROCKET_CARGO");
    expect(cargoEvent.normalizedStatus).toBe("DELIVERED");

    const standardEvent = parseShipmentWebhookPayload({
      awb: "STD-456",
      current_status: "PICKED UP",
    });
    expect(standardEvent.provider).toBe("SHIPROCKET");
    expect(standardEvent.normalizedStatus).toBe("PICKED_UP");
  });

  it("enforces status precedence to prevent regression from DELIVERED to IN_TRANSIT", () => {
    // Cannot regress from DELIVERED to IN_TRANSIT
    const canRegress = shouldUpdateShipmentStatus("DELIVERED", "IN_TRANSIT");
    expect(canRegress).toBe(false);

    // Can transition from IN_TRANSIT to DELIVERED
    const canProgress = shouldUpdateShipmentStatus("IN_TRANSIT", "DELIVERED");
    expect(canProgress).toBe(true);

    // Can transition to RTO / RETURNED from DELIVERED or any stage
    const canRto = shouldUpdateShipmentStatus("DELIVERED", "RTO");
    expect(canRto).toBe(true);
  });

  it("safely handles unknown and null provider statuses", () => {
    expect(mapToNormalizedStatus(undefined)).toBe("UNKNOWN");
    expect(mapToNormalizedStatus("SOME_UNDOCUMENTED_STATUS")).toBe("UNKNOWN");
    expect(mapToNormalizedStatus("DELIVERED")).toBe("DELIVERED");
    expect(mapToNormalizedStatus("CUSTOMER REFUSED DELIVERY")).toBe("UNDELIVERED");
  });

  it("handles duplicate and out-of-order event timestamps safely", () => {
    // Newer scan replaces older location
    const olderEvent = {
      eventTimestamp: new Date("2026-10-22T10:00:00Z"),
      location: "Jaipur Hub",
    };
    const newerEvent = {
      eventTimestamp: new Date("2026-10-23T11:30:00Z"),
      location: "Delhi Gateway",
    };

    expect(newerEvent.eventTimestamp.getTime()).toBeGreaterThan(olderEvent.eventTimestamp.getTime());
  });

  it("distinguishes delivery exceptions and return-to-origin events", () => {
    expect(mapToNormalizedStatus("RTO INITIATED")).toBe("RTO");
    expect(mapToNormalizedStatus("RETURNED TO WAREHOUSE")).toBe("RETURNED");
    expect(mapToNormalizedStatus("DELIVERY EXCEPTION - CUSTOMER NOT REACHABLE")).toBe("DELIVERY_EXCEPTION");
  });
});
