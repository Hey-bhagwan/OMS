import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        lines: {
          include: {
            sku: true,
            reservations: true,
            productionOrders: {
              orderBy: { createdAt: "desc" },
            },
            packingTasks: {
              orderBy: { createdAt: "desc" },
            },
            rawMaterialBlocks: {
              orderBy: { createdAt: "desc" },
              include: {
                assignedUser: { select: { id: true, name: true, email: true } },
                remarks: { orderBy: { createdAt: "desc" } },
              },
            },
          },
        },
        stageHistory: {
          orderBy: { timestamp: "desc" },
        },
        packingTasks: true,
        shipments: {
          include: {
            events: {
              orderBy: { eventTimestamp: "desc" },
            },
          },
        },
        rawMaterialBlocks: {
          orderBy: { createdAt: "desc" },
          include: {
            sku: true,
            assignedUser: { select: { id: true, name: true, email: true } },
            remarks: { orderBy: { createdAt: "desc" } },
          },
        },
        remarks: {
          orderBy: { createdAt: "desc" },
        },
        workflowDecisions: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, order });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
