import { prisma } from "../../db/prisma";
import { parseShipmentWebhookPayload, shouldUpdateShipmentStatus } from "./parser";
import { NormalizedShipmentEvent } from "./types";

export class ShipmentService {
  /**
   * Ingest and process a webhook from Shiprocket or Shiprocket Cargo
   */
  public async handleWebhook(payload: unknown, providerHeader?: string) {
    const rawString = JSON.stringify(payload);
    const parsed: NormalizedShipmentEvent = parseShipmentWebhookPayload(payload, providerHeader);

    // 1. Record WebhookReceipt for durability
    await prisma.webhookReceipt.create({
      data: {
        provider: parsed.provider,
        eventType: parsed.normalizedStatus,
        idempotencyKey: parsed.idempotencyKey,
        payloadJson: rawString,
        status: "PROCESSED",
      },
    }).catch(() => {
      // Ignore duplicate receipt error gracefully
    });

    if (!parsed.awbWaybill) {
      throw new Error("Payload missing required AWB or waybill identifier");
    }

    // 2. Try to find existing shipment or matching Order
    let shipment = await prisma.shipment.findUnique({
      where: {
        provider_awbWaybill: {
          provider: parsed.provider,
          awbWaybill: parsed.awbWaybill,
        },
      },
    });

    let matchedOrderId: string | null = shipment?.orderId || null;
    let matchConfidence: string = shipment?.matchConfidence || "PENDING";
    let isUnmatched = false;

    if (!matchedOrderId) {
      // Attempt match 1: By provider order ID or Uniware order code
      if (parsed.providerOrderId) {
        const order = await prisma.order.findFirst({
          where: {
            OR: [
              { uniwareOrderCode: parsed.providerOrderId },
              { displayOrderCode: parsed.providerOrderId },
            ],
          },
        });
        if (order) {
          matchedOrderId = order.id;
          matchConfidence = "ORDER_CODE_MATCH";
        }
      }

      // If still unmatched, flag as unmatched
      if (!matchedOrderId) {
        isUnmatched = true;
        matchConfidence = "UNMATCHED";
      }
    }

    // 3. Upsert Shipment snapshot
    const shouldUpdateStatus = shipment
      ? shouldUpdateShipmentStatus(shipment.normalizedStatus, parsed.normalizedStatus)
      : true;

    const currentStatus = shouldUpdateStatus
      ? parsed.normalizedStatus
      : shipment!.normalizedStatus;

    shipment = await prisma.shipment.upsert({
      where: {
        provider_awbWaybill: {
          provider: parsed.provider,
          awbWaybill: parsed.awbWaybill,
        },
      },
      update: {
        orderId: matchedOrderId || undefined,
        providerShipmentId: parsed.providerShipmentId || undefined,
        courierName: parsed.courierName,
        normalizedStatus: currentStatus,
        providerStatus: parsed.providerStatus,
        currentScanLocation: parsed.scanLocation || undefined,
        currentScanActivity: parsed.activityDescription || undefined,
        etdDate: parsed.estimatedDeliveryDate || undefined,
        dispatchedAt: parsed.normalizedStatus === "PICKED_UP" || parsed.normalizedStatus === "IN_TRANSIT" ? new Date() : undefined,
        deliveredAt: parsed.normalizedStatus === "DELIVERED" ? new Date() : undefined,
        isUnmatched,
        matchConfidence,
      },
      create: {
        provider: parsed.provider,
        awbWaybill: parsed.awbWaybill,
        orderId: matchedOrderId || undefined,
        providerShipmentId: parsed.providerShipmentId,
        providerOrderId: parsed.providerOrderId,
        courierName: parsed.courierName,
        normalizedStatus: currentStatus,
        providerStatus: parsed.providerStatus,
        currentScanLocation: parsed.scanLocation,
        currentScanActivity: parsed.activityDescription,
        etdDate: parsed.estimatedDeliveryDate,
        dispatchedAt: parsed.normalizedStatus === "PICKED_UP" || parsed.normalizedStatus === "IN_TRANSIT" ? new Date() : undefined,
        deliveredAt: parsed.normalizedStatus === "DELIVERED" ? new Date() : undefined,
        isUnmatched,
        matchConfidence,
      },
    });

    // 4. Record ShipmentEvent for append-only tracking history
    await prisma.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        provider: parsed.provider,
        awbWaybill: parsed.awbWaybill,
        providerStatus: parsed.providerStatus,
        activity: parsed.activityDescription,
        location: parsed.scanLocation,
        eventTimestamp: parsed.eventTimestamp,
        rawPayloadJson: rawString,
        idempotencyKey: parsed.idempotencyKey,
      },
    }).catch(() => {
      // Idempotency constraint prevents duplicate insert
    });

    // 5. If matched to an order and status is DELIVERED, transition order to DELIVERY
    if (matchedOrderId) {
      if (parsed.normalizedStatus === "DELIVERED") {
        await prisma.order.update({
          where: { id: matchedOrderId },
          data: {
            internalStage: "DELIVERY",
            nextAction: "Delivery confirmed by courier webhook. Order fulfilled.",
            blockerReason: null,
          },
        });

        await prisma.orderStatusHistory.create({
          data: {
            orderId: matchedOrderId,
            toStage: "DELIVERY",
            reason: `Shipment #${parsed.awbWaybill} delivered via ${parsed.courierName}`,
          },
        });
      } else if (parsed.normalizedStatus === "DELIVERY_EXCEPTION") {
        await prisma.order.update({
          where: { id: matchedOrderId },
          data: {
            internalStage: "DELIVERY_EXCEPTION",
            blockerReason: parsed.activityDescription || "Delivery exception reported by courier",
            nextAction: "Coordinate with customer and courier for re-attempt",
          },
        });
      } else if (parsed.normalizedStatus === "RTO" || parsed.normalizedStatus === "RETURNED") {
        await prisma.order.update({
          where: { id: matchedOrderId },
          data: {
            internalStage: "RTO",
            blockerReason: "Package in Return to Origin workflow",
            nextAction: "Inspect return parcel upon arrival at warehouse",
          },
        });
      }
    }

    return {
      success: true,
      shipmentId: shipment.id,
      normalizedStatus: currentStatus,
      isUnmatched,
    };
  }
}

export const shipmentService = new ShipmentService();
