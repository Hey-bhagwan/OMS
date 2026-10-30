import { NextRequest, NextResponse } from "next/server";
import { shipmentService } from "@/server/integrations/shiprocket/service";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const providerHeader = req.headers.get("x-provider-type") || undefined;
    const body = await req.json();

    const result = await shipmentService.handleWebhook(body, providerHeader);

    return NextResponse.json({
      received: true,
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Webhook Error] Courier tracking webhook failed:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
