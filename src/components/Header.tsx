"use client";

import React, { useState } from "react";
import { Search, RefreshCw, Printer, Bell, CheckCircle2, AlertCircle } from "lucide-react";

interface HeaderProps {
  onSearchChange: (query: string) => void;
  searchQuery: string;
  onRefreshData: () => void;
  userName?: string;
  userRole?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onSearchChange,
  searchQuery,
  onRefreshData,
  userName,
  userRole,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncStatusMsg("Polling Uniware for orders...");
    try {
      const res = await fetch("/api/integrations/uniware/sync", { method: "POST" });
      const data = await res.json();
      if (data.status === "SUCCESS") {
        setSyncStatusMsg(`Sync completed: ${data.recordsUpserted} orders processed`);
        onRefreshData();
      } else {
        setSyncStatusMsg(`Sync warning: ${data.errorMessage || "Check integration settings"}`);
      }
    } catch {
      setSyncStatusMsg("Sync request timed out");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusMsg(null), 5000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <header className="h-16 bg-white border-b border-stone-200 px-6 flex items-center justify-between sticky top-0 z-20 no-print shadow-sm">
      {/* Global Search Bar */}
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

      {/* Center status message if any */}
      {syncStatusMsg && (
        <div className="flex items-center space-x-2 text-xs px-3 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-md">
          {isSyncing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          )}
          <span>{syncStatusMsg}</span>
        </div>
      )}

      {/* Right Actions */}
      <div className="flex items-center space-x-3">
        {/* Sync Now Action */}
        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs font-medium text-stone-700 transition disabled:opacity-50"
          title="Poll Uniware immediately for latest orders"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-[#a27b5c]" : "text-stone-500"}`} />
          <span>{isSyncing ? "Syncing..." : "Sync Uniware"}</span>
        </button>

        {/* Print View Action */}
        <button
          onClick={handlePrint}
          className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-600 transition"
          title="Print this view"
        >
          <Printer className="w-4 h-4" />
        </button>

        {/* User Avatar */}
        <div className="flex items-center space-x-2 pl-2 border-l border-stone-200">
          <div className="w-7 h-7 rounded-full bg-[#38261b] text-white flex items-center justify-center font-bold text-xs uppercase">
            {userName ? userName.charAt(0) : "U"}
          </div>
          <div className="text-left hidden md:block">
            <div className="text-xs font-semibold text-stone-800 leading-tight">{userName || "User"}</div>
            <div className="text-[10px] text-stone-500 leading-tight">{userRole || "Operations"}</div>
          </div>
        </div>
      </div>
    </header>
  );
};
