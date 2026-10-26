import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { workflowService } from "@/server/services/workflow.service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { decision, quantity, remark, orderLineId, assignedUserId } = await req.json();

    if (!decision) {
      return NextResponse.json({ error: "decision is required ('AVAILABLE', 'UNAVAILABLE', 'PENDING_ASSESSMENT')" }, { status: 400 });
    }

    if (decision === "UNAVAILABLE" && (!remark || !remark.trim())) {
      return NextResponse.json({ error: "A meaningful remark is mandatory when marking raw material unavailable" }, { status: 400 });
    }

    const result = await workflowService.setRawMaterialDecision({
      orderId: params.id,
      orderLineId,
      decision,
      quantity: quantity ? Number(quantity) : undefined,
      remark,
      assignedUserId,
      actorId: user.id,
      actorName: user.name,
    });

    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
