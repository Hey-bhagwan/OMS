const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database with synthetic sample data for Koa Living OMS...");

  // 1. Users
  const passwordHash = await bcrypt.hash("KoaLiving2026!", 10);
  const usersData = [
    { email: "admin@koaliving.com", name: "Ananya Sharma (Admin)", role: "ADMIN" },
    { email: "ops@koaliving.com", name: "Vikram Malhotra (Ops Mgr)", role: "OPERATIONS_MANAGER" },
    { email: "inventory@koaliving.com", name: "Rajesh Kumar (Inventory Mgr)", role: "INVENTORY_MANAGER" },
    { email: "production@koaliving.com", name: "Devendra Saini (Production Head)", role: "PRODUCTION_STAFF" },
    { email: "packing@koaliving.com", name: "Manoj Verma (Packing Lead)", role: "PACKING_STAFF" },
    { email: "dispatch@koaliving.com", name: "Sunil Joshi (Dispatch Lead)", role: "DISPATCH_STAFF" },
    { email: "auditor@koaliving.com", name: "Pooja Hegde (Compliance Auditor)", role: "AUDITOR" },
  ];

  const createdUsers = {};
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, passwordHash },
      create: { ...u, passwordHash },
    });
    createdUsers[u.role] = user;
  }
  console.log("Users seeded successfully.");

  // 2. Raw Materials
  const rawMaterialsData = [
    { code: "RM-MRB-WHT", name: "White Makrana Marble Slab (20mm)", unitOfMeasure: "SQFT", currentStock: 1250, availableStock: 950, reservedStock: 300, reorderThreshold: 200, supplier: "Rajasthan Stone Craft", leadTimeDays: 14 },
    { code: "RM-MRB-BLK", name: "Black Marquina Marble Slab", unitOfMeasure: "SQFT", currentStock: 80, availableStock: 20, reservedStock: 60, reorderThreshold: 100, supplier: "Udaipur Marble Traders", leadTimeDays: 10 },
    { code: "RM-WOD-TK", name: "Seasoned CP Teak Wood Plank", unitOfMeasure: "CFT", currentStock: 450, availableStock: 380, reservedStock: 70, reorderThreshold: 150, supplier: "Central Timbers", leadTimeDays: 21 },
    { code: "RM-MET-BRS", name: "Solid Brass Inlay Strip (10mm)", unitOfMeasure: "MTR", currentStock: 620, availableStock: 500, reservedStock: 120, reorderThreshold: 100, supplier: "Moradabad Brass Works", leadTimeDays: 7 },
    { code: "RM-PKG-EXP-CRATE", name: "ISPM-15 Heat Treated Export Wooden Crate", unitOfMeasure: "PCS", currentStock: 85, availableStock: 65, reservedStock: 20, reorderThreshold: 30, supplier: "SafePack Solutions", leadTimeDays: 5 },
    { code: "RM-PKG-DOM-BOX", name: "7-Ply Heavy Duty Corrugated Master Carton", unitOfMeasure: "PCS", currentStock: 400, availableStock: 340, reservedStock: 60, reorderThreshold: 100, supplier: "Durable Packaging", leadTimeDays: 4 },
  ];

  const createdRawMaterials = {};
  for (const rm of rawMaterialsData) {
    const item = await prisma.rawMaterial.upsert({
      where: { code: rm.code },
      update: rm,
      create: rm,
    });
    createdRawMaterials[rm.code] = item;
  }
  console.log("Raw materials seeded.");

  // 3. Products & SKUs
  const skusData = [
    {
      code: "KLT2025-004",
      name: "Cala Round White Marble Dining Table",
      description: "Handcrafted round dining table featuring premium White Makrana marble top and solid teak fluted base.",
      category: "Tables",
      unitPrice: 48500.0,
      currency: "INR",
      domesticPackingType: "Reinforced 7-Ply Box with Edge Protectors",
      exportPackingType: "ISPM-15 Certified Fumigated Crate",
      bom: [
        { rawMaterialCode: "RM-MRB-WHT", quantityRequired: 18.5, wastagePercent: 5.0 },
        { rawMaterialCode: "RM-WOD-TK", quantityRequired: 4.2, wastagePercent: 8.0 },
        { rawMaterialCode: "RM-MET-BRS", quantityRequired: 3.0, wastagePercent: 2.0 },
      ],
      stock: { unpacked: 8, packed: 4 },
    },
    {
      code: "KLST2026-006",
      name: "Sol Boardgame Marble Coffee Table",
      description: "Dual-purpose conversational coffee table with inset boardgame grid in brass and black marble.",
      category: "Tables",
      unitPrice: 34000.0,
      currency: "INR",
      domesticPackingType: "Reinforced 7-Ply Box with Foam Mold",
      exportPackingType: "ISPM-15 Export Crate",
      bom: [
        { rawMaterialCode: "RM-MRB-BLK", quantityRequired: 12.0, wastagePercent: 5.0 },
        { rawMaterialCode: "RM-MET-BRS", quantityRequired: 6.5, wastagePercent: 3.0 },
        { rawMaterialCode: "RM-WOD-TK", quantityRequired: 2.5, wastagePercent: 5.0 },
      ],
      stock: { unpacked: 3, packed: 2 },
    },
    {
      code: "KLT2025-001",
      name: "Dune Natural Stone Accent Bowl",
      description: "Sculptural hand-carved decorative stone vessel.",
      category: "Decor",
      unitPrice: 6500.0,
      currency: "INR",
      domesticPackingType: "Molded EPS Carton",
      exportPackingType: "Export Air-Freight Carton with Shock Absorbers",
      bom: [
        { rawMaterialCode: "RM-MRB-WHT", quantityRequired: 2.5, wastagePercent: 10.0 },
      ],
      stock: { unpacked: 25, packed: 14 },
    },
    {
      code: "KLT2025-002",
      name: "Stella Solid Brass Centerpiece Bowl",
      description: "Spun brass bowl with matte brushed finish.",
      category: "Decor",
      unitPrice: 8200.0,
      currency: "INR",
      domesticPackingType: "Velvet Pouch + Rigid Gift Box",
      exportPackingType: "Export Master Shipper",
      bom: [
        { rawMaterialCode: "RM-MET-BRS", quantityRequired: 4.0, wastagePercent: 4.0 },
      ],
      stock: { unpacked: 12, packed: 18 },
    },
  ];

  const createdSkus = {};
  for (const s of skusData) {
    const sku = await prisma.sKU.upsert({
      where: { code: s.code },
      update: {
        name: s.name,
        description: s.description,
        category: s.category,
        unitPrice: s.unitPrice,
        currency: s.currency,
        domesticPackingType: s.domesticPackingType,
        exportPackingType: s.exportPackingType,
      },
      create: {
        code: s.code,
        name: s.name,
        description: s.description,
        category: s.category,
        unitPrice: s.unitPrice,
        currency: s.currency,
        domesticPackingType: s.domesticPackingType,
        exportPackingType: s.exportPackingType,
      },
    });
    createdSkus[s.code] = sku;

    // BOM
    for (const b of s.bom) {
      const rm = createdRawMaterials[b.rawMaterialCode];
      if (rm) {
        await prisma.billOfMaterials.upsert({
          where: { skuId_rawMaterialId: { skuId: sku.id, rawMaterialId: rm.id } },
          update: { quantityRequired: b.quantityRequired, wastagePercent: b.wastagePercent },
          create: { skuId: sku.id, rawMaterialId: rm.id, quantityRequired: b.quantityRequired, wastagePercent: b.wastagePercent },
        });
      }
    }

    // Finished Goods stock
    await prisma.finishedGoodsStock.upsert({
      where: { skuId_bucket: { skuId: sku.id, bucket: "UNPACKED" } },
      update: { quantityOnHand: s.stock.unpacked, quantityAvailable: s.stock.unpacked, quantityReserved: 0 },
      create: { skuId: sku.id, bucket: "UNPACKED", quantityOnHand: s.stock.unpacked, quantityAvailable: s.stock.unpacked, quantityReserved: 0, binLocation: "Aisle-2-Bay-B" },
    });

    await prisma.finishedGoodsStock.upsert({
      where: { skuId_bucket: { skuId: sku.id, bucket: "PACKED" } },
      update: { quantityOnHand: s.stock.packed, quantityAvailable: s.stock.packed, quantityReserved: 0 },
      create: { skuId: sku.id, bucket: "PACKED", quantityOnHand: s.stock.packed, quantityAvailable: s.stock.packed, quantityReserved: 0, binLocation: "PackZone-Rack-1" },
    });

    // Opening balance transaction
    await prisma.inventoryTransaction.create({
      data: {
        skuId: sku.id,
        bucket: "PACKED",
        quantityChange: s.stock.packed,
        type: "OPENING_BALANCE",
        reason: "Initial system migration balance setup",
        actorId: createdUsers["ADMIN"].id,
        idempotencyKey: `INIT-PACKED-${sku.code}`,
      },
    }).catch(() => {});
  }
  console.log("SKUs, BOM, and Inventory Balances seeded.");

  // 4. Sample Orders representing each internal workflow stage
  const now = new Date();
  const pastDays = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
  const futureDays = (d) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  const sampleOrders = [
    {
      uniwareOrderCode: "IK9259",
      displayOrderCode: "AMZ-405-8839210-9182341",
      channel: "Amazon IN",
      source: "UNIWARE",
      uniwareStatus: "PROCESSING",
      internalStage: "PACKING",
      packagingType: "DOMESTIC",
      destinationCountry: "IN",
      shippingAddressCity: "Mumbai",
      shippingAddressState: "Maharashtra",
      currency: "INR",
      totalAmount: 48500.0,
      isCod: false,
      displayOrderDateTime: pastDays(1),
      fulfillmentDeadline: futureDays(1),
      priorityScore: 75,
      priorityLabel: "HIGH",
      blockerReason: null,
      nextAction: "Complete domestic reinforced packaging and print shipping label",
      skuCode: "KLT2025-004",
      quantity: 1,
    },
    {
      uniwareOrderCode: "IK9260",
      displayOrderCode: "SHOPIFY-KL-10944",
      channel: "Shopify Store",
      source: "UNIWARE",
      uniwareStatus: "PROCESSING",
      internalStage: "RAW_MATERIAL",
      packagingType: "DOMESTIC",
      destinationCountry: "IN",
      shippingAddressCity: "Bengaluru",
      shippingAddressState: "Karnataka",
      currency: "INR",
      totalAmount: 68000.0,
      isCod: false,
      displayOrderDateTime: pastDays(3),
      fulfillmentDeadline: pastDays(1), // Overdue!
      priorityScore: 95,
      priorityLabel: "OVERDUE",
      blockerReason: "Black Marquina marble stock critically low (< 20 sqft available)",
      nextAction: "Expedite raw material procurement PO #PO-2026-088",
      skuCode: "KLST2026-006",
      quantity: 2,
    },
    {
      uniwareOrderCode: "IK9261",
      displayOrderCode: "AMZ-402-9912440-1102938",
      channel: "Amazon IN",
      source: "UNIWARE",
      uniwareStatus: "PROCESSING",
      internalStage: "PRODUCTION",
      packagingType: "DOMESTIC",
      destinationCountry: "IN",
      shippingAddressCity: "New Delhi",
      shippingAddressState: "Delhi",
      currency: "INR",
      totalAmount: 48500.0,
      isCod: false,
      displayOrderDateTime: pastDays(2),
      fulfillmentDeadline: futureDays(2),
      priorityScore: 65,
      priorityLabel: "NORMAL",
      blockerReason: null,
      nextAction: "CNC marble carving in progress, inspect edge beveling",
      skuCode: "KLT2025-004",
      quantity: 1,
    },
    {
      uniwareOrderCode: "IK9262",
      displayOrderCode: "B2B-EXP-GRAN-2026-01",
      channel: "Wholesale Export",
      source: "UNIWARE",
      uniwareStatus: "PROCESSING",
      internalStage: "PACKING",
      packagingType: "EXPORT",
      destinationCountry: "DE",
      shippingAddressCity: "Hamburg",
      shippingAddressState: "Hamburg",
      currency: "INR",
      totalAmount: 97000.0,
      isCod: false,
      displayOrderDateTime: pastDays(4),
      fulfillmentDeadline: futureDays(1),
      priorityScore: 85,
      priorityLabel: "URGENT",
      blockerReason: null,
      nextAction: "Pack into ISPM-15 export wooden crate with shock sensor labels",
      skuCode: "KLT2025-004",
      quantity: 2,
    },
    {
      uniwareOrderCode: "IK9263",
      displayOrderCode: "SHOPIFY-KL-10948",
      channel: "Shopify Store",
      source: "UNIWARE",
      uniwareStatus: "COMPLETE",
      internalStage: "DISPATCH",
      packagingType: "DOMESTIC",
      destinationCountry: "IN",
      shippingAddressCity: "Pune",
      shippingAddressState: "Maharashtra",
      currency: "INR",
      totalAmount: 13000.0,
      isCod: false,
      displayOrderDateTime: pastDays(2),
      fulfillmentDeadline: futureDays(2),
      priorityScore: 50,
      priorityLabel: "NORMAL",
      blockerReason: null,
      nextAction: "Handover parcel to Shiprocket courier pickup executive",
      skuCode: "KLT2025-001",
      quantity: 2,
    },
    {
      uniwareOrderCode: "IK9264",
      displayOrderCode: "SHOPIFY-KL-10930",
      channel: "Shopify Store",
      source: "UNIWARE",
      uniwareStatus: "COMPLETE",
      internalStage: "DELIVERY",
      packagingType: "DOMESTIC",
      destinationCountry: "IN",
      shippingAddressCity: "Hyderabad",
      shippingAddressState: "Telangana",
      currency: "INR",
      totalAmount: 16400.0,
      isCod: false,
      displayOrderDateTime: pastDays(5),
      fulfillmentDeadline: pastDays(2),
      priorityScore: 40,
      priorityLabel: "NORMAL",
      blockerReason: null,
      nextAction: "In transit with Shiprocket Bluedart, out for delivery today",
      skuCode: "KLT2025-002",
      quantity: 2,
    },
    {
      uniwareOrderCode: "IK9265",
      displayOrderCode: "AMZ-408-7712390-3301928",
      channel: "Amazon IN",
      source: "UNIWARE",
      uniwareStatus: "PROCESSING",
      internalStage: "DELIVERY_EXCEPTION",
      packagingType: "DOMESTIC",
      destinationCountry: "IN",
      shippingAddressCity: "Jaipur",
      shippingAddressState: "Rajasthan",
      currency: "INR",
      totalAmount: 34000.0,
      isCod: true,
      displayOrderDateTime: pastDays(6),
      fulfillmentDeadline: pastDays(1),
      priorityScore: 90,
      priorityLabel: "URGENT",
      blockerReason: "Consignee unavailable after 2 delivery attempts",
      nextAction: "Contact customer via Ops helpline to re-schedule delivery or trigger RTO prevention",
      skuCode: "KLST2026-006",
      quantity: 1,
    },
  ];

  for (const o of sampleOrders) {
    const sku = createdSkus[o.skuCode];
    const order = await prisma.order.upsert({
      where: { uniwareOrderCode: o.uniwareOrderCode },
      update: {
        displayOrderCode: o.displayOrderCode,
        channel: o.channel,
        source: o.source,
        uniwareStatus: o.uniwareStatus,
        internalStage: o.internalStage,
        packagingType: o.packagingType,
        destinationCountry: o.destinationCountry,
        shippingAddressCity: o.shippingAddressCity,
        shippingAddressState: o.shippingAddressState,
        currency: o.currency,
        totalAmount: o.totalAmount,
        isCod: o.isCod,
        displayOrderDateTime: o.displayOrderDateTime,
        fulfillmentDeadline: o.fulfillmentDeadline,
        priorityScore: o.priorityScore,
        priorityLabel: o.priorityLabel,
        blockerReason: o.blockerReason,
        nextAction: o.nextAction,
        assignedUserId: createdUsers["OPERATIONS_MANAGER"].id,
      },
      create: {
        uniwareOrderCode: o.uniwareOrderCode,
        displayOrderCode: o.displayOrderCode,
        channel: o.channel,
        source: o.source,
        uniwareStatus: o.uniwareStatus,
        internalStage: o.internalStage,
        packagingType: o.packagingType,
        destinationCountry: o.destinationCountry,
        shippingAddressCity: o.shippingAddressCity,
        shippingAddressState: o.shippingAddressState,
        currency: o.currency,
        totalAmount: o.totalAmount,
        isCod: o.isCod,
        displayOrderDateTime: o.displayOrderDateTime,
        fulfillmentDeadline: o.fulfillmentDeadline,
        priorityScore: o.priorityScore,
        priorityLabel: o.priorityLabel,
        blockerReason: o.blockerReason,
        nextAction: o.nextAction,
        assignedUserId: createdUsers["OPERATIONS_MANAGER"].id,
      },
    });

    // Create or get order line
    let line = await prisma.orderLine.findFirst({
      where: { orderId: order.id, skuId: sku.id },
    });
    if (!line) {
      line = await prisma.orderLine.create({
        data: {
          orderId: order.id,
          skuId: sku.id,
          uniwareItemCode: `ITEM-${o.uniwareOrderCode}-1`,
          quantity: o.quantity,
          unitPrice: sku.unitPrice,
          status: o.uniwareStatus,
          allocatedPackedQty: o.internalStage === "DISPATCH" || o.internalStage === "DELIVERY" ? o.quantity : 0,
          allocatedUnpackedQty: o.internalStage === "PACKING" ? o.quantity : 0,
          requiredProductionQty: o.internalStage === "PRODUCTION" ? o.quantity : 0,
          requiredRawMaterialQty: o.internalStage === "RAW_MATERIAL" ? o.quantity : 0,
          packedCompletedQty: o.internalStage === "DISPATCH" || o.internalStage === "DELIVERY" ? o.quantity : 0,
          dispatchReadyQty: o.internalStage === "DISPATCH" ? o.quantity : 0,
        },
      });
    }

    // Add stage history entry
    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        toStage: o.internalStage,
        reason: `Initial workflow state assigned: ${o.internalStage}`,
        changedByUserId: createdUsers["OPERATIONS_MANAGER"].id,
      },
    }).catch(() => {});

    // Stage specific items
    if (o.internalStage === "PRODUCTION") {
      await prisma.productionOrder.upsert({
        where: { code: `PROD-${order.uniwareOrderCode}` },
        update: {},
        create: {
          code: `PROD-${order.uniwareOrderCode}`,
          skuId: sku.id,
          orderLineId: line.id,
          quantityRequired: o.quantity,
          quantityCompleted: 0,
          status: "IN_PROGRESS",
          assignedUserId: createdUsers["PRODUCTION_STAFF"].id,
          startDate: now,
          expectedCompletionDate: futureDays(2),
          notes: "Strict quality checks on marble tabletop polish required.",
        },
      });
    }

    if (o.internalStage === "PACKING") {
      await prisma.packingTask.upsert({
        where: { code: `PACK-${order.uniwareOrderCode}` },
        update: {},
        create: {
          code: `PACK-${order.uniwareOrderCode}`,
          orderId: order.id,
          orderLineId: line.id,
          skuId: sku.id,
          quantityRequired: o.quantity,
          quantityCompleted: 0,
          packagingType: o.packagingType,
          specialInstructions: o.packagingType === "EXPORT" ? "Ensure ISPM-15 stamp is clearly visible on crate exterior" : "Standard heavy box with corner guards",
          status: "IN_PROGRESS",
          assignedUserId: createdUsers["PACKING_STAFF"].id,
        },
      });
    }

    if (o.internalStage === "DISPATCH" || o.internalStage === "DELIVERY" || o.internalStage === "DELIVERY_EXCEPTION") {
      const awb = `SR${order.uniwareOrderCode}9981`;
      const shipment = await prisma.shipment.upsert({
        where: { provider_awbWaybill: { provider: "SHIPROCKET", awbWaybill: awb } },
        update: {},
        create: {
          orderId: order.id,
          uniwareOrderCode: order.uniwareOrderCode,
          provider: "SHIPROCKET",
          providerShipmentId: `SHP-${order.uniwareOrderCode}`,
          awbWaybill: awb,
          courierName: "Blue Dart Express",
          normalizedStatus: o.internalStage === "DELIVERY_EXCEPTION" ? "DELIVERY_EXCEPTION" : o.internalStage === "DELIVERY" ? "OUT_FOR_DELIVERY" : "READY_FOR_PICKUP",
          currentScanLocation: o.shippingAddressCity,
          currentScanActivity: o.internalStage === "DELIVERY_EXCEPTION" ? "Consignee premises locked / not available" : o.internalStage === "DELIVERY" ? "Out for delivery with courier boy" : "Manifest generated, awaiting courier pickup",
          etdDate: futureDays(1),
          dispatchedAt: pastDays(1),
        },
      });

      // Add a scan event
      await prisma.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          provider: "SHIPROCKET",
          awbWaybill: awb,
          providerStatus: shipment.normalizedStatus,
          activity: shipment.currentScanActivity,
          location: shipment.currentScanLocation,
          eventTimestamp: now,
          idempotencyKey: `EVENT-${shipment.id}-${now.getTime()}`,
        },
      }).catch(() => {});
    }
  }

  // 5. Integration Checkpoints
  await prisma.integrationCheckpoint.upsert({
    where: { provider: "UNIWARE" },
    update: { lastCheckpointValue: new Date(now.getTime() - 5 * 60 * 1000).toISOString(), lastRunAt: now, lastSuccessAt: now, status: "SUCCESS" },
    create: { provider: "UNIWARE", lastCheckpointValue: new Date(now.getTime() - 5 * 60 * 1000).toISOString(), lastRunAt: now, lastSuccessAt: now, status: "SUCCESS" },
  });

  await prisma.integrationCheckpoint.upsert({
    where: { provider: "SHIPROCKET" },
    update: { lastRunAt: now, lastSuccessAt: now, status: "SUCCESS" },
    create: { provider: "SHIPROCKET", lastRunAt: now, lastSuccessAt: now, status: "SUCCESS" },
  });

  console.log("Database seeded successfully with all sample data!");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
