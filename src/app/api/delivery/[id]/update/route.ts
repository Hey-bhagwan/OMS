import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getSessionUser } from "@/server/auth/session";
import { shouldUpdateShipmentStatus } from "@/server/integrations/shiprocket/parser";
import { NormalizedShipmentStatus } from "@prisma/client";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { status, activity, location, remark, awbWaybill, courierName } = await req.json();

    const shipment = await prisma.shipment.findUnique({
      where: { id: params.id },
      include: { order: true },
    });

    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    const targetStatus = status as NormalizedShipmentStatus;
    if (targetStatus && !shouldUpdateShipmentStatus(shipment.normalizedStatus, targetStatus)) {
      return NextResponse.json(
        { error: `Cannot transition shipment from ${shipment.normalizedStatus} to ${targetStatus}` },
        { status: 400 }
      );
    }

    const now = new Date();
    const updatedStatus = targetStatus || shipment.normalizedStatus;
    const finalAwb = (awbWaybill && typeof awbWaybill === "string" && awbWaybill.trim()) ? awbWaybill.trim() : shipment.awbWaybill;
    const finalCourier = (courierName && typeof courierName === "string" && courierName.trim()) ? courierName.trim() : shipment.courierName;

    const updatedShipment = await prisma.shipment.update({
      where: { id: params.id },
      data: {
        awbWaybill: finalAwb,
        courierName: finalCourier,
        normalizedStatus: updatedStatus,
        currentScanActivity: activity || (finalAwb !== shipment.awbWaybill || finalCourier !== shipment.courierName ? `Updated to ${finalCourier} (AWB: ${finalAwb})` : shipment.currentScanActivity),
        currentScanLocation: location || shipment.currentScanLocation,
        deliveredAt: updatedStatus === "DELIVERED" ? now : shipment.deliveredAt,
      },
    });

    // Append ShipmentEvent
    await prisma.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        provider: shipment.provider,
        awbWaybill: shipment.awbWaybill,
        providerStatus: updatedStatus,
        activity: activity || `Manual update: ${updatedStatus}`,
        location: location || "Manual Entry",
        eventTimestamp: now,
      },
    });

    // Update matched Order if relevant
    if (shipment.orderId) {
      if (finalAwb !== shipment.awbWaybill || finalCourier !== shipment.courierName) {
        await prisma.order.update({
          where: { id: shipment.orderId },
          data: {
            nextAction: `In transit via ${finalCourier} (AWB: ${finalAwb})`,
          },
        });
      }

      if (updatedStatus === "DELIVERED") {
        await prisma.order.update({
          where: { id: shipment.orderId },
          data: {
            internalStage: "DELIVERY",
            nextAction: "Delivery verified. Order fulfilled.",
            blockerReason: null,
          },
        });
      } else if (updatedStatus === "DELIVERY_EXCEPTION") {
        await prisma.order.update({
          where: { id: shipment.orderId },
          data: {
            internalStage: "DELIVERY_EXCEPTION",
            blockerReason: activity || "Delivery exception flagged",
            nextAction: "Coordinate with customer and courier for re-attempt",
          },
        });
      } else if (updatedStatus === "RTO" || updatedStatus === "RETURNED") {
        await prisma.order.update({
          where: { id: shipment.orderId },
          data: {
            internalStage: "RTO",
            blockerReason: "Package in Return to Origin workflow",
            nextAction: "Inspect return parcel upon arrival at warehouse",
          },
        });
      }

      if (remark?.trim()) {
        await prisma.orderRemark.create({
          data: {
            orderId: shipment.orderId,
            shipmentId: shipment.id,
            stage: "DELIVERY",
            text: remark.trim(),
            authorName: user.name,
            authorId: user.id,
            authorEmail: user.email,
          },
        });
      }
    }

    return NextResponse.json({ success: true, shipment: updatedShipment });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
