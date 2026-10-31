"use client";

import React, { useEffect, useState } from "react";
import { Truck, AlertTriangle, CheckCircle2, Clock, MapPin } from "lucide-react";
import { formatDate, formatShortDate } from "@/lib/utils";
import { useCachedFetch } from "@/lib/useCachedFetch";

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

  const filtered = shipments.filter((s) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      s.awb?.toLowerCase().includes(q) ||
      s.courier?.toLowerCase().includes(q) ||
      s.orderCode?.toLowerCase().includes(q) ||
      s.destinationCity?.toLowerCase().includes(q)
    );
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
                <th className="py-2.5 px-4">AWB / Waybill</th>
                <th className="py-2.5 px-4">Courier</th>
                <th className="py-2.5 px-4">Order Code</th>
                <th className="py-2.5 px-4">Shipment Status</th>
                <th className="py-2.5 px-4">Current Hub / Location</th>
                <th className="py-2.5 px-4">Latest Scan Activity</th>
                <th className="py-2.5 px-4">Estimated Delivery</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">Loading tracking telemetry...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">No shipments found in this category.</td>
                </tr>
              ) : (
                filtered.map((s) => {
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
                  {selectedShipment.courier} â€¢ Order: {selectedShipment.orderCode}
                </span>
              </div>
              <button
                onClick={() => setSelectedShipment(null)}
                className="text-stone-400 hover:text-stone-700 text-sm font-semibold"
              >
                âœ•
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
                        {formatDate(ev.timestamp)} â€¢ Location: {ev.location || "In Transit"}
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
