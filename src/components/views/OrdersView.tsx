"use client";

import React, { useEffect, useState } from "react";
import {
  Download,
  Printer,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  X,
  MessageSquare,
  Boxes,
  Send,
  Clock,
  UserCheck,
} from "lucide-react";
import { formatShortDate, formatDate } from "@/lib/utils";

function getValidForwardStages(currentStage: string): { stage: string; label: string; color: string }[] {
  switch (currentStage) {
    case "RAW_MATERIAL":
      return [
        { stage: "PRODUCTION", label: "Start Production", color: "bg-stone-800 hover:bg-stone-900 text-white" },
        { stage: "PACKING", label: "Move to Packing", color: "bg-orange-600 hover:bg-orange-700 text-white" },
        { stage: "ON_HOLD", label: "Place On Hold", color: "bg-yellow-100 hover:bg-yellow-200 text-yellow-900" },
        { stage: "CANCELLED", label: "Cancel Order", color: "bg-red-50 hover:bg-red-100 text-red-700" },
      ];
    case "PRODUCTION":
      return [
        { stage: "PACKING", label: "Production Done ➔ Move to Packing", color: "bg-orange-600 hover:bg-orange-700 text-white" },
        { stage: "ON_HOLD", label: "Place On Hold", color: "bg-yellow-100 hover:bg-yellow-200 text-yellow-900" },
        { stage: "CANCELLED", label: "Cancel Order", color: "bg-red-50 hover:bg-red-100 text-red-700" },
      ];
    case "PACKING":
      return [
        { stage: "DISPATCH", label: "Packing Done ➔ Move to Dispatch", color: "bg-purple-600 hover:bg-purple-700 text-white" },
        { stage: "ON_HOLD", label: "Place On Hold", color: "bg-yellow-100 hover:bg-yellow-200 text-yellow-900" },
        { stage: "CANCELLED", label: "Cancel Order", color: "bg-red-50 hover:bg-red-100 text-red-700" },
      ];
    case "DISPATCH":
      return [
        { stage: "DELIVERY", label: "Carrier Handover ➔ Move to Delivery", color: "bg-teal-600 hover:bg-teal-700 text-white" },
        { stage: "ON_HOLD", label: "Place On Hold", color: "bg-yellow-100 hover:bg-yellow-200 text-yellow-900" },
        { stage: "CANCELLED", label: "Cancel Order", color: "bg-red-50 hover:bg-red-100 text-red-700" },
      ];
    case "DELIVERY":
      return [
        { stage: "DELIVERY_EXCEPTION", label: "Flag Delivery Exception", color: "bg-pink-600 hover:bg-pink-700 text-white" },
        { stage: "RTO", label: "Trigger Return to Origin (RTO)", color: "bg-red-600 hover:bg-red-700 text-white" },
      ];
    case "DELIVERY_EXCEPTION":
      return [
        { stage: "DELIVERY", label: "Re-attempt Delivery", color: "bg-teal-600 hover:bg-teal-700 text-white" },
        { stage: "RTO", label: "Initiate RTO", color: "bg-red-600 hover:bg-red-700 text-white" },
      ];
    case "ON_HOLD":
      return [
        { stage: "RAW_MATERIAL", label: "Resume to Raw Material", color: "bg-stone-700 hover:bg-stone-800 text-white" },
        { stage: "PRODUCTION", label: "Resume to Production", color: "bg-stone-700 hover:bg-stone-800 text-white" },
        { stage: "PACKING", label: "Resume to Packing", color: "bg-orange-600 hover:bg-orange-700 text-white" },
        { stage: "CANCELLED", label: "Cancel Order", color: "bg-red-50 hover:bg-red-100 text-red-700" },
      ];
    default:
      return [];
  }
}

export const OrdersView: React.FC<{ searchFilter?: string }> = ({ searchFilter }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<string>("");
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionMsg, setTransitionMsg] = useState<string | null>(null);

  // Remarks drawer state
  const [newRemarkText, setNewRemarkText] = useState("");
  const [addingRemark, setAddingRemark] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<"ALL" | "REMARKS" | "STAGES">("ALL");

  // Raw Material decision state
  const [rmDecisionMode, setRmDecisionMode] = useState<"AVAILABLE" | "UNAVAILABLE" | "PENDING_ASSESSMENT" | null>(null);
  const [rmRemark, setRmRemark] = useState("");
  const [rmSubmitting, setRmSubmitting] = useState(false);

  const fetchOrders = () => {
    setLoading(true);
    let url = "/api/orders?limit=50";
    if (stageFilter) url += `&stage=${stageFilter}`;
    if (channelFilter) url += `&channel=${channelFilter}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setOrders(data.orders || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, [stageFilter, channelFilter]);

  const viewOrderDetails = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      if (data.order) setSelectedOrder(data.order);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStageTransition = async (targetStage: string) => {
    if (!selectedOrder) return;
    setIsTransitioning(true);
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStage,
          reason: `Moved to ${targetStage}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTransitionMsg(`Order successfully progressed to ${targetStage}`);
        fetchOrders();
        viewOrderDetails(selectedOrder.id);
      }
    } catch {
      setTransitionMsg("Failed to transition stage");
    } finally {
      setIsTransitioning(false);
      setTimeout(() => setTransitionMsg(null), 4000);
    }
  };

  const handleReallocate = async () => {
    if (!selectedOrder) return;
    setIsTransitioning(true);
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/allocate`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setTransitionMsg("Order re-allocated through multi-stage workflow engine");
        fetchOrders();
        viewOrderDetails(selectedOrder.id);
      }
    } catch {
      setTransitionMsg("Failed to allocate order");
    } finally {
      setIsTransitioning(false);
      setTimeout(() => setTransitionMsg(null), 4000);
    }
  };

  const handleAddRemark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !newRemarkText.trim()) return;
    setAddingRemark(true);

    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/remark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remark: newRemarkText.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setNewRemarkText("");
        viewOrderDetails(selectedOrder.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddingRemark(false);
    }
  };

  const handleRawMaterialDecision = async (decision: "AVAILABLE" | "UNAVAILABLE" | "PENDING_ASSESSMENT") => {
    if (!selectedOrder) return;
    if (decision === "UNAVAILABLE" && (!rmRemark || !rmRemark.trim())) {
      alert("A meaningful remark is required when marking raw material unavailable.");
      return;
    }

    setRmSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          remark: rmRemark.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTransitionMsg(`Raw material decision recorded: ${decision}`);
        setRmDecisionMode(null);
        setRmRemark("");
        fetchOrders();
        viewOrderDetails(selectedOrder.id);
      } else {
        alert(data.error || "Decision failed");
      }
    } catch {
      alert("Request failed");
    } finally {
      setRmSubmitting(false);
      setTimeout(() => setTransitionMsg(null), 5000);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      o.uniwareOrderCode?.toLowerCase().includes(q) ||
      o.displayOrderCode?.toLowerCase().includes(q) ||
      o.primarySku?.toLowerCase().includes(q) ||
      o.shippingAddressCity?.toLowerCase().includes(q) ||
      o.items?.some((it: any) => it.skuCode?.toLowerCase().includes(q) || it.skuName?.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {/* Top Banner & Export */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg border border-stone-200 shadow-sm no-print">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Omnichannel Sale Orders</h3>
          <p className="text-xs text-stone-500">
            End-to-end multi-stage fulfillment tracking across marketplaces and factory production stages
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md transition"
          >
            <Printer className="w-3.5 h-3.5 text-stone-500" />
            <span>Print</span>
          </button>
          <a
            href="/api/reports/export?type=orders"
            download
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md transition"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Export Excel</span>
          </a>
          <button
            onClick={fetchOrders}
            className="p-1.5 text-stone-500 hover:text-stone-900 border border-stone-200 rounded hover:bg-stone-50 transition"
            title="Refresh Orders"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {transitionMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{transitionMsg}</span>
        </div>
      )}

      {/* Stage & Channel Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-stone-200 shadow-sm text-xs no-print">
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 max-w-2xl">
          {[
            { id: "", label: "All Orders" },
            { id: "RAW_MATERIAL", label: "Raw Material" },
            { id: "PRODUCTION", label: "Production" },
            { id: "PACKING", label: "Packing" },
            { id: "DISPATCH", label: "Dispatch" },
            { id: "DELIVERY", label: "Delivery" },
            { id: "ON_HOLD", label: "On Hold" },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStageFilter(st.id)}
              className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition ${
                stageFilter === st.id ? "bg-[#a27b5c] text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-md text-xs text-stone-700 focus:outline-none"
          >
            <option value="">All Channels</option>
            <option value="AMAZON">Amazon</option>
            <option value="SHOPIFY">Shopify</option>
            <option value="CUSTOM">Custom / Website</option>
            <option value="WHOLESALE">Wholesale</option>
            <option value="UNIWARE">Uniware Direct</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-2.5 px-4">Order Code</th>
                <th className="py-2.5 px-4">Channel</th>
                <th className="py-2.5 px-4">Items / SKU</th>
                <th className="py-2.5 px-4 text-center">Total Qty</th>
                <th className="py-2.5 px-4">Internal Stage</th>
                <th className="py-2.5 px-4">Packaging</th>
                <th className="py-2.5 px-4">Priority</th>
                <th className="py-2.5 px-4">Fulfillment Deadline</th>
                <th className="py-2.5 px-4">Blocker / Next Action</th>
                <th className="py-2.5 px-4 text-right no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-stone-400">Loading orders...</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-stone-400">No orders found matching filters.</td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-stone-50/70 transition align-top">
                    <td className="py-2.5 px-4">
                      <span className="font-mono font-bold text-stone-900 block">{o.uniwareOrderCode}</span>
                      {o.displayOrderCode && (
                        <span className="text-[10px] text-stone-500 block truncate">{o.displayOrderCode}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-700 border border-stone-200">
                        {o.channel}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-mono font-semibold text-stone-800 block">{o.primarySku}</span>
                      <span className="text-stone-500 text-[10px] block truncate max-w-xs">{o.primarySkuName}</span>
                    </td>
                    <td className="py-2.5 px-4 text-center font-semibold text-stone-800">
                      {o.lines?.reduce((sum: number, l: any) => sum + (l.quantity || 0), 0) || 1}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          o.internalStage === "DELIVERY"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : o.internalStage === "RAW_MATERIAL"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : o.internalStage === "PRODUCTION"
                            ? "bg-stone-100 text-stone-800 border-stone-300"
                            : o.internalStage === "PACKING"
                            ? "bg-orange-50 text-orange-800 border-orange-200"
                            : o.internalStage === "DISPATCH"
                            ? "bg-purple-50 text-purple-800 border-purple-200"
                            : "bg-red-50 text-red-800 border-red-200"
                        }`}
                      >
                        {o.internalStage}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`text-[11px] font-medium ${o.packagingType === "EXPORT" ? "text-purple-700 font-bold" : "text-stone-600"}`}>
                        {o.packagingType}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          o.priorityLabel === "OVERDUE"
                            ? "bg-rose-100 text-rose-800 border border-rose-300"
                            : o.priorityLabel === "URGENT"
                            ? "bg-orange-100 text-orange-800"
                            : o.priorityLabel === "HIGH"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-stone-100 text-stone-600"
                        }`}
                      >
                        {o.priorityLabel}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-stone-600">
                      {formatShortDate(o.fulfillmentDeadline)}
                    </td>
                    <td className="py-2.5 px-4 max-w-xs">
                      {o.blocker ? (
                        <span className="text-red-700 font-medium block truncate" title={o.blocker}>
                          ⚠️ {o.blocker}
                        </span>
                      ) : null}
                      <span className="text-stone-500 text-[11px] block truncate">{o.nextAction}</span>
                    </td>
                    <td className="py-2.5 px-4 text-right no-print">
                      <button
                        onClick={() => viewOrderDetails(o.id)}
                        className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded text-[11px] font-medium transition inline-flex items-center space-x-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div>
                <h3 className="text-base font-bold text-stone-900 font-mono">
                  {selectedOrder.uniwareOrderCode}
                </h3>
                <span className="text-xs text-stone-500">
                  {selectedOrder.displayOrderCode} • {selectedOrder.channel}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Status & Priority Badge */}
              <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-200">
                <div>
                  <span className="text-[10px] font-semibold text-stone-500 uppercase block">Current Stage</span>
                  <span className="text-sm font-bold text-stone-900">{selectedOrder.internalStage}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-stone-500 uppercase block">Uniware Status</span>
                  <span className="text-xs font-medium text-stone-700">{selectedOrder.uniwareStatus}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-stone-500 uppercase block">Packaging</span>
                  <span className="text-xs font-semibold text-purple-700">{selectedOrder.packagingType}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-stone-500 uppercase block">Fulfillment Deadline</span>
                  <span className="text-xs font-medium text-stone-800">{formatShortDate(selectedOrder.fulfillmentDeadline)}</span>
                </div>
              </div>

              {/* Blocker & Next Action */}
              {selectedOrder.blockerReason && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-1">
                  <div className="font-semibold flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                    <span>Active Blocker:</span>
                  </div>
                  <div>{selectedOrder.blockerReason}</div>
                </div>
              )}

              {/* Line Items & Allocation Breakdown */}
              <div>
                <h4 className="text-xs font-semibold text-stone-900 uppercase tracking-wider mb-2">
                  Line Items & Inventory Allocation
                </h4>
                <div className="space-y-3">
                  {selectedOrder.lines?.map((line: any) => (
                    <div key={line.id} className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-bold text-stone-900 block">{line.sku.code}</span>
                          <span className="text-stone-600 text-[11px]">{line.sku.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-stone-900">{line.quantity} Unit(s)</span>
                        </div>
                      </div>

                      {/* Stock Allocation Breakdown */}
                      <div className="grid grid-cols-5 gap-2 pt-2 border-t border-stone-200 text-center">
                        <div className="p-1 bg-white rounded border border-stone-200">
                          <span className="text-[10px] text-stone-500 block">Alloc. Packed</span>
                          <span className="font-bold text-emerald-700">{line.allocatedPackedQty}</span>
                        </div>
                        <div className="p-1 bg-white rounded border border-stone-200">
                          <span className="text-[10px] text-stone-500 block">Alloc. Unpacked</span>
                          <span className="font-bold text-blue-700">{line.allocatedUnpackedQty}</span>
                        </div>
                        <div className="p-1 bg-white rounded border border-stone-200">
                          <span className="text-[10px] text-stone-500 block">In Production</span>
                          <span className="font-bold text-stone-800">{line.requiredProductionQty}</span>
                        </div>
                        <div className="p-1 bg-white rounded border border-stone-200">
                          <span className="text-[10px] text-stone-500 block">Blocked Raw</span>
                          <span className="font-bold text-red-700">{line.blockedRawMaterialQty}</span>
                        </div>
                        <div className="p-1 bg-white rounded border border-stone-200">
                          <span className="text-[10px] text-stone-500 block">Pending RM</span>
                          <span className="font-bold text-amber-700">{line.pendingAssessmentQty}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Explicit Manual Raw-Material Availability Decision */}
              {(selectedOrder.internalStage === "RAW_MATERIAL" || selectedOrder.internalStage === "PRODUCTION") && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs space-y-2">
                  <div className="flex items-center space-x-1.5 font-bold text-amber-900">
                    <Boxes className="w-4 h-4 text-amber-700" />
                    <span>Factory Staff Raw-Material Availability Decision</span>
                  </div>
                  <p className="text-[11px] text-stone-600">
                    A human staff member must assess availability. Choose an explicit decision for quantities requiring manufacturing:
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => handleRawMaterialDecision("AVAILABLE")}
                      disabled={rmSubmitting}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-medium shadow-xs disabled:opacity-50"
                    >
                      Raw Material Available (Start Production)
                    </button>
                    <button
                      onClick={() => setRmDecisionMode("UNAVAILABLE")}
                      disabled={rmSubmitting}
                      className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded font-medium shadow-xs disabled:opacity-50"
                    >
                      Raw Material Unavailable (Queue as Blocked)
                    </button>
                    <button
                      onClick={() => handleRawMaterialDecision("PENDING_ASSESSMENT")}
                      disabled={rmSubmitting}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium shadow-xs disabled:opacity-50"
                    >
                      Mark Pending Assessment
                    </button>
                  </div>

                  {rmDecisionMode === "UNAVAILABLE" && (
                    <div className="pt-2 border-t border-amber-200 space-y-2">
                      <label className="font-semibold text-stone-800 block">
                        Mandatory Reason / Remark for Raw Material Shortage:
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={rmRemark}
                        onChange={(e) => setRmRemark(e.target.value)}
                        placeholder="e.g. Makrana slab thickness variation; waiting for quarry shipment..."
                        className="w-full px-3 py-1.5 border border-amber-300 rounded bg-white text-xs focus:outline-none"
                      />
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => setRmDecisionMode(null)}
                          className="px-3 py-1 border border-stone-300 rounded text-stone-700 bg-white"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleRawMaterialDecision("UNAVAILABLE")}
                          disabled={rmSubmitting}
                          className="px-3 py-1 bg-red-700 text-white rounded font-semibold"
                        >
                          Confirm Block
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Forward Stage Transitions */}
              <div>
                <h4 className="text-xs font-semibold text-stone-900 uppercase tracking-wider mb-2">
                  Next Actions Ahead of Current State
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(selectedOrder.internalStage === "RAW_MATERIAL" || selectedOrder.internalStage === "PRODUCTION") && (
                    <button
                      disabled={isTransitioning}
                      onClick={handleReallocate}
                      className="px-3 py-1.5 bg-[#a27b5c] text-white text-xs font-medium rounded hover:bg-[#8a6549] transition disabled:opacity-50"
                    >
                      Re-run Stock Allocation
                    </button>
                  )}

                  {getValidForwardStages(selectedOrder.internalStage).map((st) => (
                    <button
                      key={st.stage}
                      disabled={isTransitioning}
                      onClick={() => handleStageTransition(st.stage)}
                      className={`px-3 py-1.5 text-xs font-medium rounded transition ${st.color}`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dedicated Activity and Remarks Section */}
              <div className="space-y-3 pt-4 border-t border-stone-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-stone-900 uppercase tracking-wider flex items-center space-x-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-[#a27b5c]" />
                    <span>Activity & Internal Communication</span>
                  </h4>

                  {/* Filter Pills */}
                  <div className="flex space-x-1 text-[11px]">
                    <button
                      onClick={() => setTimelineFilter("ALL")}
                      className={`px-2 py-0.5 rounded transition ${
                        timelineFilter === "ALL" ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-100"
                      }`}
                    >
                      All Activity
                    </button>
                    <button
                      onClick={() => setTimelineFilter("REMARKS")}
                      className={`px-2 py-0.5 rounded transition ${
                        timelineFilter === "REMARKS" ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-100"
                      }`}
                    >
                      Remarks Only
                    </button>
                    <button
                      onClick={() => setTimelineFilter("STAGES")}
                      className={`px-2 py-0.5 rounded transition ${
                        timelineFilter === "STAGES" ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-100"
                      }`}
                    >
                      Stage Changes
                    </button>
                  </div>
                </div>

                {/* Add Remark Input */}
                <form onSubmit={handleAddRemark} className="space-y-2">
                  <textarea
                    rows={2}
                    value={newRemarkText}
                    onChange={(e) => setNewRemarkText(e.target.value)}
                    placeholder="Add an internal note or remark (saved without changing stage)..."
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={addingRemark || !newRemarkText.trim()}
                      className="px-3 py-1.5 bg-[#a27b5c] hover:bg-[#8a6549] text-white rounded text-xs font-semibold transition disabled:opacity-50 flex items-center space-x-1"
                    >
                      <Send className="w-3 h-3" />
                      <span>{addingRemark ? "Posting..." : "Post Remark"}</span>
                    </button>
                  </div>
                </form>

                {/* Combined Chronological Timeline */}
                <div className="space-y-2.5 max-h-72 overflow-y-auto pt-2">
                  {/* Merge remarks and stage history */}
                  {(() => {
                    const entries: any[] = [];
                    if (timelineFilter !== "STAGES") {
                      (selectedOrder.remarks || []).forEach((r: any) => {
                        entries.push({
                          id: r.id,
                          type: "REMARK",
                          date: new Date(r.createdAt),
                          author: r.authorName,
                          text: r.text,
                          stage: r.stage,
                        });
                      });
                    }
                    if (timelineFilter !== "REMARKS") {
                      (selectedOrder.stageHistory || []).forEach((h: any) => {
                        entries.push({
                          id: h.id,
                          type: "STAGE",
                          date: new Date(h.timestamp),
                          toStage: h.toStage,
                          text: h.reason,
                        });
                      });
                    }

                    entries.sort((a, b) => b.date.getTime() - a.date.getTime());

                    if (entries.length === 0) {
                      return <p className="text-stone-400 text-xs italic">No entries found for this view.</p>;
                    }

                    return entries.map((entry) => (
                      <div
                        key={entry.id}
                        className={`p-2.5 rounded-lg border text-xs ${
                          entry.type === "REMARK"
                            ? "bg-amber-50/50 border-amber-200"
                            : "bg-stone-50 border-stone-200"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                entry.type === "REMARK"
                                  ? "bg-amber-200 text-amber-900"
                                  : "bg-stone-200 text-stone-800"
                              }`}
                            >
                              {entry.type === "REMARK" ? "STAFF REMARK" : entry.toStage}
                            </span>
                            {entry.author && <span className="font-semibold text-stone-800">{entry.author}</span>}
                          </div>
                          <span className="text-[10px] text-stone-400">{formatDate(entry.date)}</span>
                        </div>
                        <p className="text-stone-700 text-[11px] mt-0.5">{entry.text}</p>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
