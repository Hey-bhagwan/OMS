import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();

    const where: any = { bucket: "PACKED" };
    if (search) {
      where.sku = {
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const stocks = await prisma.finishedGoodsStock.findMany({
      where,
      include: { sku: true },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      stocks: stocks.map((s) => ({
        id: s.id,
        skuId: s.skuId,
        skuCode: s.sku.code,
        skuName: s.sku.name,
        category: s.sku.category,
        packingType: s.sku.domesticPackingType,
        quantityOnHand: s.quantityOnHand,
        quantityReserved: s.quantityReserved,
        quantityAvailable: s.quantityAvailable,
        binLocation: s.binLocation || "Standard Packed Warehouse",
        updatedAt: s.updatedAt,
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
