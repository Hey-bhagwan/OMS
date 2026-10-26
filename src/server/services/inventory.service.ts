import { prisma } from "../db/prisma";
import { InventoryBucket, TransactionType, ReservationStatus } from "@prisma/client";

export interface StockAdjustmentInput {
  skuId: string;
  bucket: "PACKED" | "UNPACKED";
  quantityChange: number;
  reason: string;
  actorId?: string;
  actorEmail?: string;
  referenceType?: string;
  referenceId?: string;
}

export class InventoryService {
  /**
   * Adjust finished-goods inventory (PACKED or UNPACKED only) with an atomic ledger transaction
   */
  public async adjustStock(input: StockAdjustmentInput) {
    if (input.bucket !== "PACKED" && input.bucket !== "UNPACKED") {
      throw new Error("Only finished goods buckets (PACKED or UNPACKED) are supported. Raw material inventory is disabled.");
    }

    if (!input.skuId) throw new Error("skuId is required for finished goods stock adjustment");
    if (!input.reason || !input.reason.trim()) throw new Error("A reason is required for stock adjustments");

    return await prisma.$transaction(async (tx) => {
      const idempotencyKey = `ADJ-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const stockRecord = await tx.finishedGoodsStock.findUnique({
        where: { skuId_bucket: { skuId: input.skuId, bucket: input.bucket } },
      });

      const currentOnHand = stockRecord ? stockRecord.quantityOnHand : 0;
      const currentReserved = stockRecord ? stockRecord.quantityReserved : 0;
      const newOnHand = currentOnHand + input.quantityChange;
      const newAvailable = newOnHand - currentReserved;

      if (newOnHand < 0 || newAvailable < 0) {
        throw new Error(`Adjustment would result in negative finished goods inventory. Current on-hand: ${currentOnHand}, Reserved: ${currentReserved}, Requested change: ${input.quantityChange}`);
      }

      const updatedStock = await tx.finishedGoodsStock.upsert({
        where: { skuId_bucket: { skuId: input.skuId, bucket: input.bucket } },
        update: {
          quantityOnHand: newOnHand,
          quantityAvailable: newAvailable,
        },
        create: {
          skuId: input.skuId,
          bucket: input.bucket,
          quantityOnHand: newOnHand,
          quantityAvailable: newAvailable,
          quantityReserved: 0,
        },
      });

      const transaction = await tx.inventoryTransaction.create({
        data: {
          skuId: input.skuId,
          bucket: input.bucket,
          quantityChange: input.quantityChange,
          type: input.quantityChange >= 0 ? "RECEIPT" : "ADJUSTMENT",
          reason: input.reason.trim(),
          actorId: input.actorId,
          idempotencyKey,
          referenceType: input.referenceType || "MANUAL",
          referenceId: input.referenceId,
        },
      });

      return { success: true, updatedStock, transaction };
    });
  }

  /**
   * Record production output into UNPACKED finished-goods inventory
   */
  public async recordProductionOutput(params: {
    skuId: string;
    quantity: number;
    productionOrderId: string;
    actorId?: string;
  }) {
    const { skuId, quantity, productionOrderId, actorId } = params;
    if (quantity <= 0) throw new Error("Production output quantity must be greater than zero");

    return await prisma.$transaction(async (tx) => {
      const unpackedStock = await tx.finishedGoodsStock.findUnique({
        where: { skuId_bucket: { skuId, bucket: "UNPACKED" } },
      });

      const currentOnHand = unpackedStock ? unpackedStock.quantityOnHand : 0;
      const currentReserved = unpackedStock ? unpackedStock.quantityReserved : 0;
      const newOnHand = currentOnHand + quantity;
      const newAvailable = newOnHand - currentReserved;

      const updatedStock = await tx.finishedGoodsStock.upsert({
        where: { skuId_bucket: { skuId, bucket: "UNPACKED" } },
        update: {
          quantityOnHand: newOnHand,
          quantityAvailable: newAvailable,
        },
        create: {
          skuId,
          bucket: "UNPACKED",
          quantityOnHand: newOnHand,
          quantityAvailable: newAvailable,
          quantityReserved: 0,
        },
      });

      const transaction = await tx.inventoryTransaction.create({
        data: {
          skuId,
          bucket: "UNPACKED",
          quantityChange: quantity,
          type: "PRODUCTION_OUTPUT",
          referenceType: "PRODUCTION_ORDER",
          referenceId: productionOrderId,
          reason: `Production output completed for work order #${productionOrderId}`,
          actorId,
          idempotencyKey: `PROD-OUT-${productionOrderId}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        },
      });

      return { success: true, updatedStock, transaction };
    });
  }

  /**
   * Transfer finished goods from UNPACKED to PACKED atomically upon packing completion
   */
  public async transferUnpackedToPacked(params: {
    skuId: string;
    quantity: number;
    packingTaskId: string;
    actorId?: string;
  }) {
    const { skuId, quantity, packingTaskId, actorId } = params;
    if (quantity <= 0) throw new Error("Transfer quantity must be greater than zero");

    return await prisma.$transaction(async (tx) => {
      const unpackedStock = await tx.finishedGoodsStock.findUnique({
        where: { skuId_bucket: { skuId, bucket: "UNPACKED" } },
      });

      if (!unpackedStock || unpackedStock.quantityOnHand < quantity) {
        throw new Error(
          `Insufficient unpacked stock to complete packing transfer. Required: ${quantity}, on hand: ${unpackedStock?.quantityOnHand || 0}`
        );
      }

      // Decrement UNPACKED (release from reserved if previously reserved, and decrement on hand)
      const newUnpackedOnHand = unpackedStock.quantityOnHand - quantity;
      const newUnpackedReserved = Math.max(0, unpackedStock.quantityReserved - quantity);
      const newUnpackedAvailable = newUnpackedOnHand - newUnpackedReserved;

      await tx.finishedGoodsStock.update({
        where: { id: unpackedStock.id },
        data: {
          quantityOnHand: newUnpackedOnHand,
          quantityReserved: newUnpackedReserved,
          quantityAvailable: newUnpackedAvailable,
        },
      });

      // Increment PACKED
      const packedStock = await tx.finishedGoodsStock.findUnique({
        where: { skuId_bucket: { skuId, bucket: "PACKED" } },
      });

      const currentPackedOnHand = packedStock ? packedStock.quantityOnHand : 0;
      const currentPackedReserved = packedStock ? packedStock.quantityReserved : 0;
      const newPackedOnHand = currentPackedOnHand + quantity;
      const newPackedAvailable = newPackedOnHand - currentPackedReserved;

      await tx.finishedGoodsStock.upsert({
        where: { skuId_bucket: { skuId, bucket: "PACKED" } },
        update: {
          quantityOnHand: newPackedOnHand,
          quantityAvailable: newPackedAvailable,
        },
        create: {
          skuId,
          bucket: "PACKED",
          quantityOnHand: newPackedOnHand,
          quantityAvailable: newPackedAvailable,
          quantityReserved: 0,
        },
      });

      // Record Transfer ledger entry
      await tx.inventoryTransaction.create({
        data: {
          skuId,
          bucket: "PACKED",
          quantityChange: quantity,
          type: "PACKING_TRANSFER",
          referenceType: "PACKING_TASK",
          referenceId: packingTaskId,
          reason: `Packaging completed for packing task #${packingTaskId}`,
          actorId,
          idempotencyKey: `PACK-TRANSFER-${packingTaskId}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        },
      });

      return { success: true };
    });
  }

  /**
   * Release reservations for an order line (e.g. upon order cancellation or reallocation)
   */
  public async releaseOrderReservations(orderLineId: string, reason: string) {
    return await prisma.$transaction(async (tx) => {
      const reservations = await tx.inventoryReservation.findMany({
        where: { orderLineId, status: "RESERVED" },
      });

      for (const res of reservations) {
        await tx.inventoryReservation.update({
          where: { id: res.id },
          data: {
            status: "RELEASED",
            releasedAt: new Date(),
          },
        });

        const stock = await tx.finishedGoodsStock.findUnique({
          where: { skuId_bucket: { skuId: res.skuId, bucket: res.bucket } },
        });

        if (stock) {
          const newReserved = Math.max(0, stock.quantityReserved - res.quantity);
          const newAvailable = stock.quantityOnHand - newReserved;
          await tx.finishedGoodsStock.update({
            where: { id: stock.id },
            data: {
              quantityReserved: newReserved,
              quantityAvailable: newAvailable,
            },
          });
        }

        await tx.inventoryTransaction.create({
          data: {
            skuId: res.skuId,
            bucket: res.bucket,
            quantityChange: res.quantity,
            type: "RESERVATION_RELEASE",
            referenceType: "ORDER_LINE",
            referenceId: orderLineId,
            reason: `Reservation released: ${reason}`,
            idempotencyKey: `RELEASE-${res.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          },
        });
      }

      return { count: reservations.length };
    });
  }

  /**
   * Reconcile finished-goods inventory balances against active reservations
   */
  public async reconcileFinishedGoods(skuId?: string) {
    return await prisma.$transaction(async (tx) => {
      const skus = await tx.sKU.findMany({
        where: skuId ? { id: skuId } : undefined,
        select: { id: true, code: true },
      });

      const results = [];

      for (const s of skus) {
        for (const bucket of ["PACKED", "UNPACKED"] as const) {
          const activeReservations = await tx.inventoryReservation.aggregate({
            where: { skuId: s.id, bucket, status: "RESERVED" },
            _sum: { quantity: true },
          });

          const actualReserved = activeReservations._sum.quantity || 0;

          const stock = await tx.finishedGoodsStock.findUnique({
            where: { skuId_bucket: { skuId: s.id, bucket } },
          });

          if (stock) {
            const onHand = stock.quantityOnHand;
            const available = Math.max(0, onHand - actualReserved);

            if (stock.quantityReserved !== actualReserved || stock.quantityAvailable !== available) {
              await tx.finishedGoodsStock.update({
                where: { id: stock.id },
                data: {
                  quantityReserved: actualReserved,
                  quantityAvailable: available,
                },
              });
              results.push({ sku: s.code, bucket, reconciled: true, onHand, actualReserved, available });
            }
          }
        }
      }

      return { reconciledCount: results.length, details: results };
    });
  }
}

export const inventoryService = new InventoryService();
