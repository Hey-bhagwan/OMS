import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getSessionUser } from "@/server/auth/session";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        status: "IN_PROGRESS",
        startDate: task.startDate || new Date(),
      },
    });

    await prisma.orderRemark.create({
      data: {
        orderId: task.orderLine?.orderId,
        orderLineId: task.orderLineId,
        productionOrderId: task.id,
        stage: "PRODUCTION",
        text: `Work order #${task.code} started by ${user.name}`,
        authorName: user.name,
        authorId: user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: "PRODUCTION",
        entityId: task.id,
        action: "START_WORK",
        actorId: user.id,
        actorEmail: user.email,
      },
    });

    return NextResponse.json({ success: true, task: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
