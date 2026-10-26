import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getSessionUser } from "@/server/auth/session";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const activeOnly = searchParams.get("activeOnly") === "true";

    const where: any = {};
    if (activeOnly) {
      where.isActive = true;
    }
    if (category) {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const products = await prisma.sKU.findMany({
      where,
      orderBy: { code: "asc" },
      include: {
        finishedStock: true,
        _count: {
          select: {
            orderLines: true,
            productionOrders: true,
            packingTasks: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, products });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check: Admin, Operations Manager, Inventory Manager
    const allowedRoles = ["ADMIN", "OPERATIONS_MANAGER", "INVENTORY_MANAGER"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions to create products" }, { status: 403 });
    }

    const body = await req.json();
    const {
      code,
      name,
      category,
      description,
      unitOfManufacture,
      defaultLeadTimeDays,
      unitPrice,
      currency,
      domesticPackingType,
      exportPackingType,
      requiresSpecialHandling,
      productionNotes,
      qualityRequirements,
    } = body;

    if (!code || !code.trim() || !name || !name.trim()) {
      return NextResponse.json({ error: "Product SKU Code and Name are required" }, { status: 400 });
    }

    const existing = await prisma.sKU.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
    if (existing) {
      return NextResponse.json({ error: `Product with SKU ${code.trim().toUpperCase()} already exists` }, { status: 409 });
    }

    const product = await prisma.sKU.create({
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        category: category?.trim() || "Furniture",
        description: description?.trim() || null,
        unitOfManufacture: unitOfManufacture?.trim() || "PCS",
        defaultLeadTimeDays: Number(defaultLeadTimeDays) || 7,
        unitPrice: Number(unitPrice) || 0.0,
        currency: currency || "INR",
        domesticPackingType: domesticPackingType?.trim() || "Standard Box",
        exportPackingType: exportPackingType?.trim() || "Export Palletized Wooden Crate",
        requiresSpecialHandling: !!requiresSpecialHandling,
        productionNotes: productionNotes?.trim() || null,
        qualityRequirements: qualityRequirements?.trim() || null,
        isActive: true,
      },
    });

    // Create initial 0 inventory buckets for UNPACKED and PACKED
    await prisma.finishedGoodsStock.createMany({
      data: [
        { skuId: product.id, bucket: "UNPACKED", quantityOnHand: 0, quantityAvailable: 0, quantityReserved: 0 },
        { skuId: product.id, bucket: "PACKED", quantityOnHand: 0, quantityAvailable: 0, quantityReserved: 0 },
      ],
      skipDuplicates: true,
    });

    await prisma.auditLog.create({
      data: {
        entityType: "PRODUCT",
        entityId: product.id,
        action: "CREATE",
        actorId: user.id,
        actorEmail: user.email,
        changesJson: JSON.stringify(body),
      },
    });

    return NextResponse.json({ success: true, product });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
