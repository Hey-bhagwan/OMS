// Fix shipments wrongly marked DELIVERED where scan activity proves they're not delivered
// Heuristic: DELIVERED shipments whose currentScanActivity contains
// DISPATCHED, PICKUP GENERATED, PICKUP SCHEDULED, IN TRANSIT, MANIFESTED etc.
// These were incorrectly set by the Uniware COMPLETE→DELIVERED bug at 05:51 today.

const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const FALSE_DELIVERED_PATTERNS = [
  /PICKUP GENERATED/i,
  /PICKUP SCHEDULED/i,
  /DISPATCHED/i,
  /IN TRANSIT/i,
  /MANIFESTED/i,
  /OUT FOR PICKUP/i,
  /SHIPMENT CREATED/i,
  /READY FOR PICKUP/i,
];

async function main() {
  const delivered = await p.shipment.findMany({
    where: { normalizedStatus: "DELIVERED" },
    select: {
      id: true, awbWaybill: true, courierName: true,
      currentScanActivity: true, deliveredAt: true, orderId: true,
    },
  });

  console.log(`Total DELIVERED: ${delivered.length}`);
  let fixed = 0;

  for (const s of delivered) {
    const activity = s.currentScanActivity || "";
    const isFalse = FALSE_DELIVERED_PATTERNS.some((re) => re.test(activity));
    if (!isFalse) continue;

    console.log(`  FIXING: ${s.awbWaybill} | ${s.courierName} | ${activity}`);

    // Determine correct status from activity
    let correctStatus = "IN_TRANSIT";
    if (/PICKUP GENERATED|MANIFESTED|OUT FOR PICKUP|PICKUP SCHEDULED|READY FOR PICKUP|SHIPMENT CREATED/i.test(activity)) {
      correctStatus = "READY_FOR_PICKUP";
    }

    await p.shipment.update({
      where: { id: s.id },
      data: {
        normalizedStatus: correctStatus,
        deliveredAt: null, // Clear wrong timestamp
      },
    });

    // Walk back any order incorrectly moved to DELIVERED
    if (s.orderId) {
      const order = await p.order.findUnique({
        where: { id: s.orderId },
        select: { id: true, internalStage: true },
      });
      if (order && order.internalStage === "DELIVERED") {
        await p.order.update({
          where: { id: order.id },
          data: {
            internalStage: "DELIVERY",
            nextAction: `In transit via ${s.courierName || "carrier"} (AWB: ${s.awbWaybill})`,
            priorityScore: 10,
            priorityLabel: "NORMAL",
          },
        });
        console.log(`    ↳ Order reverted: DELIVERED → DELIVERY`);
      }
    }
    fixed++;
  }

  console.log(`\n✅ Fixed ${fixed} wrongly-DELIVERED shipment(s)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
