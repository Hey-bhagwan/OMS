// One-off script: reset priorityScore + priorityLabel for all CANCELLED orders
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.order.updateMany({
    where: {
      internalStage: "CANCELLED",
      OR: [
        { priorityScore: { gt: 0 } },
        { priorityLabel: { not: "LOW" } },
      ],
    },
    data: {
      priorityScore: 0,
      priorityLabel: "LOW",
    },
  });

  console.log(`✅ Reset priority for ${result.count} cancelled order(s) → score: 0, label: LOW`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
