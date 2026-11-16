import { NextRequest, NextResponse } from "next/server";
import { carrierStatusCheckService } from "@/server/integrations/carrier-status-check.service";
import { getSessionUser } from "@/server/auth/session";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    const summary = await carrierStatusCheckService.checkAllNonDeliveredShipments(limit);

    return NextResponse.json({
      success: true,
      message: `Checked ${summary.checkedCount} shipments: ${summary.updatedCount} updated, ${summary.deliveredCount} delivered.`,
      ...summary,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
