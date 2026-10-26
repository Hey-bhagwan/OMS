import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getSessionUser } from "@/server/auth/session";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");
    const rawMaterialBlockId = searchParams.get("rawMaterialBlockId");
    const productionOrderId = searchParams.get("productionOrderId");
    const packingTaskId = searchParams.get("packingTaskId");
    const shipmentId = searchParams.get("shipmentId");

    const where: any = {};
    if (orderId) where.orderId = orderId;
    if (rawMaterialBlockId) where.rawMaterialBlockId = rawMaterialBlockId;
    if (productionOrderId) where.productionOrderId = productionOrderId;
    if (packingTaskId) where.packingTaskId = packingTaskId;
    if (shipmentId) where.shipmentId = shipmentId;

    const remarks = await prisma.orderRemark.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, remarks });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    const body = await req.json();
    const { orderId, orderLineId, rawMaterialBlockId, productionOrderId, packingTaskId, shipmentId, stage, quantity, text } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Remark text is required" }, { status: 400 });
    }

    const remark = await prisma.orderRemark.create({
      data: {
        orderId,
        orderLineId,
        rawMaterialBlockId,
        productionOrderId,
        packingTaskId,
        shipmentId,
        stage,
        quantity: quantity ? Number(quantity) : undefined,
        text: text.trim(),
        authorName: user?.name || "Staff Member",
        authorEmail: user?.email,
        authorId: user?.id,
      },
    });

    return NextResponse.json({ success: true, remark });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
