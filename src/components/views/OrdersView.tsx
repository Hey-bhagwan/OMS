"use client";

import React, { useEffect, useRef, useState } from "react";
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
  FilterX,
} from "lucide-react";
import { formatShortDate, formatDate } from "@/lib/utils";
import { useCachedFetch } from "@/lib/useCachedFetch";
import { OrderPrintView } from "@/components/OrderPrintView";
import { ColumnFilter } from "@/components/ui/ColumnFilter";
import { DataTablePagination } from "@/components/ui/DataTablePagination";
import { useTableFiltersAndPagination } from "@/components/ui/useTableFiltersAndPagination";
import { DateSortHeader } from "@/components/ui/DateSortHeader";
import { PriorityOrderCode } from "@/components/ui/PriorityOrderCode";
import { OrderInspectDrawer } from "@/components/OrderInspectDrawer";

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

export const OrdersView: React.FC<{
  searchFilter?: string;
  highlightOrderId?: string | null;
  onHighlightClear?: () => void;
}> = ({ searchFilter, highlightOrderId, onHighlightClear }) => {
  const [stageFilter, setStageFilter] = useState<string>("");
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);
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

  // Row refs for highlight scroll
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);

  let ordersUrl = "/api/orders?limit=50";
  if (stageFilter) ordersUrl += `&stage=${stageFilter}`;
  if (channelFilter) ordersUrl += `&channel=${channelFilter}`;

  const {
    data: ordersData,
    loading,
    isBackgroundFetching,
    refetch: fetchOrders,
  } = useCachedFetch<any>(ordersUrl);

  const orders = (ordersData?.orders || []) as any[];

  // When highlightOrderId changes, clear filters so the order is visible, then scroll & highlight
  useEffect(() => {
    if (!highlightOrderId) return;

    // Clear filters so the target order appears in the list
    setStageFilter("");
    setChannelFilter("");
    setActiveHighlight(highlightOrderId);
  }, [highlightOrderId]);

  // After orders load (or filter reset), attempt scroll
  useEffect(() => {
    if (!activeHighlight) return;

    const el = rowRefs.current.get(activeHighlight);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Auto-clear highlight after 2.5s
      const timer = setTimeout(() => {
        setActiveHighlight(null);
        onHighlightClear?.();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [activeHighlight, orders]);

  const viewOrderDetails = async (orderId: string) => {
    setInspectLoading(true);
    setLoadingOrderId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      if (data.order) setSelectedOrder(data.order);
    } catch (err) {
      console.error(err);
    } finally {
      setInspectLoading(false);
      setLoadingOrderId(null);
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

  // Table filtering and pagination hook
  const {
    currentPage,
    pageSize,
    totalPages,
    totalRecords,
    columnFilters,
    filteredData: filteredOrders,
    paginatedData: paginatedOrders,
    hasActiveFilters,
    sortColumn,
    sortDirection,
    toggleDateSort,
    setCurrentPage,
    setPageSize,
    setColumnFilter,
    clearColumnFilter,
    clearAllFilters,
    getDistinctValues,
  } = useTableFiltersAndPagination<any>(orders, {
    searchFilter,
    dateSortExtractors: {
      orderDate: (o) => o.orderDate || o.displayOrderDateTime || o.createdAt,
      fulfillmentDeadline: (o) => o.fulfillmentDeadline,
    },
    searchFields: [
      (o) => o.uniwareOrderCode,
      (o) => o.displayOrderCode,
      (o) => o.primarySku,
      (o) => o.primaryProductName,
      (o) => o.shippingAddressCity,
      (o) => o.items?.map((it: any) => `${it.skuCode} ${it.skuName}`).join(" "),
    ],
    customFilterFn: (o, filters) => {
      // Custom checks if needed for multi-value fields
      if (filters.primarySku && filters.primarySku.length > 0) {
        const orderSkus = o.items?.map((it: any) => it.skuCode) || [o.primarySku];
        if (!orderSkus.some((s: string) => filters.primarySku.includes(s))) return false;
      }
      if (filters.totalQty && filters.totalQty.length > 0) {
        const qty = String(o.items?.reduce((sum: number, l: any) => sum + (l.quantity || 0), 0) || o.totalItems || 1);
        if (!filters.totalQty.includes(qty)) return false;
      }
      if (filters.orderDate && filters.orderDate.length > 0) {
        const dateStr = formatShortDate(o.orderDate || o.createdAt);
        if (!filters.orderDate.includes(dateStr)) return false;
      }
      if (filters.fulfillmentDeadline && filters.fulfillmentDeadline.length > 0) {
        const dl = formatShortDate(o.fulfillmentDeadline);
        if (!filters.fulfillmentDeadline.includes(dl)) return false;
      }
      if (filters.blocker && filters.blocker.length > 0) {
        const b = o.blockerReason || "None";
        if (!filters.blocker.includes(b)) return false;
      }
      return true;
    },
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
        <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg text-xs flex items-center space-x-2 no-print">
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
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center space-x-1 px-2.5 py-1 text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition font-medium"
            >
              <FilterX className="w-3.5 h-3.5" />
              <span>Clear All Filters</span>
            </button>
          )}
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
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <span>Order Code</span>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <DateSortHeader
                    title="Order Date"
                    columnId="orderDate"
                    currentSortColumn={sortColumn}
                    currentSortDirection={sortDirection}
                    onSortChange={toggleDateSort}
                  >
                    <ColumnFilter
                      columnId="orderDate"
                      columnTitle="Order Date"
                      options={getDistinctValues("orderDate", (o) => formatShortDate(o.orderDate || o.createdAt))}
                      selectedValues={columnFilters["orderDate"] || []}
                      onApply={(vals) => setColumnFilter("orderDate", vals)}
                      onClear={() => clearColumnFilter("orderDate")}
                    />
                  </DateSortHeader>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Channel</span>
                    <ColumnFilter
                      columnId="channel"
                      columnTitle="Channel"
                      options={getDistinctValues("channel", (o) => o.channel)}
                      selectedValues={columnFilters["channel"] || []}
                      onApply={(vals) => setColumnFilter("channel", vals)}
                      onClear={() => clearColumnFilter("channel")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Items / SKU</span>
                    <ColumnFilter
                      columnId="primarySku"
                      columnTitle="Items / SKU"
                      options={getDistinctValues("primarySku", (o) => o.items?.map((it: any) => it.skuCode) || [o.primarySku])}
                      selectedValues={columnFilters["primarySku"] || []}
                      onApply={(vals) => setColumnFilter("primarySku", vals)}
                      onClear={() => clearColumnFilter("primarySku")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 text-center whitespace-nowrap">
                  <div className="flex items-center justify-center space-x-1">
                    <span>Total Qty</span>
                    <ColumnFilter
                      columnId="totalQty"
                      columnTitle="Total Qty"
                      options={getDistinctValues("totalQty", (o) => String(o.items?.reduce((sum: number, l: any) => sum + (l.quantity || 0), 0) || o.totalItems || 1))}
                      selectedValues={columnFilters["totalQty"] || []}
                      onApply={(vals) => setColumnFilter("totalQty", vals)}
                      onClear={() => clearColumnFilter("totalQty")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Internal Stage</span>
                    <ColumnFilter
                      columnId="internalStage"
                      columnTitle="Internal Stage"
                      options={getDistinctValues("internalStage", (o) => o.internalStage)}
                      selectedValues={columnFilters["internalStage"] || []}
                      onApply={(vals) => setColumnFilter("internalStage", vals)}
                      onClear={() => clearColumnFilter("internalStage")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Packaging</span>
                    <ColumnFilter
                      columnId="packagingType"
                      columnTitle="Packaging"
                      options={getDistinctValues("packagingType", (o) => o.packagingType)}
                      selectedValues={columnFilters["packagingType"] || []}
                      onApply={(vals) => setColumnFilter("packagingType", vals)}
                      onClear={() => clearColumnFilter("packagingType")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <DateSortHeader
                    title="Fulfillment Deadline"
                    columnId="fulfillmentDeadline"
                    currentSortColumn={sortColumn}
                    currentSortDirection={sortDirection}
                    onSortChange={toggleDateSort}
                  >
                    <ColumnFilter
                      columnId="fulfillmentDeadline"
                      columnTitle="Fulfillment Deadline"
                      options={getDistinctValues("fulfillmentDeadline", (o) => formatShortDate(o.fulfillmentDeadline))}
                      selectedValues={columnFilters["fulfillmentDeadline"] || []}
                      onApply={(vals) => setColumnFilter("fulfillmentDeadline", vals)}
                      onClear={() => clearColumnFilter("fulfillmentDeadline")}
                    />
                  </DateSortHeader>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Blocker / Next Action</span>
                    <ColumnFilter
                      columnId="blocker"
                      columnTitle="Blocker"
                      options={getDistinctValues("blocker", (o) => o.blockerReason || "None")}
                      selectedValues={columnFilters["blocker"] || []}
                      onApply={(vals) => setColumnFilter("blocker", vals)}
                      onClear={() => clearColumnFilter("blocker")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 text-right no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-stone-400">Loading orders...</td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-stone-400">No orders found matching filters.</td>
                </tr>
              ) : (
                paginatedOrders.map((o) => (
                  <tr
                    key={o.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(o.id, el);
                      else rowRefs.current.delete(o.id);
                    }}
                    className={`hover:bg-stone-50/70 transition align-top ${
                      activeHighlight === o.id
                        ? "ring-2 ring-inset ring-[#a27b5c] bg-amber-50/60"
                        : ""
                    }`}
                  >
                    <td className="py-2.5 px-4">
                      <PriorityOrderCode
                        orderCode={o.uniwareOrderCode}
                        displayOrderCode={o.displayOrderCode}
                        priorityLabel={o.priorityLabel}
                        priorityReason={o.priorityReason}
                        priorityScore={o.priorityScore}
                        fulfillmentDeadline={o.fulfillmentDeadline}
                        blockerReason={o.blocker}
                        internalStage={o.internalStage}
                        onClick={() => viewOrderDetails(o.id)}
                      />
                    </td>
                    <td className="py-2.5 px-4 text-stone-600 whitespace-nowrap">
                      <span className="text-stone-800 font-medium block">
                        {formatShortDate(o.orderDate || o.createdAt)}
                      </span>
                      <span className="text-[10px] text-stone-400 block">
                        {formatDate(o.orderDate || o.createdAt, "HH:mm")}
                      </span>
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
                        disabled={loadingOrderId === o.id}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition inline-flex items-center space-x-1.5 ${
                          loadingOrderId === o.id
                            ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
                            : "bg-stone-100 hover:bg-stone-200 text-stone-700"
                        }`}
                      >
                        {loadingOrderId === o.id ? (
                          <>
                            <div className="w-3 h-3 border-2 border-[#a27b5c] border-t-transparent rounded-full animate-spin" />
                            <span>Loading...</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" />
                            <span>Inspect</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalRecords={totalRecords}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Simplified Print Output */}
      <OrderPrintView
        pageTitle="All Orders"
        orders={filteredOrders.map((o) => ({
          orderId: o.id,
          orderCode: o.uniwareOrderCode,
          displayOrderCode: o.displayOrderCode,
          channel: o.channel,
          items: o.items || [],
        }))}
      />

      {/* Order Detail Drawer */}
      <OrderInspectDrawer
        orderId={selectedOrder?.id || loadingOrderId}
        order={selectedOrder}
        loading={inspectLoading}
        onClose={() => setSelectedOrder(null)}
        onRefresh={() => {
          fetchOrders();
          if (selectedOrder) viewOrderDetails(selectedOrder.id);
        }}
      />
    </div>
  );
};
