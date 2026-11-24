import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getSessionUser } from "@/server/auth/session";
import { STATUS_PRECEDENCE } from "@/server/integrations/shiprocket/parser";

// Any shipment status at PICKED_UP or beyond means the parcel is physically with the courier.
// Orders in these pre-delivery stages should be advanced to DELIVERY automatically.
const PRE_DELIVERY_STAGES = new Set(["RAW_MATERIAL", "PRODUCTION", "PACKING", "DISPATCH"]);

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        lines: {
          include: {
            sku: true,
            reservations: true,
            productionOrders: {
              orderBy: { createdAt: "desc" },
            },
            packingTasks: {
              orderBy: { createdAt: "desc" },
            },
            rawMaterialBlocks: {
              orderBy: { createdAt: "desc" },
              include: {
                assignedUser: { select: { id: true, name: true, email: true } },
                remarks: { orderBy: { createdAt: "desc" } },
              },
            },
          },
        },
        stageHistory: {
          orderBy: { timestamp: "desc" },
        },
        packingTasks: true,
        shipments: {
          include: {
            events: {
              orderBy: { eventTimestamp: "desc" },
            },
          },
        },
        rawMaterialBlocks: {
          orderBy: { createdAt: "desc" },
          include: {
            sku: true,
            assignedUser: { select: { id: true, name: true, email: true } },
            remarks: { orderBy: { createdAt: "desc" } },
          },
        },
        remarks: {
          orderBy: { createdAt: "desc" },
        },
        workflowDecisions: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, order });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { awbWaybill, courierName, remark } = await req.json();

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { shipments: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const trimmedAwb = awbWaybill ? String(awbWaybill).trim() : "";
    const trimmedCourier = courierName ? String(courierName).trim() : "Blue Dart";

    if (!trimmedAwb) {
      return NextResponse.json({ error: "AWB number is required" }, { status: 400 });
    }

    const existingShipment = order.shipments?.[0];
    const now = new Date();

    // Check if an unmatched shipment for this AWB already exists (e.g. from an early webhook)
    const existingUnmatchedShipment = await prisma.shipment.findFirst({
      where: {
        awbWaybill: trimmedAwb,
        isUnmatched: true,
      },
    });

    let updatedShipment;
    if (existingUnmatchedShipment) {
      // Adopt the unmatched webhook shipment and link it to this order
      updatedShipment = await prisma.shipment.update({
        where: { id: existingUnmatchedShipment.id },
        data: {
          orderId: order.id,
          uniwareOrderCode: order.uniwareOrderCode,
          courierName: trimmedCourier || existingUnmatchedShipment.courierName,
          isUnmatched: false,
          isAwbMismatch: false,
          matchConfidence: "MANUAL_ORDER_UPDATE",
        },
      });

      // If the order previously had a placeholder or separate shipment, remove it to prevent duplicate rows
      if (existingShipment && existingShipment.id !== existingUnmatchedShipment.id) {
        await prisma.shipment.delete({
          where: { id: existingShipment.id },
        }).catch(() => {});
      }
    } else if (existingShipment) {
      updatedShipment = await prisma.shipment.update({
        where: { id: existingShipment.id },
        data: {
          awbWaybill: trimmedAwb,
          courierName: trimmedCourier,
          currentScanActivity: `AWB updated to ${trimmedAwb} (${trimmedCourier})`,
        },
      });
    } else {
      updatedShipment = await prisma.shipment.create({
        data: {
          orderId: order.id,
          uniwareOrderCode: order.uniwareOrderCode,
          provider: "SHIPROCKET",
          courierName: trimmedCourier,
          awbWaybill: trimmedAwb,
          normalizedStatus: order.internalStage === "DELIVERED" ? "DELIVERED" : "PICKED_UP",
          dispatchedAt: now,
          deliveredAt: order.internalStage === "DELIVERED" ? now : undefined,
          currentScanActivity: `AWB recorded: ${trimmedAwb} (${trimmedCourier})`,
        },
      });
    }

    // Add Shipment event
    await prisma.shipmentEvent.create({
      data: {
        shipmentId: updatedShipment.id,
        provider: updatedShipment.provider,
        awbWaybill: trimmedAwb,
        providerStatus: updatedShipment.normalizedStatus,
        activity: `AWB updated to ${trimmedAwb} (${trimmedCourier})`,
        location: "Warehouse / Manual Entry",
        eventTimestamp: now,
      },
    }).catch(() => {});

    // Determine whether the order should be automatically advanced to DELIVERY.
    //
    // Rule: if the shipment that was just linked/updated already has a status of
    // PICKED_UP or beyond (IN_TRANSIT, OUT_FOR_DELIVERY, etc.), the parcel is
    // physically with the courier regardless of what internal stage the order is in
    // (RAW_MATERIAL, PRODUCTION, PACKING, DISPATCH — any pre-delivery stage).
    // We advance to DELIVERY so the order stops showing pre-courier action buttons.
    const finalShipmentStatus = updatedShipment.normalizedStatus;
    const shipmentIsWithCourier = STATUS_PRECEDENCE[finalShipmentStatus] >= STATUS_PRECEDENCE["PICKED_UP"];
    const orderIsPreDelivery = PRE_DELIVERY_STAGES.has(order.internalStage);
    const shouldAdvanceToDelivery = shipmentIsWithCourier && orderIsPreDelivery;
    const newStage = shouldAdvanceToDelivery ? "DELIVERY" : order.internalStage;

    // Update order stage and nextAction
    await prisma.order.update({
      where: { id: order.id },
      data: {
        ...(shouldAdvanceToDelivery ? { internalStage: "DELIVERY" } : {}),
        nextAction: order.internalStage === "DELIVERED"
          ? "Delivered to recipient. Order fulfilled."
          : `In transit via ${trimmedCourier} (AWB: ${trimmedAwb})`,
      },
    });

    // Record stage history whenever a pre-delivery order is auto-advanced to DELIVERY
    if (shouldAdvanceToDelivery) {
      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStage: order.internalStage,
          toStage: "DELIVERY",
          reason: `AWB ${trimmedAwb} (${trimmedCourier}) already in "${finalShipmentStatus}" — stage auto-advanced to DELIVERY via manual AWB entry.`,
          changedByUserId: user.id,
        },
      }).catch(() => {});
    }

    if (remark && String(remark).trim()) {
      await prisma.orderRemark.create({
        data: {
          orderId: order.id,
          shipmentId: updatedShipment.id,
          stage: newStage,
          text: `AWB updated to ${trimmedAwb} (${trimmedCourier}). ${String(remark).trim()}`,
          authorName: user.name || "Staff",
          authorId: user.id,
          authorEmail: user.email,
        },
      });
    }

    return NextResponse.json({ success: true, shipment: updatedShipment, advancedToDelivery: shouldAdvanceToDelivery });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
