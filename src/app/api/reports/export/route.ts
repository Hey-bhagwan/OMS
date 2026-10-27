import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import ExcelJS from "exceljs";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "orders";

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Koa Living OMS";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(type.toUpperCase().substring(0, 31));

    if (type === "orders" || type === "all_orders") {
      sheet.columns = [
        { header: "Order ID", key: "uniwareOrderCode", width: 16 },
        { header: "Marketplace Order #", key: "displayOrderCode", width: 24 },
        { header: "Channel", key: "channel", width: 16 },
        { header: "Internal Stage", key: "internalStage", width: 18 },
        { header: "Uniware Status", key: "uniwareStatus", width: 16 },
        { header: "Packaging", key: "packagingType", width: 14 },
        { header: "Destination City", key: "shippingAddressCity", width: 18 },
        { header: "Priority", key: "priorityLabel", width: 12 },
        { header: "Fulfillment Deadline", key: "fulfillmentDeadline", width: 22 },
        { header: "Blocker Reason", key: "blockerReason", width: 35 },
        { header: "Next Action", key: "nextAction", width: 40 },
        { header: "Staff Remark", key: "staffRemark", width: 30 },
      ];

      const orders = await prisma.order.findMany({
        orderBy: { createdAt: "desc" },
      });

      for (const o of orders) {
        sheet.addRow({
          uniwareOrderCode: o.uniwareOrderCode,
          displayOrderCode: o.displayOrderCode || "-",
          channel: o.channel,
          internalStage: o.internalStage,
          uniwareStatus: o.uniwareStatus,
          packagingType: o.packagingType,
          shippingAddressCity: o.shippingAddressCity || "-",
          totalAmount: Number(o.totalAmount),
          priorityLabel: o.priorityLabel,
          fulfillmentDeadline: o.fulfillmentDeadline ? format(new Date(o.fulfillmentDeadline), "yyyy-MM-dd HH:mm") : "-",
          blockerReason: o.blockerReason || "None",
          nextAction: o.nextAction || "-",
          staffRemark: o.staffRemark || "-",
        });
      }
    } else if (type === "raw_material_queue" || type === "raw_material") {
      sheet.columns = [
        { header: "Block ID", key: "id", width: 18 },
        { header: "Order Code", key: "orderCode", width: 16 },
        { header: "Marketplace #", key: "displayOrderCode", width: 22 },
        { header: "Channel", key: "channel", width: 15 },
        { header: "Product SKU", key: "skuCode", width: 18 },
        { header: "Product Name", key: "productName", width: 30 },
        { header: "Status", key: "status", width: 20 },
        { header: "Blocked Qty", key: "blockedQty", width: 14 },
        { header: "Released Qty", key: "releasedQty", width: 14 },
        { header: "Net Blocked Qty", key: "netBlockedQty", width: 16 },
        { header: "Order Deadline", key: "deadline", width: 22 },
        { header: "Reason / Remark", key: "reason", width: 40 },
        { header: "Assigned User", key: "assignedUser", width: 22 },
        { header: "Date Blocked", key: "dateBlocked", width: 22 },
      ];

      const blocks = await prisma.rawMaterialBlock.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          order: true,
          sku: true,
          assignedUser: true,
        },
      });

      for (const b of blocks) {
        sheet.addRow({
          id: b.id,
          orderCode: b.order.uniwareOrderCode,
          displayOrderCode: b.order.displayOrderCode || "-",
          channel: b.order.channel,
          skuCode: b.sku.code,
          productName: b.sku.name,
          status: b.status,
          blockedQty: b.blockedQuantity,
          releasedQty: b.releasedQuantity,
          netBlockedQty: Math.max(0, b.blockedQuantity - b.releasedQuantity),
          deadline: b.order.fulfillmentDeadline ? format(new Date(b.order.fulfillmentDeadline), "yyyy-MM-dd HH:mm") : "-",
          reason: b.reason,
          assignedUser: b.assignedUser ? `${b.assignedUser.name} (${b.assignedUser.email})` : "Unassigned",
          dateBlocked: format(new Date(b.createdAt), "yyyy-MM-dd HH:mm"),
        });
      }
    } else if (type === "production") {
      sheet.columns = [
        { header: "WO Code", key: "code", width: 18 },
        { header: "Product SKU", key: "skuCode", width: 18 },
        { header: "Product Name", key: "skuName", width: 30 },
        { header: "Linked Order", key: "orderCode", width: 16 },
        { header: "Required Qty", key: "quantityRequired", width: 14 },
        { header: "Completed Qty", key: "quantityCompleted", width: 14 },
        { header: "Rejected Qty", key: "quantityRejected", width: 14 },
        { header: "Status", key: "status", width: 16 },
        { header: "Target Date", key: "targetDate", width: 20 },
        { header: "Notes", key: "notes", width: 35 },
      ];

      const tasks = await prisma.productionOrder.findMany({
        orderBy: { createdAt: "desc" },
        include: { sku: true, orderLine: { include: { order: true } } },
      });

      for (const t of tasks) {
        sheet.addRow({
          code: t.code,
          skuCode: t.sku.code,
          skuName: t.sku.name,
          orderCode: t.orderLine?.order.uniwareOrderCode || "-",
          quantityRequired: t.quantityRequired,
          quantityCompleted: t.quantityCompleted,
          quantityRejected: t.quantityRejected,
          status: t.status,
          targetDate: t.expectedCompletionDate ? format(new Date(t.expectedCompletionDate), "yyyy-MM-dd") : "-",
          notes: t.notes || "-",
        });
      }
    } else if (type === "packing") {
      sheet.columns = [
        { header: "Task Code", key: "code", width: 18 },
        { header: "Order Code", key: "orderCode", width: 16 },
        { header: "SKU Code", key: "skuCode", width: 18 },
        { header: "Required Qty", key: "quantityRequired", width: 14 },
        { header: "Completed Qty", key: "quantityCompleted", width: 14 },
        { header: "Packaging Profile", key: "packagingType", width: 18 },
        { header: "Special Instructions", key: "specialInstructions", width: 40 },
        { header: "Status", key: "status", width: 16 },
      ];

      const tasks = await prisma.packingTask.findMany({
        orderBy: { createdAt: "desc" },
        include: { sku: true, order: true },
      });

      for (const t of tasks) {
        sheet.addRow({
          code: t.code,
          orderCode: t.order.uniwareOrderCode,
          skuCode: t.sku.code,
          quantityRequired: t.quantityRequired,
          quantityCompleted: t.quantityCompleted,
          packagingType: t.packagingType,
          specialInstructions: t.specialInstructions || "-",
          status: t.status,
        });
      }
    } else if (type === "dispatch") {
      sheet.columns = [
        { header: "Order Code", key: "orderCode", width: 16 },
        { header: "Marketplace #", key: "displayOrderCode", width: 22 },
        { header: "Channel", key: "channel", width: 16 },
        { header: "Destination City", key: "city", width: 18 },
        { header: "Total Units", key: "qty", width: 14 },
        { header: "Packed Units", key: "packedQty", width: 14 },
        { header: "Carrier", key: "courier", width: 18 },
        { header: "AWB / Waybill", key: "awb", width: 20 },
        { header: "Fulfillment Deadline", key: "deadline", width: 22 },
      ];

      const orders = await prisma.order.findMany({
        where: { internalStage: "DISPATCH" },
        include: { lines: true, shipments: true },
      });

      for (const o of orders) {
        sheet.addRow({
          orderCode: o.uniwareOrderCode,
          displayOrderCode: o.displayOrderCode || "-",
          channel: o.channel,
          city: o.shippingAddressCity || "-",
          qty: o.lines.reduce((a, l) => a + l.quantity, 0),
          packedQty: o.lines.reduce((a, l) => a + l.packedCompletedQty, 0),
          courier: o.shipments[0]?.courierName || "-",
          awb: o.shipments[0]?.awbWaybill || "-",
          deadline: o.fulfillmentDeadline ? format(new Date(o.fulfillmentDeadline), "yyyy-MM-dd HH:mm") : "-",
        });
      }
    } else if (type === "delivery") {
      sheet.columns = [
        { header: "AWB / Waybill", key: "awb", width: 20 },
        { header: "Carrier", key: "courier", width: 18 },
        { header: "Order Code", key: "orderCode", width: 16 },
        { header: "Status", key: "status", width: 18 },
        { header: "Current Hub / Location", key: "location", width: 24 },
        { header: "Latest Scan Activity", key: "activity", width: 35 },
        { header: "Estimated Delivery", key: "etd", width: 22 },
        { header: "Delivered At", key: "deliveredAt", width: 22 },
      ];

      const shipments = await prisma.shipment.findMany({
        orderBy: { updatedAt: "desc" },
        include: { order: true },
      });

      for (const s of shipments) {
        sheet.addRow({
          awb: s.awbWaybill,
          courier: s.courierName,
          orderCode: s.order?.uniwareOrderCode || s.uniwareOrderCode || "-",
          status: s.normalizedStatus,
          location: s.currentScanLocation || "-",
          activity: s.currentScanActivity || "-",
          etd: s.etdDate ? format(new Date(s.etdDate), "yyyy-MM-dd HH:mm") : "-",
          deliveredAt: s.deliveredAt ? format(new Date(s.deliveredAt), "yyyy-MM-dd HH:mm") : "-",
        });
      }
    } else if (type === "stock_history") {
      sheet.columns = [
        { header: "Timestamp", key: "timestamp", width: 22 },
        { header: "SKU Code", key: "skuCode", width: 18 },
        { header: "Bucket", key: "bucket", width: 14 },
        { header: "Quantity Change", key: "change", width: 16 },
        { header: "Transaction Type", key: "type", width: 22 },
        { header: "Reason", key: "reason", width: 35 },
        { header: "Reference Type", key: "refType", width: 18 },
        { header: "Reference ID", key: "refId", width: 20 },
      ];

      const txs = await prisma.inventoryTransaction.findMany({
        take: 200,
        orderBy: { timestamp: "desc" },
        include: { sku: true },
      });

      for (const t of txs) {
        sheet.addRow({
          timestamp: format(new Date(t.timestamp), "yyyy-MM-dd HH:mm"),
          skuCode: t.sku?.code || "-",
          bucket: t.bucket,
          change: Number(t.quantityChange),
          type: t.type,
          reason: t.reason,
          refType: t.referenceType || "-",
          refId: t.referenceId || "-",
        });
      }
    } else if (type === "products" || type === "product_master") {
      sheet.columns = [
        { header: "SKU Code", key: "code", width: 18 },
        { header: "Product Name", key: "name", width: 30 },
        { header: "Category", key: "category", width: 18 },
        { header: "Unit of Measure", key: "uom", width: 16 },
        { header: "Lead Time (Days)", key: "leadTime", width: 16 },
        { header: "Domestic Packaging", key: "domesticPacking", width: 24 },
        { header: "Export Packaging", key: "exportPacking", width: 30 },
        { header: "Active Status", key: "status", width: 14 },
      ];

      const products = await prisma.sKU.findMany({ orderBy: { code: "asc" } });
      for (const p of products) {
        sheet.addRow({
          code: p.code,
          name: p.name,
          category: p.category || "-",
          uom: p.unitOfManufacture,
          leadTime: p.defaultLeadTimeDays,
          price: Number(p.unitPrice),
          domesticPacking: p.domesticPackingType,
          exportPacking: p.exportPackingType,
          status: p.isActive ? "ACTIVE" : "INACTIVE",
        });
      }
    } else {
      // Stock balance (packed / unpacked)
      const bucket = type === "packed" || type === "packed_inventory" ? "PACKED" : "UNPACKED";
      sheet.columns = [
        { header: "SKU Code", key: "code", width: 18 },
        { header: "Product Name", key: "name", width: 35 },
        { header: "Category", key: "category", width: 16 },
        { header: "Bucket", key: "bucket", width: 12 },
        { header: "On Hand", key: "quantityOnHand", width: 14 },
        { header: "Reserved", key: "quantityReserved", width: 14 },
        { header: "Available", key: "quantityAvailable", width: 14 },
        { header: "Bin Location", key: "binLocation", width: 20 },
      ];

      const stocks = await prisma.finishedGoodsStock.findMany({
        where: { bucket },
        include: { sku: true },
      });

      for (const s of stocks) {
        sheet.addRow({
          code: s.sku.code,
          name: s.sku.name,
          category: s.sku.category || "-",
          bucket: s.bucket,
          quantityOnHand: s.quantityOnHand,
          quantityReserved: s.quantityReserved,
          quantityAvailable: s.quantityAvailable,
          binLocation: s.binLocation || "-",
        });
      }
    }

    // Header styling
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2C2018" },
    };

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="koa_living_${type}_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
