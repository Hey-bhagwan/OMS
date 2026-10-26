"use client";

import React from "react";
import { FileSpreadsheet, Download, Printer } from "lucide-react";

export const ReportsView: React.FC = () => {
  const reports = [
    {
      title: "Consolidated Orders Report",
      description: "Complete order registry including marketplace channel, internal stage, packaging profile, fulfillment deadlines, and active blockers.",
      type: "orders",
    },
    {
      title: "Raw Material Blocked Queue Report",
      description: "Orders and quantities explicitly blocked due to unavailable raw materials, with mandatory remarks, assigned staff, and date blocked.",
      type: "raw_material_queue",
    },
    {
      title: "Manufacturing Work Orders Report",
      description: "Production work orders, required vs completed quantities, rejection counts, and target completion dates.",
      type: "production",
    },
    {
      title: "Packaging Operations Queue Report",
      description: "Domestic box and export wooden crate packaging queues with completed quantities and packaging instructions.",
      type: "packing",
    },
    {
      title: "Dispatch & Courier Handover Report",
      description: "Packed consignments ready for carrier handover, assigned couriers, and AWB/waybill records.",
      type: "dispatch",
    },
    {
      title: "Shipment Tracking & Telemetry Report",
      description: "Real-time parcel status synchronized via Shiprocket and Shiprocket Cargo webhooks with scan locations and delivery timestamps.",
      type: "delivery",
    },
    {
      title: "Packed Finished Goods Stock",
      description: "Ready-to-dispatch inventory that has completed certified packaging, bin locations, and reservation breakdown.",
      type: "packed_inventory",
    },
    {
      title: "Unpacked Finished Goods Stock",
      description: "Finished goods awaiting destination-specific domestic boxing or export crating.",
      type: "unpacked_inventory",
    },
    {
      title: "Finished-Goods Transaction Ledger",
      description: "Complete, immutable transaction history of receipts, packing transfers, production output, and adjustments.",
      type: "stock_history",
    },
    {
      title: "Product Master & Packaging Profiles",
      description: "SKU catalog specifications, units of manufacture, manufacturing lead times, and packaging profiles.",
      type: "products",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg border border-stone-200 shadow-sm flex justify-between items-center no-print">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Operational & Financial Reports</h3>
          <p className="text-xs text-stone-500">
            Generate audit-ready Excel reports formatted with clear headers, correct data types, and timestamps
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md transition"
        >
          <Printer className="w-3.5 h-3.5 text-stone-500" />
          <span>Print Summary</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r, idx) => (
          <div key={idx} className="bg-white p-5 rounded-lg border border-stone-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center mb-3">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-stone-900 mb-1">{r.title}</h4>
              <p className="text-xs text-stone-600 mb-4">{r.description}</p>
            </div>
            <div>
              <a
                href={`/api/reports/export?type=${r.type}`}
                download
                className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-[#a27b5c] hover:bg-[#8a6549] text-white text-xs font-semibold rounded transition shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .XLSX</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
