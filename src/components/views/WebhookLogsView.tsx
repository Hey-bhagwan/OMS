"use client";

import React, { useState, useEffect } from "react";
import {
  Webhook,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
  Package,
  Truck,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface WebhookLog {
  id: string;
  receivedAt: string;
  provider: string;
  eventType: string | null;
  status: string;
  errorMessage: string | null;
  idempotencyKey: string | null;
  awb: string | null;
  courierName: string | null;
  providerStatus: string | null;
  normalizedStatus: string | null;
  location: string | null;
  activity: string | null;
  eventTimestamp: string | null;
  payloadReceived: any;
  processedDetails: {
    parsed: any;
    shipment: {
      id: string;
      normalizedStatus: string;
      currentScanLocation: string | null;
      currentScanActivity: string | null;
      matchConfidence: string;
      isUnmatched: boolean;
      updatedAt: string;
    } | null;
    matchedOrder: {
      id: string;
      displayOrderCode: string | null;
      uniwareOrderCode: string;
      channel: string;
      internalStage: string;
      shippingAddressCity: string | null;
    } | null;
  };
}

interface WebhookLogsViewProps {
  onNavigateToOrder?: (orderId: string) => void;
  searchFilter?: string;
}

export const WebhookLogsView: React.FC<WebhookLogsViewProps> = ({
  onNavigateToOrder,
  searchFilter = "",
}) => {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [providerFilter, setProviderFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [localSearch, setLocalSearch] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"fields" | "processed" | "raw">("fields");

  const effectiveSearch = searchFilter || localSearch;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (providerFilter) params.set("provider", providerFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (effectiveSearch) params.set("search", effectiveSearch);

      const res = await fetch(`/api/webhooks/logs?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        // keep selected log updated if already open
        if (selectedLog) {
          const updated = (data.logs || []).find((l: WebhookLog) => l.id === selectedLog.id);
          if (updated) setSelectedLog(updated);
        }
      }
    } catch (err) {
      console.error("Failed to fetch webhook logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, providerFilter, statusFilter, effectiveSearch]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PROCESSED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Processed
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            Failed
          </span>
        );
      case "UNMATCHED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <HelpCircle className="w-3 h-3 text-amber-600" />
            Unmatched
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner / Controls */}
      <div className="bg-white p-4 rounded-lg border border-stone-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#a27b5c]/10 text-[#a27b5c] rounded">
              <Webhook className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-stone-900">Webhook Audit & Ingress Logs</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">
              {total.toLocaleString()} receipts recorded
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Real-time payload inspection showing exactly what fields were received from couriers and how they were parsed, mapped to orders, and updated in OMS.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Provider Filter */}
          <select
            value={providerFilter}
            onChange={(e) => {
              setProviderFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-stone-50 border border-stone-200 rounded-md px-2.5 py-1.5 text-stone-700 focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
          >
            <option value="">All Providers</option>
            <option value="SHIPROCKET">Shiprocket Standard</option>
            <option value="SHIPROCKET_CARGO">Shiprocket Cargo</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-stone-50 border border-stone-200 rounded-md px-2.5 py-1.5 text-stone-700 focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
          >
            <option value="">All Processing Status</option>
            <option value="PROCESSED">Processed</option>
            <option value="FAILED">Failed</option>
            <option value="UNMATCHED">Unmatched</option>
          </select>

          {/* Local search input if global search not provided */}
          {!searchFilter && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search AWB, order, status..."
                value={localSearch}
                onChange={(e) => {
                  setLocalSearch(e.target.value);
                  setPage(1);
                }}
                className="text-xs bg-stone-50 border border-stone-200 rounded-md pl-8 pr-3 py-1.5 text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-[#a27b5c] w-48"
              />
            </div>
          )}

          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            className="p-1.5 text-stone-600 hover:text-stone-900 border border-stone-200 rounded-md bg-stone-50 hover:bg-stone-100 transition disabled:opacity-50"
            title="Refresh logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-2.5 px-3">Received Time</th>
                <th className="py-2.5 px-3">Provider</th>
                <th className="py-2.5 px-3">AWB / Waybill</th>
                <th className="py-2.5 px-3">Provider Status</th>
                <th className="py-2.5 px-3">Normalized Stage</th>
                <th className="py-2.5 px-3">Matched Order</th>
                <th className="py-2.5 px-3">Location / Activity</th>
                <th className="py-2.5 px-3">Result</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#a27b5c]" />
                    Loading webhook receipt logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-400">
                    No webhook logs found matching your filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isSelected = selectedLog?.id === log.id;
                  const matchedOrder = log.processedDetails.matchedOrder;

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`cursor-pointer transition ${
                        isSelected ? "bg-amber-50/70 border-l-4 border-l-[#a27b5c]" : "hover:bg-stone-50/70"
                      }`}
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap text-stone-500 font-mono text-[11px]">
                        {formatDate(log.receivedAt)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            log.provider === "SHIPROCKET_CARGO"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {log.provider === "SHIPROCKET_CARGO" ? "CARGO" : "SHIPROCKET"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-medium text-stone-900">
                        {log.awb || <span className="text-stone-400 italic">None</span>}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-medium text-stone-700">{log.providerStatus || "—"}</span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-800">
                          {log.normalizedStatus || "UNKNOWN"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {matchedOrder ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-semibold text-[#a27b5c]">
                              {matchedOrder.displayOrderCode || matchedOrder.uniwareOrderCode}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-stone-100 text-stone-600 rounded">
                              {matchedOrder.internalStage}
                            </span>
                          </div>
                        ) : (
                          <span className="text-stone-400 text-[11px] italic">Not matched</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 max-w-xs truncate text-stone-600 text-[11px]" title={`${log.activity || ""} ${log.location ? `@ ${log.location}` : ""}`}>
                        {log.activity || log.location ? (
                          <span>
                            {log.activity} {log.location && <span className="text-stone-400">({log.location})</span>}
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{getStatusBadge(log.status)}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="px-2 py-1 text-[11px] font-medium text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-200 rounded"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-2.5 border-t border-stone-200 bg-stone-50 flex items-center justify-between text-xs text-stone-500">
          <div>
            Showing <span className="font-medium text-stone-700">{logs.length}</span> of{" "}
            <span className="font-medium text-stone-700">{total}</span> webhook receipts
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1 rounded border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-stone-700 font-medium">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1 rounded border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Details Slide-out / Modal Drawer when a log is selected */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
          <div className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col border-l border-stone-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-[#a27b5c]/10 text-[#a27b5c] rounded">
                    <Webhook className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-stone-900 text-sm">
                    Webhook Receipt Inspection
                  </h3>
                  {getStatusBadge(selectedLog.status)}
                </div>
                <p className="text-xs text-stone-500 mt-0.5 font-mono">
                  Receipt ID: {selectedLog.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200/50"
              >
                ✕
              </button>
            </div>

            {/* Quick Summary Chips */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-4 bg-stone-50/50 border-b border-stone-200 text-xs">
              <div className="p-2 bg-white rounded border border-stone-200">
                <span className="text-[10px] text-stone-400 block font-semibold uppercase">Provider</span>
                <span className="font-bold text-stone-800">{selectedLog.provider}</span>
              </div>
              <div className="p-2 bg-white rounded border border-stone-200">
                <span className="text-[10px] text-stone-400 block font-semibold uppercase">AWB / Waybill</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-stone-900">{selectedLog.awb || "None"}</span>
                  {selectedLog.awb && (
                    <button
                      onClick={() => handleCopy(selectedLog.awb!, "awb")}
                      className="text-stone-400 hover:text-stone-700"
                      title="Copy AWB"
                    >
                      {copiedKey === "awb" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>
              <div className="p-2 bg-white rounded border border-stone-200">
                <span className="text-[10px] text-stone-400 block font-semibold uppercase">Normalized Status</span>
                <span className="font-bold text-blue-700">{selectedLog.normalizedStatus || "UNKNOWN"}</span>
              </div>
              <div className="p-2 bg-white rounded border border-stone-200">
                <span className="text-[10px] text-stone-400 block font-semibold uppercase">Received Timestamp</span>
                <span className="text-stone-700 font-mono text-[11px]">{formatDate(selectedLog.receivedAt)}</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-stone-200 bg-white px-4 text-xs font-medium">
              <button
                onClick={() => setActiveTab("fields")}
                className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
                  activeTab === "fields"
                    ? "border-[#a27b5c] text-[#a27b5c] font-bold"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>1. What Fields It Received</span>
              </button>
              <button
                onClick={() => setActiveTab("processed")}
                className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
                  activeTab === "processed"
                    ? "border-[#a27b5c] text-[#a27b5c] font-bold"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>2. What It Processed & Updated</span>
              </button>
              <button
                onClick={() => setActiveTab("raw")}
                className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
                  activeTab === "raw"
                    ? "border-[#a27b5c] text-[#a27b5c] font-bold"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>3. Raw JSON Payload</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeTab === "fields" && (
                <div className="space-y-4">
                  <div className="bg-stone-50 p-3 rounded-lg border border-stone-200">
                    <h4 className="text-xs font-bold text-stone-800 mb-2 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#a27b5c]" />
                      Ingress Payload Fields Summary
                    </h4>
                    <p className="text-xs text-stone-500 mb-3">
                      Key attributes extracted directly from the incoming HTTP webhook POST request.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-white rounded border border-stone-200">
                        <span className="text-[10px] text-stone-400 block uppercase font-medium">Tracking / AWB Number</span>
                        <span className="font-mono font-bold text-stone-900">{selectedLog.awb || "Not provided"}</span>
                      </div>
                      <div className="p-2 bg-white rounded border border-stone-200">
                        <span className="text-[10px] text-stone-400 block uppercase font-medium">Provider Status Raw</span>
                        <span className="font-medium text-stone-900">{selectedLog.providerStatus || "Not provided"}</span>
                      </div>
                      <div className="p-2 bg-white rounded border border-stone-200">
                        <span className="text-[10px] text-stone-400 block uppercase font-medium">Courier Service</span>
                        <span className="font-medium text-stone-900">{selectedLog.courierName || "Not provided"}</span>
                      </div>
                      <div className="p-2 bg-white rounded border border-stone-200">
                        <span className="text-[10px] text-stone-400 block uppercase font-medium">Order Reference In Payload</span>
                        <span className="font-mono font-medium text-stone-900">
                          {selectedLog.payloadReceived?.order_id ||
                            selectedLog.payloadReceived?.sr_order_id ||
                            selectedLog.payloadReceived?.lrn ||
                            "Not provided"}
                        </span>
                      </div>
                      <div className="p-2 bg-white rounded border border-stone-200">
                        <span className="text-[10px] text-stone-400 block uppercase font-medium">Estimated Delivery Date (EDD/ETD)</span>
                        <span className="font-medium text-stone-900">
                          {selectedLog.payloadReceived?.etd ||
                            selectedLog.payloadReceived?.edd_date ||
                            "Not provided"}
                        </span>
                      </div>
                      <div className="p-2 bg-white rounded border border-stone-200">
                        <span className="text-[10px] text-stone-400 block uppercase font-medium">Idempotency Key</span>
                        <span className="font-mono text-[11px] text-stone-600 truncate block" title={selectedLog.idempotencyKey || ""}>
                          {selectedLog.idempotencyKey || "None"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Scan History / Scans Array Received */}
                  <div className="bg-stone-50 p-3 rounded-lg border border-stone-200">
                    <h4 className="text-xs font-bold text-stone-800 mb-2">
                      Scan Events Received in Payload (
                      {selectedLog.payloadReceived?.scans?.length ||
                        selectedLog.payloadReceived?.status_history?.length ||
                        0}{" "}
                      scans)
                    </h4>
                    <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                      {selectedLog.payloadReceived?.scans &&
                        selectedLog.payloadReceived.scans.map((s: any, idx: number) => (
                          <div key={idx} className="p-2 bg-white rounded border border-stone-200 text-xs flex items-start justify-between">
                            <div>
                              <div className="font-semibold text-stone-800">{s.activity || s["sr-status-label"]}</div>
                              <div className="text-[11px] text-stone-500">{s.location || "No location"}</div>
                            </div>
                            <span className="text-[10px] font-mono text-stone-400 whitespace-nowrap ml-2">
                              {s.date}
                            </span>
                          </div>
                        ))}

                      {selectedLog.payloadReceived?.status_history &&
                        selectedLog.payloadReceived.status_history.map((s: any, idx: number) => (
                          <div key={idx} className="p-2 bg-white rounded border border-stone-200 text-xs flex items-start justify-between">
                            <div>
                              <div className="font-semibold text-stone-800">{s.status || s.remarks || s.reason}</div>
                              <div className="text-[11px] text-stone-500">{s.location || "No location"}</div>
                            </div>
                            <span className="text-[10px] font-mono text-stone-400 whitespace-nowrap ml-2">
                              {s.added_at || s.timestamp}
                            </span>
                          </div>
                        ))}

                      {!selectedLog.payloadReceived?.scans && !selectedLog.payloadReceived?.status_history && (
                        <div className="text-stone-400 text-xs italic py-2">
                          No intermediate scans list was included in this payload.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "processed" && (
                <div className="space-y-4">
                  {/* Processing Status Card */}
                  <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Execution Pipeline Result
                      </h4>
                      {getStatusBadge(selectedLog.status)}
                    </div>

                    {selectedLog.errorMessage && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">
                        <span className="font-bold block">Error Encountered:</span>
                        {selectedLog.errorMessage}
                      </div>
                    )}

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between p-2 bg-white rounded border border-stone-200">
                        <span className="text-stone-500">1. Parsed Normalized Status:</span>
                        <span className="font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded">
                          {selectedLog.processedDetails.parsed?.normalizedStatus || selectedLog.normalizedStatus}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 bg-white rounded border border-stone-200">
                        <span className="text-stone-500">2. Active Courier / Carrier:</span>
                        <span className="font-medium text-stone-900">
                          {selectedLog.processedDetails.parsed?.courierName || selectedLog.courierName}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 bg-white rounded border border-stone-200">
                        <span className="text-stone-500">3. Latest Scanned Activity:</span>
                        <span className="font-medium text-stone-900 text-right max-w-sm">
                          {selectedLog.processedDetails.parsed?.activityDescription || selectedLog.activity || "None"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 bg-white rounded border border-stone-200">
                        <span className="text-stone-500">4. Latest Location:</span>
                        <span className="font-medium text-stone-900">
                          {selectedLog.processedDetails.parsed?.scanLocation || selectedLog.location || "None"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Shipment DB Record */}
                  <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 space-y-2">
                    <h4 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-[#a27b5c]" />
                      Shipment Tracking Snapshot in Database
                    </h4>

                    {selectedLog.processedDetails.shipment ? (
                      <div className="space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 bg-white rounded border border-stone-200">
                            <span className="text-[10px] text-stone-400 block font-medium">Shipment Record ID</span>
                            <span className="font-mono text-[11px] text-stone-800 block truncate">
                              {selectedLog.processedDetails.shipment.id}
                            </span>
                          </div>
                          <div className="p-2 bg-white rounded border border-stone-200">
                            <span className="text-[10px] text-stone-400 block font-medium">Match Confidence</span>
                            <span className="font-bold text-emerald-700">
                              {selectedLog.processedDetails.shipment.matchConfidence}
                            </span>
                          </div>
                        </div>

                        <div className="p-2 bg-white rounded border border-stone-200 flex items-center justify-between">
                          <span className="text-stone-500">Updated Current Status:</span>
                          <span className="font-bold text-stone-900">
                            {selectedLog.processedDetails.shipment.normalizedStatus}
                          </span>
                        </div>

                        <div className="p-2 bg-white rounded border border-stone-200 flex items-center justify-between">
                          <span className="text-stone-500">Database Record Last Updated:</span>
                          <span className="font-mono text-stone-700">
                            {formatDate(selectedLog.processedDetails.shipment.updatedAt)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-white rounded border border-stone-200 text-stone-400 text-xs italic">
                        No shipment tracking record was linked or created for this webhook.
                      </div>
                    )}
                  </div>

                  {/* Matched Order Card */}
                  <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 space-y-2">
                    <h4 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-[#a27b5c]" />
                      Associated Order Impact
                    </h4>

                    {selectedLog.processedDetails.matchedOrder ? (
                      <div className="p-3 bg-white rounded border border-stone-200 space-y-3 text-xs">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-stone-400 block uppercase font-medium">Order Number</span>
                            <span className="font-mono font-bold text-stone-900 text-sm">
                              {selectedLog.processedDetails.matchedOrder.displayOrderCode ||
                                selectedLog.processedDetails.matchedOrder.uniwareOrderCode}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-stone-400 block uppercase font-medium">Current Stage</span>
                            <span className="font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs">
                              {selectedLog.processedDetails.matchedOrder.internalStage}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-stone-600 text-xs">
                          <div>Channel: <span className="font-medium text-stone-800">{selectedLog.processedDetails.matchedOrder.channel}</span></div>
                          <div>City: <span className="font-medium text-stone-800">{selectedLog.processedDetails.matchedOrder.shippingAddressCity || "—"}</span></div>
                        </div>

                        {onNavigateToOrder && (
                          <button
                            onClick={() => {
                              setSelectedLog(null);
                              onNavigateToOrder(selectedLog.processedDetails.matchedOrder!.id);
                            }}
                            className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 bg-[#a27b5c] hover:bg-[#8a6549] text-white rounded text-xs font-semibold transition"
                          >
                            <span>Open Order in All Orders View</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 bg-white rounded border border-stone-200 text-amber-800 bg-amber-50/50 text-xs">
                        <span className="font-semibold block mb-0.5">Order Unmatched</span>
                        The webhook was processed and recorded, but no corresponding order was matched in the OMS for this AWB/reference yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "raw" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-700">Exact Raw Incoming JSON Payload</span>
                    <button
                      onClick={() => handleCopy(JSON.stringify(selectedLog.payloadReceived, null, 2), "json")}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-stone-600 hover:text-stone-900 border border-stone-200 rounded bg-stone-50 hover:bg-stone-100"
                    >
                      {copiedKey === "json" ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Raw JSON</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-3 bg-stone-900 text-stone-100 rounded-lg text-[11px] font-mono overflow-x-auto max-h-[500px] leading-relaxed">
                    {JSON.stringify(selectedLog.payloadReceived, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between text-xs text-stone-500">
              <span>Receipt ID: {selectedLog.id}</span>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-3 py-1 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded font-medium transition"
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
