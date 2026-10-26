"use client";

import React, { useEffect, useState } from "react";
import { Download, RefreshCw, Archive, Layers, Plus, CheckCircle2 } from "lucide-react";

interface InventoryViewProps {
  bucket: "PACKED" | "UNPACKED";
  searchFilter?: string;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ bucket, searchFilter }) => {
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [allSkus, setAllSkus] = useState<any[]>([]);
  const [selectedSkuId, setSelectedSkuId] = useState("");
  const [addQty, setAddQty] = useState("");
  const [addReason, setAddReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchStocks = () => {
    setLoading(true);
    const endpoint = bucket === "PACKED" ? "/api/inventory/packed" : "/api/inventory/unpacked";
    fetch(endpoint)
      .then((res) => res.json())
      .then((data) => {
        setStocks(data.stocks || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchStocks();
    // Load SKUs for add stock dropdown
    fetch("/api/inventory/packed")
      .then((res) => res.json())
      .then((data) => setAllSkus(data.stocks || []));
  }, [bucket]);

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
          {/* User Add Stock Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#a27b5c] hover:bg-[#8a6549] text-white text-xs font-semibold rounded-md transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Stock to {isPacked ? "Packed" : "Unpacked"}</span>
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
                <th className="py-2.5 px-4">SKU Code</th>
                <th className="py-2.5 px-4">Product Name</th>
                <th className="py-2.5 px-4">Category</th>
                {isPacked && <th className="py-2.5 px-4">Standard Packaging</th>}
                <th className="py-2.5 px-4">On Hand Qty</th>
                <th className="py-2.5 px-4">Reserved Qty</th>
                <th className="py-2.5 px-4">Available Qty</th>
                <th className="py-2.5 px-4">Warehouse Bin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">Loading stock records...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">No inventory found in this bucket.</td>
                </tr>
              ) : (
                filtered.map((s) => (
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
    </div>
  );
};
