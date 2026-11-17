import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { shipmentService } from "@/server/integrations/shiprocket/service";
import { getSessionUser } from "@/server/auth/session";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const result = await shipmentService.reconcileExistingUnmatchedShipments();
    return NextResponse.json({
      success: true,
      message: `Reconciled ${result.reconciledCount} of ${result.checkedCount} unlinked shipments.`,
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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

    // Deduplicate shipments by orderId if multiple exist for the same order:
    // Prefer non-KOAL (real tracking) shipments and shipments with higher activity/status.
    const seenOrders = new Set<string>();
    const deduplicatedShipments: typeof shipments = [];

    // First pass: Sort order-linked shipments so real courier shipments come before dummy KOAL ones
    const sorted = [...shipments].sort((a, b) => {
      const aIsKoal = a.awbWaybill.toUpperCase().startsWith("KOAL");
      const bIsKoal = b.awbWaybill.toUpperCase().startsWith("KOAL");
      if (aIsKoal && !bIsKoal) return 1;
      if (!aIsKoal && bIsKoal) return -1;
      return (b.events.length || 0) - (a.events.length || 0);
    });

    for (const s of sorted) {
      if (s.orderId) {
        if (seenOrders.has(s.orderId)) {
          continue; // Skip secondary/duplicate shipment for this order
        }
        seenOrders.add(s.orderId);
      }
      deduplicatedShipments.push(s);
    }

    return NextResponse.json({
      shipments: deduplicatedShipments.map((s) => ({
        id: s.id,
        awb: s.awbWaybill,
        courier: s.courierName,
        status: s.normalizedStatus,
        orderId: s.order?.id || null,
        orderCode: s.order?.uniwareOrderCode || s.uniwareOrderCode || s.providerOrderId || "Awaiting Order Link",
        displayOrderCode: s.order?.displayOrderCode,
        destinationCity: s.order?.shippingAddressCity || s.currentScanLocation,
        lastScanLocation: s.currentScanLocation || "In Transit Hub",
        lastActivity: s.currentScanActivity || "Package moving towards destination hub",
        etd: s.etdDate,
        dispatchedAt: s.dispatchedAt,
        deliveredAt: s.deliveredAt,
        updatedAt: s.updatedAt,
        lastEventTime: s.events[0]?.eventTimestamp || s.updatedAt,
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
