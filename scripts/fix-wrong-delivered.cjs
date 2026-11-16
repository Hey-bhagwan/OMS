// One-off fix: Reset shipments that were incorrectly marked DELIVERED
// because Uniware `dto.status === "COMPLETE"` was wrongly treated as delivered.
// 
// Heuristic: A shipment is WRONGLY marked DELIVERED if:
//   - normalizedStatus = DELIVERED
//   - deliveredAt IS NULL (carrier never actually confirmed with a timestamp)
//   - currentScanActivity contains keywords showing it's NOT actually delivered
//
// These will be reset to IN_TRANSIT so the check-status button can re-fetch real status.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Find DELIVERED shipments without a confirmed deliveredAt timestamp
  const suspicious = await prisma.shipment.findMany({
    where: {
      normalizedStatus: "DELIVERED",
      deliveredAt: null,  // No confirmed delivery timestamp
    },
    select: {
      id: true,
      awbWaybill: true,
      courierName: true,
      currentScanActivity: true,
      providerStatus: true,
      orderId: true,
    },
  });

  console.log(`Found ${suspicious.length} DELIVERED shipment(s) with no deliveredAt timestamp:`);

  let fixed = 0;
  for (const s of suspicious) {
    console.log(`  AWB: ${s.awbWaybill} | Activity: ${s.currentScanActivity} | ProviderStatus: ${s.providerStatus}`);
    
    // Reset to IN_TRANSIT — the next check-status run will get real carrier status
    await prisma.shipment.update({
      where: { id: s.id },
      data: { normalizedStatus: "IN_TRANSIT" },
    });

    // Also walk back the order if it was prematurely moved to DELIVERED
    if (s.orderId) {
      const order = await prisma.order.findUnique({
        where: { id: s.orderId },
        select: { id: true, internalStage: true },
      });
      if (order && order.internalStage === "DELIVERED") {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            internalStage: "DELIVERY",
            nextAction: `In transit via ${s.courierName || "carrier"} (AWB: ${s.awbWaybill}) — awaiting delivery confirmation`,
          },
        });
        console.log(`    ↳ Order reverted: DELIVERED → DELIVERY`);
      }
    }
    fixed++;
  }

  console.log(`\n✅ Fixed ${fixed} shipment(s) → reset to IN_TRANSIT`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
