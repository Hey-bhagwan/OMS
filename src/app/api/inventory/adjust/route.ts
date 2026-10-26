import { NextRequest, NextResponse } from "next/server";
import { inventoryService } from "@/server/services/inventory.service";
import { getSessionUser } from "@/server/auth/session";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    const body = await req.json();

    const { skuId, bucket, quantityChange, reason } = body;

    if (bucket !== "PACKED" && bucket !== "UNPACKED") {
      return NextResponse.json(
        { error: "Raw material inventory adjustments are disabled. Only finished goods (PACKED or UNPACKED) can be adjusted." },
        { status: 400 }
      );
    }

    if (!skuId || !quantityChange || !reason) {
      return NextResponse.json({ error: "Missing required adjustment fields: skuId, bucket, quantityChange, reason" }, { status: 400 });
    }

    const result = await inventoryService.adjustStock({
      skuId,
      bucket,
      quantityChange: Number(quantityChange),
      reason,
      actorId: user?.id,
      actorEmail: user?.email,
      referenceType: "MANUAL_ADJUSTMENT",
    });

    return NextResponse.json({ ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
