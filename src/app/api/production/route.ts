import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: any = {};
    if (status) where.status = status;

    const tasks = await prisma.productionOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        sku: {
          select: {
            id: true,
            code: true,
            name: true,
            unitOfManufacture: true,
            defaultLeadTimeDays: true,
          },
        },
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
        orderLine: {
          include: {
            order: {
              select: {
                id: true,
                uniwareOrderCode: true,
                displayOrderCode: true,
                fulfillmentDeadline: true,
                channel: true,
              },
            },
          },
        },
        remarks: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    return NextResponse.json({
      success: true,
      tasks: tasks.map((t) => ({
        id: t.id,
        code: t.code,
        skuId: t.skuId,
        skuCode: t.sku.code,
        skuName: t.sku.name,
        unitOfManufacture: t.sku.unitOfManufacture,
        orderId: t.orderLine?.order?.id,
        orderCode: t.orderLine?.order?.uniwareOrderCode || "Stock Work Order",
        displayOrderCode: t.orderLine?.order?.displayOrderCode,
        channel: t.orderLine?.order?.channel,
        fulfillmentDeadline: t.orderLine?.order?.fulfillmentDeadline,
        quantityRequired: t.quantityRequired,
        quantityCompleted: t.quantityCompleted,
        quantityRejected: t.quantityRejected,
        status: t.status,
        assignedUser: t.assignedUser ? { id: t.assignedUser.id, name: t.assignedUser.name } : null,
        startDate: t.startDate,
        expectedCompletionDate: t.expectedCompletionDate,
        actualCompletionDate: t.actualCompletionDate,
        notes: t.notes,
        remarks: t.remarks,
        createdAt: t.createdAt,
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
