"use client";

import React, { useEffect, useState } from "react";
import { Download, RefreshCw, Archive, Layers, Plus, CheckCircle2, FilterX } from "lucide-react";
import { useCachedFetch } from "@/lib/useCachedFetch";
import { ColumnFilter } from "@/components/ui/ColumnFilter";
import { DataTablePagination } from "@/components/ui/DataTablePagination";
import { useTableFiltersAndPagination } from "@/components/ui/useTableFiltersAndPagination";

interface InventoryViewProps {
  bucket: "PACKED" | "UNPACKED";
  searchFilter?: string;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ bucket, searchFilter }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [allSkus, setAllSkus] = useState<any[]>([]);
  const [selectedSkuId, setSelectedSkuId] = useState("");
  const [addQty, setAddQty] = useState("");
  const [addReason, setAddReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSearch, setBulkSearch] = useState("");
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [bulkQuantities, setBulkQuantities] = useState<Record<string, string>>({});
  const [bulkReason, setBulkReason] = useState("");

  const endpoint = bucket === "PACKED" ? "/api/inventory/packed" : "/api/inventory/unpacked";

  const {
    data: stockData,
    loading,
    isBackgroundFetching,
    refetch: fetchStocks,
  } = useCachedFetch<any>(endpoint);

  const stocks = (stockData?.stocks || []) as any[];

  // Table filtering and pagination hook
  const {
    currentPage,
    pageSize,
    totalPages,
    totalRecords,
    columnFilters,
    filteredData: filteredStocks,
    paginatedData: paginatedStocks,
    hasActiveFilters,
    setCurrentPage,
    setPageSize,
    setColumnFilter,
    clearColumnFilter,
    clearAllFilters,
    getDistinctValues,
  } = useTableFiltersAndPagination<any>(stocks, {
    searchFilter,
    searchFields: [
      (s) => s.skuCode,
      (s) => s.skuName,
      (s) => s.category,
      (s) => s.binLocation,
      (s) => s.packingType,
    ],
    customFilterFn: (s, filters) => {
      if (filters.category && filters.category.length > 0) {
        const cat = s.category || "General";
        if (!filters.category.includes(cat)) return false;
      }
      return true;
    },
  });

  useEffect(() => {
    // Load SKUs for add stock dropdown
    fetch("/api/inventory/packed")
      .then((res) => res.json())
      .then((data) => setAllSkus(data.stocks || []));
  }, []);

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSkuId || !addQty || !addReason) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skuId: selectedSkuId,
          bucket,
          quantityChange: parseFloat(addQty),
          reason: addReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg(`Stock successfully updated in ${bucket} inventory bucket!`);
        setShowAddModal(false);
        setAddQty("");
        setAddReason("");
        fetchStocks();
      } else {
        setMsg(data.error || "Failed to add stock");
      }
    } catch {
      setMsg("Request failed");
    } finally {
      setSubmitting(false);
      setTimeout(() => setMsg(null), 5000);
    }
  };

  const handleBulkAddStock = async (e: React.FormEvent) => {
    e.preventDefault();

    const items = bulkSelected
      .map((skuId) => ({
        skuId,
        quantityChange: Number(bulkQuantities[skuId]),
      }))
      .filter(
        (item) =>
          Number.isInteger(item.quantityChange) &&
          item.quantityChange > 0
      );

    if (!items.length || !bulkReason.trim()) {
      setMsg("Select products and enter valid quantities and an audit reason.");
      return;
    }

    setSubmitting(true);
    setMsg(null);

    try {
      const results = await Promise.all(
        items.map(async (item) => {
          try {
            const res = await fetch("/api/inventory/adjust", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...item,
                bucket,
                reason: bulkReason.trim(),
              }),
            });

            const data = await res.json();

            return {
              skuId: item.skuId,
              success: res.ok && data.success === true,
              error: data.error || `HTTP ${res.status}`,
            };
          } catch {
            return {
              skuId: item.skuId,
              success: false,
              error: "Request failed",
            };
          }
        })
      );

      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success);

      if (failed.length === 0) {
        setMsg(`Successfully added stock to all ${succeeded} products.`);
        setShowBulkModal(false);
        setBulkSelected([]);
        setBulkQuantities({});
        setBulkReason("");
        fetchStocks();
      } else {
        setMsg(
          `${succeeded} products updated; ${failed.length} failed. Failed SKU IDs: ${failed.map((r) => r.skuId).join(", ")
          }. Please review before retrying.`
        );

        if (succeeded > 0) fetchStocks();
      }
    } finally {
      setSubmitting(false);
      setTimeout(() => setMsg(null), 10000);
    }
  };

  const filtered = stocks.filter((s) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return s.skuCode?.toLowerCase().includes(q) || s.skuName?.toLowerCase().includes(q);
  });

  const isPacked = bucket === "PACKED";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg border border-stone-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className={`p-2.5 rounded-lg ${isPacked ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-700"}`}>
            {isPacked ? <Archive className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-900">
              {isPacked ? "Packed Finished Goods Inventory" : "Unpacked Finished Goods Inventory"}
            </h3>
            <p className="text-xs text-stone-500 max-w-xl">
              {isPacked
                ? "Company Stock: Finished goods that are packed in standard company boxes/crates stored in the warehouse and available for orders."
                : "Company Stock: Finished goods that have been manufactured in the workshop but are NOT yet packed into any boxes/crates."}
            </p>
          </div>
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

          {/* User Add Stock Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#a27b5c] hover:bg-[#8a6549] text-white text-xs font-semibold rounded-md transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Stock to {isPacked ? "Packed" : "Unpacked"}</span>
          </button>

          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5
              bg-stone-800 hover:bg-stone-700 text-white
              text-xs font-semibold rounded-md transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Bulk Stock Update</span>
          </button>

          <a
            href={`/api/reports/export?type=${bucket.toLowerCase()}`}
            download
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md transition"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Export Excel</span>
          </a>

          <button
            onClick={fetchStocks}
            className="p-1.5 text-stone-500 hover:text-stone-900 border border-stone-200 rounded-md"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {/* Stock Table */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>SKU Code</span>
                    <ColumnFilter
                      columnId="skuCode"
                      columnTitle="SKU Code"
                      options={getDistinctValues("skuCode", (s) => s.skuCode)}
                      selectedValues={columnFilters["skuCode"] || []}
                      onApply={(vals) => setColumnFilter("skuCode", vals)}
                      onClear={() => clearColumnFilter("skuCode")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Product Name</span>
                    <ColumnFilter
                      columnId="skuName"
                      columnTitle="Product Name"
                      options={getDistinctValues("skuName", (s) => s.skuName)}
                      selectedValues={columnFilters["skuName"] || []}
                      onApply={(vals) => setColumnFilter("skuName", vals)}
                      onClear={() => clearColumnFilter("skuName")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Category</span>
                    <ColumnFilter
                      columnId="category"
                      columnTitle="Category"
                      options={getDistinctValues("category", (s) => s.category || "General")}
                      selectedValues={columnFilters["category"] || []}
                      onApply={(vals) => setColumnFilter("category", vals)}
                      onClear={() => clearColumnFilter("category")}
                    />
                  </div>
                </th>
                {isPacked && (
                  <th className="py-2.5 px-4 whitespace-nowrap">
                    <div className="flex items-center justify-between">
                      <span>Standard Packaging</span>
                      <ColumnFilter
                        columnId="packingType"
                        columnTitle="Packaging"
                        options={getDistinctValues("packingType", (s) => s.packingType)}
                        selectedValues={columnFilters["packingType"] || []}
                        onApply={(vals) => setColumnFilter("packingType", vals)}
                        onClear={() => clearColumnFilter("packingType")}
                      />
                    </div>
                  </th>
                )}
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>On Hand Qty</span>
                    <ColumnFilter
                      columnId="quantityOnHand"
                      columnTitle="On Hand"
                      options={getDistinctValues("quantityOnHand", (s) => String(s.quantityOnHand))}
                      selectedValues={columnFilters["quantityOnHand"] || []}
                      onApply={(vals) => setColumnFilter("quantityOnHand", vals)}
                      onClear={() => clearColumnFilter("quantityOnHand")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Reserved Qty</span>
                    <ColumnFilter
                      columnId="quantityReserved"
                      columnTitle="Reserved"
                      options={getDistinctValues("quantityReserved", (s) => String(s.quantityReserved))}
                      selectedValues={columnFilters["quantityReserved"] || []}
                      onApply={(vals) => setColumnFilter("quantityReserved", vals)}
                      onClear={() => clearColumnFilter("quantityReserved")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Available Qty</span>
                    <ColumnFilter
                      columnId="quantityAvailable"
                      columnTitle="Available"
                      options={getDistinctValues("quantityAvailable", (s) => String(s.quantityAvailable))}
                      selectedValues={columnFilters["quantityAvailable"] || []}
                      onApply={(vals) => setColumnFilter("quantityAvailable", vals)}
                      onClear={() => clearColumnFilter("quantityAvailable")}
                    />
                  </div>
                </th>
                <th className="py-2.5 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <span>Warehouse Bin</span>
                    <ColumnFilter
                      columnId="binLocation"
                      columnTitle="Warehouse Bin"
                      options={getDistinctValues("binLocation", (s) => s.binLocation)}
                      selectedValues={columnFilters["binLocation"] || []}
                      onApply={(vals) => setColumnFilter("binLocation", vals)}
                      onClear={() => clearColumnFilter("binLocation")}
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">Loading stock records...</td>
                </tr>
              ) : paginatedStocks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">No inventory found in this bucket.</td>
                </tr>
              ) : (
                paginatedStocks.map((s) => (
                  <tr key={s.id} className="hover:bg-stone-50/70 transition">
                    <td className="py-2.5 px-4 font-mono font-medium text-stone-900">{s.skuCode}</td>
                    <td className="py-2.5 px-4 font-semibold text-stone-800">{s.skuName}</td>
                    <td className="py-2.5 px-4 text-stone-600">{s.category || "General"}</td>
                    {isPacked && <td className="py-2.5 px-4 text-stone-600">{s.packingType}</td>}
                    <td className="py-2.5 px-4 font-bold text-stone-900">{s.quantityOnHand}</td>
                    <td className="py-2.5 px-4 text-amber-700 font-medium">{s.quantityReserved}</td>
                    <td className="py-2.5 px-4 font-bold text-emerald-700">{s.quantityAvailable}</td>
                    <td className="py-2.5 px-4 text-stone-600">{s.binLocation}</td>
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

      {/* Quick Add Stock Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <form
            onSubmit={handleAddStock}
            className="w-full max-w-md bg-white p-6 rounded-lg shadow-xl border border-stone-200 space-y-4 text-xs"
          >
            <h3 className="text-sm font-bold text-stone-900">
              Add Stock to {isPacked ? "Packed Inventory" : "Unpacked Inventory"}
            </h3>
            <p className="text-stone-500">
              {isPacked
                ? "Enter boxed/crated stock added into company warehouse storage."
                : "Enter manufactured, unboxed finished units added into factory stock."}
            </p>

            <div>
              <label className="font-semibold text-stone-700 block mb-1">Select Product / SKU</label>
              <select
                required
                value={selectedSkuId}
                onChange={(e) => setSelectedSkuId(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded focus:ring-1 focus:ring-[#a27b5c] bg-white text-xs"
              >
                <option value="">-- Choose SKU --</option>
                {allSkus.map((s) => (
                  <option key={s.skuId} value={s.skuId}>
                    {s.skuCode} — {s.skuName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-stone-700 block mb-1">
                Quantity to Add (+ Units)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
                placeholder="e.g. 5"
                className="w-full px-3 py-2 border border-stone-300 rounded focus:ring-1 focus:ring-[#a27b5c] text-xs font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-stone-700 block mb-1">
                Audit Reason (Mandatory)
              </label>
              <textarea
                required
                rows={2}
                value={addReason}
                onChange={(e) => setAddReason(e.target.value)}
                placeholder={
                  isPacked
                    ? "e.g. Completed standard warehouse boxing batch #44"
                    : "e.g. Factory finished carpentry run for Dune bowls"
                }
                className="w-full px-3 py-2 border border-stone-300 rounded focus:ring-1 focus:ring-[#a27b5c] text-xs"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 text-stone-600 hover:bg-stone-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 font-semibold bg-[#a27b5c] text-white hover:bg-[#8a6549] rounded transition"
              >
                {submitting ? "Adding..." : "Add to Stock"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
        bg-black/40 backdrop-blur-xs p-4">

          <form
            onSubmit={handleBulkAddStock}
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto
            bg-white p-6 rounded-lg shadow-xl space-y-4 text-xs"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Bulk Stock Update
                </h3>
                <p className="text-stone-500 mt-1">
                  Add stock to multiple products in{" "}
                  {isPacked ? "Packed" : "Unpacked"} inventory.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="text-stone-500 hover:text-stone-900 text-lg"
              >
                ×
              </button>
            </div>

            <input
              type="text"
              value={bulkSearch}
              onChange={(e) => setBulkSearch(e.target.value)}
              placeholder="Search SKU code or product name..."
              className="w-full px-3 py-2 border border-stone-300 rounded"
            />

            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-700">
                {bulkSelected.length} products selected
              </span>

              <button
                type="button"
                onClick={() => {
                  const visibleSkus = allSkus.filter((s) => {
                    const q = bulkSearch.toLowerCase();
                    return (
                      !q ||
                      s.skuCode?.toLowerCase().includes(q) ||
                      s.skuName?.toLowerCase().includes(q)
                    );
                  });

                  const visibleIds = visibleSkus.map((s) => s.skuId);
                  const allVisibleSelected = visibleIds.every((id) =>
                    bulkSelected.includes(id)
                  );

                  setBulkSelected((prev) =>
                    allVisibleSelected
                      ? prev.filter((id) => !visibleIds.includes(id))
                      : Array.from(new Set([...prev, ...visibleIds]))
                  );
                }}
                className="text-[#8a6549] font-semibold"
              >
                Select / deselect visible
              </button>
            </div>

            <div className="border border-stone-200 rounded-lg overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-stone-50 border-b">
                    <tr>
                      <th className="p-3">Select</th>
                      <th className="p-3">SKU / Product</th>
                      <th className="p-3">Quantity to Add</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-stone-100">
                    {allSkus
                      .filter((s) => {
                        const q = bulkSearch.toLowerCase();
                        return (
                          !q ||
                          s.skuCode?.toLowerCase().includes(q) ||
                          s.skuName?.toLowerCase().includes(q)
                        );
                      })
                      .map((s) => {
                        const selected = bulkSelected.includes(s.skuId);

                        return (
                          <tr key={s.skuId} className="hover:bg-stone-50">
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(e) => {
                                  setBulkSelected((prev) =>
                                    e.target.checked
                                      ? [...prev, s.skuId]
                                      : prev.filter((id) => id !== s.skuId)
                                  );
                                }}
                              />
                            </td>

                            <td className="p-3">
                              <div className="font-mono font-semibold">
                                {s.skuCode}
                              </div>
                              <div className="text-stone-500 mt-1">
                                {s.skuName}
                              </div>
                            </td>

                            <td className="p-3">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                disabled={!selected}
                                required={selected}
                                value={bulkQuantities[s.skuId] || ""}
                                onChange={(e) =>
                                  setBulkQuantities((prev) => ({
                                    ...prev,
                                    [s.skuId]: e.target.value,
                                  }))
                                }
                                placeholder="Qty"
                                className="w-24 px-2 py-1.5 border
                                border-stone-300 rounded disabled:bg-stone-100"
                              />
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Audit Reason (Mandatory)
              </label>

              <textarea
                required
                rows={2}
                value={bulkReason}
                onChange={(e) => setBulkReason(e.target.value)}
                placeholder="e.g. Warehouse stock replenishment batch #45"
                className="w-full px-3 py-2 border border-stone-300 rounded"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting || bulkSelected.length === 0}
                className="px-4 py-2 font-semibold bg-[#a27b5c]
                text-white hover:bg-[#8a6549] rounded disabled:opacity-50"
              >
                {submitting
                  ? "Updating stock..."
                  : `Add Stock to ${bulkSelected.length} Products`}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
