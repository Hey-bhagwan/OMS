"use client";

import React, { useEffect, useState } from "react";
import {
  Package,
  Clock,
  AlertTriangle,
  Boxes,
  Truck,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Factory,
  PackageCheck,
  Send,
  ShieldAlert,
  HelpCircle,
  Printer,
  RefreshCw,
} from "lucide-react";
import { formatCurrency, formatShortDate } from "@/lib/utils";

interface DashboardViewProps {
  onNavigateToTab: (tab: any, filter?: any) => void;
  searchFilter?: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigateToTab, searchFilter }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = () => {
    setLoading(true);
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center text-stone-500 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-[#a27b5c] border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">Loading operational dashboard metrics...</p>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const priorityOrders = (data?.priorityOrders || []).filter((o: any) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      o.orderCode?.toLowerCase().includes(q) ||
      o.displayOrderCode?.toLowerCase().includes(q) ||
      o.sku?.toLowerCase().includes(q) ||
      o.productName?.toLowerCase().includes(q)
    );
  });

  const kpiCards = [
    { label: "Active Orders", value: kpis.totalActiveOrders, icon: Package, color: "text-blue-700 bg-blue-50 border-blue-200", tab: "orders" },
    { label: "New Today", value: kpis.newOrdersToday, icon: Clock, color: "text-indigo-700 bg-indigo-50 border-indigo-200", tab: "orders" },
    { label: "Awaiting RM Assessment", value: kpis.awaitingRawAssessment, icon: HelpCircle, color: "text-amber-800 bg-amber-50 border-amber-200", tab: "raw_material" },
    { label: "Blocked by Raw Material", value: kpis.blockedRawMaterial, icon: ShieldAlert, color: "text-red-700 bg-red-50 border-red-200", tab: "raw_material" },
    { label: "In Production", value: kpis.inProduction, icon: Factory, color: "text-stone-700 bg-stone-100 border-stone-200", tab: "production" },
    { label: "Awaiting Packing", value: kpis.awaitingPacking, icon: PackageCheck, color: "text-orange-700 bg-orange-50 border-orange-200", tab: "packing" },
    { label: "Awaiting Dispatch", value: kpis.awaitingDispatch, icon: Send, color: "text-purple-700 bg-purple-50 border-purple-200", tab: "dispatch" },
    { label: "In Transit", value: kpis.inTransit, icon: Truck, color: "text-teal-700 bg-teal-50 border-teal-200", tab: "delivery" },
    { label: "Delivered", value: kpis.deliveredOrders, icon: CheckCircle2, color: "text-emerald-700 bg-emerald-50 border-emerald-200", tab: "delivery" },
    { label: "Delayed / Overdue", value: kpis.delayedOrders, icon: AlertTriangle, color: "text-rose-700 bg-rose-50 border-rose-200 font-bold", tab: "orders" },
    { label: "Orders On Hold", value: kpis.onHoldOrders, icon: AlertCircle, color: "text-yellow-800 bg-yellow-50 border-yellow-200", tab: "orders" },
    { label: "Delivery Exceptions", value: kpis.deliveryExceptions, icon: AlertTriangle, color: "text-pink-700 bg-pink-50 border-pink-200", tab: "delivery" },
  ];

  return (
    <div className="space-y-6">
      {/* 12 KPI Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-3 no-print">
          <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">Live Operational Overview</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => window.print()}
              className="flex items-center space-x-1.5 px-3 py-1 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-md transition shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-stone-500" />
              <span>Print</span>
            </button>
            <button
              onClick={fetchStats}
              className="p-1 text-stone-500 hover:text-stone-900 border border-stone-200 rounded bg-white hover:bg-stone-50 transition"
              title="Refresh Stats"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {kpiCards.map((c, i) => {
            const Icon = c.icon;
            return (
              <div
                key={i}
                onClick={() => onNavigateToTab(c.tab)}
                className={`p-3 rounded-lg border cursor-pointer hover:shadow-xs transition ${c.color}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium opacity-90 truncate">{c.label}</span>
                  <Icon className="w-3.5 h-3.5 opacity-80" />
                </div>
                <div className="text-2xl font-bold tracking-tight">{c.value ?? 0}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Operational Priority Attention Queue */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-stone-50/50">
          <div>
            <h3 className="text-sm font-bold text-stone-900">Priority Attention Queue</h3>
            <p className="text-xs text-stone-500">
              Orders requiring immediate operational action, ordered by deadline urgency and workflow blockers
            </p>
          </div>
          <button
            onClick={() => onNavigateToTab("orders")}
            className="text-xs text-[#a27b5c] font-semibold hover:underline"
          >
            View All Orders ➔
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-2.5 px-4">Order Code</th>
                <th className="py-2.5 px-4">Channel & Status</th>
                <th className="py-2.5 px-4">Product / SKU</th>
                <th className="py-2.5 px-4">Stage</th>
                <th className="py-2.5 px-4">Allocation Breakdown</th>
                <th className="py-2.5 px-4">Deadline</th>
                <th className="py-2.5 px-4">Recommended Next Action</th>
                <th className="py-2.5 px-4">Latest Activity / Remark</th>
                <th className="py-2.5 px-4 text-right no-print">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {priorityOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-400">
                    No priority attention orders required.
                  </td>
                </tr>
              ) : (
                priorityOrders.map((o: any) => (
                  <tr key={o.id} className="hover:bg-stone-50/70 transition align-top">
                    <td className="py-2.5 px-4">
                      <span className="font-mono font-bold text-stone-900 block">{o.orderCode}</span>
                      {o.displayOrderCode && (
                        <span className="text-[10px] text-stone-500 block truncate">{o.displayOrderCode}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-700 border border-stone-200 block w-max mb-1">
                        {o.channel}
                      </span>
                      <span className="text-[10px] text-stone-500 block truncate">
                        Uniware: {o.uniwareStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 max-w-xs">
                      <span className="font-mono font-semibold text-stone-800 block">{o.sku}</span>
                      <span className="text-[11px] text-stone-600 block truncate">{o.productName}</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          o.currentStage === "RAW_MATERIAL"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : o.currentStage === "PRODUCTION"
                            ? "bg-stone-100 text-stone-800 border-stone-300"
                            : o.currentStage === "PACKING"
                            ? "bg-orange-50 text-orange-800 border-orange-200"
                            : o.currentStage === "DISPATCH"
                            ? "bg-purple-50 text-purple-800 border-purple-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        }`}
                      >
                        {o.currentStage}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px]">
                      <div className="space-y-0.5">
                        <span className="text-emerald-700 font-semibold block">
                          • Packed: {o.allocatedPackedQty} / {o.quantity}
                        </span>
                        {o.allocatedUnpackedQty > 0 && (
                          <span className="text-blue-700 block">• Unpacked: {o.allocatedUnpackedQty}</span>
                        )}
                        {o.requiredProductionQty > 0 && (
                          <span className="text-stone-800 font-semibold block">• In Prod: {o.requiredProductionQty}</span>
                        )}
                        {o.blockedRawMaterialQty > 0 && (
                          <span className="text-red-700 font-bold block">• Blocked RM: {o.blockedRawMaterialQty}</span>
                        )}
                        {o.pendingAssessmentQty > 0 && (
                          <span className="text-amber-700 font-bold block">• Pending RM: {o.pendingAssessmentQty}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-stone-600">
                      {formatShortDate(o.fulfillmentDeadline)}
                    </td>
                    <td className="py-2.5 px-4 max-w-xs">
                      <p className="text-[11px] text-stone-800 font-medium">{o.nextAction}</p>
                      {o.blocker && o.blocker !== "None" && (
                        <span className="text-[10px] text-red-600 block mt-0.5 font-medium truncate">
                          Blocker: {o.blocker}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 max-w-xs">
                      {o.lastRemark ? (
                        <p className="text-[11px] text-stone-700 italic truncate" title={o.lastRemark}>
                          "{o.lastRemark}"
                        </p>
                      ) : o.lastActivity ? (
                        <p className="text-[11px] text-stone-500 truncate">{o.lastActivity}</p>
                      ) : (
                        <span className="text-stone-400 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right no-print">
                      <button
                        onClick={() => onNavigateToTab("orders")}
                        className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded text-[11px] font-medium transition"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
