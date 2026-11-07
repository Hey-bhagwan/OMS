import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const packagingType = searchParams.get("type");
    const showCompleted = searchParams.get("showCompleted") === "true";

    const where: any = {};
    if (packagingType) where.packagingType = packagingType;
    if (!showCompleted) {
      where.status = { not: "COMPLETED" };
      // Only show tasks for orders currently in PACKING stage (exclude orders already moved to DISPATCH/DELIVERY)
      where.order = {
        internalStage: "PACKING",
      };
    }

    const tasks = await prisma.packingTask.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        sku: true,
        order: {
          include: {
            lines: {
              include: {
                sku: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      tasks: tasks.map((t) => ({
        id: t.id,
        code: t.code,
        orderId: t.orderId,
        orderCode: t.order.uniwareOrderCode,
        displayOrderCode: t.order.displayOrderCode,
        channel: t.order.channel,
        destinationCountry: t.order.destinationCountry,
        skuCode: t.sku.code,
        skuName: t.sku.name,
        quantityRequired: t.quantityRequired,
        quantityCompleted: t.quantityCompleted,
        packagingType: t.packagingType,
        specialInstructions: t.specialInstructions,
        status: t.status,
        fulfillmentDeadline: t.order.fulfillmentDeadline,
        priorityLabel: t.order.priorityLabel,
        createdAt: t.createdAt,
        items: t.order?.lines?.map((l) => ({
          skuCode: l.sku.code,
          skuName: l.sku.name,
          quantity: l.quantity,
        })) || [
          {
            skuCode: t.sku.code,
            skuName: t.sku.name,
            quantity: t.quantityRequired,
          },
        ],
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
