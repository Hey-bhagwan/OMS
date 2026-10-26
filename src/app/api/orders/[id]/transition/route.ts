import { NextRequest, NextResponse } from "next/server";
import { workflowService } from "@/server/services/workflow.service";
import { getSessionUser } from "@/server/auth/session";
import { InternalStage } from "@prisma/client";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    const { targetStage, reason } = await req.json();

    if (!targetStage) {
      return NextResponse.json({ error: "targetStage is required" }, { status: 400 });
    }

    const updated = await workflowService.transitionOrderStage({
      orderId: params.id,
      targetStage: targetStage as InternalStage,
      reason: reason || "Manual stage transition requested via OMS UI",
      actorId: user?.id,
    });

    return NextResponse.json({ success: true, order: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
