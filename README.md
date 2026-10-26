# Koa Living — Centralized Order Management System (OMS)

A production-ready, enterprise-grade Order Management System for **Koa Living**, built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **Prisma ORM** on **PostgreSQL**.

---

## 1. System Architecture

The Koa Living OMS bridges marketplace channels, warehouse inventory buckets, manufacturing work orders, and courier logistics:

```
[Uniware Marketplace Connector]
         │ (Scheduled Polling & Manual Sync)
         ▼
 ┌──────────────────────────────────────────────────────────────┐
 │                     Koa Living OMS Core                      │
 │                                                              │
 │  ┌────────────────────────────────────────────────────────┐  │
 │  │              Multi-Stage Workflow Engine               │  │
 │  │  Raw Material ➔ Production ➔ Packing ➔ Dispatch ➔ Track│  │
 │  └────────────────────────────────────────────────────────┘  │
 │                                                              │
 │  ┌────────────────────────────────────────────────────────┐  │
 │  │             Transactional Inventory Ledger             │  │
 │  │  • Raw Material Inventory  (Makrana Slabs, Teak, Brass)│  │
 │  │  • Unpacked Goods Bucket   (Finished awaiting crating) │  │
 │  │  • Packed Goods Bucket     (Domestic boxed / Export)   │  │
 │  └────────────────────────────────────────────────────────┘  │
 └──────────────────────────────────────────────────────────────┘
         ▲
         │ (Webhook Ingress: Real-time scan telemetry & status)
[Shiprocket & Shiprocket Cargo Webhooks]
```

---

## 2. Key Modules & Capabilities

1. **Uniware Omnichannel Integration**:
   - OAuth 2.0 token management with caching, expiry awareness, and single-flight lock.
   - Paged order search (`POST /services/rest/v1/oms/saleOrder/search`) and details fetch (`POST /services/rest/v1/oms/saleorder/get`).
   - Overlapping time windows prevent missed boundary records.
   - Idempotent upsert by `uniwareOrderCode`.

2. **Shiprocket & Shiprocket Cargo Integrations**:
   - Dual-parser architecture for standard Shiprocket and Shiprocket Cargo payloads.
   - Status precedence policy prevents out-of-order scans from regressing `DELIVERED` status.
   - Normalization into internal lifecycle: `SHIPMENT_CREATED`, `READY_FOR_PICKUP`, `PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `DELIVERY_EXCEPTION`, `RTO`.
   - Append-only event telemetry with idempotency keys.

3. **Multi-Stage Inventory Allocation Engine**:
   - Prioritizes eligible packed stock for domestic destinations.
   - Enforces certified export wooden crating (ISPM-15) for international shipments.
   - Automatically detects Bill of Materials (BOM) raw-material shortages and unblocks procurement.
   - Atomically decrements Unpacked inventory and increments Packed inventory upon packing task completion.

4. **14 Operational Views**:
   - **Dashboard**: 12 operational KPIs, deterministic priority attention queue, and inventory trend metrics.
   - **All Orders**: Multi-stage filtering, order details side-drawer, and stage override.
   - **Raw Material**: Real-time stock levels, reorder threshold alerts, and manual receipt modal.
   - **Production**: Work orders with BOM planned consumption.
   - **Packing**: Domestic vs Export crating queues with atomic transfer buttons.
   - **Dispatch**: Courier assignment, waybill recording, and carrier handover.
   - **Delivery**: Live telemetry, scan timeline, and exception handling.
   - **Packed & Unpacked Inventory**: Bin locations, on-hand, reserved, and available quantities.
   - **Stock Adjustments & History**: Authoritative stock adjustment console and immutable transaction ledger.
   - **Reports**: Instant Excel (`.xlsx`) downloads via ExcelJS.
   - **Integration Settings**: Real-time Uniware & Shiprocket health status.
   - **User Management**: Role-based access control.

---

## 3. Seed Accounts & Permissions

| Role | Email | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@koaliving.com` | `KoaLiving2026!` | Full administrative access across all modules |
| **Operations Manager** | `ops@koaliving.com` | `KoaLiving2026!` | Orders, priority queue, allocations, and reports |
| **Inventory Manager** | `inventory@koaliving.com` | `KoaLiving2026!` | Raw materials, stock balances, adjustments |
| **Production Head** | `production@koaliving.com` | `KoaLiving2026!` | Manufacturing work orders, BOM consumption |
| **Packing Lead** | `packing@koaliving.com` | `KoaLiving2026!` | Domestic & export packing queue, transfer to packed |
| **Dispatch Lead** | `dispatch@koaliving.com` | `KoaLiving2026!` | Courier waybills, handover confirmation |
| **Auditor** | `auditor@koaliving.com` | `KoaLiving2026!` | Read-only ledger audit trail and reports |

---

## 4. Setup & Running Locally

### Prerequisites
- Node.js v18+ (tested on Node v24)
- PostgreSQL database (Neon, Supabase, AWS RDS, or local)

### Installation
```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Ensure DATABASE_URL points to your PostgreSQL database

# 3. Synchronize database schema
npx prisma db push

# 4. Seed initial catalog, inventory, and users
node prisma/seed.js

# 5. Run tests
npm test

# 6. Start development server
npm run dev
```

Visit `http://localhost:3000` and sign in with any of the seed accounts above.
