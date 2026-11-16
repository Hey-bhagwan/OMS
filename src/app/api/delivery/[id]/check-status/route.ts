import { NextRequest, NextResponse } from "next/server";
import { carrierStatusCheckService } from "@/server/integrations/carrier-status-check.service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await carrierStatusCheckService.checkShipmentStatus(params.id);
    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
