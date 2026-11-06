"use client";

import React, { useEffect, useState } from "react";
import { Truck, AlertTriangle, CheckCircle2, Clock, MapPin, FilterX } from "lucide-react";
import { formatDate, formatShortDate } from "@/lib/utils";
import { useCachedFetch } from "@/lib/useCachedFetch";
import { ColumnFilter } from "@/components/ui/ColumnFilter";
import { DataTablePagination } from "@/components/ui/DataTablePagination";
import { useTableFiltersAndPagination } from "@/components/ui/useTableFiltersAndPagination";
import { DateSortHeader } from "@/components/ui/DateSortHeader";

export const DeliveryView: React.FC<{ searchFilter?: string; onNavigateToOrder?: (orderId: string) => void }> = ({ searchFilter, onNavigateToOrder }) => {
  const [filter, setFilter] = useState("");
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null);

  let deliveryUrl = "/api/delivery";
  if (filter) deliveryUrl += `?filter=${filter}`;

  const {
    data: deliveryData,
    loading,
    isBackgroundFetching,
    refetch: fetchShipments,
  } = useCachedFetch<any>(deliveryUrl);

  const shipments = (deliveryData?.shipments || []) as any[];

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
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">Loading tracking telemetry...</td>
                </tr>
              ) : paginatedShipments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">No shipments found in this category.</td>
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
                      <span
                        className={s.orderId ? "cursor-pointer hover:text-[#a27b5c] hover:underline" : ""}
                        onClick={() => s.orderId && onNavigateToOrder?.(s.orderId)}
                        title={s.orderId ? "Click to view in All Orders" : undefined}
                      >{s.orderCode}</span>
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
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedShipment(s)}
                          className="px-2 py-1 text-[11px] font-medium bg-stone-100 hover:bg-stone-200 text-stone-800 rounded"
                        >
                          View Events
                        </button>
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
    </div>
  );
};
