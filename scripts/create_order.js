const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        options[key] = next;
        i++;
      } else {
        options[key] = true;
      }
    }
  }
  return options;
}

function calculatePriority(deadline, internalStage, blocker) {
  const now = new Date();
  let score = 50;
  let isOverdue = false;

  if (deadline) {
    const msUntil = deadline.getTime() - now.getTime();
    if (msUntil < 0) {
      isOverdue = true;
      score += 40;
    } else if (msUntil < 24 * 3600 * 1000) {
      score += 25;
    } else if (msUntil < 48 * 3600 * 1000) {
      score += 15;
    }
  }

  if (blocker) score += 15;
  if (internalStage === "DELIVERY_EXCEPTION") score += 30;
  if (internalStage === "RAW_MATERIAL") score += 10;
  if (internalStage === "ON_HOLD") score -= 10;

  let label = "NORMAL";
  if (isOverdue) label = "OVERDUE";
  else if (score >= 85) label = "URGENT";
  else if (score >= 65) label = "HIGH";
  else if (score <= 35) label = "LOW";

  return { score, label };
}

async function createOrder() {
  const opts = parseArgs();

  console.log("==================================================");
  console.log("      Koa Living OMS — Create Order Script        ");
  console.log("==================================================");

  try {
    // 1. Fetch available SKUs
    const availableSkus = await prisma.sKU.findMany({
      where: { isActive: true },
      include: { finishedStock: true },
    });

    if (availableSkus.length === 0) {
      console.error("Error: No active SKUs found in database.");
      process.exit(1);
    }

    const skuQuery = (opts.sku || "").toUpperCase();
    const targetSku = skuQuery
      ? availableSkus.find((s) => s.code.toUpperCase().includes(skuQuery)) || availableSkus[0]
      : availableSkus[0];

    const quantity = parseInt(opts.qty || opts.quantity || "2", 10);
    const channel = (opts.channel || "AMAZON").toUpperCase();
    const destinationCountry = (opts.country || "IN").toUpperCase();
    const city = opts.city || (destinationCountry === "IN" ? "Mumbai" : "New York");
    const isExport = destinationCountry !== "IN" || opts.packaging === "EXPORT";
    const deadlineDays = parseInt(opts.days || "3", 10);
    const fulfillmentDeadline = new Date(Date.now() + deadlineDays * 24 * 3600 * 1000);

    const rmDecision = opts.rmDecision ? opts.rmDecision.toUpperCase() : undefined;
    const remark = opts.remark || (rmDecision === "UNAVAILABLE" ? "Awaiting factory marble quarry block shipment" : undefined);

    if (rmDecision === "UNAVAILABLE" && (!remark || !remark.trim())) {
      console.error("Error: --remark is required when --rmDecision is UNAVAILABLE");
      process.exit(1);
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderCode = opts.code || `KL-${Date.now().toString().slice(-4)}${randomSuffix}`;
    const displayCode = opts.displayCode || `${channel.slice(0, 3)}-${Date.now().toString().slice(-6)}`;
    const unitPrice = Number(targetSku.unitPrice || 48000);
    const totalAmount = unitPrice * quantity;

    console.log(`\nOrder Specifications:`);
    console.log(`• Order Code:         ${orderCode}`);
    console.log(`• Marketplace Code:   ${displayCode} (${channel})`);
    console.log(`• SKU:                ${targetSku.code} — ${targetSku.name}`);
    console.log(`• Quantity:           ${quantity} ${targetSku.unitOfManufacture || "PCS"}`);
    console.log(`• Packaging Profile:  ${isExport ? "EXPORT (Wooden Crate)" : "DOMESTIC (Standard Box)"}`);
    console.log(`• Destination:        ${city}, ${destinationCountry}`);
    console.log(`• Deadline:           ${fulfillmentDeadline.toISOString().split("T")[0]}`);
    if (rmDecision) {
      console.log(`• Raw Material Dec:   ${rmDecision} (${remark})`);
    }

    // 2. Execute Order creation and allocation atomically
    const result = await prisma.$transaction(async (tx) => {
      // Create Order
      const newOrder = await tx.order.create({
        data: {
          uniwareOrderCode: orderCode,
          displayOrderCode: displayCode,
          channel,
          source: "MANUAL_ENTRY",
          uniwareStatus: "PROCESSING",
          internalStage: "RAW_MATERIAL",
          packagingType: isExport ? "EXPORT" : "DOMESTIC",
          destinationCountry,
          shippingAddressCity: city,
          shippingAddressState: destinationCountry === "IN" ? "Maharashtra" : "NY",
          currency: destinationCountry === "IN" ? "INR" : "USD",
          totalAmount,
          fulfillmentDeadline,
          rawMaterialDecision: rmDecision,
          staffRemark: remark,
        },
      });

      // Create OrderLine
      const line = await tx.orderLine.create({
        data: {
          orderId: newOrder.id,
          skuId: targetSku.id,
          quantity,
          unitPrice,
          status: "CREATED",
        },
      });

      let remainingNeeded = quantity;
      let allocPacked = 0;
      let allocUnpacked = 0;
      let prodQty = 0;
      let blockedQty = 0;
      let pendingQty = 0;

      // Step 1: Check PACKED inventory (for domestic orders)
      if (remainingNeeded > 0 && !isExport) {
        const packedStock = await tx.finishedGoodsStock.findUnique({
          where: { skuId_bucket: { skuId: targetSku.id, bucket: "PACKED" } },
        });

        const availablePacked = packedStock ? Math.max(0, packedStock.quantityAvailable) : 0;
        const takePacked = Math.min(remainingNeeded, availablePacked);

        if (takePacked > 0) {
          remainingNeeded -= takePacked;
          allocPacked += takePacked;

          await tx.finishedGoodsStock.update({
            where: { id: packedStock.id },
            data: {
              quantityReserved: packedStock.quantityReserved + takePacked,
              quantityAvailable: packedStock.quantityAvailable - takePacked,
            },
          });

          await tx.inventoryReservation.create({
            data: {
              skuId: targetSku.id,
              orderLineId: line.id,
              bucket: "PACKED",
              quantity: takePacked,
              status: "RESERVED",
              idempotencyKey: `RES-PACK-${line.id}-${Date.now()}`,
            },
          });
        }
      }

      // Step 2: Check UNPACKED inventory (requires packing task)
      if (remainingNeeded > 0) {
        const unpackedStock = await tx.finishedGoodsStock.findUnique({
          where: { skuId_bucket: { skuId: targetSku.id, bucket: "UNPACKED" } },
        });

        const availableUnpacked = unpackedStock ? Math.max(0, unpackedStock.quantityAvailable) : 0;
        const takeUnpacked = Math.min(remainingNeeded, availableUnpacked);

        if (takeUnpacked > 0) {
          remainingNeeded -= takeUnpacked;
          allocUnpacked += takeUnpacked;

          await tx.finishedGoodsStock.update({
            where: { id: unpackedStock.id },
            data: {
              quantityReserved: unpackedStock.quantityReserved + takeUnpacked,
              quantityAvailable: unpackedStock.quantityAvailable - takeUnpacked,
            },
          });

          await tx.inventoryReservation.create({
            data: {
              skuId: targetSku.id,
              orderLineId: line.id,
              bucket: "UNPACKED",
              quantity: takeUnpacked,
              status: "RESERVED",
              idempotencyKey: `RES-UNPACK-${line.id}-${Date.now()}`,
            },
          });

          // Create Packing Task
          await tx.packingTask.create({
            data: {
              code: `PACK-${orderCode}-${line.id.substring(0, 4)}`,
              orderId: newOrder.id,
              orderLineId: line.id,
              skuId: targetSku.id,
              quantityRequired: takeUnpacked,
              packagingType: isExport ? "EXPORT" : "DOMESTIC",
              specialInstructions: isExport
                ? `ISPM-15 Certified Export Wooden Crate (${targetSku.exportPackingType || "Export Crate"})`
                : `Standard Domestic Pack (${targetSku.domesticPackingType || "Domestic Box"})`,
              status: "PENDING",
            },
          });
        }
      }

      // Step 3: Manufacturing Shortage handling
      if (remainingNeeded > 0) {
        if (rmDecision === "AVAILABLE") {
          await tx.productionOrder.create({
            data: {
              code: `PROD-${orderCode}-${line.id.substring(0, 4)}`,
              skuId: targetSku.id,
              orderLineId: line.id,
              quantityRequired: remainingNeeded,
              status: "READY",
              notes: `Manual creation work order for ${orderCode} (${remainingNeeded} units)`,
            },
          });
          prodQty += remainingNeeded;
          remainingNeeded = 0;
        } else if (rmDecision === "UNAVAILABLE") {
          const block = await tx.rawMaterialBlock.create({
            data: {
              orderId: newOrder.id,
              orderLineId: line.id,
              skuId: targetSku.id,
              blockedQuantity: remainingNeeded,
              status: "BLOCKED",
              reason: remark,
            },
          });

          await tx.orderRemark.create({
            data: {
              orderId: newOrder.id,
              orderLineId: line.id,
              rawMaterialBlockId: block.id,
              stage: "RAW_MATERIAL",
              quantity: remainingNeeded,
              text: remark,
              authorName: "CLI Script",
            },
          });

          blockedQty += remainingNeeded;
          remainingNeeded = 0;
        } else {
          // Default: PENDING_ASSESSMENT
          await tx.rawMaterialBlock.create({
            data: {
              orderId: newOrder.id,
              orderLineId: line.id,
              skuId: targetSku.id,
              blockedQuantity: remainingNeeded,
              status: "PENDING_ASSESSMENT",
              reason: "Awaiting manual raw-material availability assessment by factory staff",
            },
          });
          pendingQty += remainingNeeded;
          remainingNeeded = 0;
        }
      }

      // Determine internal stage & next action
      let finalStage = "DISPATCH";
      let blockerReason = null;
      let nextAction = "Verify packing and prepare courier dispatch handover";

      if (blockedQty > 0) {
        finalStage = "RAW_MATERIAL";
        blockerReason = `Production blocked: ${blockedQty} unit(s) marked blocked due to unavailable raw material.`;
        nextAction = "Review blocked raw-material queue entry and follow up with factory team";
      } else if (pendingQty > 0) {
        finalStage = "RAW_MATERIAL";
        blockerReason = `Pending assessment: ${pendingQty} unit(s) require manufacturing. Staff assessment needed.`;
        nextAction = `Production pending: ${pendingQty} units require manufacturing. Assess raw-material availability.`;
      } else if (prodQty > 0) {
        finalStage = "PRODUCTION";
        nextAction = `Active manufacturing in progress: Complete production work order for ${prodQty} unit(s)`;
      } else if (allocUnpacked > 0) {
        finalStage = "PACKING";
        nextAction = `Complete ${isExport ? "export wooden crating" : "domestic packaging"} for ${allocUnpacked} unit(s)`;
      }

      const priority = calculatePriority(fulfillmentDeadline, finalStage, blockerReason);

      // Update OrderLine
      await tx.orderLine.update({
        where: { id: line.id },
        data: {
          allocatedPackedQty: allocPacked,
          allocatedUnpackedQty: allocUnpacked,
          requiredProductionQty: prodQty,
          blockedRawMaterialQty: blockedQty,
          pendingAssessmentQty: pendingQty,
          packedCompletedQty: allocPacked,
          dispatchReadyQty: allocPacked,
        },
      });

      // Update Order
      const updatedOrder = await tx.order.update({
        where: { id: newOrder.id },
        data: {
          internalStage: finalStage,
          priorityScore: priority.score,
          priorityLabel: priority.label,
          blockerReason,
          nextAction,
        },
      });

      // Record WorkflowDecision
      await tx.workflowDecision.create({
        data: {
          orderId: newOrder.id,
          recommendedAction: nextAction,
          blockerReason,
          decisionReason: `Deterministic engine evaluation: ${allocPacked} packed, ${allocUnpacked} unpacked, ${prodQty} in prod, ${blockedQty} blocked, ${pendingQty} pending.`,
          ruleVersion: "v2.0",
          relevantQuantities: JSON.stringify({
            totalQuantity: quantity,
            allocatedPackedQty: allocPacked,
            allocatedUnpackedQty: allocUnpacked,
            inProductionQty: prodQty,
            blockedRawMaterialQty: blockedQty,
            pendingAssessmentQty: pendingQty,
          }),
        },
      });

      // Stage history
      await tx.orderStatusHistory.create({
        data: {
          orderId: newOrder.id,
          toStage: finalStage,
          reason: blockerReason || nextAction,
        },
      });

      return {
        order: updatedOrder,
        allocPacked,
        allocUnpacked,
        prodQty,
        blockedQty,
        pendingQty,
        finalStage,
        nextAction,
        blockerReason,
      };
    });

    console.log(`\n==================================================`);
    console.log(`   WORKFLOW ENGINE ALLOCATION RESULT`);
    console.log(`==================================================`);
    console.log(`• Order ID:            ${result.order.id}`);
    console.log(`• Order Code:          ${result.order.uniwareOrderCode}`);
    console.log(`• Resulting Stage:     ${result.finalStage}`);
    console.log(`• Priority Label:      ${result.order.priorityLabel} (Score: ${result.order.priorityScore})`);
    console.log(`• Recommended Action:  ${result.nextAction}`);
    if (result.blockerReason) {
      console.log(`• Blocker Reason:      ${result.blockerReason}`);
    }
    console.log(`• Inventory Breakdown:`);
    console.log(`  - Packed Stock Allocated:   ${result.allocPacked} / ${quantity}`);
    console.log(`  - Unpacked Stock Reserved:  ${result.allocUnpacked} / ${quantity}`);
    console.log(`  - Manufacturing (In Prod):  ${result.prodQty} / ${quantity}`);
    console.log(`  - Blocked in Raw Material:  ${result.blockedQty} / ${quantity}`);
    console.log(`  - Pending RM Assessment:    ${result.pendingQty} / ${quantity}`);
    console.log(`==================================================\n`);
    console.log(`Success! The order has been committed to PostgreSQL and is live in the OMS.\n`);

    process.exit(0);
  } catch (err) {
    console.error("\nFailed to create order:", err.message);
    process.exit(1);
  }
}

createOrder();
