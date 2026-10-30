/**
 * POST /api/webhooks/shiprocket/test
 *
 * Fires a synthetic Shiprocket or Shiprocket Cargo webhook payload through
 * the exact same pipeline as a real webhook — available in all environments
 * including production, protected by a secret key.
 *
 * ── Auth ──────────────────────────────────────────────────────────────────────
 * Set TEST_WEBHOOK_SECRET in your environment.
 * Pass it as the header:  x-test-secret: <value>
 * If the env var is not set, the endpoint returns 503 (disabled).
 * If the header is missing or wrong, it returns 401.
 *
 * ── Request body (all fields optional) ───────────────────────────────────────
 * {
 *   "provider"     : "SHIPROCKET" | "SHIPROCKET_CARGO",  // default: SHIPROCKET
 *   "awb"          : "BD998234123",    // default: auto-generated TEST-AWB-<ts>
 *   "status"       : "OUT FOR DELIVERY",  // default: "OUT FOR DELIVERY"
 *   "order_id"     : "IK9259",         // standard only — used for order matching
 *   "courier_name" : "Blue Dart"       // standard only
 * }
 *
 * ── Example curl calls ────────────────────────────────────────────────────────
 *
 * Standard Shiprocket:
 *   curl -X POST https://your-domain.com/api/webhooks/shiprocket/test \
 *     -H "Content-Type: application/json" \
 *     -H "x-test-secret: YOUR_SECRET" \
 *     -d '{"provider":"SHIPROCKET","awb":"BD998234123","status":"OUT FOR DELIVERY"}'
 *
 * Shiprocket Cargo:
 *   curl -X POST https://your-domain.com/api/webhooks/shiprocket/test \
 *     -H "Content-Type: application/json" \
 *     -H "x-test-secret: YOUR_SECRET" \
 *     -d '{"provider":"SHIPROCKET_CARGO","awb":"CARGO-WB-001","status":"In Transit"}'
 */

import { NextRequest, NextResponse } from "next/server";
import { shipmentService } from "@/server/integrations/shiprocket/service";

export async function POST(req: NextRequest) {
  // ── Secret guard ──────────────────────────────────────────────────────────
  const configuredSecret = process.env.TEST_WEBHOOK_SECRET;

  if (!configuredSecret || !configuredSecret.trim()) {
    return NextResponse.json(
      {
        error:
          "Test webhook is not configured. Set the TEST_WEBHOOK_SECRET environment variable to enable it.",
      },
      { status: 503 }
    );
  }

  const providedSecret = req.headers.get("x-test-secret");

  if (!providedSecret || providedSecret !== configuredSecret) {
    return NextResponse.json(
      { error: "Unauthorized. Pass the correct x-test-secret header." },
      { status: 401 }
    );
  }

  // ── Parse request ─────────────────────────────────────────────────────────
  try {
    const body = await req.json().catch(() => ({}));

    const provider: "SHIPROCKET" | "SHIPROCKET_CARGO" =
      body.provider === "SHIPROCKET_CARGO" ? "SHIPROCKET_CARGO" : "SHIPROCKET";

    const testAwb = String(body.awb || `TEST-AWB-${Date.now()}`).trim();
    const testStatus = String(body.status || "OUT FOR DELIVERY");

    // ── Build provider-specific synthetic payload ────────────────────────────

    let payload: Record<string, unknown>;

    if (provider === "SHIPROCKET_CARGO") {
      payload = {
        id: `CARGO-TEST-${Date.now()}`,
        waybill_no: testAwb,
        status: testStatus,
        edd_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        from_city: "Delhi",
        status_history: [
          {
            date: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 h ago
            status: "Departed from origin hub",
            location: "Delhi Hub",
          },
          {
            date: new Date().toISOString(), // now = latest
            status: testStatus,
            location: "Mumbai Gateway",
          },
        ],
      };
    } else {
      payload = {
        order_id: body.order_id || `TEST-ORDER-${Date.now()}`,
        shipment_id: `TEST-SHIP-${Date.now()}`,
        awb: testAwb,
        courier_name: body.courier_name || "Blue Dart Express",
        current_status: testStatus,
        etd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        scans: [
          {
            date: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 h ago
            activity: "Reached sorting facility",
            location: "Bhiwandi Hub",
          },
          {
            date: new Date().toISOString(), // now = latest
            activity: testStatus,
            location: "Mumbai Hub",
          },
        ],
      };
    }

    // ── Run through the same pipeline as the real webhook ────────────────────
    const providerHeader =
      provider === "SHIPROCKET_CARGO" ? "SHIPROCKET_CARGO" : undefined;

    const result = await shipmentService.handleWebhook(payload, providerHeader);

    return NextResponse.json({
      received: true,
      provider,
      testPayloadSent: payload,
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Test Webhook Error]", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
