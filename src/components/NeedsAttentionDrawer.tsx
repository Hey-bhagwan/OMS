"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Truck,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Bell,
  Clock,
  Check,
  Ban,
  ArrowRight,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export interface AttentionItem {
  id: string;
  category: "AWB_MISMATCH" | "UNMATCHED_WEBHOOK" | "SYNC_ERROR" | "CARRIER_ERROR";
  title: string;
  description: string;
  timestamp: string;
  severity: "high" | "medium" | "low";
  metadata: Record<string, any>;
}

export interface SkippedNotification {
  id: string;
  receivedAt: string;
  provider: string;
  awb: string;
  orderCode: string;
  status: string;
  message: string;
}

interface NeedsAttentionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: AttentionItem[];
  notifications: SkippedNotification[];
  loading: boolean;
  onRefresh: () => void;
  onNavigateToOrder?: (orderId: string) => void;
}

export const NeedsAttentionDrawer: React.FC<NeedsAttentionDrawerProps> = ({
  isOpen,
  onClose,
  items,
  notifications,
  loading,
  onRefresh,
  onNavigateToOrder,
}) => {
  const [activeTab, setActiveTab] = useState<"all" | "AWB_MISMATCH" | "UNMATCHED_WEBHOOK" | "SYNC_ERROR" | "CARRIER_ERROR" | "notifications">("all");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredItems = activeTab === "all"
    ? items
    : activeTab === "notifications"
    ? []
    : items.filter((item) => item.category === activeTab);

  const handleAwbAction = async (shipmentId: string, orderId: string, action: "UPDATE" | "SKIP") => {
    setProcessingId(`${shipmentId}-${action}`);
    setActionSuccessMsg(null);
    try {
      const res = await fetch("/api/attention/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentId, orderId, action }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccessMsg(data.message);
        onRefresh();
      } else {
        alert(data.error || "Action failed.");
      }
    } catch (err: unknown) {
      alert("Network request failed.");
    } finally {
      setProcessingId(null);
      setTimeout(() => setActionSuccessMsg(null), 7000);
    }
  };

  const getCategoryBadge = (cat: AttentionItem["category"]) => {
    switch (cat) {
      case "AWB_MISMATCH":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">AWB Mismatch</span>;
      case "UNMATCHED_WEBHOOK":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">Unmatched Order</span>;
      case "SYNC_ERROR":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">Sync Error</span>;
      case "CARRIER_ERROR":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">Carrier Check</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#faf9f8] h-full shadow-2xl flex flex-col border-l border-stone-200">
        {/* Header */}
        <div className="p-4 bg-white border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-700 rounded-lg">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-stone-900">Needs User Attention</h2>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
                  {items.length} pending
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Actionable discrepancies, AWB mismatches, and system exceptions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded border border-stone-200 transition"
              title="Refresh Items"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback message banner */}
        {actionSuccessMsg && (
          <div className="p-3 bg-emerald-50 text-emerald-900 border-b border-emerald-200 text-xs flex items-center gap-2 animate-in slide-in-from-top duration-150">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{actionSuccessMsg}</span>
          </div>
        )}

        {/* Category Filter Pills */}
        <div className="px-4 py-2.5 bg-stone-100/70 border-b border-stone-200 flex items-center gap-1.5 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-2.5 py-1 rounded-full font-medium transition ${
              activeTab === "all" ? "bg-stone-900 text-white" : "bg-white text-stone-600 hover:bg-stone-200"
            }`}
          >
            All Issues ({items.length})
          </button>
          <button
            onClick={() => setActiveTab("AWB_MISMATCH")}
            className={`px-2.5 py-1 rounded-full font-medium transition ${
              activeTab === "AWB_MISMATCH" ? "bg-amber-600 text-white" : "bg-white text-stone-600 hover:bg-stone-200"
            }`}
          >
            AWB Mismatches ({items.filter((i) => i.category === "AWB_MISMATCH").length})
          </button>
          <button
            onClick={() => setActiveTab("UNMATCHED_WEBHOOK")}
            className={`px-2.5 py-1 rounded-full font-medium transition ${
              activeTab === "UNMATCHED_WEBHOOK" ? "bg-purple-700 text-white" : "bg-white text-stone-600 hover:bg-stone-200"
            }`}
          >
            Unmatched Webhooks ({items.filter((i) => i.category === "UNMATCHED_WEBHOOK").length})
          </button>
          <button
            onClick={() => setActiveTab("SYNC_ERROR")}
            className={`px-2.5 py-1 rounded-full font-medium transition ${
              activeTab === "SYNC_ERROR" ? "bg-rose-600 text-white" : "bg-white text-stone-600 hover:bg-stone-200"
            }`}
          >
            Sync Errors ({items.filter((i) => i.category === "SYNC_ERROR").length})
          </button>
          <button
            onClick={() => setActiveTab("CARRIER_ERROR")}
            className={`px-2.5 py-1 rounded-full font-medium transition ${
              activeTab === "CARRIER_ERROR" ? "bg-blue-600 text-white" : "bg-white text-stone-600 hover:bg-stone-200"
            }`}
          >
            Carrier Errors ({items.filter((i) => i.category === "CARRIER_ERROR").length})
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            className={`px-2.5 py-1 rounded-full font-medium transition flex items-center gap-1 ${
              activeTab === "notifications" ? "bg-stone-700 text-white" : "bg-white text-stone-600 hover:bg-stone-200"
            }`}
          >
            <Bell className="w-3 h-3" />
            <span>Skipped AWB Activity ({notifications.length})</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === "notifications" ? (
            <div className="space-y-2">
              <div className="p-3 bg-stone-100 rounded-lg text-xs text-stone-600 mb-2">
                <span className="font-semibold block text-stone-800">Skipped AWB Audit Stream:</span>
                Webhooks that arrived for previously skipped AWBs. These were silently accepted without disturbing the order tracking.
              </div>
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-stone-400 text-xs">
                  No webhooks for skipped AWBs recorded yet.
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="p-3 bg-white rounded-lg border border-stone-200 shadow-xs text-xs space-y-1">
                    <div className="flex items-center justify-between text-stone-500 font-mono text-[10px]">
                      <span>{formatDate(n.receivedAt)}</span>
                      <span className="px-1.5 py-0.2 bg-stone-100 text-stone-600 rounded">SILENT_INGRESS</span>
                    </div>
                    <div className="font-semibold text-stone-800 flex items-center gap-2">
                      <span>Order #{n.orderCode}</span>
                      <span className="text-stone-400">•</span>
                      <span className="font-mono text-stone-600">AWB: {n.awb}</span>
                    </div>
                    <p className="text-stone-500 text-[11px]">{n.message}</p>
                  </div>
                ))
              )}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-16 text-stone-400">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <h4 className="font-bold text-stone-700 text-sm">All Clear!</h4>
              <p className="text-xs text-stone-500 mt-1">
                No items currently require attention in this category.
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              if (item.category === "AWB_MISMATCH") {
                const isUpdating = processingId === `${item.metadata.shipmentId}-UPDATE`;
                const isSkipping = processingId === `${item.metadata.shipmentId}-SKIP`;

                return (
                  <div
                    key={item.id}
                    className="p-4 bg-white rounded-xl border-2 border-amber-300 shadow-sm space-y-3 animate-in fade-in"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getCategoryBadge(item.category)}
                        <span className="font-mono font-bold text-stone-900 text-sm">
                          Order #{item.metadata.orderCode}
                        </span>
                      </div>
                      <span className="text-stone-400 font-mono text-[10px]">
                        {formatDate(item.timestamp)}
                      </span>
                    </div>

                    <p className="text-xs text-stone-700 leading-relaxed font-medium">
                      A webhook arrived with a different tracking AWB from the currently recorded one. Please choose whether to update the order to this AWB or ignore future updates for this AWB.
                    </p>

                    {/* AWB Side-by-Side Comparison */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 bg-amber-50/60 rounded-lg border border-amber-200 text-xs">
                      {/* Left: Current Recorded */}
                      <div className="p-2 bg-white rounded border border-stone-200 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-stone-400 block">
                          Current Recorded AWB
                        </span>
                        <div className="font-mono font-bold text-stone-800 text-sm break-all">
                          {item.metadata.recordedAwb || "None"}
                        </div>
                        <div className="text-[11px] text-stone-500">
                          Courier: <span className="font-medium text-stone-700">{item.metadata.recordedCourier || "Unassigned"}</span>
                        </div>
                      </div>

                      {/* Right: Incoming Webhook */}
                      <div className="p-2 bg-emerald-50/50 rounded border border-emerald-200 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-emerald-600 block flex items-center justify-between">
                          <span>Incoming Webhook AWB</span>
                          <span className="font-mono text-[9px] bg-emerald-200/60 text-emerald-800 px-1 rounded">NEW</span>
                        </span>
                        <div className="font-mono font-bold text-emerald-900 text-sm break-all">
                          {item.metadata.incomingAwb}
                        </div>
                        <div className="text-[11px] text-stone-600">
                          Courier: <span className="font-medium text-stone-800">{item.metadata.incomingCourier}</span>
                        </div>
                        <div className="text-[10px] text-emerald-700 font-semibold">
                          Status: {item.metadata.incomingStatus}
                        </div>
                      </div>
                    </div>

                    {item.metadata.activity && (
                      <div className="text-[11px] text-stone-500 bg-stone-50 px-2.5 py-1.5 rounded border border-stone-200">
                        <span className="font-semibold text-stone-700">Latest Scan: </span>
                        {item.metadata.activity} {item.metadata.location && `(@ ${item.metadata.location})`}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-1 border-t border-stone-100">
                      <button
                        onClick={() => handleAwbAction(item.metadata.shipmentId, item.metadata.orderId, "UPDATE")}
                        disabled={isUpdating || isSkipping}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs"
                      >
                        {isUpdating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Update Order Shipping Details</span>
                      </button>

                      <button
                        onClick={() => handleAwbAction(item.metadata.shipmentId, item.metadata.orderId, "SKIP")}
                        disabled={isUpdating || isSkipping}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-stone-200 hover:bg-stone-300 disabled:opacity-50 text-stone-800 rounded-lg text-xs font-semibold transition"
                      >
                        {isSkipping ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5 text-stone-600" />}
                        <span>Skip & Add to Skip List</span>
                      </button>

                      {onNavigateToOrder && item.metadata.orderId && (
                        <button
                          onClick={() => {
                            onClose();
                            onNavigateToOrder(item.metadata.orderId);
                          }}
                          className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg border border-stone-200 transition"
                          title="Open Order View"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              // Generic Card for UNMATCHED_WEBHOOK, SYNC_ERROR, CARRIER_ERROR
              return (
                <div
                  key={item.id}
                  className="p-3.5 bg-white rounded-xl border border-stone-200 shadow-xs space-y-2 hover:border-stone-300 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getCategoryBadge(item.category)}
                      <h4 className="font-bold text-stone-900 text-xs">{item.title}</h4>
                    </div>
                    <span className="text-stone-400 font-mono text-[10px]">
                      {formatDate(item.timestamp)}
                    </span>
                  </div>

                  <p className="text-xs text-stone-600 leading-normal">{item.description}</p>

                  <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-xs">
                    <div className="text-[11px] text-stone-400 font-mono">
                      {item.metadata.provider || item.metadata.courier || "SYSTEM"}
                    </div>
                    {item.metadata.orderId && onNavigateToOrder && (
                      <button
                        onClick={() => {
                          onClose();
                          onNavigateToOrder(item.metadata.orderId);
                        }}
                        className="text-[#a27b5c] hover:underline font-semibold text-[11px] flex items-center gap-1"
                      >
                        <span>View Order</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-white border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
          <span>{items.length} issues requiring attention</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
