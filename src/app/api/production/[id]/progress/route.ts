import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getSessionUser } from "@/server/auth/session";
import { inventoryService } from "@/server/services/inventory.service";
import { workflowService } from "@/server/services/workflow.service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { quantity, remark } = body;

    const qtyToComplete = Number(quantity);
    if (!qtyToComplete || qtyToComplete <= 0) {
      return NextResponse.json({ error: "Completion quantity must be greater than zero" }, { status: 400 });
    }

    const task = await prisma.productionOrder.findUnique({
      where: { id: params.id },
      include: {
        sku: true,
        orderLine: {
          include: { order: true },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Production order not found" }, { status: 404 });
    }

    const remainingRequired = task.quantityRequired - task.quantityCompleted;
    if (qtyToComplete > remainingRequired) {
      return NextResponse.json(
        { error: `Cannot complete ${qtyToComplete} units: only ${remainingRequired} unit(s) remain required` },
        { status: 400 }
      );
    }

    // 1. Atomically increment UNPACKED finished goods inventory & record PRODUCTION_OUTPUT transaction
    await inventoryService.recordProductionOutput({
      skuId: task.skuId,
      quantity: qtyToComplete,
      productionOrderId: task.id,
      actorId: user.id,
    });

    // 2. Update ProductionOrder record
    const newCompleted = task.quantityCompleted + qtyToComplete;
    const isFinished = newCompleted >= task.quantityRequired;

    const updatedTask = await prisma.productionOrder.update({
      where: { id: task.id },
      data: {
        quantityCompleted: newCompleted,
        status: isFinished ? "COMPLETED" : "IN_PROGRESS",
        actualCompletionDate: isFinished ? new Date() : undefined,
      },
    });

    // 3. Create or update PackingTask for the completed unpacked units if linked to an order
    if (task.orderLine) {
      const order = task.orderLine.order;
      const isExport = order.destinationCountry !== "IN" || order.packagingType === "EXPORT";

      const existingPacking = await prisma.packingTask.findFirst({
        where: {
          orderLineId: task.orderLineId!,
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
      });

      if (existingPacking) {
        await prisma.packingTask.update({
          where: { id: existingPacking.id },
          data: {
            quantityRequired: existingPacking.quantityRequired + qtyToComplete,
          },
        });
      } else {
        await prisma.packingTask.create({
          data: {
            code: `PACK-${order.uniwareOrderCode}-${task.orderLineId!.substring(0, 4)}`,
            orderId: order.id,
            orderLineId: task.orderLineId!,
            skuId: task.skuId,
            quantityRequired: qtyToComplete,
            packagingType: isExport ? "EXPORT" : "DOMESTIC",
            specialInstructions: isExport
              ? `ISPM-15 Certified Export Wooden Crate (${task.sku.exportPackingType || "Export Crate"})`
              : `Standard Domestic Pack (${task.sku.domesticPackingType || "Domestic Box"})`,
            status: "PENDING",
          },
        });
      }

      // Re-evaluate order workflow state
      await workflowService.allocateOrder(order.id, user.id);
    }

    // 4. Record persistent remark
    const remarkText = remark?.trim()
      ? remark.trim()
      : `Recorded production completion of ${qtyToComplete} unit(s). ${isFinished ? "Work order completed." : `${task.quantityRequired - newCompleted} units remaining.`}`;

    await prisma.orderRemark.create({
      data: {
        orderId: task.orderLine?.orderId,
        orderLineId: task.orderLineId,
        productionOrderId: task.id,
        stage: "PRODUCTION",
        quantity: qtyToComplete,
        text: remarkText,
        authorName: user.name,
        authorId: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      task: updatedTask,
      completedQuantity: qtyToComplete,
      totalCompleted: newCompleted,
      isFinished,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
