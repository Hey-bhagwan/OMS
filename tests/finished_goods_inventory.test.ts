import { describe, it, expect } from "vitest";
import { inventoryService } from "../src/server/services/inventory.service";

describe("Finished Goods Inventory Integrity", () => {
  it("rejects RAW_MATERIAL bucket adjustments", async () => {
    await expect(
      inventoryService.adjustStock({
        skuId: "sku-1",
        bucket: "RAW_MATERIAL" as any,
        quantityChange: 10,
        reason: "Test raw adjustment",
      })
    ).rejects.toThrow("Only finished goods buckets (PACKED or UNPACKED) are supported. Raw material inventory is disabled.");
  });

  it("requires a non-empty reason for any inventory adjustment", async () => {
    await expect(
      inventoryService.adjustStock({
        skuId: "sku-1",
        bucket: "PACKED",
        quantityChange: 5,
        reason: "   ",
      })
    ).rejects.toThrow("A reason is required for stock adjustments");
  });

  it("requires positive transfer quantities", async () => {
    await expect(
      inventoryService.transferUnpackedToPacked({
        skuId: "sku-1",
        quantity: 0,
        packingTaskId: "task-1",
      })
    ).rejects.toThrow("Transfer quantity must be greater than zero");

    await expect(
      inventoryService.transferUnpackedToPacked({
        skuId: "sku-1",
        quantity: -3,
        packingTaskId: "task-1",
      })
    ).rejects.toThrow("Transfer quantity must be greater than zero");
  });

  it("requires positive production output quantities", async () => {
    await expect(
      inventoryService.recordProductionOutput({
        skuId: "sku-1",
        quantity: 0,
        productionOrderId: "prod-1",
      })
    ).rejects.toThrow("Production output quantity must be greater than zero");
  });
});
