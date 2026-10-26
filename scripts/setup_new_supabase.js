const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function setup() {
  console.log("==========================================================");
  console.log("   Setting up new Cloud Database (PostgreSQL / Supabase)   ");
  console.log("==========================================================");

  // 1. Read schema SQL (PowerShell redirects in UTF-16LE or UTF-8)
  let sql;
  const buffer = fs.readFileSync('prisma/init_schema.sql');
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    sql = buffer.toString('utf16le');
  } else {
    sql = buffer.toString('utf8');
  }
  
  // Split statements by semicolon, being careful of comments
  const cleanStatements = [];
  const lines = sql.split(/\r?\n/);
  let currentStmt = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--') || trimmed === '') {
      continue;
    }
    currentStmt += ' ' + trimmed;
    if (trimmed.endsWith(';')) {
      cleanStatements.push(currentStmt.trim());
      currentStmt = '';
    }
  }

  console.log(`Executing ${cleanStatements.length} DDL statements...`);

  for (let i = 0; i < cleanStatements.length; i++) {
    const stmt = cleanStatements[i];
    console.log(`[${i + 1}/${cleanStatements.length}] ${stmt.substring(0, 50)}...`);
    try {
      await prisma.$executeRawUnsafe(stmt);
    } catch (err) {
      // Ignore if already exists (e.g. enum or table)
      if (err.message.includes('already exists') || err.message.includes('42710') || err.message.includes('42P07')) {
        console.log(`  -> Already exists, skipping.`);
      } else {
        console.error(`Error on statement #${i + 1}:`, stmt.substring(0, 80));
        console.error(err.message);
        throw err;
      }
    }
  }

  console.log("All DDL statements executed successfully!");

  // 2. Seed Users
  console.log("Seeding core staff users...");
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

  for (const u of usersData) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, passwordHash },
      create: { ...u, passwordHash },
    });
  }
  console.log("Users seeded.");

  // 3. Seed SKUs (Product Master)
  console.log("Seeding Product Master SKUs...");
  const skusData = [
    {
      code: "KLT2025-004",
      name: "Cala Round White Marble Dining Table",
      description: "Handcrafted round dining table featuring premium White Makrana marble top and solid teak fluted base.",
      category: "Tables",
      unitOfManufacture: "PCS",
      defaultLeadTimeDays: 14,
      unitPrice: 48500.0,
      currency: "INR",
      domesticPackingType: "Reinforced 7-Ply Box with Edge Protectors",
      exportPackingType: "ISPM-15 Certified Fumigated Crate",
      productionNotes: "Check table top beveling and brass inlay tolerance < 0.5mm.",
      qualityRequirements: "Zero chips on marble bevel; moisture content in teak < 12%.",
      stock: { unpacked: 5, packed: 2 },
    },
    {
      code: "KLST2026-006",
      name: "Sol Boardgame Marble Coffee Table",
      description: "Dual-purpose conversational coffee table with inset boardgame grid in brass and black marble.",
      category: "Tables",
      unitOfManufacture: "PCS",
      defaultLeadTimeDays: 10,
      unitPrice: 34000.0,
      currency: "INR",
      domesticPackingType: "Reinforced 7-Ply Box with Foam Mold",
      exportPackingType: "ISPM-15 Export Crate",
      productionNotes: "Ensure brass grid is perfectly flush with marble surface.",
      qualityRequirements: "High gloss mirror finish; no voids in black marble resin fill.",
      stock: { unpacked: 2, packed: 1 },
    },
    {
      code: "KLT2025-001",
      name: "Dune Natural Stone Accent Bowl",
      description: "Sculptural hand-carved decorative stone vessel.",
      category: "Decor",
      unitOfManufacture: "PCS",
      defaultLeadTimeDays: 5,
      unitPrice: 6500.0,
      currency: "INR",
      domesticPackingType: "Molded EPS Carton",
      exportPackingType: "Export Air-Freight Carton with Shock Absorbers",
      productionNotes: "Hand-carved concentric flutes.",
      qualityRequirements: "Uniform wall thickness; smooth honed rim.",
      stock: { unpacked: 15, packed: 10 },
    },
    {
      code: "KLT2025-002",
      name: "Stella Solid Brass Centerpiece Bowl",
      description: "Spun brass bowl with matte brushed finish.",
      category: "Decor",
      unitOfManufacture: "PCS",
      defaultLeadTimeDays: 7,
      unitPrice: 8200.0,
      currency: "INR",
      domesticPackingType: "Velvet Pouch + Rigid Gift Box",
      exportPackingType: "Export Master Shipper",
      productionNotes: "Spun brass on lathe with protective lacquer coating.",
      qualityRequirements: "Blemish-free brushed finish; scratch-free clear lacquer.",
      stock: { unpacked: 10, packed: 15 },
    },
  ];

  for (const s of skusData) {
    const sku = await prisma.sKU.upsert({
      where: { code: s.code },
      update: {
        name: s.name,
        description: s.description,
        category: s.category,
        unitOfManufacture: s.unitOfManufacture,
        defaultLeadTimeDays: s.defaultLeadTimeDays,
        unitPrice: s.unitPrice,
        currency: s.currency,
        domesticPackingType: s.domesticPackingType,
        exportPackingType: s.exportPackingType,
        productionNotes: s.productionNotes,
        qualityRequirements: s.qualityRequirements,
      },
      create: {
        code: s.code,
        name: s.name,
        description: s.description,
        category: s.category,
        unitOfManufacture: s.unitOfManufacture,
        defaultLeadTimeDays: s.defaultLeadTimeDays,
        unitPrice: s.unitPrice,
        currency: s.currency,
        domesticPackingType: s.domesticPackingType,
        exportPackingType: s.exportPackingType,
        productionNotes: s.productionNotes,
        qualityRequirements: s.qualityRequirements,
      },
    });

    // Seed finished goods stock buckets
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
  }
  console.log("SKUs and Initial Finished Goods stock seeded.");

  // 4. Seed Workflow Configurations
  console.log("Seeding Workflow Configurations...");
  const defaultConfigs = [
    { stage: "RAW_MATERIAL", slaHours: 24, priorityWeight: 10 },
    { stage: "PRODUCTION", slaHours: 72, priorityWeight: 20 },
    { stage: "PACKING", slaHours: 24, priorityWeight: 15 },
    { stage: "DISPATCH", slaHours: 12, priorityWeight: 15 },
    { stage: "DELIVERY", slaHours: 96, priorityWeight: 10 },
    { stage: "DELIVERY_EXCEPTION", slaHours: 12, priorityWeight: 35 },
    { stage: "ON_HOLD", slaHours: 48, priorityWeight: 5 },
  ];

  for (const c of defaultConfigs) {
    const existing = await prisma.workflowConfiguration.findFirst({ where: { stage: c.stage } });
    if (!existing) {
      await prisma.workflowConfiguration.create({
        data: {
          stage: c.stage,
          slaHours: c.slaHours,
          priorityWeight: c.priorityWeight,
          requiresSpecialCheck: false,
        },
      });
    }
  }
  console.log("Workflow configurations seeded.");

  // 5. Verification
  const userCount = await prisma.user.count();
  const skuCount = await prisma.sKU.count();
  const orderCount = await prisma.order.count();
  const configCount = await prisma.workflowConfiguration.count();
  console.log("\nSetup complete summary:");
  console.log(`• Users:           ${userCount}`);
  console.log(`• Product SKUs:    ${skuCount}`);
  console.log(`• Workflow Configs:${configCount}`);
  console.log(`• Orders in DB:    ${orderCount} (Clean & ready for Uniware sync)`);
  console.log("==========================================================\n");

  await prisma.$disconnect();
  process.exit(0);
}

setup().catch((e) => {
  console.error("Setup failed:", e);
  process.exit(1);
});
