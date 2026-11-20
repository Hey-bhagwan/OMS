"use client";

import React, { useEffect, useState } from "react";
import { Truck, AlertTriangle, CheckCircle2, Clock, MapPin, FilterX, RefreshCw, Edit3 } from "lucide-react";
import { formatDate, formatShortDate } from "@/lib/utils";
import { useCachedFetch } from "@/lib/useCachedFetch";
import { ColumnFilter } from "@/components/ui/ColumnFilter";
import { DataTablePagination } from "@/components/ui/DataTablePagination";
import { useTableFiltersAndPagination } from "@/components/ui/useTableFiltersAndPagination";
import { DateSortHeader } from "@/components/ui/DateSortHeader";

export const DeliveryView: React.FC<{ searchFilter?: string; onNavigateToOrder?: (orderId: string) => void }> = ({ searchFilter, onNavigateToOrder }) => {
  const [filter, setFilter] = useState("");
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileMsg, setReconcileMsg] = useState<string | null>(null);
  const [checkingShipmentId, setCheckingShipmentId] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);

  // Edit Courier / AWB Modal state
  const [editingShipment, setEditingShipment] = useState<any | null>(null);
  const [editCourier, setEditCourier] = useState("Blue Dart");
  const [editCustomCourier, setEditCustomCourier] = useState("");
  const [editAwb, setEditAwb] = useState("");
  const [editRemark, setEditRemark] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const {
    data: deliveryData,
    loading,
    isBackgroundFetching,
    refetch: fetchShipments,
  } = useCachedFetch<any>("/api/delivery");

  const handleCheckStatus = async (shipmentId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (checkingShipmentId) return;
    setCheckingShipmentId(shipmentId);
    setReconcileMsg(null);
    try {
      const res = await fetch(`/api/delivery/${shipmentId}/check-status`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const r = data.result;
        const msg = r.statusChanged
          ? `Status updated: ${r.previousStatus} ➔ ${r.newStatus} (${r.courierName || "Carrier"})`
          : `Verified with carrier: Current status is ${r.newStatus}`;
        setReconcileMsg(msg);
        fetchShipments();
      } else {
        setReconcileMsg(data.error || "Failed to check status.");
      }
    } catch {
      setReconcileMsg("Carrier check request failed.");
    } finally {
      setCheckingShipmentId(null);
      setTimeout(() => setReconcileMsg(null), 6000);
    }
  };

  const handleCheckAllNonDelivered = async () => {
    if (checkingAll) return;
    setCheckingAll(true);
    setReconcileMsg(null);
    try {
      const res = await fetch("/api/delivery/check-status?limit=50", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setReconcileMsg(data.message || `Checked ${data.checkedCount} shipments.`);
        fetchShipments();
      } else {
        setReconcileMsg(data.error || "Failed to check non-delivered shipments.");
      }
    } catch {
      setReconcileMsg("Bulk status check failed.");
    } finally {
      setCheckingAll(false);
      setTimeout(() => setReconcileMsg(null), 7000);
    }
  };

  const handleReconcileUnmatched = async () => {
    if (reconciling) return;
    setReconciling(true);
    setReconcileMsg(null);
    try {
      const res = await fetch("/api/delivery", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setReconcileMsg(data.message || "Reconciliation complete.");
        fetchShipments();
      } else {
        setReconcileMsg(data.error || "Failed to reconcile shipments.");
      }
    } catch {
      setReconcileMsg("Request failed.");
    } finally {
      setReconciling(false);
      setTimeout(() => setReconcileMsg(null), 5000);
    }
  };

  const handleOpenEdit = (shipment: any) => {
    setEditingShipment(shipment);
    setEditAwb(shipment.awb || "");
    const standardCouriers = [
      "Blue Dart",
      "Delhivery",
      "Shiprocket Cargo",
      "DTDC",
      "Ekart Logistics",
      "Amazon Shipping",
      "Shadowfax",
      "Xpressbees",
      "DHL Express (Export)",
      "FedEx",
    ];
    if (standardCouriers.includes(shipment.courier)) {
      setEditCourier(shipment.courier);
      setEditCustomCourier("");
    } else {
      setEditCourier("OTHER");
      setEditCustomCourier(shipment.courier || "");
    }
    setEditRemark("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShipment) return;
    const finalCourier = editCourier === "OTHER" ? editCustomCourier.trim() : editCourier;
    if (!editAwb.trim() || !finalCourier) {
      setReconcileMsg("Courier and AWB number cannot be empty.");
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/delivery/${editingShipment.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awbWaybill: editAwb.trim(),
          courierName: finalCourier,
          remark: editRemark.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReconcileMsg(`Shipment updated: ${finalCourier} (AWB: ${editAwb.trim()})`);
        setEditingShipment(null);
        fetchShipments();
      } else {
        setReconcileMsg(data.error || "Failed to update shipment.");
      }
    } catch {
      setReconcileMsg("Failed to send update request.");
    } finally {
      setSavingEdit(false);
      setTimeout(() => setReconcileMsg(null), 6000);
    }
  };

  const allShipments = (deliveryData?.shipments || []) as any[];
  // Count only non-delivered shipments that belong to actual orders
  const nonDeliveredCount = React.useMemo(() => {
    return allShipments.filter((s) => s.orderId && s.status !== "DELIVERED" && s.status !== "RETURNED").length;
  }, [allShipments]);

  // Client-side quick filter according to status pill without re-fetching
  const shipments = React.useMemo(() => {
    if (!filter) return allShipments;
    if (filter === "in_transit") {
      return allShipments.filter((s) => ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(s.status));
    }
    if (filter === "exceptions") {
      return allShipments.filter((s) => ["DELIVERY_EXCEPTION", "UNDELIVERED", "RTO"].includes(s.status));
    }
    if (filter === "delivered") {
      return allShipments.filter((s) => s.status === "DELIVERED");
    }
    return allShipments;
  }, [allShipments, filter]);

  // Table filtering and pagination hook
  const {
    currentPage,
    pageSize,
    totalPages,
    totalRecords,
    columnFilters,
    filteredData: filteredShipments,
    paginatedData: paginatedShipments,
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
  } = useTableFiltersAndPagination<any>(shipments, {
    searchFilter,
    dateSortExtractors: {
      etd: (s) => s.etd,
      updatedAt: (s) => s.updatedAt || s.lastEventTime,
    },
    searchFields: [
      (s) => s.awb,
      (s) => s.courier,
      (s) => s.orderCode,
      (s) => s.destinationCity,
      (s) => s.lastScanLocation,
      (s) => s.lastActivity,
    ],
    customFilterFn: (s, filters) => {
      if (filters.status && filters.status.length > 0) {
        const statusLabel = s.status?.replace(/_/g, " ");
        if (!filters.status.includes(statusLabel) && !filters.status.includes(s.status)) return false;
      }
      if (filters.etd && filters.etd.length > 0) {
        const etdStr = formatShortDate(s.etd);
        if (!filters.etd.includes(etdStr)) return false;
      }
      if (filters.updatedAt && filters.updatedAt.length > 0) {
        const updStr = formatShortDate(s.updatedAt || s.lastEventTime);
        if (!filters.updatedAt.includes(updStr)) return false;
      }
      return true;
    },
  });

  return (
    <div className="space-y-4">
      {/* Header & Status Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg border border-stone-200 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Shipment & Delivery Tracking</h3>
          <p className="text-xs text-stone-500">Live parcel telemetry synchronized via Shiprocket and Shiprocket Cargo webhooks</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            disabled
            title="Carrier live status check is temporarily disabled"
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-stone-400 bg-stone-100 border border-stone-200 rounded-md transition cursor-not-allowed"
          >
            <RefreshCw className="w-3.5 h-3.5 text-stone-400" />
            <span>Check Live Status (Disabled)</span>
          </button>
          <button
            onClick={handleReconcileUnmatched}
            disabled={reconciling}
            title="Scan Unicommerce for unmatched AWBs and auto-import missing orders"
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md transition disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-stone-600 ${reconciling ? "animate-spin" : ""}`} />
            <span>{reconciling ? "Syncing..." : "Sync Unlinked AWBs"}</span>
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center space-x-1 px-2.5 py-1 text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition font-medium"
            >
              <FilterX className="w-3.5 h-3.5" />
              <span>Clear All Filters</span>
            </button>
          )}
          <button
            onClick={() => setFilter("")}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition ${
              filter === "" ? "bg-[#a27b5c] text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"
            }`}
          >
            All Shipments
          </button>
          <button
            onClick={() => setFilter("in_transit")}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition ${
              filter === "in_transit" ? "bg-[#a27b5c] text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"
            }`}
          >
            In Transit
          </button>
          <button
            onClick={() => setFilter("exceptions")}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition ${
              filter === "exceptions" ? "bg-red-700 text-white" : "bg-red-50 text-red-700 hover:bg-red-100"
            }`}
          >
            Exceptions / RTO
          </button>
          <button
            onClick={() => setFilter("delivered")}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition ${
              filter === "delivered" ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            Delivered
          </button>
        </div>
      </div>

      {reconcileMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{reconcileMsg}</span>
        </div>
      )}

      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>AWB / Waybill</span>
                    <ColumnFilter
                      columnId="awb"
                      columnTitle="AWB"
                      options={getDistinctValues("awb", (s) => s.awb)}
                      selectedValues={columnFilters["awb"] || []}
                      onApply={(vals) => setColumnFilter("awb", vals)}
                      onClear={() => clearColumnFilter("awb")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Courier</span>
                    <ColumnFilter
                      columnId="courier"
                      columnTitle="Courier"
                      options={getDistinctValues("courier", (s) => s.courier)}
                      selectedValues={columnFilters["courier"] || []}
                      onApply={(vals) => setColumnFilter("courier", vals)}
                      onClear={() => clearColumnFilter("courier")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Order Code</span>
                    <ColumnFilter
                      columnId="orderCode"
                      columnTitle="Order Code"
                      options={getDistinctValues("orderCode", (s) => s.orderCode)}
                      selectedValues={columnFilters["orderCode"] || []}
                      onApply={(vals) => setColumnFilter("orderCode", vals)}
                      onClear={() => clearColumnFilter("orderCode")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Shipment Status</span>
                    <ColumnFilter
                      columnId="status"
                      columnTitle="Shipment Status"
                      options={getDistinctValues("status", (s) => s.status?.replace(/_/g, " "))}
                      selectedValues={columnFilters["status"] || []}
                      onApply={(vals) => setColumnFilter("status", vals)}
                      onClear={() => clearColumnFilter("status")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Current Hub / Location</span>
                    <ColumnFilter
                      columnId="lastScanLocation"
                      columnTitle="Location"
                      options={getDistinctValues("lastScanLocation", (s) => s.lastScanLocation)}
                      selectedValues={columnFilters["lastScanLocation"] || []}
                      onApply={(vals) => setColumnFilter("lastScanLocation", vals)}
                      onClear={() => clearColumnFilter("lastScanLocation")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">Latest Scan Activity</th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <DateSortHeader
                    title="Estimated Delivery"
                    columnId="etd"
                    currentSortColumn={sortColumn}
                    currentSortDirection={sortDirection}
                    onSortChange={toggleDateSort}
                  >
                    <ColumnFilter
                      columnId="etd"
                      columnTitle="Estimated Delivery"
                      options={getDistinctValues("etd", (s) => formatShortDate(s.etd))}
                      selectedValues={columnFilters["etd"] || []}
                      onApply={(vals) => setColumnFilter("etd", vals)}
                      onClear={() => clearColumnFilter("etd")}
                    />
                  </DateSortHeader>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <DateSortHeader
                    title="Last Updated"
                    columnId="updatedAt"
                    currentSortColumn={sortColumn}
                    currentSortDirection={sortDirection}
                    onSortChange={toggleDateSort}
                  >
                    <ColumnFilter
                      columnId="updatedAt"
                      columnTitle="Last Updated"
                      options={getDistinctValues("updatedAt", (s) => formatShortDate(s.updatedAt || s.lastEventTime))}
                      selectedValues={columnFilters["updatedAt"] || []}
                      onApply={(vals) => setColumnFilter("updatedAt", vals)}
                      onClear={() => clearColumnFilter("updatedAt")}
                    />
                  </DateSortHeader>
                </th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-400">Loading tracking telemetry...</td>
                </tr>
              ) : paginatedShipments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-400">No shipments found in this category.</td>
                </tr>
              ) : (
                paginatedShipments.map((s) => {
                  const isDelivered = s.status === "DELIVERED";
                  const isException = s.status === "DELIVERY_EXCEPTION" || s.status === "RTO" || s.status === "UNDELIVERED";
                  return (
                    <tr key={s.id} className="hover:bg-stone-50/70 transition">
                      <td className="py-2.5 px-4 font-mono font-medium text-stone-900">{s.awb}</td>
                      <td className="py-2.5 px-4 font-medium text-stone-700">{s.courier}</td>
                      <td className="py-2.5 px-4 font-mono text-stone-600">
                        {s.orderId ? (
                          <span
                            className="cursor-pointer font-semibold text-[#a27b5c] hover:underline inline-flex items-center gap-1"
                            onClick={() => onNavigateToOrder?.(s.orderId)}
                            title="Click to inspect order"
                          >
                            <span>{s.orderCode}</span>
                            {s.displayOrderCode && (
                              <span className="text-[10px] text-stone-400 font-normal">({s.displayOrderCode})</span>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                            {s.orderCode && s.orderCode !== "Unmatched" ? s.orderCode : "Awaiting Order Link"}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isDelivered
                              ? "bg-emerald-100 text-emerald-800"
                              : isException
                              ? "bg-red-100 text-red-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {s.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-stone-700 flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                        <span>{s.lastScanLocation}</span>
                      </td>
                      <td className="py-2.5 px-4 text-stone-600 max-w-xs truncate">{s.lastActivity}</td>
                      <td className="py-2.5 px-4 text-stone-600">{formatShortDate(s.etd)}</td>
                      <td className="py-2.5 px-4 text-stone-600 whitespace-nowrap">
                        <div className="text-xs font-medium text-stone-800">
                          {formatShortDate(s.updatedAt || s.lastEventTime)}
                        </div>
                        <div className="text-[10px] text-stone-400">
                          {formatDate(s.updatedAt || s.lastEventTime, "HH:mm")}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {!isDelivered ? (
                            <button
                              disabled
                              title="Carrier status check is temporarily disabled"
                              className="px-2 py-1 text-[11px] font-semibold bg-stone-100 text-stone-400 border border-stone-200 rounded flex items-center space-x-1 cursor-not-allowed"
                            >
                              <RefreshCw className="w-3 h-3 text-stone-400" />
                              <span>Check Status</span>
                            </button>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 rounded border border-emerald-200">
                              Delivered ✓
                            </span>
                          )}
                          <button
                            onClick={() => setSelectedShipment(s)}
                            className="px-2 py-1 text-[11px] font-medium bg-stone-100 hover:bg-stone-200 text-stone-800 rounded transition"
                          >
                            Events
                          </button>
                          {!isDelivered && (
                            <button
                              onClick={() => handleOpenEdit(s)}
                              title="Edit Courier or AWB number"
                              className="px-2 py-1 text-[11px] font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 rounded flex items-center space-x-1 transition"
                            >
                              <Edit3 className="w-3 h-3 text-stone-500" />
                              <span>Edit</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
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

      {/* Events Modal */}
      {selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white p-6 rounded-lg shadow-xl border border-stone-200 space-y-4">
            <div className="flex justify-between items-start border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900 font-mono">
                  AWB: {selectedShipment.awb}
                </h3>
                <span className="text-xs text-stone-500">
                  {selectedShipment.courier} • Order: {selectedShipment.orderCode}
                </span>
              </div>
              <button
                onClick={() => setSelectedShipment(null)}
                className="text-stone-400 hover:text-stone-700 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              <h4 className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                Telemetry Audit Scans
              </h4>
              {selectedShipment.events?.length === 0 ? (
                <p className="text-xs text-stone-400">Awaiting first carrier checkpoint scan.</p>
              ) : (
                <div className="space-y-3 border-l-2 border-stone-200 pl-4 ml-1">
                  {selectedShipment.events?.map((ev: any) => (
                    <div key={ev.id} className="relative text-xs">
                      <div className="w-2 h-2 rounded-full bg-blue-500 absolute -left-[21px] top-1"></div>
                      <span className="font-semibold text-stone-900">{ev.activity}</span>
                      <span className="text-[10px] text-stone-400 block">
                        {formatDate(ev.timestamp)} • Location: {ev.location || "In Transit"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-stone-200">
              <button
                onClick={() => setSelectedShipment(null)}
                className="px-4 py-1.5 text-xs bg-stone-100 hover:bg-stone-200 text-stone-800 rounded font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Courier / AWB Modal */}
      {editingShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs no-print">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md bg-white p-6 rounded-lg shadow-xl border border-stone-200 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex justify-between items-start border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  Update Courier &amp; AWB Number
                </h3>
                <span className="text-xs text-stone-500">
                  Order: {editingShipment.orderCode}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingShipment(null)}
                className="text-stone-400 hover:text-stone-700 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">Shipping Partner</label>
              <select
                value={editCourier}
                onChange={(e) => setEditCourier(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-[#a27b5c]"
              >
                <option value="Blue Dart">Blue Dart</option>
                <option value="Delhivery">Delhivery</option>
                <option value="Shiprocket Cargo">Shiprocket Cargo</option>
                <option value="DTDC">DTDC</option>
                <option value="Ekart Logistics">Ekart Logistics</option>
                <option value="Amazon Shipping">Amazon Shipping</option>
                <option value="Shadowfax">Shadowfax</option>
                <option value="Xpressbees">Xpressbees</option>
                <option value="DHL Express (Export)">DHL Express (Export)</option>
                <option value="FedEx">FedEx</option>
                <option value="OTHER">+ Other / Custom Shipping Partner...</option>
              </select>
            </div>

            {editCourier === "OTHER" && (
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Custom Shipping Company Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editCustomCourier}
                  onChange={(e) => setEditCustomCourier(e.target.value)}
                  placeholder="Enter shipping company (e.g. TCI Freight, V-Trans, GATI...)"
                  className="w-full px-3 py-1.5 text-xs border border-amber-300 bg-amber-50/30 rounded focus:ring-1 focus:ring-[#a27b5c]"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">
                AWB / Tracking Number <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={editAwb}
                onChange={(e) => setEditAwb(e.target.value)}
                placeholder="e.g. BD987123498"
                className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-[#a27b5c] font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">Update Reason / Remark (Optional)</label>
              <textarea
                rows={2}
                value={editRemark}
                onChange={(e) => setEditRemark(e.target.value)}
                placeholder="e.g. Corrected AWB after re-manifesting parcel..."
                className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-[#a27b5c]"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setEditingShipment(null)}
                className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="px-4 py-1.5 text-xs font-semibold bg-[#a27b5c] text-white hover:bg-[#8a6549] rounded transition"
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
