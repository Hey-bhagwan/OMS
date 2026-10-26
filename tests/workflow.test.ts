import { describe, it, expect } from "vitest";
import { calculateOrderPriority } from "../src/server/services/workflow.service";

describe("Workflow Priority Engine", () => {
  it("assigns OVERDUE priority when fulfillment deadline has passed", () => {
    const pastDeadline = new Date(Date.now() - 24 * 3600 * 1000); // 1 day ago
    const result = calculateOrderPriority({
      fulfillmentDeadline: pastDeadline,
      internalStage: "PACKING",
      createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
    });

    expect(result.isOverdue).toBe(true);
    expect(result.label).toBe("OVERDUE");
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("increases score when an active blocker is reported", () => {
    const deadline = new Date(Date.now() + 48 * 3600 * 1000);
    const unblocked = calculateOrderPriority({
      fulfillmentDeadline: deadline,
      internalStage: "RAW_MATERIAL",
      createdAt: new Date(),
    });

    const blocked = calculateOrderPriority({
      fulfillmentDeadline: deadline,
      internalStage: "RAW_MATERIAL",
      blockerReason: "Critical Marble Slab Shortage",
      createdAt: new Date(),
    });

    expect(blocked.score).toBeGreaterThan(unblocked.score);
  });

  it("assigns high priority to delivery exceptions", () => {
    const result = calculateOrderPriority({
      internalStage: "DELIVERY_EXCEPTION",
      createdAt: new Date(),
    });

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(["URGENT", "OVERDUE", "HIGH"]).toContain(result.label);
  });
});
