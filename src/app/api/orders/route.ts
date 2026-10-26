import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { InternalStage } from "@prisma/client";
import { workflowService } from "@/server/services/workflow.service";
import { getSessionUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const stage = searchParams.get("stage") as InternalStage | null;
    const channel = searchParams.get("channel");
    const search = searchParams.get("search")?.trim();
    const isOverdue = searchParams.get("isOverdue") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "15", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (stage) {
      where.internalStage = stage;
    }

    if (channel) {
      where.channel = channel;
    }

    if (isOverdue) {
      where.fulfillmentDeadline = { lt: new Date() };
      where.internalStage = { not: "DELIVERY" };
    }

    if (search) {
      where.OR = [
        { uniwareOrderCode: { contains: search, mode: "insensitive" } },
        { displayOrderCode: { contains: search, mode: "insensitive" } },
        { shippingAddressCity: { contains: search, mode: "insensitive" } },
        { lines: { some: { sku: { code: { contains: search, mode: "insensitive" } } } } },
        { lines: { some: { sku: { name: { contains: search, mode: "insensitive" } } } } },
      ];
    }

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
        include: {
          lines: {
            include: {
              sku: true,
            },
          },
          shipments: true,
        },
      }),
    ]);

    return NextResponse.json({
      orders: orders.map((o) => ({
        id: o.id,
        uniwareOrderCode: o.uniwareOrderCode,
        displayOrderCode: o.displayOrderCode,
        channel: o.channel,
        uniwareStatus: o.uniwareStatus,
        internalStage: o.internalStage,
        packagingType: o.packagingType,
        destinationCountry: o.destinationCountry,
        shippingAddressCity: o.shippingAddressCity,
        totalAmount: Number(o.totalAmount),
        currency: o.currency,
        isCod: o.isCod,
        fulfillmentDeadline: o.fulfillmentDeadline,
        priorityScore: o.priorityScore,
        priorityLabel: o.priorityLabel,
        blockerReason: o.blockerReason,
        nextAction: o.nextAction,
        createdAt: o.createdAt,
        totalItems: o.lines.reduce((sum, l) => sum + l.quantity, 0),
        items: o.lines.map((l) => ({
          id: l.id,
          skuCode: l.sku.code,
          skuName: l.sku.name,
          quantity: l.quantity,
          allocatedPackedQty: l.allocatedPackedQty,
          allocatedUnpackedQty: l.allocatedUnpackedQty,
          requiredProductionQty: l.requiredProductionQty,
          requiredRawMaterialQty: l.requiredRawMaterialQty,
          packedCompletedQty: l.packedCompletedQty,
          unitPrice: Number(l.unitPrice),
        })),
        primarySku: o.lines[0]?.sku.code || "N/A",
        primaryProductName: o.lines[0]?.sku.name || "N/A",
        awb: o.shipments[0]?.awbWaybill,
        shipmentStatus: o.shipments[0]?.normalizedStatus,
      })),
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

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    const body = await req.json();

    const {
      skuId,
      skuCode,
      quantity,
      channel,
      destinationCountry,
      city,
      rawMaterialDecision,
      remark,
      daysUntilDeadline,
    } = body;

    const qty = parseInt(quantity || "1", 10);
    if (!qty || qty <= 0) {
      return NextResponse.json({ error: "Quantity must be greater than zero" }, { status: 400 });
    }

    // Find SKU
    let targetSku = null;
    if (skuId) {
      targetSku = await prisma.sKU.findUnique({ where: { id: skuId } });
    } else if (skuCode) {
      targetSku = await prisma.sKU.findUnique({ where: { code: skuCode.trim().toUpperCase() } });
    } else {
      targetSku = await prisma.sKU.findFirst({ where: { isActive: true } });
    }

    if (!targetSku) {
      return NextResponse.json({ error: "Product SKU not found" }, { status: 404 });
    }

    const country = (destinationCountry || "IN").toUpperCase();
    const isExport = country !== "IN";
    const deadlineDays = parseInt(daysUntilDeadline || "4", 10);
    const fulfillmentDeadline = new Date(Date.now() + deadlineDays * 24 * 3600 * 1000);

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderCode = `KL-${Date.now().toString().slice(-4)}${randomSuffix}`;
    const displayCode = `${(channel || "WEB").slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;
    const unitPrice = Number(targetSku.unitPrice || 45000);
    const totalAmount = unitPrice * qty;

    if (rawMaterialDecision === "UNAVAILABLE" && (!remark || !remark.trim())) {
      return NextResponse.json(
        { error: "A meaningful remark is required when marking raw material unavailable" },
        { status: 400 }
      );
    }

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          uniwareOrderCode: orderCode,
          displayOrderCode: displayCode,
          channel: (channel || "CUSTOM").toUpperCase(),
          source: "MANUAL_ENTRY",
          uniwareStatus: "PROCESSING",
          internalStage: "RAW_MATERIAL",
          packagingType: isExport ? "EXPORT" : "DOMESTIC",
          destinationCountry: country,
          shippingAddressCity: city || (country === "IN" ? "Mumbai" : "New York"),
          shippingAddressState: country === "IN" ? "Maharashtra" : "NY",
          currency: country === "IN" ? "INR" : "USD",
          totalAmount,
          fulfillmentDeadline,
          rawMaterialDecision: rawMaterialDecision || undefined,
          staffRemark: remark?.trim() || undefined,
        },
      });

      await tx.orderLine.create({
        data: {
          orderId: newOrder.id,
          skuId: targetSku.id,
          quantity: qty,
          unitPrice,
          status: "CREATED",
        },
      });

      return newOrder;
    });

    // Run deterministic next-action engine
    const evaluation = await workflowService.allocateOrder(order.id, user?.id);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderCode: order.uniwareOrderCode,
      evaluation,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
