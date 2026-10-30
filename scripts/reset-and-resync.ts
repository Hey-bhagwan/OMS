/**
 * reset-and-resync.ts
 *
 * 1. Deletes all order-related data (orders, lines, shipments, events,
 *    webhook receipts, audit logs, sync runs).
 * 2. Resets the Unicommerce sync checkpoint so the next sync starts fresh.
 * 3. Triggers a CREATED-date sync from yesterday 00:00 IST → now.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/reset-and-resync.ts
 *
 * ⚠️  DESTRUCTIVE — back up your DB first if needed.
 */

import { PrismaClient } from "@prisma/client";
import { UniwareSyncService } from "../src/server/integrations/uniware/sync";

const prisma = new PrismaClient();

async function main() {
  // ── Date range: yesterday 00:00 IST → now ──────────────────────────────────
  // IST = UTC+5:30  →  offset = 5.5 hours = 19800 seconds
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

  const nowUtc = new Date();
  const nowIst = new Date(nowUtc.getTime() + IST_OFFSET_MS);

  // Yesterday midnight in IST
  const yesterdayIst = new Date(nowIst);
  yesterdayIst.setDate(yesterdayIst.getDate() - 1);
  yesterdayIst.setHours(0, 0, 0, 0);

  // Convert back to UTC for Prisma / API calls
  const fromDate = new Date(yesterdayIst.getTime() - IST_OFFSET_MS);
  const toDate = nowUtc;

  console.log("=".repeat(60));
  console.log("OMS — Order Reset & Resync");
  console.log("=".repeat(60));
  console.log(`Sync window : ${fromDate.toISOString()} → ${toDate.toISOString()}`);
  console.log(`             (yesterday 00:00 IST → now)`);
  console.log("");

  // ── Step 1: Clear order-related tables ────────────────────────────────────
  console.log("Step 1/3  Clearing order-related data...");

  // Delete in dependency order (children before parents).
  // Prisma cascade handles most children, but explicit order avoids FK errors
  // on DBs where cascade isn't enforced at the DB level.

  const [
    webhookReceipts,
    auditLogs,
    syncRuns,
    shipmentEvents,
    shipments,
    orderRemarks,
    orderStatusHistories,
    orderLines,
    orders,
  ] = await Promise.all([
    prisma.webhookReceipt.deleteMany({}),
    prisma.auditLog.deleteMany({ where: { entityType: { in: ["SHIPMENT", "ORDER"] } } }),
    prisma.integrationSyncRun.deleteMany({ where: { provider: "UNIWARE" } }),
    prisma.shipmentEvent.deleteMany({}),
    prisma.shipment.deleteMany({}),
    prisma.orderRemark.deleteMany({}),
    prisma.orderStatusHistory.deleteMany({}),
    prisma.orderLine.deleteMany({}),
    prisma.order.deleteMany({}),
  ]);

  console.log(`  ✓ Orders deleted            : ${orders.count}`);
  console.log(`  ✓ Order lines deleted       : ${orderLines.count}`);
  console.log(`  ✓ Shipments deleted         : ${shipments.count}`);
  console.log(`  ✓ Shipment events deleted   : ${shipmentEvents.count}`);
  console.log(`  ✓ Webhook receipts deleted  : ${webhookReceipts.count}`);
  console.log(`  ✓ Order remarks deleted     : ${orderRemarks.count}`);
  console.log(`  ✓ Status histories deleted  : ${orderStatusHistories.count}`);
  console.log(`  ✓ Sync runs cleared         : ${syncRuns.count}`);
  console.log(`  ✓ Audit logs cleared        : ${auditLogs.count}`);
  console.log("");

  // ── Step 2: Reset Unicommerce sync checkpoint ──────────────────────────────
  console.log("Step 2/3  Resetting Unicommerce sync checkpoint...");

  await prisma.integrationCheckpoint.deleteMany({ where: { provider: "UNIWARE" } });
  console.log("  ✓ Checkpoint reset — next sync will use explicit date range");
  console.log("");

  // ── Step 3: Trigger fresh sync ─────────────────────────────────────────────
  console.log("Step 3/3  Fetching orders from Unicommerce...");
  console.log(`          dateType: CREATED`);
  console.log(`          from    : ${fromDate.toISOString()}`);
  console.log(`          to      : ${toDate.toISOString()}`);
  console.log("");

  const syncService = new UniwareSyncService();
  const result = await syncService.executeSync("INITIAL", "CREATED", {
    fromDate,
    toDate,
  });

  console.log("=".repeat(60));
  console.log("Sync complete");
  console.log(`  Status          : ${result.status}`);
  console.log(`  Records fetched : ${result.recordsFetched}`);
  console.log(`  Records upserted: ${result.recordsUpserted}`);
  console.log(`  Records failed  : ${result.recordsFailed}`);

  if (result.errorMessage) {
    console.log(`  Error           : ${result.errorMessage}`);
  }

  console.log("=".repeat(60));
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
