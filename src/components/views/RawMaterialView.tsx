"use client";

import React, { useEffect, useState } from "react";
import {
  Download,
  Printer,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  UserCheck,
  MessageSquare,
  History,
  Eye,
  X,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { formatShortDate, formatDate } from "@/lib/utils";

export const RawMaterialView: React.FC<{
  searchFilter?: string;
  onNavigateToOrder?: (orderId: string) => void;
}> = ({ searchFilter, onNavigateToOrder }) => {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("BLOCKED"); // "BLOCKED", "PENDING_ASSESSMENT", "RESOLVED", "ALL"
  const [channelFilter, setChannelFilter] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Modals
  const [selectedBlock, setSelectedBlock] = useState<any | null>(null);
  const [modalMode, setModalMode] = useState<"RELEASE" | "REMARK" | "ASSIGN" | "HISTORY" | null>(null);
  const [releaseQty, setReleaseQty] = useState("");
  const [remarkText, setRemarkText] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchBlocks = () => {
    setLoading(true);
    let url = `/api/raw-material/queue?page=${page}&limit=25&status=${statusFilter}`;
    if (channelFilter) url += `&channel=${encodeURIComponent(channelFilter)}`;
    const q = searchFilter || localSearch;
    if (q) url += `&search=${encodeURIComponent(q)}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setBlocks(data.blocks || []);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
          setTotalRecords(data.pagination.total || 0);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const fetchUsers = () => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => setUsers(data.users || []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchBlocks();
    fetchUsers();
  }, [page, statusFilter, channelFilter]);

  const openModal = (block: any, mode: "RELEASE" | "REMARK" | "ASSIGN" | "HISTORY") => {
    setSelectedBlock(block);
    setModalMode(mode);
    setErrorMsg(null);
    if (mode === "RELEASE") {
      setReleaseQty(String(block.netBlockedQuantity || 1));
      setRemarkText("");
    } else if (mode === "REMARK") {
      setRemarkText(block.reason || "");
    } else if (mode === "ASSIGN") {
      setAssigneeId(block.assignedUser?.id || "");
    }
  };

  const closeModal = () => {
    setSelectedBlock(null);
    setModalMode(null);
    setErrorMsg(null);
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBlock || !modalMode) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      let body: any = { blockId: selectedBlock.id };
      if (modalMode === "RELEASE") {
        body.action = "MARK_AVAILABLE";
        body.quantity = Number(releaseQty);
        body.remark = remarkText;
      } else if (modalMode === "REMARK") {
        body.action = "UPDATE_REMARK";
        body.remark = remarkText;
      } else if (modalMode === "ASSIGN") {
        body.action = "ASSIGN_USER";
        body.assignedUserId = assigneeId;
      }

      const res = await fetch("/api/raw-material/queue/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        if (modalMode === "RELEASE") {
          setFeedbackMsg(
            `Successfully released ${releaseQty} unit(s) of ${selectedBlock.skuCode} to Production work order.`
          );
        } else if (modalMode === "REMARK") {
          setFeedbackMsg("Remark updated and recorded in append-only history.");
        } else if (modalMode === "ASSIGN") {
          setFeedbackMsg("Follow-up ownership updated successfully.");
        }
        closeModal();
        fetchBlocks();
      } else {
        setErrorMsg(data.error || "Operation failed");
      }
    } catch {
      setErrorMsg("Request failed");
    } finally {
      setSubmitting(false);
      setTimeout(() => setFeedbackMsg(null), 5000);
    }
  };

  const channels = Array.from(new Set(blocks.map((b) => b.channel).filter(Boolean)));

  return (
    <div className="space-y-4">
      {/* Top Banner & Export */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg border border-stone-200 shadow-sm no-print">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-semibold text-stone-900">Raw Material Blocked Queue</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
              Manual Blocked Queue Only
            </span>
          </div>
          <p className="text-xs text-stone-500">
            Orders explicitly blocked due to raw material unavailability. Availability decisions are made manually by factory staff.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md transition"
          >
            <Printer className="w-3.5 h-3.5 text-stone-500" />
            <span>Print</span>
          </button>
          <a
            href="/api/reports/export?type=raw_material_queue"
            download
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md transition"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Export Excel</span>
          </a>
          <button
            onClick={fetchBlocks}
            className="p-1.5 text-stone-500 hover:text-stone-900 border border-stone-200 rounded hover:bg-stone-50 transition"
            title="Refresh Queue"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-stone-200 shadow-sm text-xs no-print">
        {/* Status Filter Pills */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => { setStatusFilter("BLOCKED"); setPage(1); }}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              statusFilter === "BLOCKED"
                ? "bg-red-700 text-white shadow-xs"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            Confirmed Blocked
          </button>
          <button
            onClick={() => { setStatusFilter("PENDING_ASSESSMENT"); setPage(1); }}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              statusFilter === "PENDING_ASSESSMENT"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            Pending Assessment
          </button>
          <button
            onClick={() => { setStatusFilter("RESOLVED"); setPage(1); }}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              statusFilter === "RESOLVED"
                ? "bg-emerald-700 text-white shadow-xs"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            Resolved Archive
          </button>
          <button
            onClick={() => { setStatusFilter("ALL"); setPage(1); }}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              statusFilter === "ALL"
                ? "bg-stone-800 text-white shadow-xs"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            All Queue Records
          </button>
        </div>

        {/* Search & Channel Filter */}
        <div className="flex items-center space-x-2">
          <div className="relative w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search order, SKU, reason..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchBlocks()}
              className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
            />
          </div>

          <select
            value={channelFilter}
            onChange={(e) => { setChannelFilter(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-md text-xs text-stone-700 focus:outline-none"
          >
            <option value="">All Channels</option>
            {channels.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Blocked Orders Queue Table */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-2.5 px-4">Order Code</th>
                <th className="py-2.5 px-4">Channel</th>
                <th className="py-2.5 px-4">Product SKU & Name</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-center">Blocked Qty</th>
                <th className="py-2.5 px-4">Deadline</th>
                <th className="py-2.5 px-4">Reason / Remark</th>
                <th className="py-2.5 px-4">Assigned Staff</th>
                <th className="py-2.5 px-4">Date Blocked</th>
                <th className="py-2.5 px-4 text-right no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-stone-400">Loading blocked order queue...</td>
                </tr>
              ) : blocks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-stone-400">
                    {statusFilter === "BLOCKED"
                      ? "No orders currently blocked by raw material unavailability."
                      : statusFilter === "PENDING_ASSESSMENT"
                      ? "No orders awaiting manual raw-material assessment."
                      : "No matching queue entries found."}
                  </td>
                </tr>
              ) : (
                blocks.map((b) => (
                  <tr key={b.id} className="hover:bg-stone-50/70 transition align-top">
                    <td className="py-2.5 px-4">
                      <span className="font-mono font-bold text-stone-900 block">{b.orderCode}</span>
                      {b.displayOrderCode && (
                        <span className="text-[10px] text-stone-500 block truncate">{b.displayOrderCode}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-700 border border-stone-200">
                        {b.channel}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 max-w-xs">
                      <span className="font-mono font-semibold text-stone-800 block">{b.skuCode}</span>
                      <span className="text-[11px] text-stone-600 block truncate">{b.productName}</span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          b.status === "BLOCKED"
                            ? "bg-red-50 text-red-800 border-red-200"
                            : b.status === "PENDING_ASSESSMENT"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        }`}
                      >
                        {b.status === "BLOCKED"
                          ? "Blocked"
                          : b.status === "PENDING_ASSESSMENT"
                          ? "Pending Assessment"
                          : "Resolved"}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono">
                      <span className="text-red-700 font-bold text-sm block">
                        {b.netBlockedQuantity}
                      </span>
                      {b.releasedQuantity > 0 && (
                        <span className="text-[10px] text-stone-400 block">
                          ({b.releasedQuantity} released)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-stone-600">
                      {formatShortDate(b.orderDeadline)}
                    </td>
                    <td className="py-2.5 px-4 max-w-sm">
                      <p className="text-[11px] text-stone-800 font-medium line-clamp-2">{b.reason}</p>
                      {b.remarks && b.remarks[0] && (
                        <span className="text-[10px] text-stone-400 block mt-0.5 truncate">
                          Latest: {b.remarks[0].authorName}: {b.remarks[0].text}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      {b.assignedUser ? (
                        <span className="text-[11px] font-medium text-stone-800 block">
                          {b.assignedUser.name}
                        </span>
                      ) : (
                        <span className="text-[11px] text-stone-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-stone-500 text-[11px]">
                      {formatShortDate(b.dateBlocked)}
                    </td>
                    <td className="py-2.5 px-4 text-right no-print">
                      <div className="flex items-center justify-end space-x-1">
                        {/* Mark Available / Release button */}
                        {b.status !== "RESOLVED" && b.netBlockedQuantity > 0 && (
                          <button
                            onClick={() => openModal(b, "RELEASE")}
                            className="px-2 py-1 text-[11px] font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded transition shadow-xs flex items-center space-x-1"
                            title="Mark Raw Material Available & Move to Production"
                          >
                            <span>Mark Available</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}

                        {/* Update Remark */}
                        <button
                          onClick={() => openModal(b, "REMARK")}
                          className="p-1 rounded text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                          title="Update Remark"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>

                        {/* Assign User */}
                        <button
                          onClick={() => openModal(b, "ASSIGN")}
                          className="p-1 rounded text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                          title="Assign Staff Follow-up"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                        </button>

                        {/* History */}
                        <button
                          onClick={() => openModal(b, "HISTORY")}
                          className="p-1 rounded text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                          title="View Decision & Remark History"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500 no-print">
            <span>Showing page {page} of {totalPages} ({totalRecords} records)</span>
            <div className="flex space-x-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-2.5 py-1 border border-stone-200 rounded bg-white hover:bg-stone-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 border border-stone-200 rounded bg-white hover:bg-stone-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Action Modals */}
      {selectedBlock && modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  {modalMode === "RELEASE" && "Mark Raw Material Available"}
                  {modalMode === "REMARK" && "Update Reason / Add Remark"}
                  {modalMode === "ASSIGN" && "Assign Follow-up Responsibility"}
                  {modalMode === "HISTORY" && "Decision & Remark History"}
                </h3>
                <span className="text-[11px] text-stone-500">
                  Order #{selectedBlock.orderCode} • SKU: {selectedBlock.skuCode}
                </span>
              </div>
              <button
                onClick={closeModal}
                className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Modal Body */}
            {modalMode === "HISTORY" ? (
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto text-xs">
                <div>
                  <span className="text-stone-500 font-medium block">Current Reason:</span>
                  <p className="font-semibold text-stone-800 mt-0.5">{selectedBlock.reason}</p>
                </div>
                <div className="pt-2 border-t border-stone-100">
                  <span className="text-stone-500 font-semibold uppercase tracking-wider block mb-2">
                    Append-Only Remarks History
                  </span>
                  {selectedBlock.remarks && selectedBlock.remarks.length > 0 ? (
                    <div className="space-y-2 border-l-2 border-stone-200 pl-3">
                      {selectedBlock.remarks.map((r: any) => (
                        <div key={r.id} className="text-xs bg-stone-50 p-2 rounded border border-stone-100">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-stone-800">{r.authorName}</span>
                            <span className="text-[10px] text-stone-400">{formatDate(r.createdAt)}</span>
                          </div>
                          <p className="text-stone-700">{r.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-stone-400 italic">No additional remarks recorded.</p>
                  )}
                </div>
                <div className="flex justify-end pt-3 border-t border-stone-200">
                  <button
                    onClick={closeModal}
                    className="px-4 py-1.5 bg-stone-800 text-white rounded text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleActionSubmit} className="p-6 space-y-4 text-xs">
                {modalMode === "RELEASE" && (
                  <>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs">
                      Moving available quantities directly creates or increments a <strong>Production Work Order</strong> for manufacturing.
                    </div>
                    <div>
                      <label className="font-semibold text-stone-700 block mb-1">
                        Quantity to Unblock & Move to Production
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={selectedBlock.netBlockedQuantity}
                        required
                        value={releaseQty}
                        onChange={(e) => setReleaseQty(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-300 rounded font-bold text-stone-900 focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
                      />
                      <span className="text-[11px] text-stone-400 block mt-1">
                        Net blocked: {selectedBlock.netBlockedQuantity} units available to release.
                      </span>
                    </div>

                    <div>
                      <label className="font-semibold text-stone-700 block mb-1">
                        Release Remark (Optional)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Makrana white slab received and inspected at factory dock..."
                        value={remarkText}
                        onChange={(e) => setRemarkText(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
                      />
                    </div>
                  </>
                )}

                {modalMode === "REMARK" && (
                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">
                      New Situation Remark <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Explain current situation or quarry update. Preserves previous remarks in history."
                      value={remarkText}
                      onChange={(e) => setRemarkText(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
                    />
                  </div>
                )}

                {modalMode === "ASSIGN" && (
                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">
                      Responsible Staff Member <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={assigneeId}
                      onChange={(e) => setAssigneeId(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
                    >
                      <option value="">Select Staff Member</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role}) — {u.email}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-3 border-t border-stone-200">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 border border-stone-300 rounded text-stone-700 hover:bg-stone-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-[#a27b5c] hover:bg-[#8a6549] text-white font-semibold rounded shadow-sm disabled:opacity-50"
                  >
                    {submitting ? "Processing..." : "Confirm Action"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
