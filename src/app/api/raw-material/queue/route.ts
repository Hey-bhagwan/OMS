import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "BLOCKED"; // "BLOCKED", "PENDING_ASSESSMENT", "RESOLVED", "ALL"
    const channel = searchParams.get("channel") || "";
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const where: any = {};

    if (status !== "ALL") {
      if (status === "ACTIVE") {
        where.status = { in: ["BLOCKED", "PENDING_ASSESSMENT"] };
      } else {
        where.status = status;
      }
    }

    if (channel) {
      where.order = { channel };
    }

    if (search) {
      where.OR = [
        { reason: { contains: search, mode: "insensitive" } },
        { order: { uniwareOrderCode: { contains: search, mode: "insensitive" } } },
        { order: { displayOrderCode: { contains: search, mode: "insensitive" } } },
        { sku: { code: { contains: search, mode: "insensitive" } } },
        { sku: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [total, blocks] = await Promise.all([
      prisma.rawMaterialBlock.count({ where }),
      prisma.rawMaterialBlock.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: sortBy === "fulfillmentDeadline"
          ? { order: { fulfillmentDeadline: sortOrder } }
          : { [sortBy]: sortOrder },
        include: {
          order: {
            select: {
              id: true,
              uniwareOrderCode: true,
              displayOrderCode: true,
              channel: true,
              internalStage: true,
              fulfillmentDeadline: true,
              packagingType: true,
              priorityLabel: true,
              createdAt: true,
            },
          },
          orderLine: {
            select: {
              id: true,
              quantity: true,
              allocatedPackedQty: true,
              allocatedUnpackedQty: true,
              requiredProductionQty: true,
              blockedRawMaterialQty: true,
            },
          },
          sku: {
            select: {
              id: true,
              code: true,
              name: true,
              unitOfManufacture: true,
              category: true,
            },
          },
          assignedUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          remarks: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      }),
    ]);

    // Format response
    const formatted = blocks.map((b) => ({
      id: b.id,
      orderId: b.orderId,
      orderLineId: b.orderLineId,
      orderCode: b.order.uniwareOrderCode,
      displayOrderCode: b.order.displayOrderCode,
      channel: b.order.channel,
      skuId: b.skuId,
      skuCode: b.sku.code,
      productName: b.sku.name,
      unitOfManufacture: b.sku.unitOfManufacture,
      blockedQuantity: b.blockedQuantity,
      releasedQuantity: b.releasedQuantity,
      netBlockedQuantity: Math.max(0, b.blockedQuantity - b.releasedQuantity),
      status: b.status,
      orderDeadline: b.order.fulfillmentDeadline,
      reason: b.reason,
      assignedUser: b.assignedUser ? { id: b.assignedUser.id, name: b.assignedUser.name, email: b.assignedUser.email } : null,
      dateBlocked: b.createdAt,
      lastUpdated: b.updatedAt,
      resolvedAt: b.resolvedAt,
      remarks: b.remarks,
    }));

    return NextResponse.json({
      success: true,
      blocks: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
