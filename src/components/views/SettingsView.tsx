"use client";

import React, { useEffect, useState } from "react";
import { Settings, RefreshCw, CheckCircle2, ShieldCheck, AlertCircle, Radio } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const SettingsView: React.FC = () => {
  const [statusData, setStatusData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const fetchStatus = () => {
    setLoading(true);
    fetch("/api/integrations/status")
      .then((res) => res.json())
      .then((data) => {
        setStatusData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/integrations/uniware/sync", { method: "POST" });
      const data = await res.json();
      if (data.status === "SUCCESS") {
        setSyncMsg(`Sync succeeded: ${data.recordsUpserted} orders processed.`);
        fetchStatus();
      } else {
        setSyncMsg(`Sync result: ${data.errorMessage || "Completed"}`);
      }
    } catch {
      setSyncMsg("Sync request timed out.");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 5000);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-stone-500">Loading integration health status...</div>;
  }

  const uni = statusData?.uniware || {};
  const sr = statusData?.shiprocket || {};

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white p-4 rounded-lg border border-stone-200 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Integration Architecture & Health</h3>
          <p className="text-xs text-stone-500">
            Monitor API polling checkpoints, webhook ingress pipelines, and provider synchronization runs
          </p>
        </div>
        <button
          onClick={handleSyncNow}
          disabled={syncing}
          className="flex items-center space-x-2 px-3 py-1.5 bg-[#a27b5c] hover:bg-[#8a6549] text-white rounded text-xs font-semibold transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
          <span>{syncing ? "Syncing..." : "Manual Sync Now"}</span>
        </button>
      </div>

      {syncMsg && (
        <div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{syncMsg}</span>
        </div>
      )}

      {/* Uniware Card */}
      <div className="bg-white p-5 rounded-lg border border-stone-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <h4 className="text-sm font-bold text-stone-900">Uniware Omnichannel Connector</h4>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
            {uni.status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 bg-stone-50 rounded border border-stone-200">
            <span className="text-[10px] text-stone-500 block">Base URL</span>
            <span className="font-mono font-medium text-stone-800 truncate block">{uni.baseUrl}</span>
          </div>
          <div className="p-2.5 bg-stone-50 rounded border border-stone-200">
            <span className="text-[10px] text-stone-500 block">Polling Schedule</span>
            <span className="font-medium text-stone-800">{uni.syncIntervalSeconds}s interval</span>
          </div>
          <div className="p-2.5 bg-stone-50 rounded border border-stone-200">
            <span className="text-[10px] text-stone-500 block">Last Checkpoint</span>
            <span className="font-medium text-stone-800">{formatDate(uni.lastSuccessAt)}</span>
          </div>
          <div className="p-2.5 bg-stone-50 rounded border border-stone-200">
            <span className="text-[10px] text-stone-500 block">Authentication</span>
            <span className="font-medium text-emerald-700 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>OAuth Token Cached</span>
            </span>
          </div>
        </div>
      </div>

      {/* Shiprocket Card */}
      <div className="bg-white p-5 rounded-lg border border-stone-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <h4 className="text-sm font-bold text-stone-900">Shiprocket & Cargo Webhooks</h4>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
            {sr.status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div className="p-2.5 bg-stone-50 rounded border border-stone-200">
            <span className="text-[10px] text-stone-500 block">Webhook Ingress Endpoint</span>
            <span className="font-mono font-medium text-stone-800">{sr.webhookEndpoint}</span>
          </div>
          <div className="p-2.5 bg-stone-50 rounded border border-stone-200">
            <span className="text-[10px] text-stone-500 block">Unmatched Shipments</span>
            <span className="font-bold text-stone-800">{sr.unmatchedShipmentCount}</span>
          </div>
          <div className="p-2.5 bg-stone-50 rounded border border-stone-200">
            <span className="text-[10px] text-stone-500 block">Failed Webhook Events</span>
            <span className="font-bold text-stone-800">{sr.failedEventCount}</span>
          </div>
        </div>
      </div>

      {/* Recent Sync Runs */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 font-semibold text-xs text-stone-700">
          Recent Synchronization Runs Log
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-2 px-4">Started At</th>
                <th className="py-2 px-4">Type</th>
                <th className="py-2 px-4">Status</th>
                <th className="py-2 px-4">Fetched</th>
                <th className="py-2 px-4">Upserted</th>
                <th className="py-2 px-4">Failed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {(statusData?.recentRuns || []).map((r: any) => (
                <tr key={r.id}>
                  <td className="py-2 px-4 text-stone-500">{formatDate(r.startedAt)}</td>
                  <td className="py-2 px-4 font-medium text-stone-700">{r.syncType}</td>
                  <td className="py-2 px-4">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        r.status === "SUCCESS" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2 px-4">{r.recordsFetched}</td>
                  <td className="py-2 px-4 font-bold text-emerald-700">{r.recordsUpserted}</td>
                  <td className="py-2 px-4 text-red-700">{r.recordsFailed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
