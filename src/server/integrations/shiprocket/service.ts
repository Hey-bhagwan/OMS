import { prisma } from "../../db/prisma";
import { parseShipmentWebhookPayload, shouldUpdateShipmentStatus } from "./parser";
import { NormalizedShipmentEvent } from "./types";

export class ShipmentService {
  /**
   * Reset order-line quantities and resolve any raw-material blocks when an
   * order is force-advanced to DISPATCH or DELIVERY via a webhook or sync
   * reconciliation, bypassing the normal inventory-allocation flow.
   *
   * Without this, the dashboard allocation breakdown still shows
   * "Pending RM" or "Blocked RM" even though the order has shipped.
   */
  private async cleanupOrderLinesOnShipmentAdvance(orderId: string): Promise<void> {
    const lines = await prisma.orderLine.findMany({
      where: { orderId },
      select: { id: true, quantity: true },
    });

    for (const line of lines) {
      await prisma.orderLine.update({
        where: { id: line.id },
        data: {
          pendingAssessmentQty: 0,
          blockedRawMaterialQty: 0,
          requiredProductionQty: 0,
          allocatedUnpackedQty: 0,
          allocatedPackedQty: line.quantity,
          packedCompletedQty: line.quantity,
          dispatchReadyQty: line.quantity,
        },
      });
    }

    // Resolve any active raw-material blocks so the queue no longer flags the order.
    await prisma.rawMaterialBlock.updateMany({
      where: {
        orderId,
        status: { in: ["PENDING_ASSESSMENT", "BLOCKED"] },
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
    });
  }

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

    // 5. Transition order stage based on shipment status (if matched to an order).
    //
    //    Mapping:
    //      SHIPMENT_CREATED / READY_FOR_PICKUP          → DISPATCH  (guard: only if order is pre-dispatch)
    //      PICKED_UP / IN_TRANSIT / OUT_FOR_DELIVERY
    //        / UNDELIVERED                              → DELIVERY  (guard: only if order is pre-delivery)
    //      DELIVERED                                    → DELIVERY  (existing behaviour, no guard needed)
    //      DELIVERY_EXCEPTION                           → DELIVERY_EXCEPTION (existing behaviour)
    //      RTO / RETURNED                               → RTO (existing behaviour)
    //
    //    Orders already at or beyond the implied target stage are never regressed.
    if (matchedOrderId) {
      if (parsed.normalizedStatus === "DELIVERED") {
        // Terminal positive state — always update regardless of current stage.
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
      } else if (
        parsed.normalizedStatus === "SHIPMENT_CREATED" ||
        parsed.normalizedStatus === "READY_FOR_PICKUP"
      ) {
        // Shipment created / scheduled for pickup → advance order to DISPATCH.
        // Guard: only move forward if the order is still in a pre-dispatch stage.
        const order = await prisma.order.findUnique({
          where: { id: matchedOrderId },
          select: { internalStage: true },
        });

        const preDispatchStages = ["RAW_MATERIAL", "PRODUCTION", "PACKING"];
        if (order && preDispatchStages.includes(order.internalStage)) {
          await prisma.order.update({
            where: { id: matchedOrderId },
            data: {
              internalStage: "DISPATCH",
              nextAction: `Shipment created via ${parsed.courierName} (AWB: ${parsed.awbWaybill}). Awaiting courier pickup.`,
              blockerReason: null,
            },
          });

          await prisma.orderStatusHistory.create({
            data: {
              orderId: matchedOrderId,
              toStage: "DISPATCH",
              reason: `Webhook: ${parsed.normalizedStatus} — AWB ${parsed.awbWaybill} via ${parsed.courierName}`,
            },
          });

          // Fix allocation breakdown: clear raw-material quantities since the order has shipped.
          await this.cleanupOrderLinesOnShipmentAdvance(matchedOrderId);
        }
      } else if (
        parsed.normalizedStatus === "PICKED_UP" ||
        parsed.normalizedStatus === "IN_TRANSIT" ||
        parsed.normalizedStatus === "OUT_FOR_DELIVERY" ||
        parsed.normalizedStatus === "UNDELIVERED"
      ) {
        // Shipment picked up or actively in motion → advance order to DELIVERY.
        // Guard: only move forward if the order has not yet reached DELIVERY or a terminal state.
        const order = await prisma.order.findUnique({
          where: { id: matchedOrderId },
          select: { internalStage: true },
        });

        const preDeliveryStages = ["RAW_MATERIAL", "PRODUCTION", "PACKING", "DISPATCH"];
        if (order && preDeliveryStages.includes(order.internalStage)) {
          await prisma.order.update({
            where: { id: matchedOrderId },
            data: {
              internalStage: "DELIVERY",
              nextAction: `In transit via ${parsed.courierName} (AWB: ${parsed.awbWaybill}) — status: ${parsed.normalizedStatus}`,
              blockerReason: null,
            },
          });

          await prisma.orderStatusHistory.create({
            data: {
              orderId: matchedOrderId,
              toStage: "DELIVERY",
              reason: `Webhook: ${parsed.normalizedStatus} — AWB ${parsed.awbWaybill} via ${parsed.courierName}`,
            },
          });

          // Fix allocation breakdown: clear raw-material quantities since the order has shipped.
          await this.cleanupOrderLinesOnShipmentAdvance(matchedOrderId);
        }
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
