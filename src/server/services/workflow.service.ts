import { prisma } from "../db/prisma";
import { InternalStage, PackagingType, ReservationStatus, RawMaterialBlockStatus } from "@prisma/client";

export interface PriorityCalculationResult {
  score: number;
  label: "LOW" | "NORMAL" | "HIGH" | "URGENT" | "OVERDUE";
  isOverdue: boolean;
}

export function calculateOrderPriority(params: {
  fulfillmentDeadline?: Date | null;
  internalStage: InternalStage;
  blockerReason?: string | null;
  createdAt: Date;
}): PriorityCalculationResult {
  const { fulfillmentDeadline, internalStage, blockerReason, createdAt } = params;
  const now = new Date();
  let score = 50; // base score

  // Order age factor (each day adds 3 points, up to 30 max)
  const ageDays = Math.floor((now.getTime() - createdAt.getTime()) / (24 * 3600 * 1000));
  score += Math.min(30, Math.max(0, ageDays * 3));

  let isOverdue = false;

  // Deadline evaluation
  if (fulfillmentDeadline) {
    const msUntilDeadline = fulfillmentDeadline.getTime() - now.getTime();
    if (msUntilDeadline < 0) {
      isOverdue = true;
      score += 40; // Overdue penalty
    } else if (msUntilDeadline < 24 * 3600 * 1000) {
      score += 25; // Due within 24 hours
    } else if (msUntilDeadline < 48 * 3600 * 1000) {
      score += 15; // Due within 48 hours
    }
  }

  // Blocker factor
  if (blockerReason) {
    score += 15;
  }

  // Stage weight
  if (internalStage === "DELIVERY_EXCEPTION") score += 30;
  if (internalStage === "RAW_MATERIAL") score += 10;
  if (internalStage === "ON_HOLD") score -= 10;

  let label: "LOW" | "NORMAL" | "HIGH" | "URGENT" | "OVERDUE" = "NORMAL";
  if (isOverdue) {
    label = "OVERDUE";
  } else if (score >= 85) {
    label = "URGENT";
  } else if (score >= 65) {
    label = "HIGH";
  } else if (score <= 35) {
    label = "LOW";
  }

  return { score, label, isOverdue };
}

export interface WorkflowEvaluationResult {
  orderId: string;
  internalStage: InternalStage;
  recommendedAction: string;
  blockerReason: string | null;
  relevantQuantities: {
    totalQuantity: number;
    allocatedPackedQty: number;
    allocatedUnpackedQty: number;
    inProductionQty: number;
    blockedRawMaterialQty: number;
    pendingAssessmentQty: number;
    packedCompletedQty: number;
  };
}

export class WorkflowService {
  /**
   * Run deterministic server-side next-action evaluation and finished-goods allocation for an order.
   *
   * Business Rules:
   * 1. Cancelled orders never create tasks and release any existing reservations.
   * 2. On-hold orders never automatically advance.
   * 3. Allocate available PACKED stock (domestic profile). For export orders, export crating requirements apply.
   * 4. Allocate available UNPACKED stock and create/update PackingTask.
   * 5. For remaining manufacturing quantity:
   *    - Human user must decide raw material availability.
   *    - If user decision is AVAILABLE: create/update Production work order.
   *    - If user decision is UNAVAILABLE: record RawMaterialBlock and block quantity.
   *    - If user decision is PENDING_ASSESSMENT (or unstated): mark awaiting assessment.
   * 6. When production is completed, output enters UNPACKED stock and PackingTask is created.
   * 7. When all quantities are packed, order is ready for DISPATCH.
   */
  public async allocateOrder(orderId: string, actorId?: string): Promise<WorkflowEvaluationResult> {
    return await prisma.$transaction(
      async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          lines: {
            include: {
              sku: true,
              rawMaterialBlocks: {
                where: { status: { in: ["BLOCKED", "PENDING_ASSESSMENT"] } },
              },
              productionOrders: {
                where: { status: { not: "CANCELLED" } },
              },
              packingTasks: {
                where: { status: { not: "CANCELLED" } },
              },
              reservations: {
                where: { status: "RESERVED" },
              },
            },
          },
          shipments: true,
        },
      });

      if (!order) throw new Error(`Order #${orderId} not found`);

      // 1. Cancelled orders
      if (order.internalStage === "CANCELLED") {
        // Release any remaining reservations
        for (const line of order.lines) {
          const reservations = line.reservations;
          for (const res of reservations) {
            await tx.inventoryReservation.update({
              where: { id: res.id },
              data: { status: "RELEASED", releasedAt: new Date() },
            });
            const stock = await tx.finishedGoodsStock.findUnique({
              where: { skuId_bucket: { skuId: res.skuId, bucket: res.bucket } },
            });
            if (stock) {
              const newReserved = Math.max(0, stock.quantityReserved - res.quantity);
              await tx.finishedGoodsStock.update({
                where: { id: stock.id },
                data: {
                  quantityReserved: newReserved,
                  quantityAvailable: stock.quantityOnHand - newReserved,
                },
              });
            }
          }
        }
        return {
          orderId: order.id,
          internalStage: "CANCELLED",
          recommendedAction: "Order is cancelled. No further action required.",
          blockerReason: "Order cancelled",
          relevantQuantities: {
            totalQuantity: 0,
            allocatedPackedQty: 0,
            allocatedUnpackedQty: 0,
            inProductionQty: 0,
            blockedRawMaterialQty: 0,
            pendingAssessmentQty: 0,
            packedCompletedQty: 0,
          },
        };
      }

      // 2. Orders on Hold
      if (order.internalStage === "ON_HOLD") {
        return {
          orderId: order.id,
          internalStage: "ON_HOLD",
          recommendedAction: "Order is on hold. Resolve hold blocker before advancing.",
          blockerReason: order.blockerReason || "Manual hold placed by operations",
          relevantQuantities: {
            totalQuantity: order.lines.reduce((acc, l) => acc + l.quantity, 0),
            allocatedPackedQty: order.lines.reduce((acc, l) => acc + l.allocatedPackedQty, 0),
            allocatedUnpackedQty: order.lines.reduce((acc, l) => acc + l.allocatedUnpackedQty, 0),
            inProductionQty: order.lines.reduce((acc, l) => acc + l.requiredProductionQty, 0),
            blockedRawMaterialQty: order.lines.reduce((acc, l) => acc + l.blockedRawMaterialQty, 0),
            pendingAssessmentQty: order.lines.reduce((acc, l) => acc + l.pendingAssessmentQty, 0),
            packedCompletedQty: order.lines.reduce((acc, l) => acc + l.packedCompletedQty, 0),
          },
        };
      }

      const isExport = order.destinationCountry !== "IN" || order.packagingType === "EXPORT";

      let totalOrderQty = 0;
      let totalAllocPacked = 0;
      let totalAllocUnpacked = 0;
      let totalInProduction = 0;
      let totalBlockedRaw = 0;
      let totalPendingRaw = 0;
      let totalPackedCompleted = 0;

      let detectedStage: InternalStage = "DISPATCH";
      let activeBlocker: string | null = null;
      let nextActionDesc = "Verify packing and prepare courier dispatch handover";

      for (const line of order.lines) {
        totalOrderQty += line.quantity;

        // Existing reservations check
        const existingPackedRes = line.reservations.filter((r) => r.bucket === "PACKED").reduce((a, b) => a + b.quantity, 0);
        const existingUnpackedRes = line.reservations.filter((r) => r.bucket === "UNPACKED").reduce((a, b) => a + b.quantity, 0);

        // Existing active production qty
        const existingProdQty = line.productionOrders.reduce((a, b) => a + b.quantityRequired, 0);

        // Existing active blocked / pending blocks
        const activeBlockedBlocks = line.rawMaterialBlocks.filter((b) => b.status === "BLOCKED");
        const activePendingBlocks = line.rawMaterialBlocks.filter((b) => b.status === "PENDING_ASSESSMENT");
        const currentBlockedQty = activeBlockedBlocks.reduce((a, b) => a + (b.blockedQuantity - b.releasedQuantity), 0);
        const currentPendingQty = activePendingBlocks.reduce((a, b) => a + (b.blockedQuantity - b.releasedQuantity), 0);

        let remainingNeeded = line.quantity - (existingPackedRes + existingUnpackedRes + existingProdQty + currentBlockedQty + currentPendingQty);
        remainingNeeded = Math.max(0, remainingNeeded);

        let allocPacked = existingPackedRes;
        let allocUnpacked = existingUnpackedRes;
        let prodQty = existingProdQty;
        let blockedQty = currentBlockedQty;
        let pendingQty = currentPendingQty;

        // Step 1: Check PACKED Finished-Goods Inventory (if not export or if already packed for export)
        if (remainingNeeded > 0 && !isExport) {
          const packedStock = await tx.finishedGoodsStock.findUnique({
            where: { skuId_bucket: { skuId: line.skuId, bucket: "PACKED" } },
          });

          const availablePacked = packedStock ? Math.max(0, packedStock.quantityAvailable) : 0;
          const newAllocPacked = Math.min(remainingNeeded, availablePacked);

          if (newAllocPacked > 0) {
            remainingNeeded -= newAllocPacked;
            allocPacked += newAllocPacked;

            await tx.finishedGoodsStock.update({
              where: { id: packedStock!.id },
              data: {
                quantityReserved: packedStock!.quantityReserved + newAllocPacked,
                quantityAvailable: packedStock!.quantityAvailable - newAllocPacked,
              },
            });

            await tx.inventoryReservation.create({
              data: {
                skuId: line.skuId,
                orderLineId: line.id,
                bucket: "PACKED",
                quantity: newAllocPacked,
                status: "RESERVED",
                idempotencyKey: `RES-PACKED-${line.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              },
            });
          }
        }

        // Step 2: Check UNPACKED Finished-Goods Inventory (needs packing task)
        if (remainingNeeded > 0) {
          const unpackedStock = await tx.finishedGoodsStock.findUnique({
            where: { skuId_bucket: { skuId: line.skuId, bucket: "UNPACKED" } },
          });

          const availableUnpacked = unpackedStock ? Math.max(0, unpackedStock.quantityAvailable) : 0;
          const newAllocUnpacked = Math.min(remainingNeeded, availableUnpacked);

          if (newAllocUnpacked > 0) {
            remainingNeeded -= newAllocUnpacked;
            allocUnpacked += newAllocUnpacked;

            await tx.finishedGoodsStock.update({
              where: { id: unpackedStock!.id },
              data: {
                quantityReserved: unpackedStock!.quantityReserved + newAllocUnpacked,
                quantityAvailable: unpackedStock!.quantityAvailable - newAllocUnpacked,
              },
            });

            await tx.inventoryReservation.create({
              data: {
                skuId: line.skuId,
                orderLineId: line.id,
                bucket: "UNPACKED",
                quantity: newAllocUnpacked,
                status: "RESERVED",
                idempotencyKey: `RES-UNPACKED-${line.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              },
            });

            // Create/update packing task without duplicating
            const existingTask = line.packingTasks.find((t) => t.status === "PENDING" || t.status === "IN_PROGRESS");
            if (existingTask) {
              await tx.packingTask.update({
                where: { id: existingTask.id },
                data: { quantityRequired: existingTask.quantityRequired + newAllocUnpacked },
              });
            } else {
              await tx.packingTask.create({
                data: {
                  code: `PACK-${order.uniwareOrderCode}-${line.id.substring(0, 4)}`,
                  orderId: order.id,
                  orderLineId: line.id,
                  skuId: line.skuId,
                  quantityRequired: newAllocUnpacked,
                  packagingType: isExport ? "EXPORT" : "DOMESTIC",
                  specialInstructions: isExport
                    ? `ISPM-15 Certified Export Wooden Crate (${line.sku.exportPackingType || "Export Crate"})`
                    : `Standard Domestic Pack (${line.sku.domesticPackingType || "Domestic Box"})`,
                  status: "PENDING",
                },
              });
            }
          }
        }

        // Step 3: Handle remaining quantity requiring manufacturing
        // CRITICAL RULE: No BOM calculation. Human user explicitly decides.
        if (remainingNeeded > 0) {
          if (order.rawMaterialDecision === "AVAILABLE") {
            // User confirmed raw material available -> Create/update ProductionOrder
            const existingProd = line.productionOrders.find((p) => p.status === "READY" || p.status === "IN_PROGRESS");
            if (existingProd) {
              await tx.productionOrder.update({
                where: { id: existingProd.id },
                data: { quantityRequired: existingProd.quantityRequired + remainingNeeded },
              });
            } else {
              await tx.productionOrder.create({
                data: {
                  code: `PROD-${order.uniwareOrderCode}-${line.id.substring(0, 4)}`,
                  skuId: line.skuId,
                  orderLineId: line.id,
                  quantityRequired: remainingNeeded,
                  status: "READY",
                  notes: `Auto-generated work order for ${order.displayOrderCode || order.uniwareOrderCode} (${remainingNeeded} units)`,
                },
              });
            }
            prodQty += remainingNeeded;
            remainingNeeded = 0;
          } else if (order.rawMaterialDecision === "UNAVAILABLE") {
            // User confirmed raw material UNAVAILABLE -> Put in Raw Material Blocked Queue
            const existingBlock = line.rawMaterialBlocks.find((b) => b.status === "BLOCKED");
            if (existingBlock) {
              await tx.rawMaterialBlock.update({
                where: { id: existingBlock.id },
                data: { blockedQuantity: existingBlock.blockedQuantity + remainingNeeded },
              });
            } else {
              await tx.rawMaterialBlock.create({
                data: {
                  orderId: order.id,
                  orderLineId: line.id,
                  skuId: line.skuId,
                  blockedQuantity: remainingNeeded,
                  status: "BLOCKED",
                  reason: order.staffRemark || "Marked blocked: Raw material unavailable for manufacturing",
                  assignedUserId: order.assignedUserId,
                },
              });
            }
            blockedQty += remainingNeeded;
            remainingNeeded = 0;
          } else {
            // Decision is PENDING ASSESSMENT (or unstated)
            const existingPending = line.rawMaterialBlocks.find((b) => b.status === "PENDING_ASSESSMENT");
            if (existingPending) {
              await tx.rawMaterialBlock.update({
                where: { id: existingPending.id },
                data: { blockedQuantity: existingPending.blockedQuantity + remainingNeeded },
              });
            } else {
              await tx.rawMaterialBlock.create({
                data: {
                  orderId: order.id,
                  orderLineId: line.id,
                  skuId: line.skuId,
                  blockedQuantity: remainingNeeded,
                  status: "PENDING_ASSESSMENT",
                  reason: "Awaiting manual raw-material availability assessment by factory staff",
                  assignedUserId: order.assignedUserId,
                },
              });
            }
            pendingQty += remainingNeeded;
            remainingNeeded = 0;
          }
        }

        // Calculate packedCompletedQty
        const packedCompleted = allocPacked + (line.packingTasks.reduce((a, b) => a + b.quantityCompleted, 0));

        // Update OrderLine with reconciled quantities
        await tx.orderLine.update({
          where: { id: line.id },
          data: {
            allocatedPackedQty: allocPacked,
            allocatedUnpackedQty: allocUnpacked,
            requiredProductionQty: prodQty,
            blockedRawMaterialQty: blockedQty,
            pendingAssessmentQty: pendingQty,
            packedCompletedQty: packedCompleted,
            dispatchReadyQty: packedCompleted,
          },
        });

        totalAllocPacked += allocPacked;
        totalAllocUnpacked += allocUnpacked;
        totalInProduction += prodQty;
        totalBlockedRaw += blockedQty;
        totalPendingRaw += pendingQty;
        totalPackedCompleted += packedCompleted;
      }

      // Determine overall stage and next recommended action
      if (totalBlockedRaw > 0) {
        detectedStage = "RAW_MATERIAL";
        activeBlocker = `Production blocked: ${totalBlockedRaw} unit(s) marked blocked due to unavailable raw material.`;
        nextActionDesc = `Review blocked raw-material queue entry and follow up with factory team`;
      } else if (totalPendingRaw > 0) {
        detectedStage = "RAW_MATERIAL";
        activeBlocker = `Pending assessment: ${totalPendingRaw} unit(s) require manufacturing. Staff assessment needed.`;
        nextActionDesc = `Production pending: ${totalPendingRaw} units require manufacturing. Assess raw-material availability.`;
      } else if (totalInProduction > 0) {
        detectedStage = "PRODUCTION";
        nextActionDesc = `Active manufacturing in progress: Complete production work orders for ${totalInProduction} unit(s)`;
      } else if (totalAllocUnpacked > 0 && totalPackedCompleted < totalOrderQty) {
        detectedStage = "PACKING";
        nextActionDesc = `Complete ${isExport ? "export wooden crating" : "domestic packaging"} for ${totalOrderQty - totalPackedCompleted} unit(s)`;
      } else if (totalPackedCompleted >= totalOrderQty) {
        // All items packed
        if (order.shipments && order.shipments.length > 0) {
          const latestShipment = order.shipments[0];
          if (latestShipment.normalizedStatus === "DELIVERED") {
            detectedStage = "DELIVERY";
            nextActionDesc = "Delivered to recipient. Order fulfilled.";
          } else if (latestShipment.normalizedStatus === "DELIVERY_EXCEPTION") {
            detectedStage = "DELIVERY_EXCEPTION";
            activeBlocker = latestShipment.currentScanActivity || "Delivery exception flagged by courier";
            nextActionDesc = "Coordinate re-attempt or contact customer";
          } else if (latestShipment.normalizedStatus === "RTO" || latestShipment.normalizedStatus === "RETURNED") {
            detectedStage = "RTO";
            activeBlocker = "Shipment in Return to Origin";
            nextActionDesc = "Inspect returned goods upon warehouse arrival";
          } else {
            detectedStage = "DELIVERY";
            nextActionDesc = `In transit via ${latestShipment.courierName} (AWB: ${latestShipment.awbWaybill})`;
          }
        } else {
          detectedStage = "DISPATCH";
          nextActionDesc = "All units packed and ready. Hand over parcel to courier and record AWB.";
        }
      }

      // Calculate priority
      const priority = calculateOrderPriority({
        fulfillmentDeadline: order.fulfillmentDeadline,
        internalStage: detectedStage,
        blockerReason: activeBlocker,
        createdAt: order.createdAt,
      });

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          internalStage: detectedStage,
          priorityScore: priority.score,
          priorityLabel: priority.label,
          blockerReason: activeBlocker,
          nextAction: nextActionDesc,
        },
      });

      // Record WorkflowDecision record
      const relevantQuantities = {
        totalQuantity: totalOrderQty,
        allocatedPackedQty: totalAllocPacked,
        allocatedUnpackedQty: totalAllocUnpacked,
        inProductionQty: totalInProduction,
        blockedRawMaterialQty: totalBlockedRaw,
        pendingAssessmentQty: totalPendingRaw,
        packedCompletedQty: totalPackedCompleted,
      };

      await tx.workflowDecision.create({
        data: {
          orderId: order.id,
          recommendedAction: nextActionDesc,
          blockerReason: activeBlocker,
          decisionReason: `Deterministic engine evaluation: ${totalPackedCompleted}/${totalOrderQty} packed, ${totalInProduction} in prod, ${totalBlockedRaw} blocked, ${totalPendingRaw} pending.`,
          ruleVersion: "v2.0",
          relevantQuantities: JSON.stringify(relevantQuantities),
        },
      });

      // If stage changed, record stage history
      if (order.internalStage !== detectedStage) {
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStage: order.internalStage,
            toStage: detectedStage,
            reason: activeBlocker || nextActionDesc,
            changedByUserId: actorId,
          },
        });
      }

      return {
        orderId: order.id,
        internalStage: detectedStage,
        recommendedAction: nextActionDesc,
        blockerReason: activeBlocker,
        relevantQuantities,
      };
    }, { timeout: 60000, maxWait: 10000 });
  }

  /**
   * Record explicit manual raw-material availability decision by user
   */
  public async setRawMaterialDecision(params: {
    orderId: string;
    orderLineId?: string;
    decision: "AVAILABLE" | "UNAVAILABLE" | "PENDING_ASSESSMENT";
    quantity?: number;
    remark?: string;
    assignedUserId?: string;
    actorId?: string;
    actorName?: string;
  }) {
    const { orderId, orderLineId, decision, quantity, remark, assignedUserId, actorId, actorName } = params;

    if (decision === "UNAVAILABLE" && (!remark || !remark.trim())) {
      throw new Error("A meaningful remark is mandatory when marking raw material unavailable");
    }

    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { lines: true },
      });
      if (!order) throw new Error(`Order #${orderId} not found`);

      // Record user decision on Order
      await tx.order.update({
        where: { id: orderId },
        data: {
          rawMaterialDecision: decision,
          assignedUserId: assignedUserId || order.assignedUserId,
          staffRemark: remark ? remark.trim() : order.staffRemark,
        },
      });

      const line = orderLineId
        ? order.lines.find((l) => l.id === orderLineId)
        : order.lines[0];

      if (!line) throw new Error(`Order line not found for order #${orderId}`);

      const affectedQty = quantity && quantity > 0 ? quantity : line.quantity;

      if (decision === "UNAVAILABLE") {
        // Create or update RawMaterialBlock queue entry
        const block = await tx.rawMaterialBlock.create({
          data: {
            orderId: order.id,
            orderLineId: line.id,
            skuId: line.skuId,
            blockedQuantity: affectedQty,
            status: "BLOCKED",
            reason: remark!.trim(),
            assignedUserId: assignedUserId || order.assignedUserId,
          },
        });

        // Add persistent remark
        await tx.orderRemark.create({
          data: {
            orderId: order.id,
            orderLineId: line.id,
            rawMaterialBlockId: block.id,
            stage: "RAW_MATERIAL",
            quantity: affectedQty,
            text: remark!.trim(),
            authorName: actorName || "Staff User",
            authorId: actorId,
          },
        });
      } else if (decision === "PENDING_ASSESSMENT") {
        const block = await tx.rawMaterialBlock.create({
          data: {
            orderId: order.id,
            orderLineId: line.id,
            skuId: line.skuId,
            blockedQuantity: affectedQty,
            status: "PENDING_ASSESSMENT",
            reason: remark?.trim() || "Awaiting manual raw-material assessment",
            assignedUserId: assignedUserId || order.assignedUserId,
          },
        });

        if (remark?.trim()) {
          await tx.orderRemark.create({
            data: {
              orderId: order.id,
              orderLineId: line.id,
              rawMaterialBlockId: block.id,
              stage: "RAW_MATERIAL",
              quantity: affectedQty,
              text: remark.trim(),
              authorName: actorName || "Staff User",
              authorId: actorId,
            },
          });
        }
      } else if (decision === "AVAILABLE") {
        // Mark any existing active blocks as resolved
        const existingBlocks = await tx.rawMaterialBlock.findMany({
          where: { orderLineId: line.id, status: { in: ["BLOCKED", "PENDING_ASSESSMENT"] } },
        });

        for (const b of existingBlocks) {
          await tx.rawMaterialBlock.update({
            where: { id: b.id },
            data: {
              status: "RESOLVED",
              resolvedAt: new Date(),
              releasedQuantity: b.blockedQuantity,
            },
          });
        }

        if (remark?.trim()) {
          await tx.orderRemark.create({
            data: {
              orderId: order.id,
              orderLineId: line.id,
              stage: "PRODUCTION",
              quantity: affectedQty,
              text: remark.trim(),
              authorName: actorName || "Staff User",
              authorId: actorId,
            },
          });
        }
      }
    }, { timeout: 30000, maxWait: 10000 });

    // Re-evaluate order workflow state outside the transaction
    return await this.allocateOrder(orderId, actorId);
  }

  /**
   * Release quantity from Raw Material blocked queue to Production
   */
  public async releaseBlockedQuantity(params: {
    blockId: string;
    quantityToRelease: number;
    remark?: string;
    actorId?: string;
    actorName?: string;
  }) {
    const { blockId, quantityToRelease, remark, actorId, actorName } = params;

    if (quantityToRelease <= 0) {
      throw new Error("Quantity to release must be greater than zero");
    }

    const result = await prisma.$transaction(async (tx) => {
      const block = await tx.rawMaterialBlock.findUnique({
        where: { id: blockId },
        include: { order: true, orderLine: true, sku: true },
      });

      if (!block) throw new Error(`Raw material block entry #${blockId} not found`);

      const currentRemaining = block.blockedQuantity - block.releasedQuantity;
      if (quantityToRelease > currentRemaining) {
        throw new Error(`Cannot release ${quantityToRelease} units: only ${currentRemaining} blocked unit(s) remain`);
      }

      const newReleased = block.releasedQuantity + quantityToRelease;
      const isFullyResolved = newReleased >= block.blockedQuantity;

      await tx.rawMaterialBlock.update({
        where: { id: block.id },
        data: {
          releasedQuantity: newReleased,
          status: isFullyResolved ? "RESOLVED" : block.status,
          resolvedAt: isFullyResolved ? new Date() : undefined,
        },
      });

      // Create or update Production work order for the unblocked quantity!
      const existingProd = await tx.productionOrder.findFirst({
        where: { orderLineId: block.orderLineId, status: { in: ["READY", "IN_PROGRESS"] } },
      });

      if (existingProd) {
        await tx.productionOrder.update({
          where: { id: existingProd.id },
          data: { quantityRequired: existingProd.quantityRequired + quantityToRelease },
        });
      } else {
        await tx.productionOrder.create({
          data: {
            code: `PROD-${block.order.uniwareOrderCode}-${block.orderLineId.substring(0, 4)}`,
            skuId: block.skuId,
            orderLineId: block.orderLineId,
            quantityRequired: quantityToRelease,
            status: "READY",
            notes: `Released from raw-material blocked queue (${quantityToRelease} units)`,
          },
        });
      }

      // Add persistent remark
      const remarkText = remark?.trim()
        ? remark.trim()
        : `Released ${quantityToRelease} unit(s) from blocked queue to Production. ${isFullyResolved ? "Block resolved." : `${block.blockedQuantity - newReleased} unit(s) remain blocked.`}`;

      await tx.orderRemark.create({
        data: {
          orderId: block.orderId,
          orderLineId: block.orderLineId,
          rawMaterialBlockId: block.id,
          stage: "PRODUCTION",
          quantity: quantityToRelease,
          text: remarkText,
          authorName: actorName || "Staff User",
          authorId: actorId,
        },
      });

      return {
        success: true,
        blockId: block.id,
        releasedQuantity: quantityToRelease,
        remainingBlocked: block.blockedQuantity - newReleased,
        isFullyResolved,
        orderId: block.orderId,
      };
    }, { timeout: 30000, maxWait: 10000 });

    // Re-evaluate order workflow state outside the transaction
    await this.allocateOrder(result.orderId, actorId);

    return {
      success: result.success,
      blockId: result.blockId,
      releasedQuantity: result.releasedQuantity,
      remainingBlocked: result.remainingBlocked,
      isFullyResolved: result.isFullyResolved,
    };
  }

  /**
   * Manually transition order stage with validation and audit logging
   */
  public async transitionOrderStage(params: {
    orderId: string;
    targetStage: InternalStage;
    reason: string;
    actorId?: string;
  }) {
    const { orderId, targetStage, reason, actorId } = params;

    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
      });
      if (!order) throw new Error(`Order #${orderId} not found`);

      const prevStage = order.internalStage;

      const priority = calculateOrderPriority({
        fulfillmentDeadline: order.fulfillmentDeadline,
        internalStage: targetStage,
        blockerReason: order.blockerReason,
        createdAt: order.createdAt,
      });

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          internalStage: targetStage,
          priorityScore: priority.score,
          priorityLabel: priority.label,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStage: prevStage,
          toStage: targetStage,
          reason,
          changedByUserId: actorId,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: "ORDER",
          entityId: orderId,
          action: "STAGE_TRANSITION",
          actorId,
          changesJson: JSON.stringify({ fromStage: prevStage, toStage: targetStage, reason }),
        },
      });

      return updated;
    });
  }
}

export const workflowService = new WorkflowService();
