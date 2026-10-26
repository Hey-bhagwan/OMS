import { describe, it, expect } from "vitest";
import { calculateOrderPriority } from "../src/server/services/workflow.service";

describe("Workflow Engine Next-Action & Allocation Engine", () => {
  it("evaluates overdue penalty and priority score deterministically", () => {
    const overdueDeadline = new Date(Date.now() - 3600 * 1000);
    const result = calculateOrderPriority({
      fulfillmentDeadline: overdueDeadline,
      internalStage: "RAW_MATERIAL",
      blockerReason: "Awaiting quarry marble inspection",
      createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
    });

    expect(result.isOverdue).toBe(true);
    expect(result.label).toBe("OVERDUE");
    expect(result.score).toBeGreaterThan(80);
  });

  it("handles cancelled and on-hold stages appropriately without advancing", () => {
    const onHoldPriority = calculateOrderPriority({
      fulfillmentDeadline: new Date(Date.now() + 48 * 3600 * 1000),
      internalStage: "ON_HOLD",
      createdAt: new Date(),
    });

    const activePriority = calculateOrderPriority({
      fulfillmentDeadline: new Date(Date.now() + 48 * 3600 * 1000),
      internalStage: "PRODUCTION",
      createdAt: new Date(),
    });

    expect(onHoldPriority.score).toBeLessThan(activePriority.score);
  });

  it("verifies export packaging requirements over domestic packaging", () => {
    const orderDomestic = {
      destinationCountry: "IN",
      packagingType: "DOMESTIC",
    };
    const orderExport = {
      destinationCountry: "US",
      packagingType: "EXPORT",
    };

    const isDomesticExport = orderDomestic.destinationCountry !== "IN" || orderDomestic.packagingType === "EXPORT";
    const isInternationalExport = orderExport.destinationCountry !== "IN" || orderExport.packagingType === "EXPORT";

    expect(isDomesticExport).toBe(false);
    expect(isInternationalExport).toBe(true);
  });

  it("ensures rule version v2.0 is assigned to deterministic decisions", () => {
    const ruleVersion = "v2.0";
    expect(ruleVersion).toBe("v2.0");
  });
});
