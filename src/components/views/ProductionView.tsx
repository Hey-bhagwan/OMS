"use client";

import React, { useEffect, useState } from "react";
import {
  Factory,
  CheckCircle2,
  Clock,
  Play,
  Check,
  AlertTriangle,
  Download,
  Printer,
  RefreshCw,
  Search,
  X,
  MessageSquare,
} from "lucide-react";
import { formatShortDate, formatDate } from "@/lib/utils";

export const ProductionView: React.FC<{ searchFilter?: string }> = ({ searchFilter }) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modals
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [modalType, setModalType] = useState<"PROGRESS" | "REJECT" | "REMARK" | null>(null);
  const [inputQty, setInputQty] = useState("");
  const [inputText, setInputText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = () => {
    setLoading(true);
    let url = "/api/production?";
    if (statusFilter) url += `status=${statusFilter}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setTasks(data.tasks || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchTasks();
  }, [statusFilter]);

  const handleStartWork = async (taskId: string, code: string) => {
    try {
      const res = await fetch(`/api/production/${taskId}/start`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setFeedback(`Work order ${code} marked In Progress`);
        fetchTasks();
      } else {
        setFeedback(data.error || "Failed to start work order");
      }
    } catch {
      setFeedback("Request failed");
    } finally {
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const openActionModal = (task: any, type: "PROGRESS" | "REJECT" | "REMARK") => {
    setSelectedTask(task);
    setModalType(type);
    setErrorMsg(null);
    if (type === "PROGRESS") {
      setInputQty(String(task.quantityRequired - task.quantityCompleted));
      setInputText("");
    } else if (type === "REJECT") {
      setInputQty("1");
      setInputText("");
    } else if (type === "REMARK") {
      setInputQty("");
      setInputText("");
    }
  };

  const closeModal = () => {
    setSelectedTask(null);
    setModalType(null);
    setErrorMsg(null);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !modalType) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      let res;
      if (modalType === "PROGRESS") {
        res = await fetch(`/api/production/${selectedTask.id}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantity: Number(inputQty),
            remark: inputText,
          }),
        });
      } else if (modalType === "REJECT") {
        res = await fetch(`/api/production/${selectedTask.id}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantity: Number(inputQty),
            reason: inputText,
          }),
        });
      } else if (modalType === "REMARK") {
        res = await fetch("/api/remarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productionOrderId: selectedTask.id,
            stage: "PRODUCTION",
            text: inputText,
          }),
        });
      }

      const data = await res!.json();
      if (data.success) {
        if (modalType === "PROGRESS") {
          setFeedback(
            `Recorded completion of ${inputQty} unit(s). Stock transferred to UNPACKED finished-goods inventory.`
          );
        } else if (modalType === "REJECT") {
          setFeedback(`Recorded ${inputQty} rejected unit(s).`);
        } else {
          setFeedback("Remark added to work order history.");
        }
        closeModal();
        fetchTasks();
      } else {
        setErrorMsg(data.error || "Operation failed");
      }
    } catch {
      setErrorMsg("Request failed");
    } finally {
      setSubmitting(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const query = (searchFilter || localSearch).toLowerCase();
  const filtered = tasks.filter((t) => {
    if (!query) return true;
    return (
      t.code?.toLowerCase().includes(query) ||
      t.skuCode?.toLowerCase().includes(query) ||
      t.skuName?.toLowerCase().includes(query) ||
      t.orderCode?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-4">
      {/* Top Banner & Export */}
      <div className="bg-white p-4 rounded-lg border border-stone-200 shadow-sm flex flex-wrap justify-between items-center gap-3 no-print">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Manufacturing & Work Orders</h3>
          <p className="text-xs text-stone-500">
            Real-time shop floor execution. Completed units are transferred atomically to UNPACKED finished goods.
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
            href="/api/reports/export?type=production"
            download
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md transition"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Export Excel</span>
          </a>
          <button
            onClick={fetchTasks}
            className="p-1.5 text-stone-500 hover:text-stone-900 border border-stone-200 rounded hover:bg-stone-50 transition"
            title="Refresh Work Orders"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-stone-200 shadow-sm text-xs no-print">
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setStatusFilter("")}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              statusFilter === "" ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            All Work Orders
          </button>
          <button
            onClick={() => setStatusFilter("READY")}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              statusFilter === "READY" ? "bg-blue-700 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            Ready to Start
          </button>
          <button
            onClick={() => setStatusFilter("IN_PROGRESS")}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              statusFilter === "IN_PROGRESS" ? "bg-amber-700 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            In Progress
          </button>
          <button
            onClick={() => setStatusFilter("COMPLETED")}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              statusFilter === "COMPLETED" ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            Completed
          </button>
        </div>

        <div className="relative w-56">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
          <input
            type="text"
            placeholder="Search WO code, SKU, order..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
          />
        </div>
      </div>

      {/* Production Orders Table */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="py-2.5 px-4">WO Code</th>
                <th className="py-2.5 px-4">Product / SKU</th>
                <th className="py-2.5 px-4">Linked Order</th>
                <th className="py-2.5 px-4 text-center">Req. Qty</th>
                <th className="py-2.5 px-4 text-center">Completed</th>
                <th className="py-2.5 px-4 text-center">Rejected</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Target Date</th>
                <th className="py-2.5 px-4">Notes & Remarks</th>
                <th className="py-2.5 px-4 text-right no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-stone-400">Loading work orders...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-stone-400">No production work orders found.</td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-stone-50/70 transition align-top">
                    <td className="py-2.5 px-4 font-mono font-bold text-stone-900">{t.code}</td>
                    <td className="py-2.5 px-4">
                      <span className="font-semibold text-stone-800 block">{t.skuCode}</span>
                      <span className="text-[10px] text-stone-500 block truncate max-w-xs">{t.skuName}</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-mono text-stone-700 block">{t.orderCode}</span>
                      {t.displayOrderCode && (
                        <span className="text-[10px] text-stone-400 block truncate">{t.displayOrderCode}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center font-bold text-stone-900">{t.quantityRequired}</td>
                    <td className="py-2.5 px-4 text-center font-bold text-emerald-700">{t.quantityCompleted}</td>
                    <td className="py-2.5 px-4 text-center font-bold text-red-600">{t.quantityRejected || 0}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          t.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : t.status === "IN_PROGRESS"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-blue-50 text-blue-800 border-blue-200"
                        }`}
                      >
                        {t.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-stone-600">{formatShortDate(t.expectedCompletionDate)}</td>
                    <td className="py-2.5 px-4 max-w-xs">
                      <span className="text-stone-700 text-[11px] block">{t.notes || "-"}</span>
                      {t.remarks && t.remarks[0] && (
                        <span className="text-[10px] text-stone-400 block mt-0.5 truncate">
                          Latest: {t.remarks[0].text}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right no-print">
                      <div className="flex items-center justify-end space-x-1.5">
                        {t.status === "READY" && (
                          <button
                            onClick={() => handleStartWork(t.id, t.code)}
                            className="px-2 py-1 bg-stone-800 hover:bg-stone-900 text-white rounded text-[11px] font-medium flex items-center space-x-1 transition shadow-xs"
                            title="Start Work Order"
                          >
                            <Play className="w-3 h-3" />
                            <span>Start</span>
                          </button>
                        )}

                        {t.status !== "COMPLETED" && (
                          <>
                            <button
                              onClick={() => openActionModal(t, "PROGRESS")}
                              className="px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[11px] font-medium flex items-center space-x-1 transition shadow-xs"
                              title="Record Completion (transfers to Unpacked FG stock)"
                            >
                              <Check className="w-3 h-3" />
                              <span>Complete</span>
                            </button>
                            <button
                              onClick={() => openActionModal(t, "REJECT")}
                              className="px-2 py-1 text-red-700 hover:bg-red-50 border border-red-200 rounded text-[11px] font-medium transition"
                              title="Record Rejected Quality Quantity"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => openActionModal(t, "REMARK")}
                          className="p-1 rounded text-stone-500 hover:text-stone-900 hover:bg-stone-100"
                          title="Add Remark"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Production Action Modal */}
      {selectedTask && modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  {modalType === "PROGRESS" && "Record Production Completion"}
                  {modalType === "REJECT" && "Record Rejected Units"}
                  {modalType === "REMARK" && "Add Production Remark"}
                </h3>
                <span className="text-[11px] text-stone-500">
                  Work Order #{selectedTask.code} • SKU: {selectedTask.skuCode}
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

            <form onSubmit={handleModalSubmit} className="p-6 space-y-4 text-xs">
              {modalType === "PROGRESS" && (
                <>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs">
                    Completed units are transferred into <strong>UNPACKED finished goods stock</strong> atomically and advance the linked order to Packing readiness.
                  </div>
                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">
                      Units Completed <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={selectedTask.quantityRequired - selectedTask.quantityCompleted}
                      required
                      value={inputQty}
                      onChange={(e) => setInputQty(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded font-bold text-stone-900 focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
                    />
                    <span className="text-[11px] text-stone-400 block mt-1">
                      Required: {selectedTask.quantityRequired}, Completed so far: {selectedTask.quantityCompleted}
                    </span>
                  </div>

                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">Production Notes (Optional)</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Surface polishing complete, passed QC inspection..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
                    />
                  </div>
                </>
              )}

              {modalType === "REJECT" && (
                <>
                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">
                      Quantity Rejected <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={inputQty}
                      onChange={(e) => setInputQty(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded font-bold text-red-700 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">
                      Rejection Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      required
                      placeholder="e.g. Marble hairline fracture during CNC carving; scrapped."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                </>
              )}

              {modalType === "REMARK" && (
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    Remark Text <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Enter production update or shop floor observation..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
                  />
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
                  {submitting ? "Processing..." : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
