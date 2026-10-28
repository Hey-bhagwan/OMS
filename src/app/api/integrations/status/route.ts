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
    const activeRun = recentSyncRuns.find((r) => r.status === "RUNNING");

    return NextResponse.json({
      activeSync: activeRun
        ? {
            id: activeRun.id,
            provider: activeRun.provider,
            syncType: activeRun.syncType,
            startedAt: activeRun.startedAt,
            recordsFetched: activeRun.recordsFetched,
            recordsUpserted: activeRun.recordsUpserted,
            recordsFailed: activeRun.recordsFailed,
          }
        : null,
      uniware: {
        baseUrl: process.env.UNIWARE_BASE_URL || "https://koaliving.unicommerce.com",
        usernameConfigured: !!(process.env.UNIWARE_AUTH_TOKEN?.trim() || (process.env.UNIWARE_USERNAME && process.env.UNIWARE_USERNAME !== "api_user")),
        authMode: process.env.UNIWARE_AUTH_TOKEN?.trim() ? "BEARER_TOKEN" : "OAUTH",
        fromDate: process.env.UNIWARE_FROM_DATE || null,
        lookbackDays: parseInt(process.env.UNIWARE_INITIAL_LOOKBACK_DAYS || "60", 10),
        pageSize: parseInt(process.env.UNIWARE_PAGE_SIZE || "50", 10),
        status: uniwareCp?.status || "NOT_SYNCED",
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
