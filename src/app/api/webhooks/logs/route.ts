import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { parseShipmentWebhookPayload } from "@/server/integrations/shiprocket/parser";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
    const provider = searchParams.get("provider") || undefined;
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search")?.trim() || "";
    const sortBy = searchParams.get("sortBy") || "receivedAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const where: any = {};
    if (provider) {
      where.provider = provider;
    }
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { payloadJson: { contains: search, mode: "insensitive" } },
        { eventType: { contains: search, mode: "insensitive" } },
        { idempotencyKey: { contains: search, mode: "insensitive" } },
      ];
    }

    const validSortFields = ["receivedAt", "createdAt"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "receivedAt";

    const [total, receipts] = await Promise.all([
      prisma.webhookReceipt.count({ where }),
      prisma.webhookReceipt.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Extract identifiers to batch lookup shipments and orders
    const parsedList = receipts.map((r) => {
      let payload: any = {};
      try {
        payload = JSON.parse(r.payloadJson);
      } catch {
        payload = { raw: r.payloadJson };
      }

      let parsedNormalized: any = null;
      try {
        parsedNormalized = parseShipmentWebhookPayload(payload, r.provider);
      } catch (err) {
        // parser fallback
      }

      const awb = parsedNormalized?.awbWaybill || payload.awb || payload.waybill_no || null;
      const orderCode = parsedNormalized?.providerOrderId || payload.order_id || null;

      return {
        receipt: r,
        payload,
        parsedNormalized,
        awb: awb ? String(awb) : null,
        orderCode: orderCode ? String(orderCode) : null,
      };
    });

    const awbs = Array.from(new Set(parsedList.map((p) => p.awb).filter(Boolean))) as string[];

    const shipments = awbs.length > 0
      ? await prisma.shipment.findMany({
          where: { awbWaybill: { in: awbs } },
          include: {
            order: {
              select: {
                id: true,
                displayOrderCode: true,
                uniwareOrderCode: true,
                channel: true,
                internalStage: true,
                shippingAddressCity: true,
              },
            },
          },
        })
      : [];

    const shipmentMap = new Map<string, (typeof shipments)[0]>();
    for (const s of shipments) {
      shipmentMap.set(s.awbWaybill, s);
    }

    const logs = parsedList.map(({ receipt, payload, parsedNormalized, awb }) => {
      const shipment = awb ? shipmentMap.get(awb) : null;

      return {
        id: receipt.id,
        receivedAt: receipt.receivedAt,
        provider: receipt.provider,
        eventType: receipt.eventType,
        status: receipt.status,
        errorMessage: receipt.errorMessage,
        idempotencyKey: receipt.idempotencyKey,
        awb,
        courierName: parsedNormalized?.courierName || payload.courier_name || null,
        providerStatus: parsedNormalized?.providerStatus || payload.current_status || payload.status || null,
        normalizedStatus: parsedNormalized?.normalizedStatus || receipt.eventType,
        location: parsedNormalized?.scanLocation || null,
        activity: parsedNormalized?.activityDescription || null,
        eventTimestamp: parsedNormalized?.eventTimestamp || null,
        payloadReceived: payload,
        processedDetails: {
          parsed: parsedNormalized,
          shipment: shipment
            ? {
                id: shipment.id,
                normalizedStatus: shipment.normalizedStatus,
                currentScanLocation: shipment.currentScanLocation,
                currentScanActivity: shipment.currentScanActivity,
                matchConfidence: shipment.matchConfidence,
                isUnmatched: shipment.isUnmatched,
                updatedAt: shipment.updatedAt,
              }
            : null,
          matchedOrder: shipment?.order
            ? {
                id: shipment.order.id,
                displayOrderCode: shipment.order.displayOrderCode,
                uniwareOrderCode: shipment.order.uniwareOrderCode,
                channel: shipment.order.channel,
                internalStage: shipment.order.internalStage,
                shippingAddressCity: shipment.order.shippingAddressCity,
              }
            : null,
        },
      };
    });

    return NextResponse.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      logs,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
