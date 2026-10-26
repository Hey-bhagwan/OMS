import { NextRequest, NextResponse } from "next/server";
import { workflowService } from "@/server/services/workflow.service";
import { getSessionUser } from "@/server/auth/session";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    const updated = await workflowService.allocateOrder(params.id, user?.id);
    return NextResponse.json({ success: true, order: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
