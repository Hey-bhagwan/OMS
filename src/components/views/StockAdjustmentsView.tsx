"use client";

import React, { useState, useEffect } from "react";
import { SlidersHorizontal, CheckCircle2, AlertCircle, Printer } from "lucide-react";

export const StockAdjustmentsView: React.FC = () => {
  const [bucket, setBucket] = useState<"PACKED" | "UNPACKED">("PACKED");
  const [skuList, setSkuList] = useState<any[]>([]);
  const [selectedSkuId, setSelectedSkuId] = useState("");
  const [quantityChange, setQuantityChange] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => setSkuList(data.products || []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSkuId || !quantityChange || !reason) {
      setResultMsg({ type: "error", text: "Please fill out all required fields." });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        skuId: selectedSkuId,
        bucket,
        quantityChange: parseFloat(quantityChange),
        reason,
      };

      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setResultMsg({ type: "success", text: "Finished goods inventory adjustment committed to ledger successfully." });
        setQuantityChange("");
        setReason("");
      } else {
        setResultMsg({ type: "error", text: data.error || "Adjustment failed." });
      }
    } catch {
      setResultMsg({ type: "error", text: "Server request failed." });
    } finally {
      setSubmitting(false);
      setTimeout(() => setResultMsg(null), 5000);
    }
  };

  const selectedProduct = skuList.find((s) => s.id === selectedSkuId);
  const currentStock = selectedProduct?.finishedStock?.find((s: any) => s.bucket === bucket);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-lg border border-stone-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-stone-100 rounded-lg text-stone-800">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">Finished Goods Stock Adjustment</h3>
              <p className="text-xs text-stone-500">
                Adjust PACKED or UNPACKED finished inventory balances with atomic transaction logging
              </p>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs border border-stone-200 rounded text-stone-600 hover:bg-stone-50 no-print"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>

        {resultMsg && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center space-x-2 mb-4 ${
              resultMsg.type === "success"
                ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                : "bg-red-50 text-red-900 border border-red-200"
            }`}
          >
            {resultMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{resultMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-stone-700 block mb-1">Finished Goods Inventory Bucket</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setBucket("PACKED")}
                className={`py-2 px-3 rounded-lg border font-medium text-xs transition ${
                  bucket === "PACKED"
                    ? "bg-[#a27b5c] text-white border-[#a27b5c]"
                    : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100"
                }`}
              >
                Packed Finished Goods
              </button>
              <button
                type="button"
                onClick={() => setBucket("UNPACKED")}
                className={`py-2 px-3 rounded-lg border font-medium text-xs transition ${
                  bucket === "UNPACKED"
                    ? "bg-[#a27b5c] text-white border-[#a27b5c]"
                    : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100"
                }`}
              >
                Unpacked Finished Goods
              </button>
            </div>
          </div>

          <div>
            <label className="font-semibold text-stone-700 block mb-1">Select Product / SKU</label>
            <select
              value={selectedSkuId}
              onChange={(e) => setSelectedSkuId(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
            >
              <option value="">-- Choose Finished SKU --</option>
              {skuList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name} ({s.unitOfManufacture || "PCS"})
                </option>
              ))}
            </select>
          </div>

          {currentStock && (
            <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-stone-400 block text-[10px]">On Hand</span>
                <span className="font-bold text-stone-900">{currentStock.quantityOnHand}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px]">Reserved</span>
                <span className="font-bold text-amber-700">{currentStock.quantityReserved}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px]">Available</span>
                <span className="font-bold text-emerald-700">{currentStock.quantityAvailable}</span>
              </div>
            </div>
          )}

          <div>
            <label className="font-semibold text-stone-700 block mb-1">
              Quantity Change (+ for receipt/find, - for damage/write-off)
            </label>
            <input
              type="number"
              step="1"
              required
              value={quantityChange}
              onChange={(e) => setQuantityChange(e.target.value)}
              placeholder="e.g. 5 or -2"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#a27b5c] font-bold"
            />
          </div>

          <div>
            <label className="font-semibold text-stone-700 block mb-1">Adjustment Reason / Reference</label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Physical inventory cycle count reconciliation; 2 extra cartons found in Zone B"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-[#a27b5c] hover:bg-[#8a6549] text-white font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
          >
            {submitting ? "Committing Adjustment..." : "Commit Inventory Adjustment"}
          </button>
        </form>
      </div>
    </div>
  );
};
