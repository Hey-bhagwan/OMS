"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  RefreshCw,
  Printer,
  CheckCircle2,
  ChevronDown,
  CalendarPlus,
  History,
  Calendar,
  X,
  Clock,
  PackageCheck,
  AlertCircle,
  FileText,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface HeaderProps {
  onSearchChange: (query: string) => void;
  searchQuery: string;
  onRefreshData: () => void;
  userName?: string;
  userRole?: string;
}

type SyncMode = "CREATED" | "UPDATED";

interface SyncResultModalData {
  syncRunId?: string;
  status: "SUCCESS" | "FAILED";
  recordsFetched: number;
  recordsUpserted: number;
  recordsFailed: number;
  errorMessage?: string;
  syncWindow?: { fromDate?: string; toDate?: string };
  ordersSummary?: Array<{
    orderCode: string;
    displayOrderCode?: string | null;
    status: string;
    internalStage: string;
    city?: string;
  }>;
}

export const Header: React.FC<HeaderProps> = ({
  onSearchChange,
  searchQuery,
  onRefreshData,
  userName,
  userRole,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncOptions, setShowSyncOptions] = useState(false);
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [customDateType, setCustomDateType] = useState<SyncMode>("CREATED");
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [syncError, setSyncError] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ fetched: number; upserted: number; failed: number } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncModalData, setSyncModalData] = useState<SyncResultModalData | null>(null);

  // Fetch initial last sync time
  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/integrations/status");
      const data = await res.json();
      if (data.uniware?.lastRunAt || data.uniware?.lastSuccessAt) {
        setLastSyncTime(data.uniware.lastRunAt || data.uniware.lastSuccessAt);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Poll sync status when syncing is active
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isSyncing) {
      interval = setInterval(async () => {
        try {
          const res = await fetch("/api/integrations/status");
          const data = await res.json();
          if (data.activeSync) {
            setSyncProgress({
              fetched: data.activeSync.recordsFetched || 0,
              upserted: data.activeSync.recordsUpserted || 0,
              failed: data.activeSync.recordsFailed || 0,
            });
          }
        } catch {
          // ignore polling errors
        }
      }, 2000);
    } else {
      setSyncProgress(null);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSyncing]);

  const handleManualSync = async (
    mode: SyncMode,
    range?: { fromDate?: string; toDate?: string }
  ) => {
    if (isSyncing) return;

    setIsSyncing(true);
    setShowSyncOptions(false);
    setShowCustomRange(false);
    setSyncError(false);
    setSyncStatusMsg(
      range?.fromDate
        ? `Fetching ${mode.toLowerCase()} orders from ${range.fromDate.slice(0, 10)}...`
        : mode === "CREATED"
        ? "Fetching created orders since last sync..."
        : "Fetching updated orders since last sync..."
    );

    try {
      const res = await fetch("/api/integrations/uniware/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          syncType: "MANUAL_TRIGGER",
          dateType: mode,
          ...(range?.fromDate ? { fromDate: range.fromDate } : {}),
          ...(range?.toDate ? { toDate: range.toDate } : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.errorMessage || data.message || "Sync request failed"
        );
      }

      // Update last sync time
      setLastSyncTime(new Date().toISOString());

      if (data.status === "SUCCESS") {
        setSyncStatusMsg(
          `${mode === "CREATED" ? "Created" : "Updated"} sync completed: ${
            data.recordsUpserted ?? 0
          } orders processed`
        );
        onRefreshData();
      } else {
        setSyncError(true);
        setSyncStatusMsg(
          data.errorMessage ||
            `Sync ${data.status?.toLowerCase() || "failed"}. Check integration settings.`
        );
      }

      // Trigger Details Pop-up Modal
      setSyncModalData({
        syncRunId: data.syncRunId,
        status: data.status || "SUCCESS",
        recordsFetched: data.recordsFetched ?? 0,
        recordsUpserted: data.recordsUpserted ?? 0,
        recordsFailed: data.recordsFailed ?? 0,
        errorMessage: data.errorMessage,
        syncWindow: range,
        ordersSummary: data.ordersSummary || [],
      });
    } catch (error) {
      setSyncError(true);
      setSyncStatusMsg(
        error instanceof Error ? error.message : "Sync request failed"
      );
      setSyncModalData({
        status: "FAILED",
        recordsFetched: 0,
        recordsUpserted: 0,
        recordsFailed: 1,
        errorMessage: error instanceof Error ? error.message : "Sync request failed",
      });
    } finally {
      setIsSyncing(false);
      window.setTimeout(() => setSyncStatusMsg(null), 6000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-stone-200 px-6 flex items-center justify-between sticky top-0 z-20 no-print shadow-xs">
        {/* Global Search */}
        <div className="flex items-center w-80 relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Global search by Order ID, SKU, City, AWB..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a27b5c] focus:bg-white transition"
          />
        </div>

        {/* Sync Status / Info */}
        <div className="flex items-center space-x-3">
          {syncStatusMsg && (
            <div
              role="status"
              className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border max-w-md ${
                syncError
                  ? "bg-red-50 text-red-800 border-red-200"
                  : isSyncing
                  ? "bg-amber-50 text-amber-900 border-amber-200"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200"
              }`}
            >
              {isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-[#a27b5c]" />
              ) : syncError ? (
                <X className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              )}
              <div className="flex flex-col">
                <span className="font-medium text-[11px]">
                  {isSyncing && syncProgress && syncProgress.fetched > 0
                    ? `Syncing orders: ${syncProgress.upserted} / ${syncProgress.fetched} (${Math.round(
                        (syncProgress.upserted / syncProgress.fetched) * 100
                      )}%)`
                    : syncStatusMsg}
                </span>
              </div>
            </div>
          )}

          {/* Last Synced Date-Time Indicator */}
          {lastSyncTime && !syncStatusMsg && (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-50 border border-stone-200 text-stone-600 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-stone-400" />
              <span>
                Orders synced till:{" "}
                <strong className="text-stone-800 font-semibold">
                  {formatDate(lastSyncTime, "dd MMM yyyy, HH:mm")}
                </strong>
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-3">
          {/* Sync dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSyncOptions((value) => !value)}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs font-medium text-stone-700 transition disabled:opacity-50"
              title="Choose which Uniware orders to sync"
              aria-expanded={showSyncOptions}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isSyncing ? "animate-spin text-[#a27b5c]" : "text-stone-500"
                }`}
              />
              <span>{isSyncing ? "Syncing..." : "Sync Uniware"}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {showSyncOptions && !isSyncing && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-stone-200 rounded-xl shadow-lg py-2 z-50">
                <div className="px-3 py-2">
                  <p className="text-xs font-semibold text-stone-800">Choose sync type</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Select which Uniware orders to fetch.
                  </p>
                </div>

                <div className="border-t border-stone-100 my-1" />

                <button
                  type="button"
                  onClick={() => handleManualSync("CREATED")}
                  className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-stone-50 transition"
                >
                  <CalendarPlus className="w-4 h-4 mt-0.5 text-emerald-700 shrink-0" />
                  <span>
                    <span className="block text-xs font-medium text-stone-800">
                      Sync Created (Auto)
                    </span>
                    <span className="block text-[11px] text-stone-500 mt-0.5">
                      Fetches newly created orders since last sync up to now.
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleManualSync("UPDATED")}
                  className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-stone-50 transition"
                >
                  <History className="w-4 h-4 mt-0.5 text-[#a27b5c] shrink-0" />
                  <span>
                    <span className="block text-xs font-medium text-stone-800">
                      Sync Updated (Auto)
                    </span>
                    <span className="block text-[11px] text-stone-500 mt-0.5">
                      Fetches status changes on existing orders since last checkpoint.
                    </span>
                  </span>
                </button>

                <div className="border-t border-stone-100 my-1" />

                <button
                  type="button"
                  onClick={() => setShowCustomRange((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 transition"
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-stone-500" />
                    <span>Custom Date Range...</span>
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-stone-400 transition-transform ${
                      showCustomRange ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showCustomRange && (
                  <div className="px-3 py-2 bg-stone-50 border-t border-stone-100 space-y-2 text-xs">
                    <div>
                      <label className="block text-[11px] font-medium text-stone-600 mb-1">
                        Filter By
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCustomDateType("CREATED")}
                          className={`flex-1 py-1 rounded text-center text-xs font-medium border ${
                            customDateType === "CREATED"
                              ? "bg-white border-[#a27b5c] text-[#a27b5c] shadow-xs"
                              : "border-stone-200 text-stone-600 hover:bg-stone-100"
                          }`}
                        >
                          Created Date
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomDateType("UPDATED")}
                          className={`flex-1 py-1 rounded text-center text-xs font-medium border ${
                            customDateType === "UPDATED"
                              ? "bg-white border-[#a27b5c] text-[#a27b5c] shadow-xs"
                              : "border-stone-200 text-stone-600 hover:bg-stone-100"
                          }`}
                        >
                          Updated Date
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-stone-600 mb-0.5">
                        From Date
                      </label>
                      <input
                        type="date"
                        value={customFromDate}
                        onChange={(e) => setCustomFromDate(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-stone-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-stone-600 mb-0.5">
                        To Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={customToDate}
                        onChange={(e) => setCustomToDate(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-stone-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={!customFromDate}
                      onClick={() => {
                        const from = customFromDate ? `${customFromDate}T00:00:00` : undefined;
                        const to = customToDate ? `${customToDate}T23:59:59` : undefined;
                        handleManualSync(customDateType, { fromDate: from, toDate: to });
                      }}
                      className="w-full mt-1 py-1.5 bg-[#a27b5c] hover:bg-[#8e6b4e] disabled:opacity-40 text-white rounded text-xs font-medium transition shadow-xs"
                    >
                      Start Custom Sync
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Print */}
          <button
            type="button"
            onClick={handlePrint}
            className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-600 transition"
            title="Print this view"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* User */}
          <div className="flex items-center space-x-2 pl-2 border-l border-stone-200">
            <div className="w-7 h-7 rounded-full bg-[#38261b] text-white flex items-center justify-center font-bold text-xs uppercase">
              {userName ? userName.charAt(0) : "U"}
            </div>

            <div className="text-left hidden md:block">
              <div className="text-xs font-semibold text-stone-800 leading-tight">
                {userName || "User"}
              </div>
              <div className="text-[10px] text-stone-500 leading-tight">
                {userRole || "Operations"}
              </div>
            </div>
          </div>
        </div>

        {/* Close dropdown when clicking outside */}
        {showSyncOptions && (
          <button
            type="button"
            aria-label="Close sync menu"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setShowSyncOptions(false)}
          />
        )}
      </header>

      {/* Sync Completion Details Modal */}
      {syncModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-stone-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/70">
              <div className="flex items-center gap-2.5">
                {syncModalData.status === "SUCCESS" ? (
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <PackageCheck className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-700">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-stone-900">
                    {syncModalData.status === "SUCCESS"
                      ? "Unicommerce Sync Completed"
                      : "Sync Operation Failed"}
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    {syncModalData.status === "SUCCESS"
                      ? `Successfully synchronized with Unicommerce`
                      : syncModalData.errorMessage || "Error occurred during sync"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSyncModalData(null)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-md transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Stats */}
            <div className="grid grid-cols-3 gap-2 px-5 py-3 bg-stone-100/50 border-b border-stone-200 text-center">
              <div className="bg-white p-2.5 rounded-lg border border-stone-200">
                <span className="text-[10px] font-medium text-stone-500 uppercase block">
                  Fetched
                </span>
                <span className="text-base font-bold text-stone-800">
                  {syncModalData.recordsFetched}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/30">
                <span className="text-[10px] font-medium text-emerald-700 uppercase block">
                  Upserted
                </span>
                <span className="text-base font-bold text-emerald-800">
                  {syncModalData.recordsUpserted}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-stone-200">
                <span className="text-[10px] font-medium text-stone-500 uppercase block">
                  Failed
                </span>
                <span
                  className={`text-base font-bold ${
                    syncModalData.recordsFailed > 0 ? "text-red-600" : "text-stone-800"
                  }`}
                >
                  {syncModalData.recordsFailed}
                </span>
              </div>
            </div>

            {/* Order Details List */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              <h4 className="text-xs font-semibold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-stone-500" />
                <span>Orders Synced ({syncModalData.ordersSummary?.length || 0})</span>
              </h4>

              {(!syncModalData.ordersSummary || syncModalData.ordersSummary.length === 0) ? (
                <div className="py-6 text-center text-xs text-stone-400">
                  No new or modified orders were found in this sync window.
                </div>
              ) : (
                <div className="border border-stone-200 rounded-lg overflow-hidden divide-y divide-stone-100">
                  {syncModalData.ordersSummary.map((order, idx) => (
                    <div
                      key={order.orderCode || idx}
                      className="p-3 text-xs flex items-center justify-between hover:bg-stone-50 transition"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-stone-900">
                            {order.orderCode}
                          </span>
                          {order.displayOrderCode && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-stone-100 text-stone-600 font-mono">
                              #{order.displayOrderCode}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-500 mt-0.5 flex items-center gap-2">
                          <span>City: {order.city || "-"}</span>
                          <span>•</span>
                          <span>Unicommerce: {order.status}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            order.internalStage === "DELIVERY"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : order.internalStage === "DISPATCH"
                              ? "bg-purple-50 text-purple-800 border-purple-200"
                              : order.internalStage === "PACKING"
                              ? "bg-orange-50 text-orange-800 border-orange-200"
                              : order.internalStage === "RAW_MATERIAL"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-stone-100 text-stone-800 border-stone-300"
                          }`}
                        >
                          {order.internalStage}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSyncModalData(null)}
                className="px-4 py-1.5 bg-[#a27b5c] hover:bg-[#8e6b4e] text-white rounded-lg text-xs font-medium transition shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
