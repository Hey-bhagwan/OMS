import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getSessionUser } from "@/server/auth/session";

export async function GET(req: NextRequest) {
  try {
    const orders = await prisma.order.findMany({
      where: { internalStage: "DISPATCH" },
      orderBy: [{ priorityScore: "desc" }, { createdAt: "asc" }],
      include: {
        lines: { include: { sku: true } },
        shipments: true,
      },
    });

    return NextResponse.json({
      success: true,
      orders: orders.map((o) => ({
        id: o.id,
        orderCode: o.uniwareOrderCode,
        displayOrderCode: o.displayOrderCode,
        channel: o.channel,
        destinationCountry: o.destinationCountry,
        shippingAddressCity: o.shippingAddressCity,
        skuCode: o.lines[0]?.sku.code || "N/A",
        skuName: o.lines[0]?.sku.name || "N/A",
        quantity: o.lines.reduce((acc, l) => acc + l.quantity, 0),
        packedCompletedQty: o.lines.reduce((acc, l) => acc + l.packedCompletedQty, 0),
        fulfillmentDeadline: o.fulfillmentDeadline,
        priorityLabel: o.priorityLabel,
        blocker: o.blockerReason,
        nextAction: o.nextAction || "Assign courier & record AWB",
        awb: o.shipments[0]?.awbWaybill || null,
        courier: o.shipments[0]?.courierName || null,
        shipmentStatus: o.shipments[0]?.normalizedStatus || "PENDING_DISPATCH",
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId, courierName, awbWaybill, provider, remark } = await req.json();

    if (!orderId || !awbWaybill || !awbWaybill.trim()) {
      return NextResponse.json({ error: "orderId and awbWaybill are required" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { lines: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Validate packing readiness: total packed completed must equal total order qty
    const totalOrderQty = order.lines.reduce((acc, l) => acc + l.quantity, 0);
    const totalPackedQty = order.lines.reduce((acc, l) => acc + l.packedCompletedQty, 0);

    if (totalPackedQty < totalOrderQty) {
      return NextResponse.json(
        { error: `Cannot dispatch: packing is incomplete. Packed: ${totalPackedQty}/${totalOrderQty} units.` },
        { status: 400 }
      );
    }

    const shipmentProvider = provider === "SHIPROCKET_CARGO" ? "SHIPROCKET_CARGO" : "SHIPROCKET";
    const courier = courierName || (shipmentProvider === "SHIPROCKET_CARGO" ? "Shiprocket Cargo" : "Blue Dart");

    // Upsert shipment record
    const shipment = await prisma.shipment.upsert({
      where: {
        provider_awbWaybill: {
          provider: shipmentProvider,
          awbWaybill: awbWaybill.trim(),
        },
      },
      update: {
        orderId: order.id,
        uniwareOrderCode: order.uniwareOrderCode,
        courierName: courier,
        normalizedStatus: "PICKED_UP",
        dispatchedAt: new Date(),
        currentScanActivity: "Handed over to carrier at warehouse dispatch dock",
      },
      create: {
        provider: shipmentProvider,
        awbWaybill: awbWaybill.trim(),
        orderId: order.id,
        uniwareOrderCode: order.uniwareOrderCode,
        courierName: courier,
        normalizedStatus: "PICKED_UP",
        dispatchedAt: new Date(),
        currentScanActivity: "Handed over to carrier at warehouse dispatch dock",
      },
    });

    // Append ShipmentEvent
    await prisma.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        provider: shipmentProvider,
        awbWaybill: awbWaybill.trim(),
        providerStatus: "PICKED_UP",
        activity: "Physical courier handover confirmed at warehouse dispatch dock",
        location: "Warehouse Dispatch Hub",
        eventTimestamp: new Date(),
      },
    });

    // Advance order to DELIVERY stage
    await prisma.order.update({
      where: { id: order.id },
      data: {
        internalStage: "DELIVERY",
        nextAction: `In transit with ${courier} (AWB: ${awbWaybill.trim()})`,
        blockerReason: null,
      },
    });

    // Stage history
    const historyReason = remark?.trim()
      ? `Dispatched via ${courier} (AWB: ${awbWaybill.trim()}). Remark: ${remark.trim()}`
      : `Physical handover recorded via ${courier} (AWB: ${awbWaybill.trim()})`;

    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStage: order.internalStage,
        toStage: "DELIVERY",
        reason: historyReason,
        changedByUserId: user.id,
      },
    });

    // Persistent remark
    await prisma.orderRemark.create({
      data: {
        orderId: order.id,
        shipmentId: shipment.id,
        stage: "DISPATCH",
        text: historyReason,
        authorName: user.name,
        authorId: user.id,
        authorEmail: user.email,
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: "SHIPMENT",
        entityId: shipment.id,
        action: "DISPATCH_HANDOVER",
        actorId: user.id,
        actorEmail: user.email,
        changesJson: JSON.stringify({ awbWaybill, courier, provider }),
      },
    });

    return NextResponse.json({ success: true, shipment });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
