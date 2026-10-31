"use client";

import React, { useEffect, useState } from "react";
import { PackageCheck, CheckCircle2 } from "lucide-react";
import { formatShortDate } from "@/lib/utils";
import { useCachedFetch } from "@/lib/useCachedFetch";

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
      <div className="bg-white p-4 rounded-lg border border-stone-200 shadow-sm flex flex-wrap justify-between items-center gap-3">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Packaging Work Queue</h3>
          <p className="text-xs text-stone-500">
            Active packing tasks. Completing a task immediately moves the order to Dispatch readiness and removes it from this active queue.
          </p>
        </div>

        <div className="flex items-center space-x-2">
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
        <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-2.5 px-4">Task Code</th>
                <th className="py-2.5 px-4">Order Code</th>
                <th className="py-2.5 px-4">SKU / Item</th>
                <th className="py-2.5 px-4">Qty</th>
                <th className="py-2.5 px-4">Packaging Type</th>
                <th className="py-2.5 px-4">Packaging Specifications</th>
                <th className="py-2.5 px-4">Deadline</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-400">Loading packing queue...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-400">
                    {showCompleted ? "No completed packing tasks." : "All packing tasks are complete! No orders pending in packing queue."}
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
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
      </div>
    </div>
  );
};
