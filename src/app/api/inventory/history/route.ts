import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bucket = searchParams.get("bucket");
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

    const where: any = {};
    if (bucket) where.bucket = bucket;

    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      take: limit,
      orderBy: { timestamp: "desc" },
      include: {
        sku: true,
      },
    });

    return NextResponse.json({
      success: true,
      transactions: transactions.map((t) => ({
        id: t.id,
        bucket: t.bucket,
        itemCode: t.sku?.code || "N/A",
        itemName: t.sku?.name || "Finished Goods",
        quantityChange: Number(t.quantityChange),
        type: t.type,
        reason: t.reason,
        referenceType: t.referenceType,
        referenceId: t.referenceId,
        timestamp: t.timestamp,
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
