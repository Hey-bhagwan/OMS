import {
  UniwareTokenResponse,
  UniwareSearchRequest,
  UniwareSearchResponse,
  UniwareSaleOrderGetResponse,
} from "./types";

interface TokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
  refreshToken?: string;
}

export class UniwareClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  private clientId: string;
  private tokenCache: TokenCache | null = null;
  private inflightTokenPromise: Promise<string> | null = null;

  constructor() {
    this.baseUrl = (process.env.UNIWARE_BASE_URL || "https://koaliving.unicommerce.com").replace(/\/$/, "");
    this.username = process.env.UNIWARE_USERNAME || "";
    this.password = process.env.UNIWARE_PASSWORD || "";
    this.clientId = process.env.UNIWARE_CLIENT_ID || "my-trusted-client";
  }

  /**
   * Safe logger redacting passwords and tokens
   */
  private log(message: string, meta?: Record<string, unknown>) {
    const sanitizedMeta = meta ? JSON.stringify(meta, (k, v) => {
      if (/password|token|secret|authorization/i.test(k)) return "[REDACTED]";
      return v;
    }) : "";
    console.log(`[UniwareClient] ${message} ${sanitizedMeta}`);
  }

  /**
   * Acquire a valid OAuth access token with expiration-awareness and single-flight lock
   */
  public async getAccessToken(): Promise<string> {
    const now = Date.now();
    // Cache valid if more than 60 seconds before expiration
    if (this.tokenCache && this.tokenCache.expiresAt - now > 60_000) {
      return this.tokenCache.accessToken;
    }

    if (this.inflightTokenPromise) {
      return this.inflightTokenPromise;
    }

    this.inflightTokenPromise = (async () => {
      try {
        if (!this.username || !this.password || this.username === "api_user") {
          this.log("Live Uniware credentials not configured; using offline token mock mode.");
          const mockToken = "mock_uniware_token_" + Date.now();
          this.tokenCache = {
            accessToken: mockToken,
            expiresAt: Date.now() + 3600_000,
          };
          return mockToken;
        }

        const url = new URL(`${this.baseUrl}/oauth/token`);
        url.searchParams.set("grant_type", "password");
        url.searchParams.set("client_id", this.clientId);
        url.searchParams.set("username", this.username);
        url.searchParams.set("password", this.password);

        this.log("Authenticating against Uniware OAuth endpoint", { url: url.pathname });

        const res = await fetch(url.toString(), {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`Uniware auth failed with status ${res.status}: ${errText.slice(0, 200)}`);
        }

        const data = (await res.json()) as UniwareTokenResponse;
        const expiresInMs = (data.expires_in || 3600) * 1000;

        this.tokenCache = {
          accessToken: data.access_token,
          expiresAt: Date.now() + expiresInMs,
          refreshToken: data.refresh_token,
        };

        this.log("Successfully acquired Uniware OAuth token", { expiresInSeconds: data.expires_in });
        return data.access_token;
      } finally {
        this.inflightTokenPromise = null;
      }
    })();

    return this.inflightTokenPromise;
  }

  /**
   * Search sale orders by date range
   */
  public async searchOrders(req: UniwareSearchRequest): Promise<UniwareSearchResponse> {
    const token = await this.getAccessToken();

    if (token.startsWith("mock_uniware_token_")) {
      // Return simulated search response for offline development / testing
      return {
        successful: true,
        totalRecords: 1,
        elements: [
          {
            code: "IK9259",
            displayOrderCode: "AMZ-405-8839210-9182341",
            channel: "Amazon IN",
            source: "UNIWARE",
            status: "PROCESSING",
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            fulfillmentTat: new Date(Date.now() + 24 * 3600_000).toISOString(),
          },
        ],
      };
    }

    const endpoint = `${this.baseUrl}/services/rest/v1/oms/saleOrder/search`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(req),
    });

    if (res.status === 401) {
      this.tokenCache = null; // Invalidate cached token and retry once
      const retryToken = await this.getAccessToken();
      const retryRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `bearer ${retryToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(req),
      });
      return (await retryRes.json()) as UniwareSearchResponse;
    }

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Uniware order search failed (${res.status}): ${err.slice(0, 200)}`);
    }

    return (await res.json()) as UniwareSearchResponse;
  }

  /**
   * Get complete sale order details by order code
   */
  public async getOrderDetails(orderCode: string): Promise<UniwareSaleOrderGetResponse> {
    const token = await this.getAccessToken();

    if (token.startsWith("mock_uniware_token_")) {
      return {
        successful: true,
        saleOrderDTO: {
          code: orderCode,
          displayOrderCode: `AMZ-MOCK-${orderCode}`,
          channel: "Amazon IN",
          source: "UNIWARE",
          status: "PROCESSING",
          currency: "INR",
          totalPrice: 48500,
          cashOnDelivery: false,
          addresses: [
            {
              id: 1,
              name: "Customer Sample",
              city: "Mumbai",
              state: "Maharashtra",
              country: "IN",
              pincode: "400001",
              type: "SHIPPING",
            },
          ],
          saleOrderItems: [
            {
              code: `ITEM-${orderCode}-1`,
              itemSKU: "KLT2025-004",
              itemName: "Cala Round White Marble Dining Table",
              quantity: 1,
              sellingPrice: 48500,
              itemStatus: "PROCESSING",
            },
          ],
          shippingPackages: [
            {
              code: `PKG-${orderCode}`,
              shippingPackageStatus: "PACKED",
              courierName: "Blue Dart",
              trackingNumber: `BD${orderCode}998`,
            },
          ],
        },
      };
    }

    const endpoint = `${this.baseUrl}/services/rest/v1/oms/saleorder/get`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ code: orderCode, paymentDetailRequired: false }),
    });

    if (res.status === 401) {
      this.tokenCache = null;
      const retryToken = await this.getAccessToken();
      const retryRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `bearer ${retryToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ code: orderCode, paymentDetailRequired: false }),
      });
      return (await retryRes.json()) as UniwareSaleOrderGetResponse;
    }

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Uniware get order failed (${res.status}): ${err.slice(0, 200)}`);
    }

    return (await res.json()) as UniwareSaleOrderGetResponse;
  }
}

export const uniwareClient = new UniwareClient();
