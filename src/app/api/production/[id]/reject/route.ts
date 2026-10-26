import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getSessionUser } from "@/server/auth/session";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { quantity, reason } = await req.json();
    const qty = Number(quantity);

    if (!qty || qty <= 0) {
      return NextResponse.json({ error: "Rejected quantity must be greater than zero" }, { status: 400 });
    }
    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: "Rejection reason is mandatory" }, { status: 400 });
    }

    const task = await prisma.productionOrder.findUnique({
      where: { id: params.id },
      include: { orderLine: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Production order not found" }, { status: 404 });
    }

    const updated = await prisma.productionOrder.update({
      where: { id: params.id },
      data: {
        quantityRejected: task.quantityRejected + qty,
      },
    });

    await prisma.orderRemark.create({
      data: {
        orderId: task.orderLine?.orderId,
        orderLineId: task.orderLineId,
        productionOrderId: task.id,
        stage: "PRODUCTION",
        quantity: qty,
        text: `Recorded ${qty} rejected unit(s). Reason: ${reason.trim()}`,
        authorName: user.name,
        authorId: user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: "PRODUCTION",
        entityId: task.id,
        action: "RECORD_REJECTION",
        actorId: user.id,
        actorEmail: user.email,
        changesJson: JSON.stringify({ rejectedQty: qty, reason }),
      },
    });

    return NextResponse.json({ success: true, task: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
