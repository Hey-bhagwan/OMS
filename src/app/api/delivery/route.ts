import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter"); // e.g. exceptions, in_transit, delivered

    const where: any = {};
    if (filter === "exceptions") {
      where.normalizedStatus = { in: ["DELIVERY_EXCEPTION", "UNDELIVERED", "RTO"] };
    } else if (filter === "in_transit") {
      where.normalizedStatus = { in: ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"] };
    } else if (filter === "delivered") {
      where.normalizedStatus = "DELIVERED";
    }

    const shipments = await prisma.shipment.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        order: {
          include: {
            lines: { include: { sku: true } },
          },
        },
        events: {
          orderBy: { eventTimestamp: "desc" },
          take: 5,
        },
      },
    });

    return NextResponse.json({
      shipments: shipments.map((s) => ({
        id: s.id,
        awb: s.awbWaybill,
        courier: s.courierName,
        status: s.normalizedStatus,
        orderId: s.order?.id || null,
        orderCode: s.order?.uniwareOrderCode || s.uniwareOrderCode || "Unmatched",
        displayOrderCode: s.order?.displayOrderCode,
        destinationCity: s.order?.shippingAddressCity || s.currentScanLocation,
        lastScanLocation: s.currentScanLocation || "In Transit Hub",
        lastActivity: s.currentScanActivity || "Package moving towards destination hub",
        etd: s.etdDate,
        dispatchedAt: s.dispatchedAt,
        deliveredAt: s.deliveredAt,
        isUnmatched: s.isUnmatched,
        events: s.events.map((e) => ({
          id: e.id,
          activity: e.activity,
          location: e.location,
          timestamp: e.eventTimestamp,
        })),
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
