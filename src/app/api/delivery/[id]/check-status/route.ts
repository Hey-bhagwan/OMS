import { NextRequest, NextResponse } from "next/server";
import { carrierStatusCheckService } from "@/server/integrations/carrier-status-check.service";
import { getSessionUser } from "@/server/auth/session";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
