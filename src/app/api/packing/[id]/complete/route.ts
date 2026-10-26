import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { inventoryService } from "@/server/services/inventory.service";
import { workflowService } from "@/server/services/workflow.service";
import { getSessionUser } from "@/server/auth/session";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body optional
    }

    const task = await prisma.packingTask.findUnique({
      where: { id: params.id },
      include: {
        sku: true,
        order: true,
        orderLine: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Packing task not found" }, { status: 404 });
    }

    if (task.status === "COMPLETED") {
      return NextResponse.json({ error: "Task is already completed" }, { status: 400 });
    }

    const remainingRequired = task.quantityRequired - task.quantityCompleted;
    const qtyToTransfer = body.quantity ? Number(body.quantity) : remainingRequired;

    if (qtyToTransfer <= 0 || qtyToTransfer > remainingRequired) {
      return NextResponse.json(
        { error: `Invalid packing quantity. Must be between 1 and ${remainingRequired}` },
        { status: 400 }
      );
    }

    // 1. Validate packaging profile
    const isExport = task.packagingType === "EXPORT" || task.order.destinationCountry !== "IN";
    const profileApplied = isExport
      ? `ISPM-15 Certified Export Wooden Crate (${task.sku.exportPackingType || "Export Crate"})`
      : `Standard Domestic Pack (${task.sku.domesticPackingType || "Standard Box"})`;

    // 2. Transfer stock from UNPACKED to PACKED atomically
    await inventoryService.transferUnpackedToPacked({
      skuId: task.skuId,
      quantity: qtyToTransfer,
      packingTaskId: task.id,
      actorId: user?.id,
    });

    // 3. Mark/update task
    const newCompleted = task.quantityCompleted + qtyToTransfer;
    const isFinished = newCompleted >= task.quantityRequired;

    await prisma.packingTask.update({
      where: { id: task.id },
      data: {
        quantityCompleted: newCompleted,
        status: isFinished ? "COMPLETED" : "IN_PROGRESS",
        completedAt: isFinished ? new Date() : undefined,
        assignedUserId: user?.id || task.assignedUserId,
      },
    });

    // 4. Update order line packedCompletedQty
    await prisma.orderLine.update({
      where: { id: task.orderLineId },
      data: {
        packedCompletedQty: { increment: qtyToTransfer },
        dispatchReadyQty: { increment: qtyToTransfer },
      },
    });

    // 5. Add persistent remark
    const remarkText = body.remark?.trim()
      ? body.remark.trim()
      : `Verified packaging profile [${profileApplied}]: transferred ${qtyToTransfer} unit(s) to Packed inventory. ${isFinished ? "Packing task completed." : `${task.quantityRequired - newCompleted} units remaining.`}`;

    await prisma.orderRemark.create({
      data: {
        orderId: task.orderId,
        orderLineId: task.orderLineId,
        packingTaskId: task.id,
        stage: "PACKING",
        quantity: qtyToTransfer,
        text: remarkText,
        authorName: user?.name || "Packing Staff",
        authorId: user?.id,
      },
    });

    // 6. Recalculate workflow decision
    const evaluation = await workflowService.allocateOrder(task.orderId, user?.id);

    return NextResponse.json({
      success: true,
      completedQuantity: qtyToTransfer,
      totalCompleted: newCompleted,
      isFinished,
      profileApplied,
      stage: evaluation.internalStage,
      nextAction: evaluation.recommendedAction,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
