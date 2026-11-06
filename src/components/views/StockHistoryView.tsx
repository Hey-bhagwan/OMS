"use client";

import React, { useEffect, useState } from "react";
import { History, Download, RefreshCw, FilterX } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useCachedFetch } from "@/lib/useCachedFetch";
import { ColumnFilter } from "@/components/ui/ColumnFilter";
import { DataTablePagination } from "@/components/ui/DataTablePagination";
import { useTableFiltersAndPagination } from "@/components/ui/useTableFiltersAndPagination";
import { DateSortHeader } from "@/components/ui/DateSortHeader";

export const StockHistoryView: React.FC<{ searchFilter?: string }> = ({ searchFilter }) => {
  const [bucketFilter, setBucketFilter] = useState("");

  let historyUrl = "/api/inventory/history?limit=1000";
  if (bucketFilter) historyUrl += `&bucket=${bucketFilter}`;

  const {
    data: historyData,
    loading,
    isBackgroundFetching,
    refetch: fetchHistory,
  } = useCachedFetch<any>(historyUrl);

  const transactions = (historyData?.transactions || []) as any[];

  // Table filtering and pagination hook
  const {
    currentPage,
    pageSize,
    totalPages,
    totalRecords,
    columnFilters,
    filteredData: filteredTransactions,
    paginatedData: paginatedTransactions,
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
  } = useTableFiltersAndPagination<any>(transactions, {
    searchFilter,
    dateSortExtractors: {
      timestamp: (t) => t.timestamp,
    },
    searchFields: [
      (t) => t.itemCode,
      (t) => t.itemName,
      (t) => t.reason,
      (t) => t.type,
      (t) => t.referenceType,
    ],
    customFilterFn: (t, filters) => {
      if (filters.timestamp && filters.timestamp.length > 0) {
        const dt = formatDate(t.timestamp, "dd MMM yyyy");
        if (!filters.timestamp.includes(dt)) return false;
      }
      return true;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg border border-stone-200 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Immutable Stock Transaction Ledger</h3>
          <p className="text-xs text-stone-500">
            Append-only financial-grade audit ledger recording every inventory reservation, transfer, consumption, and adjustment
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
          <select
            value={bucketFilter}
            onChange={(e) => setBucketFilter(e.target.value)}
            className="text-xs bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none"
          >
            <option value="">All Buckets</option>
            <option value="PACKED">Packed Goods</option>
            <option value="UNPACKED">Unpacked Goods</option>
            <option value="RAW_MATERIAL">Raw Materials</option>
          </select>
          <button
            onClick={fetchHistory}
            className="p-1.5 text-stone-500 hover:text-stone-900 border border-stone-200 rounded-md"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <DateSortHeader
                    title="Timestamp"
                    columnId="timestamp"
                    currentSortColumn={sortColumn}
                    currentSortDirection={sortDirection}
                    onSortChange={toggleDateSort}
                  >
                    <ColumnFilter
                      columnId="timestamp"
                      columnTitle="Timestamp"
                      options={getDistinctValues("timestamp", (t) => formatDate(t.timestamp, "dd MMM yyyy"))}
                      selectedValues={columnFilters["timestamp"] || []}
                      onApply={(vals) => setColumnFilter("timestamp", vals)}
                      onClear={() => clearColumnFilter("timestamp")}
                    />
                  </DateSortHeader>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Bucket</span>
                    <ColumnFilter
                      columnId="bucket"
                      columnTitle="Bucket"
                      options={getDistinctValues("bucket", (t) => t.bucket)}
                      selectedValues={columnFilters["bucket"] || []}
                      onApply={(vals) => setColumnFilter("bucket", vals)}
                      onClear={() => clearColumnFilter("bucket")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Item Code</span>
                    <ColumnFilter
                      columnId="itemCode"
                      columnTitle="Item Code"
                      options={getDistinctValues("itemCode", (t) => t.itemCode)}
                      selectedValues={columnFilters["itemCode"] || []}
                      onApply={(vals) => setColumnFilter("itemCode", vals)}
                      onClear={() => clearColumnFilter("itemCode")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Item Name</span>
                    <ColumnFilter
                      columnId="itemName"
                      columnTitle="Item Name"
                      options={getDistinctValues("itemName", (t) => t.itemName)}
                      selectedValues={columnFilters["itemName"] || []}
                      onApply={(vals) => setColumnFilter("itemName", vals)}
                      onClear={() => clearColumnFilter("itemName")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Transaction Type</span>
                    <ColumnFilter
                      columnId="type"
                      columnTitle="Type"
                      options={getDistinctValues("type", (t) => t.type)}
                      selectedValues={columnFilters["type"] || []}
                      onApply={(vals) => setColumnFilter("type", vals)}
                      onClear={() => clearColumnFilter("type")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Quantity Delta</span>
                    <ColumnFilter
                      columnId="quantityChange"
                      columnTitle="Qty Delta"
                      options={getDistinctValues("quantityChange", (t) => String(t.quantityChange))}
                      selectedValues={columnFilters["quantityChange"] || []}
                      onApply={(vals) => setColumnFilter("quantityChange", vals)}
                      onClear={() => clearColumnFilter("quantityChange")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">Reason & Justification</th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Reference</span>
                    <ColumnFilter
                      columnId="referenceType"
                      columnTitle="Reference"
                      options={getDistinctValues("referenceType", (t) => t.referenceType || "-")}
                      selectedValues={columnFilters["referenceType"] || []}
                      onApply={(vals) => setColumnFilter("referenceType", vals)}
                      onClear={() => clearColumnFilter("referenceType")}
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">Loading ledger records...</td>
                </tr>
              ) : paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">No stock ledger transactions found.</td>
                </tr>
              ) : (
                paginatedTransactions.map((t) => {
                  const isPositive = t.quantityChange > 0;
                  return (
                    <tr key={t.id} className="hover:bg-stone-50/70 transition">
                      <td className="py-2.5 px-4 text-stone-500 whitespace-nowrap">{formatDate(t.timestamp)}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-700">
                          {t.bucket}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono font-medium text-stone-900">{t.itemCode}</td>
                      <td className="py-2.5 px-4 font-semibold text-stone-800">{t.itemName}</td>
                      <td className="py-2.5 px-4 font-medium text-stone-700">{t.type}</td>
                      <td className="py-2.5 px-4 font-bold">
                        <span className={isPositive ? "text-emerald-700" : "text-red-700"}>
                          {isPositive ? `+${t.quantityChange}` : t.quantityChange}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-stone-600 max-w-sm truncate">{t.reason}</td>
                      <td className="py-2.5 px-4 text-stone-400 font-mono text-[10px]">{t.referenceType || "-"}</td>
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
    </div>
  );
};
