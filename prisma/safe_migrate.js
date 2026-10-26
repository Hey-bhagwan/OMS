const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function runSafeMigration() {
  console.log("Running safe schema migrations on PostgreSQL...");

  const queries = [
    // 1. SKU columns
    `ALTER TABLE "SKU" ADD COLUMN IF NOT EXISTS "unitOfManufacture" TEXT DEFAULT 'PCS';`,
    `ALTER TABLE "SKU" ADD COLUMN IF NOT EXISTS "defaultLeadTimeDays" INTEGER DEFAULT 7;`,
    `ALTER TABLE "SKU" ADD COLUMN IF NOT EXISTS "productionNotes" TEXT;`,
    `ALTER TABLE "SKU" ADD COLUMN IF NOT EXISTS "qualityRequirements" TEXT;`,

    // 2. Order columns
    `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "staffRemark" TEXT;`,
    `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "rawMaterialDecision" TEXT;`,

    // 3. OrderLine columns
    `ALTER TABLE "OrderLine" ADD COLUMN IF NOT EXISTS "blockedRawMaterialQty" INTEGER DEFAULT 0;`,
    `ALTER TABLE "OrderLine" ADD COLUMN IF NOT EXISTS "pendingAssessmentQty" INTEGER DEFAULT 0;`,

    // 4. RawMaterialBlockStatus enum
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RawMaterialBlockStatus') THEN
        CREATE TYPE "RawMaterialBlockStatus" AS ENUM ('BLOCKED', 'PENDING_ASSESSMENT', 'RESOLVED', 'CANCELLED');
      END IF;
    END $$;`,

    // 5. RawMaterialBlock table
    `CREATE TABLE IF NOT EXISTS "RawMaterialBlock" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
      "orderLineId" TEXT NOT NULL REFERENCES "OrderLine"("id") ON DELETE CASCADE,
      "skuId" TEXT NOT NULL REFERENCES "SKU"("id") ON DELETE RESTRICT,
      "blockedQuantity" INTEGER NOT NULL DEFAULT 0,
      "releasedQuantity" INTEGER NOT NULL DEFAULT 0,
      "status" "RawMaterialBlockStatus" NOT NULL DEFAULT 'BLOCKED',
      "reason" TEXT NOT NULL,
      "assignedUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "resolvedAt" TIMESTAMP(3)
    );`,
    `CREATE INDEX IF NOT EXISTS "RawMaterialBlock_orderId_idx" ON "RawMaterialBlock"("orderId");`,
    `CREATE INDEX IF NOT EXISTS "RawMaterialBlock_orderLineId_idx" ON "RawMaterialBlock"("orderLineId");`,
    `CREATE INDEX IF NOT EXISTS "RawMaterialBlock_skuId_idx" ON "RawMaterialBlock"("skuId");`,
    `CREATE INDEX IF NOT EXISTS "RawMaterialBlock_status_idx" ON "RawMaterialBlock"("status");`,
    `CREATE INDEX IF NOT EXISTS "RawMaterialBlock_assignedUserId_idx" ON "RawMaterialBlock"("assignedUserId");`,

    // 6. OrderRemark table
    `CREATE TABLE IF NOT EXISTS "OrderRemark" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "orderId" TEXT REFERENCES "Order"("id") ON DELETE CASCADE,
      "orderLineId" TEXT,
      "rawMaterialBlockId" TEXT REFERENCES "RawMaterialBlock"("id") ON DELETE CASCADE,
      "productionOrderId" TEXT REFERENCES "ProductionOrder"("id") ON DELETE CASCADE,
      "packingTaskId" TEXT REFERENCES "PackingTask"("id") ON DELETE CASCADE,
      "shipmentId" TEXT REFERENCES "Shipment"("id") ON DELETE CASCADE,
      "stage" TEXT,
      "quantity" INTEGER,
      "text" TEXT NOT NULL,
      "authorName" TEXT NOT NULL,
      "authorEmail" TEXT,
      "authorId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE INDEX IF NOT EXISTS "OrderRemark_orderId_idx" ON "OrderRemark"("orderId");`,
    `CREATE INDEX IF NOT EXISTS "OrderRemark_rawMaterialBlockId_idx" ON "OrderRemark"("rawMaterialBlockId");`,
    `CREATE INDEX IF NOT EXISTS "OrderRemark_productionOrderId_idx" ON "OrderRemark"("productionOrderId");`,
    `CREATE INDEX IF NOT EXISTS "OrderRemark_packingTaskId_idx" ON "OrderRemark"("packingTaskId");`,
    `CREATE INDEX IF NOT EXISTS "OrderRemark_shipmentId_idx" ON "OrderRemark"("shipmentId");`,
    `CREATE INDEX IF NOT EXISTS "OrderRemark_createdAt_idx" ON "OrderRemark"("createdAt");`,

    // 7. WorkflowDecision table
    `CREATE TABLE IF NOT EXISTS "WorkflowDecision" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
      "recommendedAction" TEXT NOT NULL,
      "blockerReason" TEXT,
      "decisionReason" TEXT NOT NULL,
      "ruleVersion" TEXT NOT NULL DEFAULT '2.0',
      "relevantQuantities" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE INDEX IF NOT EXISTS "WorkflowDecision_orderId_idx" ON "WorkflowDecision"("orderId");`,
    `CREATE INDEX IF NOT EXISTS "WorkflowDecision_createdAt_idx" ON "WorkflowDecision"("createdAt");`,

    // 8. WorkflowConfiguration table
    `CREATE TABLE IF NOT EXISTS "WorkflowConfiguration" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "stage" "InternalStage" NOT NULL UNIQUE,
      "slaHours" INTEGER NOT NULL DEFAULT 24,
      "priorityWeight" INTEGER NOT NULL DEFAULT 10,
      "requiresSpecialCheck" BOOLEAN NOT NULL DEFAULT false,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
  ];

  for (const q of queries) {
    try {
      await prisma.$executeRawUnsafe(q);
      console.log("Executed successfully:", q.split("\n")[0].substring(0, 70));
    } catch (err) {
      console.error("Migration error executing query:", q, err.message);
      throw err;
    }
  }

  // Populate initial WorkflowConfiguration if empty
  const count = await prisma.workflowConfiguration.count().catch(() => 0);
  if (count === 0) {
    const defaultConfigs = [
      { stage: "RAW_MATERIAL", slaHours: 24, priorityWeight: 10 },
      { stage: "PRODUCTION", slaHours: 72, priorityWeight: 20 },
      { stage: "PACKING", slaHours: 24, priorityWeight: 15 },
      { stage: "DISPATCH", slaHours: 12, priorityWeight: 15 },
      { stage: "DELIVERY", slaHours: 96, priorityWeight: 10 },
      { stage: "DELIVERY_EXCEPTION", slaHours: 12, priorityWeight: 35 },
      { stage: "ON_HOLD", slaHours: 48, priorityWeight: 5 },
    ];
    for (const c of defaultConfigs) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "WorkflowConfiguration" ("id", "stage", "slaHours", "priorityWeight", "requiresSpecialCheck", "updatedAt")
         VALUES (gen_random_uuid()::text, '${c.stage}'::"InternalStage", ${c.slaHours}, ${c.priorityWeight}, false, CURRENT_TIMESTAMP)
         ON CONFLICT ("stage") DO NOTHING;`
      );
    }
    console.log("Seeded default WorkflowConfigurations.");
  }

  console.log("Migration completed safely without data loss!");
}

runSafeMigration()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
