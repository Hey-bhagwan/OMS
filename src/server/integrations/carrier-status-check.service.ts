import { prisma } from "../db/prisma";
import { uniwareClient } from "./uniware/client";
import { mapToNormalizedStatus, shouldUpdateShipmentStatus } from "./shiprocket/parser";
import { NormalizedShipmentStatus } from "@prisma/client";

export interface StatusCheckResult {
  shipmentId: string;
  awb: string;
  provider: string;
  courierName?: string | null;
  previousStatus: NormalizedShipmentStatus;
  newStatus: NormalizedShipmentStatus;
  statusChanged: boolean;
  activity?: string;
  location?: string;
  deliveredAt?: Date | null;
  error?: string;
}

export class CarrierStatusCheckService {
  /**
   * Check status for a single shipment directly from the relevant carrier or source.
   */
  public async checkShipmentStatus(shipmentId: string): Promise<StatusCheckResult> {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        order: true,
      },
    });

    if (!shipment) {
      throw new Error(`Shipment with ID ${shipmentId} not found`);
    }

    const previousStatus = shipment.normalizedStatus;

    // Guard: Only non-delivered shipments can be refreshed
    if (previousStatus === "DELIVERED") {
      return {
        shipmentId: shipment.id,
        awb: shipment.awbWaybill,
        provider: shipment.provider,
        courierName: shipment.courierName,
        previousStatus,
        newStatus: previousStatus,
        statusChanged: false,
        activity: "Already confirmed DELIVERED. Locked from external regression.",
      };
    }

    try {
      // Branch based on Provider or Channel
      if (shipment.provider === "SHIPROCKET") {
        return await this.checkShiprocketStatus(shipment);
      } else if (shipment.provider === "SHIPROCKET_CARGO") {
        return await this.checkShiprocketCargoStatus(shipment);
      } else {
        // UNIWARE, MYNTRA / EKART, or other channel shipments
        return await this.checkUniwareStatus(shipment);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[CarrierStatusCheck] Carrier status check failed", { shipmentId: shipment.id, error: errorMsg });
      return {
        shipmentId: shipment.id,
        awb: shipment.awbWaybill,
        provider: shipment.provider,
        courierName: shipment.courierName,
        previousStatus,
        newStatus: previousStatus,
        statusChanged: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Check status directly from Shiprocket API (if token / credentials configured)
   * or fallback to order tracking endpoint.
   */
  private async checkShiprocketStatus(shipment: any): Promise<StatusCheckResult> {
    const awb = shipment.awbWaybill;
    const token = process.env.SHIPROCKET_AUTH_TOKEN;

    if (token) {
      try {
        const res = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awb}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (res.ok) {
          const data = await res.json();
          const trackData = data?.tracking_data;
          const currentStatusStr = trackData?.track_status || trackData?.shipment_status;
          const normalizedStatus = mapToNormalizedStatus(currentStatusStr);
          const location = trackData?.current_city || trackData?.destination || shipment.currentScanLocation;
          const activity = trackData?.activity || `Tracking update from Shiprocket (${currentStatusStr || "In Transit"})`;

          return await this.applyStatusUpdate(shipment, normalizedStatus, location, activity);
        }
      } catch (err) {
        console.warn("[CarrierStatusCheck] Shiprocket direct tracking lookup failed, falling back to Uniware", { err });
      }
    }

    // Fallback: If Uniware order code is available, re-check via Uniware
    if (shipment.order?.uniwareOrderCode || shipment.uniwareOrderCode) {
      return await this.checkUniwareStatus(shipment);
    }

    return {
      shipmentId: shipment.id,
      awb: shipment.awbWaybill,
      provider: shipment.provider,
      courierName: shipment.courierName,
      previousStatus: shipment.normalizedStatus,
      newStatus: shipment.normalizedStatus,
      statusChanged: false,
      activity: "Shiprocket tracking credentials not set and no linked order found.",
    };
  }

  /**
   * Check status for Shiprocket Cargo shipments
   */
  private async checkShiprocketCargoStatus(shipment: any): Promise<StatusCheckResult> {
    const cargoToken = process.env.SHIPROCKET_CARGO_AUTH_TOKEN || process.env.SHIPROCKET_AUTH_TOKEN;

    if (cargoToken) {
      try {
        const res = await fetch(`https://apiv2.shiprocket.in/v1/external/cargo/track/${shipment.awbWaybill}`, {
          headers: {
            Authorization: `Bearer ${cargoToken}`,
            "Content-Type": "application/json",
          },
        });
        if (res.ok) {
          const data = await res.json();
          const rawStatus = data?.current_status || data?.status;
          const normalizedStatus = mapToNormalizedStatus(rawStatus);
          const location = data?.current_location || shipment.currentScanLocation;
          const activity = `Cargo scan update: ${rawStatus}`;

          return await this.applyStatusUpdate(shipment, normalizedStatus, location, activity);
        }
      } catch (err) {
        console.warn("[CarrierStatusCheck] Shiprocket cargo direct tracking failed, falling back to Uniware", { err });
      }
    }

    // Fallback to Uniware order lookup if available
    if (shipment.order?.uniwareOrderCode || shipment.uniwareOrderCode) {
      return await this.checkUniwareStatus(shipment);
    }

    return {
      shipmentId: shipment.id,
      awb: shipment.awbWaybill,
      provider: shipment.provider,
      courierName: shipment.courierName,
      previousStatus: shipment.normalizedStatus,
      newStatus: shipment.normalizedStatus,
      statusChanged: false,
      activity: "Cargo tracking credentials not set and no linked order found.",
    };
  }

  /**
   * Check status via Uniware (covers Myntra/Ekart, Amazon, Shopify, Bluedart, etc.)
   */
  private async checkUniwareStatus(shipment: any): Promise<StatusCheckResult> {
    const orderCode = shipment.order?.uniwareOrderCode || shipment.uniwareOrderCode;

    if (!orderCode) {
      return {
        shipmentId: shipment.id,
        awb: shipment.awbWaybill,
        provider: shipment.provider,
        courierName: shipment.courierName,
        previousStatus: shipment.normalizedStatus,
        newStatus: shipment.normalizedStatus,
        statusChanged: false,
        activity: "No associated order code to query Uniware/Carrier.",
      };
    }

    const orderRes = await uniwareClient.getOrderDetails(orderCode);
    if (!orderRes.successful || !orderRes.saleOrderDTO) {
      throw new Error(`Uniware order lookup failed for code ${orderCode}`);
    }

    const dto = orderRes.saleOrderDTO;
    const pkgs = dto.shippingPackages || [];

    // Find the matching package or use the first one
    const matchingPkg =
      pkgs.find(
        (p) =>
          p.trackingNumber === shipment.awbWaybill ||
          p.code === shipment.awbWaybill ||
          p.channelShipmentCode === shipment.awbWaybill
      ) || pkgs[0];

    if (!matchingPkg) {
      return {
        shipmentId: shipment.id,
        awb: shipment.awbWaybill,
        provider: shipment.provider,
        courierName: shipment.courierName,
        previousStatus: shipment.normalizedStatus,
        newStatus: shipment.normalizedStatus,
        statusChanged: false,
        activity: "No shipping package found in carrier response.",
      };
    }

    // Evaluate carrier courierStatus / status
    const rawVal = matchingPkg.courierStatus || matchingPkg.status || dto.status || "";
    const carrierRawStatus = String(rawVal).toUpperCase();
    let normalizedStatus: NormalizedShipmentStatus = mapToNormalizedStatus(carrierRawStatus);

    if (carrierRawStatus === "DELIVERED" || dto.status === "COMPLETE") {
      normalizedStatus = "DELIVERED";
    } else if (carrierRawStatus === "DISPATCHED" || carrierRawStatus === "SHIPPED") {
      normalizedStatus = "IN_TRANSIT";
    } else if (carrierRawStatus === "READY_TO_SHIP" || carrierRawStatus === "PACKED") {
      normalizedStatus = "READY_FOR_PICKUP";
    }

    const courierProvider = matchingPkg.shippingProvider || matchingPkg.shippingCourier || shipment.courierName;
    const location = matchingPkg.city || shipment.currentScanLocation || "Carrier Facility";
    const activity = `Direct carrier status (${courierProvider || "Courier"}): ${carrierRawStatus || normalizedStatus}`;
    const deliveredAt = matchingPkg.delivered ? new Date(Number(matchingPkg.delivered)) : null;

    return await this.applyStatusUpdate(shipment, normalizedStatus, location, activity, deliveredAt, courierProvider);
  }

  /**
   * Apply database status transition and synchronize linked order
   */
  private async applyStatusUpdate(
    shipment: any,
    targetStatus: NormalizedShipmentStatus,
    location?: string,
    activity?: string,
    deliveredAtTimestamp?: Date | null,
    courierName?: string | null
  ): Promise<StatusCheckResult> {
    const previousStatus = shipment.normalizedStatus;

    if (!shouldUpdateShipmentStatus(previousStatus, targetStatus)) {
      return {
        shipmentId: shipment.id,
        awb: shipment.awbWaybill,
        provider: shipment.provider,
        courierName: courierName || shipment.courierName,
        previousStatus,
        newStatus: previousStatus,
        statusChanged: false,
        activity: `Status ${targetStatus} cannot precede current status ${previousStatus}`,
      };
    }

    const now = new Date();
    const finalDeliveredAt =
      targetStatus === "DELIVERED"
        ? deliveredAtTimestamp || shipment.deliveredAt || now
        : shipment.deliveredAt;

    // 1. Update Shipment
    const updated = await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        normalizedStatus: targetStatus,
        currentScanLocation: location || shipment.currentScanLocation,
        currentScanActivity: activity || shipment.currentScanActivity,
        deliveredAt: finalDeliveredAt,
        ...(courierName ? { courierName } : {}),
      },
    });

    // 2. Insert ShipmentEvent
    await prisma.shipmentEvent.create({
      data: {
        shipment: { connect: { id: shipment.id } },
        provider: shipment.provider,
        awbWaybill: shipment.awbWaybill,
        providerStatus: targetStatus,
        activity: activity || `Status manually verified: ${targetStatus}`,
        location: location || "In Transit Hub",
        eventTimestamp: now,
      },
    }).catch((err) => {
      console.warn("[CarrierStatusCheck] Failed to create shipment event", { err });
    });

    // 3. Advance Linked Order stage if Delivered or In Transit
    if (shipment.orderId) {
      if (targetStatus === "DELIVERED") {
        await prisma.order.update({
          where: { id: shipment.orderId },
          data: {
            internalStage: "DELIVERED",
            priorityScore: 0,
            priorityLabel: "LOW",
            nextAction: "Delivery confirmed by carrier company. Order fulfilled.",
            blockerReason: null,
          },
        });

        // Cleanup pending RM / queue allocations
        const lines = await prisma.orderLine.findMany({
          where: { orderId: shipment.orderId },
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
        await prisma.rawMaterialBlock.updateMany({
          where: {
            orderId: shipment.orderId,
            status: { in: ["PENDING_ASSESSMENT", "BLOCKED"] },
          },
          data: {
            status: "RESOLVED",
            resolvedAt: now,
          },
        });
      } else if (["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(targetStatus)) {
        const order = await prisma.order.findUnique({
          where: { id: shipment.orderId },
          select: { internalStage: true },
        });
        if (order && ["RAW_MATERIAL", "PRODUCTION", "PACKING", "DISPATCH"].includes(order.internalStage)) {
          await prisma.order.update({
            where: { id: shipment.orderId },
            data: {
              internalStage: "DELIVERY",
              nextAction: `In transit via ${updated.courierName} (AWB: ${updated.awbWaybill}) — status: ${targetStatus}`,
              blockerReason: null,
            },
          });
        }
      }
    }

    return {
      shipmentId: shipment.id,
      awb: shipment.awbWaybill,
      provider: shipment.provider,
      courierName: updated.courierName,
      previousStatus,
      newStatus: targetStatus,
      statusChanged: previousStatus !== targetStatus,
      activity,
      location,
      deliveredAt: finalDeliveredAt,
    };
  }

  /**
   * Check status for all non-delivered shipments in batch
   */
  public async checkAllNonDeliveredShipments(limit = 50): Promise<{
    checkedCount: number;
    updatedCount: number;
    deliveredCount: number;
    results: StatusCheckResult[];
  }> {
    const nonDeliveredShipments = await prisma.shipment.findMany({
      where: {
        normalizedStatus: {
          notIn: ["DELIVERED", "RETURNED"],
        },
      },
      take: limit,
      orderBy: { updatedAt: "asc" }, // Check stalest first
      select: { id: true },
    });

    let updatedCount = 0;
    let deliveredCount = 0;
    const results: StatusCheckResult[] = [];

    for (const s of nonDeliveredShipments) {
      try {
        const result = await this.checkShipmentStatus(s.id);
        results.push(result);
        if (result.statusChanged) {
          updatedCount++;
        }
        if (result.newStatus === "DELIVERED") {
          deliveredCount++;
        }
      } catch (e) {
        console.error("[CarrierStatusCheck] Failed batch check for shipment", { shipmentId: s.id, error: e });
      }
    }

    return {
      checkedCount: nonDeliveredShipments.length,
      updatedCount,
      deliveredCount,
      results,
    };
  }
}

export const carrierStatusCheckService = new CarrierStatusCheckService();
