
"use client";

import React, { useState } from "react";
import {
  Search,
  RefreshCw,
  Printer,
  CheckCircle2,
  ChevronDown,
  CalendarPlus,
  History,
  X,
} from "lucide-react";

interface HeaderProps {
  onSearchChange: (query: string) => void;
  searchQuery: string;
  onRefreshData: () => void;
  userName?: string;
  userRole?: string;
}

type SyncMode = "CREATED" | "UPDATED";

export const Header: React.FC<HeaderProps> = ({
  onSearchChange,
  searchQuery,
  onRefreshData,
  userName,
  userRole,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncOptions, setShowSyncOptions] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [syncError, setSyncError] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ fetched: number; upserted: number; failed: number } | null>(null);

  // Poll sync status when syncing is active
  React.useEffect(() => {
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

  const handleManualSync = async (mode: SyncMode) => {
    if (isSyncing) return;

    setIsSyncing(true);
    setShowSyncOptions(false);
    setSyncError(false);
    setSyncStatusMsg(
      mode === "CREATED"
        ? "Fetching newly created orders..."
        : "Fetching updated orders..."
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
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.errorMessage || data.message || "Sync request failed"
        );
      }

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
    } catch (error) {
      setSyncError(true);
      setSyncStatusMsg(
        error instanceof Error
          ? error.message
          : "Sync request failed"
      );
    } finally {
      setIsSyncing(false);
      window.setTimeout(() => setSyncStatusMsg(null), 6000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <header className="h-16 bg-white border-b border-stone-200 px-6 flex items-center justify-between sticky top-0 z-20 no-print shadow-sm">
      {/* Global Search */}
      <div className="flex items-center w-96 relative">
        <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Global search by Order ID, SKU, City, AWB..."
          className="w-full pl-9 pr-4 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a27b5c] focus:bg-white transition"
        />
      </div>

      {/* Sync status */}
      {syncStatusMsg && (
        <div
          role="status"
          className={`flex items-center gap-2 text-xs px-3 py-2 rounded-md border max-w-md ${
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
            <span className="font-medium">
              {isSyncing && syncProgress && syncProgress.fetched > 0
                ? `Syncing orders: ${syncProgress.upserted} / ${syncProgress.fetched} (${Math.round(
                    (syncProgress.upserted / syncProgress.fetched) * 100
                  )}%)`
                : syncStatusMsg}
            </span>
            {isSyncing && syncProgress && syncProgress.fetched > 0 && (
              <div className="w-full bg-amber-200 h-1.5 rounded-full mt-1 overflow-hidden">
                <div
                  className="bg-[#a27b5c] h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((syncProgress.upserted / syncProgress.fetched) * 100)
                    )}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

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
                isSyncing
                  ? "animate-spin text-[#a27b5c]"
                  : "text-stone-500"
              }`}
            />
            <span>{isSyncing ? "Syncing..." : "Sync Uniware"}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {showSyncOptions && !isSyncing && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-stone-200 rounded-xl shadow-lg py-2 z-50">
              <div className="px-3 py-2">
                <p className="text-xs font-semibold text-stone-800">
                  Choose sync type
                </p>
                <p className="text-[11px] text-stone-500 mt-1">
                  Select which Uniware orders to fetch.
                </p>
              </div>

              <div className="border-t border-stone-100 my-1" />

              <button
                type="button"
                onClick={() => handleManualSync("CREATED")}
                className="w-full flex items-start gap-3 px-3 py-3 text-left hover:bg-stone-50 transition"
              >
                <CalendarPlus className="w-4 h-4 mt-0.5 text-emerald-700 shrink-0" />
                <span>
                  <span className="block text-xs font-medium text-stone-800">
                    Created Sync
                  </span>
                  <span className="block text-[11px] text-stone-500 mt-1">
                    Fetch orders by creation date. Existing orders are updated,
                    not duplicated.
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleManualSync("UPDATED")}
                className="w-full flex items-start gap-3 px-3 py-3 text-left hover:bg-stone-50 transition"
              >
                <History className="w-4 h-4 mt-0.5 text-[#a27b5c] shrink-0" />
                <span>
                  <span className="block text-xs font-medium text-stone-800">
                    Updated Sync
                  </span>
                  <span className="block text-[11px] text-stone-500 mt-1">
                    Fetch orders by last update date.
                  </span>
                </span>
              </button>
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
  );
};
