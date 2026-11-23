const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const STATUS_PRECEDENCE = {
  UNKNOWN: 0,
  SHIPMENT_CREATED: 10,
  READY_FOR_PICKUP: 20,
  PICKED_UP: 30,
  IN_TRANSIT: 40,
  OUT_FOR_DELIVERY: 50,
  DELIVERY_EXCEPTION: 45,
  UNDELIVERED: 46,
  DELIVERED: 100,
  RTO: 105,
  RETURNED: 110,
  CANCELLED: 90,
};

async function main() {
  const orders = await prisma.order.findMany({
    include: { shipments: true },
  });

  let mergedCount = 0;
  for (const o of orders) {
    if (o.shipments.length > 1) {
      const byAwb = {};
      for (const s of o.shipments) {
        const awb = s.awbWaybill.trim();
        byAwb[awb] = byAwb[awb] || [];
        byAwb[awb].push(s);
      }

      for (const [awb, list] of Object.entries(byAwb)) {
        if (list.length > 1) {
          list.sort((a, b) => {
            const pa = STATUS_PRECEDENCE[a.normalizedStatus] || 0;
            const pb = STATUS_PRECEDENCE[b.normalizedStatus] || 0;
            if (pb !== pa) return pb - pa;
            return a.provider === 'UNIWARE' ? 1 : -1;
          });

          const winner = list[0];
          console.log(`Order ${o.uniwareOrderCode} AWB ${awb}: Keeping winner ${winner.id} (${winner.provider}, ${winner.normalizedStatus}, ${winner.courierName})`);

          for (let i = 1; i < list.length; i++) {
            const loser = list[i];
            console.log(`  Deleting duplicate ${loser.id} (${loser.provider}, ${loser.normalizedStatus})`);
            await prisma.shipmentEvent.updateMany({
              where: { shipmentId: loser.id },
              data: { shipmentId: winner.id },
            });
            await prisma.shipment.delete({ where: { id: loser.id } });
            mergedCount++;
          }
        }
      }
    }
  }

  console.log('Successfully cleaned and deduplicated shipments count:', mergedCount);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
