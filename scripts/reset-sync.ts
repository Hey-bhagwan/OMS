import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const stuck = await prisma.integrationSyncRun.updateMany({
    where: { status: 'RUNNING' },
    data: { status: 'FAILED', completedAt: new Date(), errorMessage: 'Terminated during server restart/timeout' }
  });
  console.log('Reset stuck runs:', stuck.count);

  const deletedOrders = await prisma.order.deleteMany({});
  console.log('Deleted existing orders:', deletedOrders.count);

  const checkpoints = await prisma.integrationCheckpoint.deleteMany({});
  console.log('Reset checkpoints:', checkpoints.count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
