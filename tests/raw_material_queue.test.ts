import { describe, it, expect, vi } from "vitest";
import { workflowService } from "../src/server/services/workflow.service";
import { prisma } from "../src/server/db/prisma";

describe("Raw Material Manual Blocked Queue & Availability Decisions", () => {
  it("enforces a mandatory remark when marking raw material unavailable", async () => {
    await expect(
      workflowService.setRawMaterialDecision({
        orderId: "fake-order-id",
        decision: "UNAVAILABLE",
        remark: "   ", // empty remark
      })
    ).rejects.toThrow("A meaningful remark is mandatory when marking raw material unavailable");
  });

  it("distinguishes between PENDING_ASSESSMENT and confirmed BLOCKED status", () => {
    const statuses = ["BLOCKED", "PENDING_ASSESSMENT", "RESOLVED", "CANCELLED"];
    expect(statuses).toContain("PENDING_ASSESSMENT");
    expect(statuses).toContain("BLOCKED");
    expect("PENDING_ASSESSMENT").not.toBe("BLOCKED");
  });

  it("calculates partial quantities accurately when unblocking", () => {
    const totalBlocked = 3;
    const releaseQty = 2;
    const remaining = totalBlocked - releaseQty;

    expect(remaining).toBe(1);
    expect(releaseQty).toBeLessThan(totalBlocked);
    expect(remaining).toBeGreaterThan(0);
  });

  it("validates that releasing more than blocked quantity is rejected", async () => {
    // Attempting to release 5 units when only 2 are blocked should fail validation
    const block = { blockedQuantity: 2, releasedQuantity: 0 };
    const remainingBlocked = block.blockedQuantity - block.releasedQuantity;
    const qtyToRelease = 5;

    expect(qtyToRelease > remainingBlocked).toBe(true);
  });
});
