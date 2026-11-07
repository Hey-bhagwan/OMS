import React from "react";
import {
  Boxes,
  Clock,
  Package,
  AlertTriangle,
  X,
  MessageSquare,
  Send,
  Truck,
  ArrowRight,
  UserCheck,
} from "lucide-react";
import { formatShortDate, formatDate } from "@/lib/utils";
import { getPriorityColorClasses } from "@/components/ui/PriorityOrderCode";

export interface OrderInspectDrawerProps {
  orderId: string | null;
  order: any | null;
  loading: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  onNavigateToOrder?: (orderId: string) => void;
}

export const OrderInspectDrawer: React.FC<OrderInspectDrawerProps> = ({
  orderId,
  order,
  loading,
  onClose,
  onRefresh,
}) => {
  // Local state for actions if drawer is active with full order
  const [newRemarkText, setNewRemarkText] = React.useState("");
  const [addingRemark, setAddingRemark] = React.useState(false);
  const [timelineFilter, setTimelineFilter] = React.useState<"ALL" | "REMARKS" | "STAGES">("ALL");
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const [transitionMsg, setTransitionMsg] = React.useState<string | null>(null);

  // Manual raw-material decision state
  const [rmDecisionMode, setRmDecisionMode] = React.useState<"AVAILABLE" | "UNAVAILABLE" | "PENDING_ASSESSMENT" | null>(null);
  const [rmRemark, setRmRemark] = React.useState("");
  const [rmSubmitting, setRmSubmitting] = React.useState(false);

  if (!orderId && !order) return null;

  const handleStageTransition = async (targetStage: string) => {
    if (!order) return;
    setIsTransitioning(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStage,
          reason: `Moved to ${targetStage}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTransitionMsg(`Successfully moved to ${targetStage}`);
        onRefresh?.();
      } else {
        setTransitionMsg(data.error || "Transition failed");
      }
    } catch {
      setTransitionMsg("Request failed");
    } finally {
      setIsTransitioning(false);
      setTimeout(() => setTransitionMsg(null), 4000);
    }
  };

  const handleReallocate = async () => {
    if (!order) return;
    setIsTransitioning(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/allocate`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setTransitionMsg("Stock reallocation completed");
        onRefresh?.();
      } else {
        setTransitionMsg(data.error || "Allocation failed");
      }
    } catch {
      setTransitionMsg("Failed to allocate order");
    } finally {
      setIsTransitioning(false);
      setTimeout(() => setTransitionMsg(null), 4000);
    }
  };

  const handleAddRemark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !newRemarkText.trim()) return;
    setAddingRemark(true);

    try {
      const res = await fetch(`/api/orders/${order.id}/remark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remark: newRemarkText.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setNewRemarkText("");
        onRefresh?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddingRemark(false);
    }
  };

  const handleRawMaterialDecision = async (decision: "AVAILABLE" | "UNAVAILABLE" | "PENDING_ASSESSMENT") => {
    if (!order) return;
    if (decision === "UNAVAILABLE" && (!rmRemark || !rmRemark.trim())) {
      alert("A meaningful remark is required when marking raw material unavailable.");
      return;
    }

    setRmSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          remark: rmRemark.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTransitionMsg(`Raw material decision recorded: ${decision}`);
        setRmDecisionMode(null);
        setRmRemark("");
        onRefresh?.();
      } else {
        alert(data.error || "Decision failed");
      }
    } catch {
      alert("Request failed");
    } finally {
      setRmSubmitting(false);
      setTimeout(() => setTransitionMsg(null), 5000);
    }
  };

  const getValidForwardStages = (currentStage: string) => {
    switch (currentStage) {
      case "RAW_MATERIAL":
        return [
          { stage: "PRODUCTION", label: "Start Production", color: "bg-stone-800 hover:bg-stone-900 text-white" },
          { stage: "PACKING", label: "Move to Packing", color: "bg-orange-600 hover:bg-orange-700 text-white" },
          { stage: "ON_HOLD", label: "Place On Hold", color: "bg-yellow-100 hover:bg-yellow-200 text-yellow-900" },
          { stage: "CANCELLED", label: "Cancel Order", color: "bg-red-50 hover:bg-red-100 text-red-700" },
        ];
      case "PRODUCTION":
        return [
          { stage: "PACKING", label: "Production Done ➔ Move to Packing", color: "bg-orange-600 hover:bg-orange-700 text-white" },
          { stage: "ON_HOLD", label: "Place On Hold", color: "bg-yellow-100 hover:bg-yellow-200 text-yellow-900" },
          { stage: "CANCELLED", label: "Cancel Order", color: "bg-red-50 hover:bg-red-100 text-red-700" },
        ];
      case "PACKING":
        return [
          { stage: "DISPATCH", label: "Packing Verified ➔ Move to Dispatch", color: "bg-purple-600 hover:bg-purple-700 text-white" },
          { stage: "ON_HOLD", label: "Place On Hold", color: "bg-yellow-100 hover:bg-yellow-200 text-yellow-900" },
        ];
      case "DISPATCH":
        return [
          { stage: "DELIVERY", label: "Mark Handed Over to Courier", color: "bg-teal-600 hover:bg-teal-700 text-white" },
          { stage: "ON_HOLD", label: "Place On Hold", color: "bg-yellow-100 hover:bg-yellow-200 text-yellow-900" },
        ];
      case "DELIVERY_EXCEPTION":
        return [
          { stage: "DELIVERY", label: "Re-attempt Delivery", color: "bg-teal-600 hover:bg-teal-700 text-white" },
          { stage: "RTO", label: "Initiate RTO", color: "bg-red-600 hover:bg-red-700 text-white" },
        ];
      case "ON_HOLD":
        return [
          { stage: "RAW_MATERIAL", label: "Resume to Raw Material", color: "bg-stone-700 hover:bg-stone-800 text-white" },
          { stage: "PRODUCTION", label: "Resume to Production", color: "bg-stone-700 hover:bg-stone-800 text-white" },
          { stage: "PACKING", label: "Resume to Packing", color: "bg-orange-600 hover:bg-orange-700 text-white" },
          { stage: "CANCELLED", label: "Cancel Order", color: "bg-red-50 hover:bg-red-100 text-red-700" },
        ];
      default:
        return [];
    }
  };

  const priorityColors = order ? getPriorityColorClasses(order.priorityLabel) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs no-print animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 border-l border-stone-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div>
            {loading ? (
              <div className="space-y-1.5">
                <div className="h-5 w-48 bg-stone-200 rounded animate-pulse" />
                <div className="h-3.5 w-32 bg-stone-200 rounded animate-pulse" />
              </div>
            ) : order ? (
              <>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-stone-900 font-mono">
                    {order.uniwareOrderCode}
                  </h3>
                  {order.priorityLabel && (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        priorityColors?.badge || "bg-stone-100 text-stone-700"
                      }`}
                    >
                      {order.priorityLabel}
                    </span>
                  )}
                </div>
                <span className="text-xs text-stone-500 block mt-0.5">
                  {order.displayOrderCode} • {order.channel}
                </span>
              </>
            ) : (
              <h3 className="text-base font-bold text-stone-900">Order Inspection</h3>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition"
            title="Close Drawer (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transition Feedback message */}
        {transitionMsg && (
          <div className="p-3 bg-amber-50 text-amber-900 border-b border-amber-200 text-xs flex items-center justify-between">
            <span>{transitionMsg}</span>
            <button onClick={() => setTransitionMsg(null)} className="text-amber-700 font-bold ml-2">✕</button>
          </div>
        )}

        {/* Content Body: Skeleton vs Loaded State */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            /* Skeleton Loading Placeholder */
            <div className="space-y-6 animate-pulse">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-stone-50 rounded-lg border border-stone-200">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-2.5 w-16 bg-stone-200 rounded" />
                    <div className="h-4 w-24 bg-stone-300 rounded" />
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div className="h-3.5 w-40 bg-stone-200 rounded" />
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg space-y-3">
                  <div className="flex justify-between">
                    <div className="space-y-1">
                      <div className="h-4 w-28 bg-stone-300 rounded" />
                      <div className="h-3 w-40 bg-stone-200 rounded" />
                    </div>
                    <div className="h-4 w-16 bg-stone-200 rounded" />
                  </div>
                  <div className="grid grid-cols-5 gap-2 pt-2 border-t border-stone-200">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="p-2 bg-white rounded border border-stone-200 space-y-1">
                        <div className="h-2 w-10 mx-auto bg-stone-200 rounded" />
                        <div className="h-3.5 w-6 mx-auto bg-stone-300 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="h-3.5 w-32 bg-stone-200 rounded" />
                <div className="h-10 bg-stone-100 rounded border border-stone-200" />
              </div>

              <div className="space-y-2">
                <div className="h-3.5 w-48 bg-stone-200 rounded" />
                <div className="h-20 bg-stone-100 rounded border border-stone-200" />
              </div>
            </div>
          ) : !order ? (
            <div className="text-center py-12 text-stone-400 text-xs">
              Unable to load order details. Please try again.
            </div>
          ) : (
            <>
              {/* Status & Priority Badge */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-stone-50 rounded-lg border border-stone-200 text-xs">
                <div>
                  <span className="text-[10px] font-semibold text-stone-500 uppercase block">Current Stage</span>
                  <span className="text-sm font-bold text-stone-900">{order.internalStage}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-stone-500 uppercase block">Uniware Status</span>
                  <span className="text-xs font-medium text-stone-700">{order.uniwareStatus}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-stone-500 uppercase block">Packaging</span>
                  <span className="text-xs font-semibold text-purple-700">{order.packagingType}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-stone-500 uppercase block">Fulfillment Deadline</span>
                  <span className="text-xs font-medium text-stone-800">{formatShortDate(order.fulfillmentDeadline)}</span>
                </div>
              </div>

              {/* Blocker & Next Action */}
              {order.blockerReason && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-1">
                  <div className="font-semibold flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                    <span>Active Blocker:</span>
                  </div>
                  <div>{order.blockerReason}</div>
                </div>
              )}

              {/* Line Items & Allocation Breakdown */}
              <div>
                <h4 className="text-xs font-semibold text-stone-900 uppercase tracking-wider mb-2">
                  Line Items &amp; Inventory Allocation
                </h4>
                <div className="space-y-3">
                  {order.lines?.map((line: any) => (
                    <div key={line.id} className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-bold text-stone-900 block">{line.sku.code}</span>
                          <span className="text-stone-600 text-[11px]">{line.sku.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-stone-900">{line.quantity} Unit(s)</span>
                        </div>
                      </div>

                      {/* Stock Allocation Breakdown */}
                      <div className="grid grid-cols-5 gap-2 pt-2 border-t border-stone-200 text-center">
                        <div className="p-1 bg-white rounded border border-stone-200">
                          <span className="text-[10px] text-stone-500 block">Alloc. Packed</span>
                          <span className="font-bold text-emerald-700">{line.allocatedPackedQty}</span>
                        </div>
                        <div className="p-1 bg-white rounded border border-stone-200">
                          <span className="text-[10px] text-stone-500 block">Alloc. Unpacked</span>
                          <span className="font-bold text-blue-700">{line.allocatedUnpackedQty}</span>
                        </div>
                        <div className="p-1 bg-white rounded border border-stone-200">
                          <span className="text-[10px] text-stone-500 block">In Production</span>
                          <span className="font-bold text-stone-800">{line.requiredProductionQty}</span>
                        </div>
                        <div className="p-1 bg-white rounded border border-stone-200">
                          <span className="text-[10px] text-stone-500 block">Blocked Raw</span>
                          <span className="font-bold text-red-700">{line.blockedRawMaterialQty}</span>
                        </div>
                        <div className="p-1 bg-white rounded border border-stone-200">
                          <span className="text-[10px] text-stone-500 block">Pending RM</span>
                          <span className="font-bold text-amber-700">{line.pendingAssessmentQty}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Explicit Manual Raw-Material Availability Decision */}
              {(order.internalStage === "RAW_MATERIAL" || order.internalStage === "PRODUCTION") && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs space-y-2">
                  <div className="flex items-center space-x-1.5 font-bold text-amber-900">
                    <Boxes className="w-4 h-4 text-amber-700" />
                    <span>Factory Staff Raw-Material Availability Decision</span>
                  </div>
                  <p className="text-[11px] text-stone-600">
                    A human staff member must assess availability. Choose an explicit decision for quantities requiring manufacturing:
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => handleRawMaterialDecision("AVAILABLE")}
                      disabled={rmSubmitting}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-medium shadow-xs disabled:opacity-50"
                    >
                      Raw Material Available (Start Production)
                    </button>
                    <button
                      onClick={() => setRmDecisionMode("UNAVAILABLE")}
                      disabled={rmSubmitting}
                      className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded font-medium shadow-xs disabled:opacity-50"
                    >
                      Raw Material Unavailable (Queue as Blocked)
                    </button>
                    <button
                      onClick={() => handleRawMaterialDecision("PENDING_ASSESSMENT")}
                      disabled={rmSubmitting}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium shadow-xs disabled:opacity-50"
                    >
                      Mark Pending Assessment
                    </button>
                  </div>

                  {rmDecisionMode === "UNAVAILABLE" && (
                    <div className="pt-2 border-t border-amber-200 space-y-2">
                      <label className="font-semibold text-stone-800 block">
                        Mandatory Reason / Remark for Raw Material Shortage:
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={rmRemark}
                        onChange={(e) => setRmRemark(e.target.value)}
                        placeholder="e.g. Makrana slab thickness variation; waiting for quarry shipment..."
                        className="w-full px-3 py-1.5 border border-amber-300 rounded bg-white text-xs focus:outline-none"
                      />
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => setRmDecisionMode(null)}
                          className="px-3 py-1 border border-stone-300 rounded text-stone-700 bg-white"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleRawMaterialDecision("UNAVAILABLE")}
                          disabled={rmSubmitting}
                          className="px-3 py-1 bg-red-700 text-white rounded font-semibold"
                        >
                          Confirm Block
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Forward Stage Transitions */}
              <div>
                <h4 className="text-xs font-semibold text-stone-900 uppercase tracking-wider mb-2">
                  Next Actions Ahead of Current State
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(order.internalStage === "RAW_MATERIAL" || order.internalStage === "PRODUCTION") && (
                    <button
                      disabled={isTransitioning}
                      onClick={handleReallocate}
                      className="px-3 py-1.5 bg-[#a27b5c] text-white text-xs font-medium rounded hover:bg-[#8a6549] transition disabled:opacity-50"
                    >
                      Re-run Stock Allocation
                    </button>
                  )}

                  {getValidForwardStages(order.internalStage).map((st) => (
                    <button
                      key={st.stage}
                      disabled={isTransitioning}
                      onClick={() => handleStageTransition(st.stage)}
                      className={`px-3 py-1.5 text-xs font-medium rounded transition ${st.color}`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dedicated Activity and Remarks Section */}
              <div className="space-y-3 pt-4 border-t border-stone-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-stone-900 uppercase tracking-wider flex items-center space-x-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-[#a27b5c]" />
                    <span>Activity &amp; Internal Communication</span>
                  </h4>

                  {/* Filter Pills */}
                  <div className="flex space-x-1 text-[11px]">
                    <button
                      onClick={() => setTimelineFilter("ALL")}
                      className={`px-2 py-0.5 rounded transition ${
                        timelineFilter === "ALL" ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-100"
                      }`}
                    >
                      All Activity
                    </button>
                    <button
                      onClick={() => setTimelineFilter("REMARKS")}
                      className={`px-2 py-0.5 rounded transition ${
                        timelineFilter === "REMARKS" ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-100"
                      }`}
                    >
                      Remarks Only
                    </button>
                    <button
                      onClick={() => setTimelineFilter("STAGES")}
                      className={`px-2 py-0.5 rounded transition ${
                        timelineFilter === "STAGES" ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-100"
                      }`}
                    >
                      Stage Changes
                    </button>
                  </div>
                </div>

                {/* Add Remark Input */}
                <form onSubmit={handleAddRemark} className="space-y-2">
                  <textarea
                    rows={2}
                    value={newRemarkText}
                    onChange={(e) => setNewRemarkText(e.target.value)}
                    placeholder="Add an internal note or remark (saved without changing stage)..."
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={addingRemark || !newRemarkText.trim()}
                      className="px-3 py-1.5 bg-[#a27b5c] hover:bg-[#8a6549] text-white rounded text-xs font-semibold transition disabled:opacity-50 flex items-center space-x-1"
                    >
                      <Send className="w-3 h-3" />
                      <span>{addingRemark ? "Posting..." : "Post Remark"}</span>
                    </button>
                  </div>
                </form>

                {/* Combined Chronological Timeline */}
                <div className="space-y-2.5 max-h-72 overflow-y-auto pt-2">
                  {(() => {
                    const entries: any[] = [];
                    if (timelineFilter !== "STAGES") {
                      (order.remarks || []).forEach((r: any) => {
                        entries.push({
                          id: r.id,
                          type: "REMARK",
                          date: new Date(r.createdAt),
                          author: r.authorName,
                          text: r.text,
                          stage: r.stage,
                        });
                      });
                    }
                    if (timelineFilter !== "REMARKS") {
                      (order.stageHistory || []).forEach((h: any) => {
                        entries.push({
                          id: h.id,
                          type: "STAGE",
                          date: new Date(h.timestamp),
                          toStage: h.toStage,
                          text: h.reason,
                        });
                      });
                    }

                    entries.sort((a, b) => b.date.getTime() - a.date.getTime());

                    if (entries.length === 0) {
                      return <p className="text-stone-400 text-xs italic">No entries found for this view.</p>;
                    }

                    return entries.map((entry) => (
                      <div
                        key={entry.id}
                        className={`p-2.5 rounded-lg border text-xs ${
                          entry.type === "REMARK"
                            ? "bg-amber-50/50 border-amber-200"
                            : "bg-stone-50 border-stone-200"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                entry.type === "REMARK"
                                  ? "bg-amber-200 text-amber-900"
                                  : "bg-stone-200 text-stone-800"
                              }`}
                            >
                              {entry.type === "REMARK" ? "STAFF REMARK" : entry.toStage}
                            </span>
                            {entry.author && <span className="font-semibold text-stone-800">{entry.author}</span>}
                          </div>
                          <span className="text-[10px] text-stone-400">{formatDate(entry.date)}</span>
                        </div>
                        <p className="text-stone-700 text-[11px] mt-0.5">{entry.text}</p>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
