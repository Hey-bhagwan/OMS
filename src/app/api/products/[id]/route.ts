import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getSessionUser } from "@/server/auth/session";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const product = await prisma.sKU.findUnique({
      where: { id: params.id },
      include: {
        finishedStock: true,
        orderLines: {
          take: 5,
          orderBy: { createdAt: "desc" },
          include: { order: true },
        },
        productionOrders: {
          take: 5,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, product });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowedRoles = ["ADMIN", "OPERATIONS_MANAGER", "INVENTORY_MANAGER"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const body = await req.json();
    const existing = await prisma.sKU.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const updated = await prisma.sKU.update({
      where: { id: params.id },
      data: {
        name: body.name !== undefined ? body.name.trim() : existing.name,
        category: body.category !== undefined ? body.category?.trim() : existing.category,
        description: body.description !== undefined ? body.description?.trim() : existing.description,
        unitOfManufacture: body.unitOfManufacture !== undefined ? body.unitOfManufacture.trim() : existing.unitOfManufacture,
        defaultLeadTimeDays: body.defaultLeadTimeDays !== undefined ? Number(body.defaultLeadTimeDays) : existing.defaultLeadTimeDays,
        unitPrice: body.unitPrice !== undefined ? Number(body.unitPrice) : existing.unitPrice,
        currency: body.currency !== undefined ? body.currency : existing.currency,
        domesticPackingType: body.domesticPackingType !== undefined ? body.domesticPackingType.trim() : existing.domesticPackingType,
        exportPackingType: body.exportPackingType !== undefined ? body.exportPackingType.trim() : existing.exportPackingType,
        requiresSpecialHandling: body.requiresSpecialHandling !== undefined ? !!body.requiresSpecialHandling : existing.requiresSpecialHandling,
        productionNotes: body.productionNotes !== undefined ? body.productionNotes?.trim() : existing.productionNotes,
        qualityRequirements: body.qualityRequirements !== undefined ? body.qualityRequirements?.trim() : existing.qualityRequirements,
        isActive: body.isActive !== undefined ? !!body.isActive : existing.isActive,
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: "PRODUCT",
        entityId: updated.id,
        action: "UPDATE",
        actorId: user.id,
        actorEmail: user.email,
        changesJson: JSON.stringify(body),
      },
    });

    return NextResponse.json({ success: true, product: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only administrators can deactivate products" }, { status: 403 });
    }

    // Soft deactivation to preserve historical records
    const product = await prisma.sKU.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        entityType: "PRODUCT",
        entityId: product.id,
        action: "DEACTIVATE",
        actorId: user.id,
        actorEmail: user.email,
      },
    });

    return NextResponse.json({ success: true, product });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
