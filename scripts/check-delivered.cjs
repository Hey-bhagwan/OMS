const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.shipment.findMany({
  where: { normalizedStatus: "DELIVERED" },
  select: { id: true, awbWaybill: true, courierName: true, currentScanActivity: true, providerStatus: true, deliveredAt: true },
  take: 20,
  orderBy: { updatedAt: "desc" },
}).then((r) => {
  r.forEach((s) =>
    console.log(s.awbWaybill, "|", s.courierName, "|", s.currentScanActivity?.substring(0, 60), "| deliveredAt:", s.deliveredAt)
  );
  p.$disconnect();
});
