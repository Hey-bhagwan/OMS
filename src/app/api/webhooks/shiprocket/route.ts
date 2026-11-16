import { NextRequest, NextResponse } from "next/server";
import { shipmentService } from "@/server/integrations/shiprocket/service";

// Shiprocket sends a shared secret in the Authorization header or x-webhook-secret
function verifyWebhookSecret(req: NextRequest, isCargo: boolean): boolean {
  const expectedSecret = isCargo
    ? process.env.SHIPROCKET_CARGO_WEBHOOK_SECRET
    : process.env.SHIPROCKET_WEBHOOK_SECRET;

  // If no secret is configured, allow (for local dev); warn in logs
  if (!expectedSecret) {
    console.warn("[Webhook] WARNING: No webhook secret configured. Set SHIPROCKET_WEBHOOK_SECRET.");
    return true;
  }

  const provided =
    req.headers.get("x-webhook-secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "");

  return provided === expectedSecret;
}

export async function POST(req: NextRequest) {
  try {
    const providerHeader = req.headers.get("x-provider-type") || undefined;
    const isCargo = providerHeader === "SHIPROCKET_CARGO";

    if (!verifyWebhookSecret(req, isCargo)) {
      console.warn("[Webhook] Rejected: invalid webhook secret");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const result = await shipmentService.handleWebhook(body, providerHeader);

    return NextResponse.json({
      received: true,
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Webhook Error] Shiprocket webhook failed:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
