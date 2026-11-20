import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getSessionUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export interface AttentionItem {
  id: string;
  category: "AWB_MISMATCH" | "UNMATCHED_WEBHOOK" | "SYNC_ERROR" | "CARRIER_ERROR";
  title: string;
  description: string;
  timestamp: string;
  severity: "high" | "medium" | "low";
  metadata: Record<string, any>;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const items: AttentionItem[] = [];

    // 1. Fetch AWB Mismatch items
    // (Shipments marked with isAwbMismatch or receipts with status AWB_MISMATCH)
    const mismatchShipments = await prisma.shipment.findMany({
      where: { isAwbMismatch: true },
      include: {
        order: {
          select: {
            id: true,
            displayOrderCode: true,
            uniwareOrderCode: true,
            channel: true,
            internalStage: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    for (const s of mismatchShipments) {
      let meta: any = {};
      try {
        if (s.mismatchDetails) meta = JSON.parse(s.mismatchDetails);
      } catch {}

      items.push({
        id: `mismatch-${s.id}`,
        category: "AWB_MISMATCH",
        title: `AWB Mismatch: Order #${meta.orderCode || s.order?.displayOrderCode || s.order?.uniwareOrderCode || s.providerOrderId || "Unknown"}`,
        description: `Incoming webhook received with AWB "${s.awbWaybill}" (${s.courierName}), but order currently has AWB "${meta.recordedAwb || "Different AWB"}" (${meta.recordedCourier || ""}).`,
        timestamp: s.updatedAt.toISOString(),
        severity: "high",
        metadata: {
          shipmentId: s.id,
          orderId: s.orderId || meta.orderId,
          orderCode: meta.orderCode || s.order?.displayOrderCode || s.order?.uniwareOrderCode || s.providerOrderId,
          recordedAwb: meta.recordedAwb,
          recordedCourier: meta.recordedCourier,
          incomingAwb: s.awbWaybill,
          incomingCourier: s.courierName,
          incomingStatus: s.normalizedStatus,
          provider: s.provider,
          activity: s.currentScanActivity,
          location: s.currentScanLocation,
        },
      });
    }

    // 2. Fetch Unmatched Webhook Receipts
    const unmatchedReceipts = await prisma.webhookReceipt.findMany({
      where: {
        status: { in: ["UNMATCHED", "FAILED"] },
      },
      orderBy: { receivedAt: "desc" },
      take: 20,
    });

    for (const r of unmatchedReceipts) {
      let payload: any = {};
      try {
        payload = JSON.parse(r.payloadJson);
      } catch {}

      const awb = payload.awb || payload.waybill_no || "N/A";
      const orderCode = payload.order_id || payload.sr_order_id || "N/A";

      items.push({
        id: `receipt-${r.id}`,
        category: "UNMATCHED_WEBHOOK",
        title: `Unmatched Webhook: Order #${orderCode} / AWB ${awb}`,
        description: r.errorMessage || `Webhook received from ${r.provider} but could not be matched to an active order in OMS or Unicommerce.`,
        timestamp: r.receivedAt.toISOString(),
        severity: "medium",
        metadata: {
          receiptId: r.id,
          provider: r.provider,
          awb,
          orderCode,
          eventType: r.eventType,
          error: r.errorMessage,
        },
      });
    }

    // 3. Fetch Recent Sync Errors (Unicommerce / Integrations)
    const failedSyncRuns = await prisma.integrationSyncRun.findMany({
      where: {
        OR: [
          { status: "FAILED" },
          { recordsFailed: { gt: 0 } },
        ],
      },
      orderBy: { startedAt: "desc" },
      take: 10,
    });

    for (const run of failedSyncRuns) {
      items.push({
        id: `sync-${run.id}`,
        category: "SYNC_ERROR",
        title: `${run.provider} Sync Error (${run.syncType})`,
        description: run.errorMessage || `${run.recordsFailed} order(s) failed during synchronization.`,
        timestamp: (run.completedAt || run.startedAt).toISOString(),
        severity: run.status === "FAILED" ? "high" : "medium",
        metadata: {
          syncRunId: run.id,
          provider: run.provider,
          syncType: run.syncType,
          recordsFetched: run.recordsFetched,
          recordsUpserted: run.recordsUpserted,
          recordsFailed: run.recordsFailed,
          logsJson: run.logsJson,
        },
      });
    }

    // 4. Fetch Carrier Check Errors / Delivery Exception Shipments
    const carrierErrorShipments = await prisma.shipment.findMany({
      where: {
        failureReason: { not: null },
      },
      include: {
        order: {
          select: {
            id: true,
            displayOrderCode: true,
            uniwareOrderCode: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    for (const s of carrierErrorShipments) {
      items.push({
        id: `carrier-error-${s.id}`,
        category: "CARRIER_ERROR",
        title: `Carrier Status Issue: AWB ${s.awbWaybill}`,
        description: s.failureReason || `Carrier API check encountered an issue for order ${s.order?.displayOrderCode || s.order?.uniwareOrderCode || s.uniwareOrderCode || "N/A"}.`,
        timestamp: s.updatedAt.toISOString(),
        severity: "medium",
        metadata: {
          shipmentId: s.id,
          orderId: s.orderId,
          orderCode: s.order?.displayOrderCode || s.order?.uniwareOrderCode,
          awb: s.awbWaybill,
          courier: s.courierName,
          status: s.normalizedStatus,
          failureReason: s.failureReason,
        },
      });
    }

    // 5. Fetch recent silent notifications (webhooks received for skipped AWBs)
    const recentSkippedReceipts = await prisma.webhookReceipt.findMany({
      where: { status: "SKIPPED_SILENT" },
      orderBy: { receivedAt: "desc" },
      take: 15,
    });

    const notifications = recentSkippedReceipts.map((r) => {
      let payload: any = {};
      try { payload = JSON.parse(r.payloadJson); } catch {}
      return {
        id: r.id,
        receivedAt: r.receivedAt.toISOString(),
        provider: r.provider,
        awb: payload.awb || payload.waybill_no || "N/A",
        orderCode: payload.order_id || "N/A",
        status: payload.current_status || payload.status || "UPDATE",
        message: r.errorMessage || `Webhook received for skipped AWB ${payload.awb} and silently ignored.`,
      };
    });

    // Sort attention items by timestamp descending
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      success: true,
      totalCount: items.length,
      items,
      notifications,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Attention API Error]:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
