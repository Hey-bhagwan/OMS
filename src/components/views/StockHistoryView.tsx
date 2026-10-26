"use client";

import React, { useEffect, useState } from "react";
import { History, Download, RefreshCw } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const StockHistoryView: React.FC<{ searchFilter?: string }> = ({ searchFilter }) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucketFilter, setBucketFilter] = useState("");

  const fetchHistory = () => {
    setLoading(true);
    let url = "/api/inventory/history?limit=100";
    if (bucketFilter) url += `&bucket=${bucketFilter}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setTransactions(data.transactions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchHistory();
  }, [bucketFilter]);

  const filtered = transactions.filter((t) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      t.itemCode?.toLowerCase().includes(q) ||
      t.itemName?.toLowerCase().includes(q) ||
      t.reason?.toLowerCase().includes(q) ||
      t.type?.toLowerCase().includes(q)
    );
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
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Bucket</th>
                <th className="py-2.5 px-4">Item Code</th>
                <th className="py-2.5 px-4">Item Name</th>
                <th className="py-2.5 px-4">Transaction Type</th>
                <th className="py-2.5 px-4">Quantity Delta</th>
                <th className="py-2.5 px-4">Reason & Justification</th>
                <th className="py-2.5 px-4">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">Loading ledger records...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">No stock ledger transactions found.</td>
                </tr>
              ) : (
                filtered.map((t) => {
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
      </div>
    </div>
  );
};
