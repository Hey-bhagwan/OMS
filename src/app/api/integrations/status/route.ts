import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const checkpoints = await prisma.integrationCheckpoint.findMany();
    const recentSyncRuns = await prisma.integrationSyncRun.findMany({
      take: 10,
      orderBy: { startedAt: "desc" },
    });
    const unmatchedCount = await prisma.shipment.count({
      where: { isUnmatched: true },
    });
    const failedReceiptsCount = await prisma.webhookReceipt.count({
      where: { status: "FAILED" },
    });

    const uniwareCp = checkpoints.find((c) => c.provider === "UNIWARE");
    const shiprocketCp = checkpoints.find((c) => c.provider === "SHIPROCKET");

    return NextResponse.json({
      uniware: {
        baseUrl: process.env.UNIWARE_BASE_URL || "https://koaliving.unicommerce.com",
        usernameConfigured: !!process.env.UNIWARE_USERNAME,
        status: uniwareCp?.status || "CONNECTED",
        lastRunAt: uniwareCp?.lastRunAt,
        lastSuccessAt: uniwareCp?.lastSuccessAt,
        failureCount: uniwareCp?.failureCount || 0,
        lastError: uniwareCp?.lastError,
        syncIntervalSeconds: parseInt(process.env.UNIWARE_SYNC_INTERVAL_SECONDS || "300", 10),
      },
      shiprocket: {
        status: "ACTIVE",
        webhookEndpoint: "/api/webhooks/shiprocket",
        lastReceivedAt: shiprocketCp?.lastRunAt,
        unmatchedShipmentCount: unmatchedCount,
        failedEventCount: failedReceiptsCount,
      },
      recentRuns: recentSyncRuns.map((r) => ({
        id: r.id,
        provider: r.provider,
        syncType: r.syncType,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        status: r.status,
        recordsFetched: r.recordsFetched,
        recordsUpserted: r.recordsUpserted,
        recordsFailed: r.recordsFailed,
        errorMessage: r.errorMessage,
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
