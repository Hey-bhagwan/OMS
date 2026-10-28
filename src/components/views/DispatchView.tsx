"use client";

import React, { useEffect, useState } from "react";
import { Send, CheckCircle2 } from "lucide-react";
import { formatShortDate } from "@/lib/utils";
import { useCachedFetch } from "@/lib/useCachedFetch";

export const DispatchView: React.FC<{ searchFilter?: string }> = ({ searchFilter }) => {
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [courierName, setCourierName] = useState("Blue Dart");
  const [awbWaybill, setAwbWaybill] = useState("");
  const [dispatchRemark, setDispatchRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const {
    data: dispatchData,
    loading,
    isBackgroundFetching,
    refetch: fetchOrders,
  } = useCachedFetch<any>("/api/dispatch");

  const orders = (dispatchData?.orders || []) as any[];

  const handleRecordDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !awbWaybill) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          courierName,
          awbWaybill,
          provider: "SHIPROCKET",
          remark: dispatchRemark || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback(`Dispatch confirmed: Order ${selectedOrder.orderCode} handed over to ${courierName}`);
        setSelectedOrder(null);
        setAwbWaybill("");
        setDispatchRemark("");
        fetchOrders();
      } else {
        setFeedback(data.error || "Failed to record dispatch");
      }
    } catch {
      setFeedback("Request failed");
    } finally {
      setSubmitting(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const filtered = orders.filter((o) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      o.orderCode?.toLowerCase().includes(q) ||
      o.displayOrderCode?.toLowerCase().includes(q) ||
      o.skuCode?.toLowerCase().includes(q) ||
      o.shippingAddressCity?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg border border-stone-200 shadow-sm flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Dispatch & Courier Handover</h3>
          <p className="text-xs text-stone-500">
            Packed items awaiting carrier pickup. Physical handover transitions parcels into active tracking
          </p>
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
                <th className="py-2.5 px-4">Order Code</th>
                <th className="py-2.5 px-4">Channel</th>
                <th className="py-2.5 px-4">SKU / Item</th>
                <th className="py-2.5 px-4">Qty</th>
                <th className="py-2.5 px-4">Destination</th>
                <th className="py-2.5 px-4">Fulfillment Deadline</th>
                <th className="py-2.5 px-4">Priority</th>
                <th className="py-2.5 px-4">Next Action</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-400">Loading dispatch staging queue...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-400">No orders awaiting dispatch handover.</td>
                </tr>
              ) : (
                filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-stone-50/70 transition">
                    <td className="py-2.5 px-4 font-mono font-medium text-stone-900">
                      {o.orderCode}
                      {o.displayOrderCode && (
                        <span className="block text-[10px] text-stone-400 font-sans">{o.displayOrderCode}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-stone-600">{o.channel}</td>
                    <td className="py-2.5 px-4 font-semibold text-stone-800">
                      {o.skuCode}
                      <span className="block text-[10px] text-stone-400 font-normal truncate max-w-xs">{o.skuName}</span>
                    </td>
                    <td className="py-2.5 px-4 font-bold text-stone-900">{o.quantity}</td>
                    <td className="py-2.5 px-4 text-stone-600">{o.shippingAddressCity || o.destinationCountry}</td>
                    <td className="py-2.5 px-4 text-stone-600">{formatShortDate(o.fulfillmentDeadline)}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        {o.priorityLabel}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-stone-600 max-w-xs">{o.nextAction}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedOrder(o)}
                        className="px-3 py-1 bg-[#a27b5c] hover:bg-[#8a6549] text-white text-[11px] font-medium rounded transition"
                      >
                        Record Handover
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Dispatch Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <form
            onSubmit={handleRecordDispatch}
            className="w-full max-w-md bg-white p-6 rounded-lg shadow-xl border border-stone-200 space-y-4"
          >
            <h3 className="text-sm font-bold text-stone-900">
              Confirm Carrier Handover: {selectedOrder.orderCode}
            </h3>
            <p className="text-xs text-stone-500">
              Enter courier partner and AWB/waybill tracking number to advance parcel to Delivery tracking.
            </p>

            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">Courier Partner</label>
              <select
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-[#a27b5c]"
              >
                <option value="Blue Dart">Blue Dart</option>
                <option value="Delhivery">Delhivery</option>
                <option value="Shiprocket Cargo">Shiprocket Cargo</option>
                <option value="DTDC">DTDC</option>
                <option value="DHL Express (Export)">DHL Express (Export)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">AWB / Waybill Number</label>
              <input
                type="text"
                required
                value={awbWaybill}
                onChange={(e) => setAwbWaybill(e.target.value)}
                placeholder="e.g. BD987123498"
                className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-[#a27b5c] font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">Dispatch Remarks / Gate Pass (Optional)</label>
              <textarea
                rows={2}
                value={dispatchRemark}
                onChange={(e) => setDispatchRemark(e.target.value)}
                placeholder="E.g. Handed over to Blue Dart driver Mr. Ramesh at 5 PM..."
                className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-[#a27b5c]"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 text-xs font-semibold bg-[#a27b5c] text-white hover:bg-[#8a6549] rounded transition"
              >
                {submitting ? "Saving..." : "Confirm Handover"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
