import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getSessionUser } from "@/server/auth/session";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    const { remark, stage } = await req.json();

    if (!remark || !remark.trim()) {
      return NextResponse.json({ error: "Remark text is required" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: params.id },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const currentStage = stage || order.internalStage;

    // 1. Create persistent OrderRemark in database
    const orderRemark = await prisma.orderRemark.create({
      data: {
        orderId: order.id,
        stage: currentStage,
        text: remark.trim(),
        authorName: user?.name || "Staff Member",
        authorEmail: user?.email,
        authorId: user?.id,
      },
    });

    // 2. Also record in stage audit history with clear attribution
    const historyEntry = await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        toStage: currentStage,
        reason: `[Remark by ${user?.name || "Staff"}]: ${remark.trim()}`,
        changedByUserId: user?.id,
      },
    });

    // 3. Update staffRemark on order without advancing stage or changing next action
    await prisma.order.update({
      where: { id: order.id },
      data: {
        staffRemark: remark.trim(),
      },
    });

    // 4. Audit log
    await prisma.auditLog.create({
      data: {
        entityType: "ORDER",
        entityId: order.id,
        action: "ADD_REMARK",
        actorId: user?.id,
        actorEmail: user?.email,
        changesJson: JSON.stringify({ remark: remark.trim(), stage: currentStage }),
      },
    });

    return NextResponse.json({ success: true, remark: orderRemark, historyEntry });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
