import { describe, it, expect, vi } from "vitest";
import { UniwareClient } from "../src/server/integrations/uniware/client";

describe("Uniware Integration Client", () => {
  it("uses single-flight lock so concurrent requests share one token renewal", async () => {
    const client = new UniwareClient();

    // Call getAccessToken twice concurrently
    const [token1, token2] = await Promise.all([
      client.getAccessToken(),
      client.getAccessToken(),
    ]);

    expect(token1).toBeTruthy();
    expect(token2).toBeTruthy();
    expect(token1).toBe(token2);
  });

  it("successfully searches orders and returns valid elements in mock mode", async () => {
    const client = new UniwareClient();

    const response = await client.searchOrders({
      dateType: "CREATED",
      fromDate: "2026-10-01T00:00:00",
      toDate: "2026-10-22T23:59:59",
      searchOptions: {
        displayStart: 0,
        displayLength: 10,
        getCount: true,
      },
    });

    expect(response.successful).toBe(true);
    expect(response.elements).toBeDefined();
    expect(response.elements!.length).toBeGreaterThan(0);
    expect(response.elements![0].code).toBe("IK9259");
    expect(response.elements![0].status).toBe("PROCESSING");
  });

  it("retrieves full order details DTO by code", async () => {
    const client = new UniwareClient();

    const response = await client.getOrderDetails("IK9259");

    expect(response.successful).toBe(true);
    expect(response.saleOrderDTO).toBeDefined();
    expect(response.saleOrderDTO!.code).toBe("IK9259");
    expect(response.saleOrderDTO!.saleOrderItems).toBeDefined();
    expect(response.saleOrderDTO!.saleOrderItems![0].itemSKU).toBe("KLT2025-004");
  });
});
