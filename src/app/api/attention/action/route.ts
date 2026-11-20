import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getSessionUser } from "@/server/auth/session";
import { shipmentService } from "@/server/integrations/shiprocket/service";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { shipmentId, orderId, action } = await req.json();

    if (!shipmentId || !action || !["UPDATE", "SKIP"].includes(action)) {
      return NextResponse.json(
        { error: "shipmentId and action ('UPDATE' | 'SKIP') are required" },
        { status: 400 }
      );
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        events: {
          orderBy: { eventTimestamp: "desc" },
          take: 1,
        },
      },
    });

    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    let meta: any = {};
    try {
      if (shipment.mismatchDetails) meta = JSON.parse(shipment.mismatchDetails);
    } catch {}

    const targetOrderId = orderId || shipment.orderId || meta.orderId;
    if (!targetOrderId) {
      return NextResponse.json(
        { error: "Cannot determine which order this shipment belongs to." },
        { status: 400 }
      );
    }

    const targetOrder = await prisma.order.findUnique({
      where: { id: targetOrderId },
      include: {
        shipments: true,
        skippedAwbs: true,
      },
    });

    if (!targetOrder) {
      return NextResponse.json({ error: "Associated order not found." }, { status: 404 });
    }

    const incomingAwb = shipment.awbWaybill.trim();
    const recordedAwb = meta.recordedAwb?.trim() || targetOrder.shipments?.[0]?.awbWaybill?.trim();

    if (action === "UPDATE") {
      // 1. User wants to UPDATE order with incoming webhook details!
      // Add the PREVIOUS recorded AWB to the Order's Skip List
      if (recordedAwb && recordedAwb.toLowerCase() !== incomingAwb.toLowerCase()) {
        await prisma.orderAwbSkip.upsert({
          where: {
            orderId_awbWaybill: {
              orderId: targetOrder.id,
              awbWaybill: recordedAwb,
            },
          },
          update: {
            reason: `Replaced by user in favor of webhook AWB ${incomingAwb}`,
          },
          create: {
            orderId: targetOrder.id,
            awbWaybill: recordedAwb,
            reason: `Replaced by user in favor of webhook AWB ${incomingAwb}`,
          },
        }).catch(() => {});
      }

      // If the incoming AWB was previously in the skip list for any reason, remove it
      await prisma.orderAwbSkip.deleteMany({
        where: {
          orderId: targetOrder.id,
          awbWaybill: incomingAwb,
        },
      }).catch(() => {});

      // Remove the old/placeholder shipment(s) or unassign them
      await prisma.shipment.deleteMany({
        where: {
          orderId: targetOrder.id,
          id: { not: shipment.id },
          awbWaybill: { in: [recordedAwb, "KOAL*"].filter(Boolean) as string[] },
        },
      }).catch(() => {});

      // Link this shipment to the order and clear mismatch flags
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          orderId: targetOrder.id,
          uniwareOrderCode: targetOrder.uniwareOrderCode,
          isUnmatched: false,
          isAwbMismatch: false,
          matchConfidence: "MANUAL_RECONCILED",
        },
      });

      // Advance order stage to DELIVERY (or DELIVERED)
      const nextStage = shipment.normalizedStatus === "DELIVERED" ? "DELIVERED" : "DELIVERY";
      await prisma.order.update({
        where: { id: targetOrder.id },
        data: {
          internalStage: nextStage,
          nextAction: `Shipping reconciled: Tracking via ${shipment.courierName} (AWB: ${incomingAwb})`,
          blockerReason: null,
          priorityScore: nextStage === "DELIVERED" ? 0 : 40,
        },
      });

      // Record stage history
      await prisma.orderStatusHistory.create({
        data: {
          orderId: targetOrder.id,
          toStage: nextStage,
          reason: `User reconciled AWB from ${recordedAwb || "None"} to ${incomingAwb} (${shipment.courierName})`,
        },
      });

      // Record Audit Log
      await prisma.auditLog.create({
        data: {
          entityType: "ORDER",
          entityId: targetOrder.id,
          action: "RECONCILE",
          actorId: user.id,
          actorEmail: user.email,
          changesJson: JSON.stringify({
            previousAwb: recordedAwb,
            newAwb: incomingAwb,
            courier: shipment.courierName,
            status: shipment.normalizedStatus,
            addedToSkipList: recordedAwb,
          }),
        },
      });

      // Update receipts
      await prisma.webhookReceipt.updateMany({
        where: {
          payloadJson: { contains: incomingAwb },
          status: "AWB_MISMATCH",
        },
        data: {
          status: "PROCESSED",
          errorMessage: null,
        },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        action: "UPDATE",
        message: `Successfully updated Order #${targetOrder.displayOrderCode || targetOrder.uniwareOrderCode} to AWB ${incomingAwb}. Previous AWB ${recordedAwb} added to Skip List.`,
        orderId: targetOrder.id,
        newAwb: incomingAwb,
        skippedAwb: recordedAwb,
      });
    } else {
      // 2. User chose SKIP:
      // Add the INCOMING AWB to the Order's Skip List
      await prisma.orderAwbSkip.upsert({
        where: {
          orderId_awbWaybill: {
            orderId: targetOrder.id,
            awbWaybill: incomingAwb,
          },
        },
        update: {
          reason: `Skipped by user decision. Existing AWB ${recordedAwb} preserved.`,
        },
        create: {
          orderId: targetOrder.id,
          awbWaybill: incomingAwb,
          reason: `Skipped by user decision. Existing AWB ${recordedAwb} preserved.`,
        },
      }).catch(() => {});

      // Mark the shipment mismatch as resolved/dismissed
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          isAwbMismatch: false,
          matchConfidence: "SKIPPED_BY_USER",
        },
      });

      // Update receipts to SKIPPED
      await prisma.webhookReceipt.updateMany({
        where: {
          payloadJson: { contains: incomingAwb },
          status: "AWB_MISMATCH",
        },
        data: {
          status: "SKIPPED",
          errorMessage: `Skipped by user decision. Future webhooks for AWB ${incomingAwb} on Order ${targetOrder.uniwareOrderCode} will be ignored.`,
        },
      }).catch(() => {});

      // Record Audit Log
      await prisma.auditLog.create({
        data: {
          entityType: "SHIPMENT",
          entityId: shipment.id,
          action: "UPDATE",
          actorId: user.id,
          actorEmail: user.email,
          changesJson: JSON.stringify({
            skippedAwb: incomingAwb,
            orderId: targetOrder.id,
            orderCode: targetOrder.uniwareOrderCode,
            preservedAwb: recordedAwb,
          }),
        },
      });

      return NextResponse.json({
        success: true,
        action: "SKIP",
        message: `AWB ${incomingAwb} added to Skip List for Order #${targetOrder.displayOrderCode || targetOrder.uniwareOrderCode}. Order details left untouched.`,
        orderId: targetOrder.id,
        skippedAwb: incomingAwb,
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Attention Action Error]:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
