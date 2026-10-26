const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function clearTestData() {
  console.log("==================================================");
  console.log("    Koa Living OMS — Purging Test Orders Data     ");
  console.log("==================================================");

  try {
    const deletedCounts = await prisma.$transaction(async (tx) => {
      // 1. Delete dependent child records
      const remarks = await tx.orderRemark.deleteMany({});
      const rawBlocks = await tx.rawMaterialBlock.deleteMany({});
      const packingTasks = await tx.packingTask.deleteMany({});
      const prodOrders = await tx.productionOrder.deleteMany({});
      const reservations = await tx.inventoryReservation.deleteMany({});
      const stageHistory = await tx.orderStatusHistory.deleteMany({});
      const shipmentEvents = await tx.shipmentEvent.deleteMany({});
      const shipments = await tx.shipment.deleteMany({});
      const workflowDecisions = await tx.workflowDecision.deleteMany({});
      const orderLines = await tx.orderLine.deleteMany({});
      const orders = await tx.order.deleteMany({});
      const webhookReceipts = await tx.webhookReceipt.deleteMany({});
      const syncRuns = await tx.integrationSyncRun.deleteMany({});
      const checkpoints = await tx.integrationCheckpoint.deleteMany({});
      const transactions = await tx.inventoryTransaction.deleteMany({});

      // 2. Reset Finished Goods stock reservations to 0 and available = onHand
      const stocks = await tx.finishedGoodsStock.findMany();
      for (const s of stocks) {
        await tx.finishedGoodsStock.update({
          where: { id: s.id },
          data: {
            quantityReserved: 0,
            quantityAvailable: s.quantityOnHand,
          },
        });
      }

      return {
        orders: orders.count,
        orderLines: orderLines.count,
        rawBlocks: rawBlocks.count,
        prodOrders: prodOrders.count,
        packingTasks: packingTasks.count,
        shipments: shipments.count,
        remarks: remarks.count,
        stageHistory: stageHistory.count,
        reservations: reservations.count,
        workflowDecisions: workflowDecisions.count,
        syncRuns: syncRuns.count,
        checkpoints: checkpoints.count,
      };
    });

    console.log("\nPurge completed successfully!");
    console.log(`• Orders deleted:              ${deletedCounts.orders}`);
    console.log(`• Order Lines deleted:        ${deletedCounts.orderLines}`);
    console.log(`• Raw Material Blocks deleted:${deletedCounts.rawBlocks}`);
    console.log(`• Production Orders deleted:  ${deletedCounts.prodOrders}`);
    console.log(`• Packing Tasks deleted:      ${deletedCounts.packingTasks}`);
    console.log(`• Shipments deleted:          ${deletedCounts.shipments}`);
    console.log(`• Remarks deleted:            ${deletedCounts.remarks}`);
    console.log(`• Stage History deleted:      ${deletedCounts.stageHistory}`);
    console.log(`• Checkpoints & Syncs reset:  ${deletedCounts.checkpoints + deletedCounts.syncRuns}`);
    console.log("• Finished goods stock reservations reset to 0.");
    console.log("• User accounts, SKUs catalog, and configurations PRESERVED.\n");

    // Verify remaining count
    const remainingOrders = await prisma.order.count();
    const remainingUsers = await prisma.user.count();
    const remainingSkus = await prisma.sKU.count();
    console.log(`Current DB Status: ${remainingOrders} orders, ${remainingSkus} SKUs, ${remainingUsers} users.\n`);

    process.exit(0);
  } catch (err) {
    console.error("Purge failed:", err.message);
    process.exit(1);
  }
}

clearTestData();
