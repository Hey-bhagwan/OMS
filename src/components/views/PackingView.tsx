"use client";

import React, { useEffect, useState } from "react";
import { PackageCheck, CheckCircle2, Printer, FilterX } from "lucide-react";
import { formatShortDate } from "@/lib/utils";
import { useCachedFetch } from "@/lib/useCachedFetch";
import { OrderPrintView } from "@/components/OrderPrintView";
import { ColumnFilter } from "@/components/ui/ColumnFilter";
import { DataTablePagination } from "@/components/ui/DataTablePagination";
import { useTableFiltersAndPagination } from "@/components/ui/useTableFiltersAndPagination";
import { DateSortHeader } from "@/components/ui/DateSortHeader";

export const PackingView: React.FC<{ searchFilter?: string; onNavigateToOrder?: (orderId: string) => void }> = ({ searchFilter, onNavigateToOrder }) => {
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  let packingUrl = "/api/packing";
  if (showCompleted) packingUrl += "?showCompleted=true";

  const {
    data: packingData,
    loading,
    isBackgroundFetching,
    refetch: fetchTasks,
    mutate,
  } = useCachedFetch<any>(packingUrl);

  const tasks = (packingData?.tasks || []) as any[];

  // Table filtering and pagination hook
  const {
    currentPage,
    pageSize,
    totalPages,
    totalRecords,
    columnFilters,
    filteredData: filteredTasks,
    paginatedData: paginatedTasks,
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
  } = useTableFiltersAndPagination<any>(tasks, {
    searchFilter,
    dateSortExtractors: {
      deadline: (t) => t.fulfillmentDeadline,
    },
    searchFields: [
      (t) => t.code,
      (t) => t.orderCode,
      (t) => t.skuCode,
      (t) => t.skuName,
      (t) => t.specialInstructions,
    ],
    customFilterFn: (t, filters) => {
      if (filters.deadline && filters.deadline.length > 0) {
        const dl = formatShortDate(t.fulfillmentDeadline);
        if (!filters.deadline.includes(dl)) return false;
      }
      return true;
    },
  });

  const handleComplete = async (taskId: string) => {
    setCompletingId(taskId);
    try {
      const res = await fetch(`/api/packing/${taskId}/complete`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setFeedback("Packaging verified: Goods transferred to Packed inventory and removed from active packing queue.");
        // Immediately remove completed task from active view
        mutate((prev: any) => ({
          ...prev,
          tasks: (prev?.tasks || []).filter((t: any) => t.id !== taskId),
        }));
      } else {
        setFeedback(data.error || "Failed to complete packing");
      }
    } catch {
      setFeedback("Request failed");
    } finally {
      setCompletingId(null);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const filtered = tasks.filter((t) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      t.code?.toLowerCase().includes(q) ||
      t.orderCode?.toLowerCase().includes(q) ||
      t.skuCode?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg border border-stone-200 shadow-sm flex flex-wrap justify-between items-center gap-3 no-print">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Packaging Work Queue</h3>
          <p className="text-xs text-stone-500">
            Active packing tasks. Completing a task immediately moves the order to Dispatch readiness and removes it from this active queue.
          </p>
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
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md transition"
          >
            <Printer className="w-3.5 h-3.5 text-stone-500" />
            <span>Print</span>
          </button>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className={`px-3 py-1.5 text-xs rounded-md border font-medium transition ${
              showCompleted
                ? "bg-stone-800 text-white border-stone-800"
                : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100"
            }`}
          >
            {showCompleted ? "Showing Completed Tasks" : "Show Completed Archive"}
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg text-xs flex items-center space-x-2 no-print">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Task Code</span>
                    <ColumnFilter
                      columnId="code"
                      columnTitle="Task Code"
                      options={getDistinctValues("code", (t) => t.code)}
                      selectedValues={columnFilters["code"] || []}
                      onApply={(vals) => setColumnFilter("code", vals)}
                      onClear={() => clearColumnFilter("code")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Order Code</span>
                    <ColumnFilter
                      columnId="orderCode"
                      columnTitle="Order Code"
                      options={getDistinctValues("orderCode", (t) => t.orderCode)}
                      selectedValues={columnFilters["orderCode"] || []}
                      onApply={(vals) => setColumnFilter("orderCode", vals)}
                      onClear={() => clearColumnFilter("orderCode")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>SKU / Item</span>
                    <ColumnFilter
                      columnId="skuCode"
                      columnTitle="SKU"
                      options={getDistinctValues("skuCode", (t) => t.skuCode)}
                      selectedValues={columnFilters["skuCode"] || []}
                      onApply={(vals) => setColumnFilter("skuCode", vals)}
                      onClear={() => clearColumnFilter("skuCode")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 text-center whitespace-nowrap">
                  <div className="flex items-center justify-center space-x-1">
                    <span>Qty</span>
                    <ColumnFilter
                      columnId="quantityRequired"
                      columnTitle="Qty"
                      options={getDistinctValues("quantityRequired", (t) => String(t.quantityRequired))}
                      selectedValues={columnFilters["quantityRequired"] || []}
                      onApply={(vals) => setColumnFilter("quantityRequired", vals)}
                      onClear={() => clearColumnFilter("quantityRequired")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Packaging Type</span>
                    <ColumnFilter
                      columnId="packagingType"
                      columnTitle="Packaging Type"
                      options={getDistinctValues("packagingType", (t) => t.packagingType)}
                      selectedValues={columnFilters["packagingType"] || []}
                      onApply={(vals) => setColumnFilter("packagingType", vals)}
                      onClear={() => clearColumnFilter("packagingType")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">Packaging Specifications</th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <DateSortHeader
                    title="Deadline"
                    columnId="deadline"
                    currentSortColumn={sortColumn}
                    currentSortDirection={sortDirection}
                    onSortChange={toggleDateSort}
                  >
                    <ColumnFilter
                      columnId="deadline"
                      columnTitle="Deadline"
                      options={getDistinctValues("deadline", (t) => formatShortDate(t.fulfillmentDeadline))}
                      selectedValues={columnFilters["deadline"] || []}
                      onApply={(vals) => setColumnFilter("deadline", vals)}
                      onClear={() => clearColumnFilter("deadline")}
                    />
                  </DateSortHeader>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Status</span>
                    <ColumnFilter
                      columnId="status"
                      columnTitle="Status"
                      options={getDistinctValues("status", (t) => t.status)}
                      selectedValues={columnFilters["status"] || []}
                      onApply={(vals) => setColumnFilter("status", vals)}
                      onClear={() => clearColumnFilter("status")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-400">Loading packing queue...</td>
                </tr>
              ) : paginatedTasks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-400">
                    {showCompleted ? "No completed packing tasks." : "All packing tasks are complete! No orders pending in packing queue."}
                  </td>
                </tr>
              ) : (
                paginatedTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-stone-50/70 transition align-top">
                    <td className="py-3 px-4 font-mono font-medium text-stone-900">{t.code}</td>
                    <td className="py-3 px-4">
                      <span
                        className="font-mono text-stone-600 cursor-pointer hover:text-[#a27b5c] hover:underline"
                        onClick={() => t.orderId && onNavigateToOrder?.(t.orderId)}
                        title="Click to view in All Orders"
                      >{t.orderCode}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-stone-800 block">{t.skuCode}</span>
                      <span className="text-[10px] text-stone-500 block truncate max-w-xs">{t.skuName}</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-stone-900">{t.quantityRequired}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.packagingType === "EXPORT"
                            ? "bg-purple-100 text-purple-800 border border-purple-200"
                            : "bg-blue-100 text-blue-800 border border-blue-200"
                        }`}
                      >
                        {t.packagingType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-stone-600 max-w-xs">{t.specialInstructions}</td>
                    <td className="py-3 px-4 text-stone-600">{formatShortDate(t.fulfillmentDeadline)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          t.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {t.status !== "COMPLETED" && (
                          <button
                            disabled={completingId === t.id}
                            onClick={() => handleComplete(t.id)}
                            className="px-3 py-1 bg-[#a27b5c] hover:bg-[#8a6549] text-white text-[11px] font-medium rounded transition disabled:opacity-50"
                          >
                            {completingId === t.id ? "Transferring..." : "Complete & Transfer"}
                          </button>
                        )}
                      </div>
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
        pageTitle="Packing Queue"
        orders={filteredTasks.map((t) => ({
          orderId: t.orderId,
          orderCode: t.orderCode,
          displayOrderCode: t.displayOrderCode,
          channel: t.channel || "CUSTOM",
          items: t.items && t.items.length > 0 ? t.items : [
            {
              skuCode: t.skuCode,
              skuName: t.skuName,
              quantity: t.quantityRequired,
            },
          ],
        }))}
      />
    </div>
  );
};
