
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function clearTestData() {
  console.log("==================================================");
  console.log("      KOA LIVING OMS - COMPLETE TEST RESET       ");
  console.log("==================================================");

  try {
    if (process.env.CONFIRM_PURGE_TEST_DATA !== "YES") {
      throw new Error(
        "Cancelled. Set CONFIRM_PURGE_TEST_DATA=YES to proceed."
      );
    }

    // Keep user accounts and configuration/settings.
    // Delete operational/test data, including audit logs.
    const preserveModels = new Set([
      "User",
      "Role",
      "Permission",
      "Configuration",
      "SystemConfig",
      "AppSetting",
    ]);

    const models = Object.keys(prisma)
      .filter((key) => {
        if (key.startsWith("$") || key.startsWith("_")) return false;
        const delegate = prisma[key];
        return delegate && typeof delegate.deleteMany === "function";
      })
      .filter((key) => {
        const modelName = key.charAt(0).toUpperCase() + key.slice(1);
        return !preserveModels.has(modelName);
      });

    console.log("Models selected for deletion:", models);

    await prisma.$transaction(
      async (tx) => {
        const remaining = new Set(models);
        const deletedCounts = {};

        // Delete in passes so dependent records can be removed first.
        // Database foreign-key constraints remain the final safeguard.
        let progress = true;

        while (remaining.size > 0 && progress) {
          progress = false;

          for (const model of [...remaining]) {
            try {
              const result = await tx[model].deleteMany({});
              deletedCounts[model] = result.count;
              remaining.delete(model);
              progress = true;
            } catch (error) {
              // Defer this model until its dependent records are removed.
              // Prisma transaction errors may abort the transaction, so
              // unresolved relations should be handled explicitly instead.
              throw new Error(
                `Could not delete model "${model}". ` +
                `Check its foreign-key dependencies. ` +
                `${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        }

        if (remaining.size > 0) {
          throw new Error(
            `Could not delete models: ${[...remaining].join(", ")}`
          );
        }

        console.log("Deleted record counts:", deletedCounts);
      },
      { timeout: 120000 }
    );

    console.log("\nTest database reset completed.");
    console.log("User accounts and selected configuration models were preserved.");
    console.log("Audit logs and operational records were deleted.");

  } catch (error) {
    console.error(
      "\nReset failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

clearTestData();
