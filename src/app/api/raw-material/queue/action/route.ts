import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getSessionUser } from "@/server/auth/session";
import { workflowService } from "@/server/services/workflow.service";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, blockId, orderId, orderLineId, quantity, remark, assignedUserId, decision } = body;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    // 1. MARK_AVAILABLE: Release full or partial quantity from blocked queue to Production
    if (action === "MARK_AVAILABLE") {
      if (!blockId) {
        return NextResponse.json({ error: "blockId is required to mark raw material available" }, { status: 400 });
      }

      const block = await prisma.rawMaterialBlock.findUnique({
        where: { id: blockId },
      });
      if (!block) {
        return NextResponse.json({ error: "Blocked queue record not found" }, { status: 404 });
      }

      const remainingBlocked = block.blockedQuantity - block.releasedQuantity;
      const qtyToRelease = quantity ? Number(quantity) : remainingBlocked;

      if (qtyToRelease <= 0 || qtyToRelease > remainingBlocked) {
        return NextResponse.json(
          { error: `Invalid release quantity. Must be between 1 and ${remainingBlocked}` },
          { status: 400 }
        );
      }

      const result = await workflowService.releaseBlockedQuantity({
        blockId,
        quantityToRelease: qtyToRelease,
        remark,
        actorId: user.id,
        actorName: user.name,
      });

      await prisma.auditLog.create({
        data: {
          entityType: "ORDER",
          entityId: block.orderId,
          action: "RM_RELEASE",
          actorId: user.id,
          actorEmail: user.email,
          changesJson: JSON.stringify({ blockId, qtyToRelease, remark }),
        },
      });

      return NextResponse.json({ success: true, result });
    }

    // 2. UPDATE_REMARK: Add persistent remark and update displayed reason
    if (action === "UPDATE_REMARK") {
      if (!blockId || !remark || !remark.trim()) {
        return NextResponse.json({ error: "blockId and remark text are required" }, { status: 400 });
      }

      const block = await prisma.rawMaterialBlock.findUnique({
        where: { id: blockId },
      });
      if (!block) {
        return NextResponse.json({ error: "Blocked queue record not found" }, { status: 404 });
      }

      const updatedBlock = await prisma.rawMaterialBlock.update({
        where: { id: blockId },
        data: { reason: remark.trim() },
      });

      const newRemark = await prisma.orderRemark.create({
        data: {
          orderId: block.orderId,
          orderLineId: block.orderLineId,
          rawMaterialBlockId: block.id,
          stage: "RAW_MATERIAL",
          text: remark.trim(),
          authorName: user.name,
          authorId: user.id,
          authorEmail: user.email,
        },
      });

      return NextResponse.json({ success: true, block: updatedBlock, remark: newRemark });
    }

    // 3. ASSIGN_USER: Assign follow-up ownership
    if (action === "ASSIGN_USER") {
      if (!blockId || !assignedUserId) {
        return NextResponse.json({ error: "blockId and assignedUserId are required" }, { status: 400 });
      }

      const assignedUser = await prisma.user.findUnique({
        where: { id: assignedUserId },
      });
      if (!assignedUser) {
        return NextResponse.json({ error: "Assigned user not found" }, { status: 404 });
      }

      const updatedBlock = await prisma.rawMaterialBlock.update({
        where: { id: blockId },
        data: { assignedUserId },
      });

      await prisma.orderRemark.create({
        data: {
          orderId: updatedBlock.orderId,
          rawMaterialBlockId: updatedBlock.id,
          stage: "RAW_MATERIAL",
          text: `Assigned follow-up ownership to ${assignedUser.name} (${assignedUser.email})`,
          authorName: user.name,
          authorId: user.id,
        },
      });

      return NextResponse.json({ success: true, block: updatedBlock });
    }

    // 4. DECIDE_AVAILABILITY: Explicit manual availability decision on an order
    if (action === "DECIDE_AVAILABILITY") {
      if (!orderId || !decision) {
        return NextResponse.json({ error: "orderId and decision are required" }, { status: 400 });
      }

      const validDecisions = ["AVAILABLE", "UNAVAILABLE", "PENDING_ASSESSMENT"];
      if (!validDecisions.includes(decision)) {
        return NextResponse.json({ error: `Invalid decision. Allowed: ${validDecisions.join(", ")}` }, { status: 400 });
      }

      if (decision === "UNAVAILABLE" && (!remark || !remark.trim())) {
        return NextResponse.json({ error: "A meaningful remark is mandatory when marking raw material unavailable" }, { status: 400 });
      }

      const result = await workflowService.setRawMaterialDecision({
        orderId,
        orderLineId,
        decision,
        quantity: quantity ? Number(quantity) : undefined,
        remark,
        assignedUserId,
        actorId: user.id,
        actorName: user.name,
      });

      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
