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
  Edit3,
  Check,
  Loader2,
} from "lucide-react";
import { formatShortDate, formatDate } from "@/lib/utils";
import { getPriorityColorClasses } from "@/components/ui/PriorityOrderCode";
import { invalidateCache } from "@/lib/useCachedFetch";

export interface OrderInspectDrawerProps {
  orderId: string | null;
  order: any | null;
  loading: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  onOrderUpdate?: (updatedOrder: any) => void;
  onNavigateToOrder?: (orderId: string) => void;
}

export const OrderInspectDrawer: React.FC<OrderInspectDrawerProps> = ({
  orderId,
  order: initialOrder,
  loading: parentLoading,
  onClose,
  onRefresh,
  onOrderUpdate,
}) => {
  // Local active order state to allow instant optimistic updates without parent re-render flashes
  const [localOrder, setLocalOrder] = React.useState<any | null>(initialOrder);

  // Synchronize when a new order is passed from parent
  React.useEffect(() => {
    setLocalOrder(initialOrder);
  }, [initialOrder]);

  const order = localOrder;
  const loading = parentLoading && !order;

  // Local helper to update order both locally and propagate up if handler provided
  const updateOrderData = React.useCallback(
    (updater: (prev: any) => any) => {
      setLocalOrder((prev: any) => {
        if (!prev) return prev;
        const next = updater(prev);
        if (onOrderUpdate) {
          try {
            onOrderUpdate(next);
          } catch (e) {
            console.error(e);
          }
        }
        return next;
      });
    },
    [onOrderUpdate]
  );
  // Local state for actions if drawer is active with full order
  const [newRemarkText, setNewRemarkText] = React.useState("");
  const [addingRemark, setAddingRemark] = React.useState(false);
  const [timelineFilter, setTimelineFilter] = React.useState<"ALL" | "REMARKS" | "STAGES">("ALL");
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const [transitioningStage, setTransitioningStage] = React.useState<string | null>(null);
  const [isReallocating, setIsReallocating] = React.useState(false);
  const [transitionMsg, setTransitionMsg] = React.useState<string | null>(null);

  // Manual raw-material decision state
  const [rmDecisionMode, setRmDecisionMode] = React.useState<"AVAILABLE" | "UNAVAILABLE" | "PENDING_ASSESSMENT" | null>(null);
  const [rmRemark, setRmRemark] = React.useState("");
  const [rmSubmitting, setRmSubmitting] = React.useState(false);

  // Handover modal state
  const [showHandoverModal, setShowHandoverModal] = React.useState(false);
  const [handoverCourier, setHandoverCourier] = React.useState("Blue Dart");
  const [customHandoverCourier, setCustomHandoverCourier] = React.useState("");
  const [handoverAwb, setHandoverAwb] = React.useState("");
  const [handoverRemark, setHandoverRemark] = React.useState("");
  const [handoverSubmitting, setHandoverSubmitting] = React.useState(false);

  // AWB editing inside drawer
  const [isEditingAwb, setIsEditingAwb] = React.useState(false);
  const [awbInput, setAwbInput] = React.useState("");
  const [courierInput, setCourierInput] = React.useState("Blue Dart");
  const [customCourierInput, setCustomCourierInput] = React.useState("");
  const [awbRemarkInput, setAwbRemarkInput] = React.useState("");
  const [savingAwb, setSavingAwb] = React.useState(false);

  // Sort shipments so the most progressed/active shipment appears first
  const activeShipment = React.useMemo(() => {
    if (!order?.shipments || order.shipments.length === 0) return undefined;
    const STATUS_WEIGHT: Record<string, number> = {
      DELIVERED: 100,
      OUT_FOR_DELIVERY: 50,
      IN_TRANSIT: 40,
      PICKED_UP: 30,
      READY_FOR_PICKUP: 20,
      SHIPMENT_CREATED: 10,
    };
    return [...order.shipments].sort((a, b) => {
      const wa = STATUS_WEIGHT[a.normalizedStatus] || 0;
      const wb = STATUS_WEIGHT[b.normalizedStatus] || 0;
      if (wb !== wa) return wb - wa;
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    })[0];
  }, [order?.shipments]);
  React.useEffect(() => {
    if (activeShipment) {
      setAwbInput(activeShipment.awbWaybill || "");
      const stdCouriers = [
        "Blue Dart",
        "Delhivery",
        "Shiprocket Cargo",
        "DTDC",
        "Ekart Logistics",
        "Amazon Shipping",
        "Shadowfax",
        "Xpressbees",
        "DHL Express (Export)",
        "FedEx",
      ];
      if (stdCouriers.includes(activeShipment.courierName)) {
        setCourierInput(activeShipment.courierName);
        setCustomCourierInput("");
      } else if (activeShipment.courierName) {
        setCourierInput("OTHER");
        setCustomCourierInput(activeShipment.courierName);
      } else {
        setCourierInput("Blue Dart");
        setCustomCourierInput("");
      }
    } else {
      setAwbInput("");
      setCourierInput("Blue Dart");
      setCustomCourierInput("");
    }
    setIsEditingAwb(false);
  }, [order?.id, activeShipment?.awbWaybill, activeShipment?.courierName]);

  const handleUpdateAwb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    const finalCourier = courierInput === "OTHER" ? customCourierInput.trim() : courierInput;
    if (!awbInput.trim() || !finalCourier) {
      setTransitionMsg("AWB number and Courier are required.");
      return;
    }

    setSavingAwb(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awbWaybill: awbInput.trim(),
          courierName: finalCourier,
          remark: awbRemarkInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTransitionMsg(`AWB successfully updated: ${awbInput.trim()} (${finalCourier})`);
        setIsEditingAwb(false);
        setAwbRemarkInput("");

        // Optimistically update shipment & order inside the drawer.
        // If the API advanced the stage from DISPATCH → DELIVERY, reflect that too
        // so the action buttons immediately switch away from "Mark Handed Over to Courier".
        updateOrderData((prev) => {
          const updatedShipment = data.shipment || {
            awbWaybill: awbInput.trim(),
            courierName: finalCourier,
            normalizedStatus: prev.internalStage === "DELIVERED" ? "DELIVERED" : "PICKED_UP",
          };
          const existingShipments = prev.shipments || [];
          const shipments = existingShipments.length > 0
            ? [{ ...existingShipments[0], ...updatedShipment }, ...existingShipments.slice(1)]
            : [updatedShipment];
          const PRE_DELIVERY_STAGES = new Set(["RAW_MATERIAL", "PRODUCTION", "PACKING", "DISPATCH"]);
          const advancedStage = data.advancedToDelivery && PRE_DELIVERY_STAGES.has(prev.internalStage) ? "DELIVERY" : prev.internalStage;
          return {
            ...prev,
            shipments,
            internalStage: advancedStage,
            nextAction: advancedStage === "DELIVERED"
              ? "Delivered to recipient. Order fulfilled."
              : `In transit via ${finalCourier} (AWB: ${awbInput.trim()})`,
          };
        });

        invalidateCache("/api/delivery");
        invalidateCache("/api/orders");
        invalidateCache("/api/dashboard/stats");
        if (data.advancedToDelivery) {
          invalidateCache("/api/dispatch");
        }
      } else {
        setTransitionMsg(data.error || "Failed to update AWB");
      }
    } catch {
      setTransitionMsg("Failed to send AWB update request");
    } finally {
      setSavingAwb(false);
      setTimeout(() => setTransitionMsg(null), 5000);
    }
  };

  if (!orderId && !order) return null;

  const handleStageTransition = async (targetStage: string) => {
    if (!order) return;
    if (targetStage === "DELIVERY" && order.internalStage === "DISPATCH") {
      setShowHandoverModal(true);
      return;
    }
    setIsTransitioning(true);
    setTransitioningStage(targetStage);
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

        // Optimistically update order state without triggering a full screen/table reload
        updateOrderData((prev) => {
          const updatedShipments = targetStage === "CANCELLED"
            ? (prev.shipments || []).map((s: any) =>
                ["SHIPMENT_CREATED", "READY_FOR_PICKUP"].includes(s.normalizedStatus)
                  ? { ...s, normalizedStatus: "CANCELLED", currentScanActivity: "Shipment cancelled due to order cancellation" }
                  : s
              )
            : prev.shipments;

          if (data.order) {
            return {
              ...prev,
              ...data.order,
              shipments: data.order.shipments || updatedShipments,
              stageHistory: data.order.stageHistory || [
                {
                  id: "temp-" + Date.now(),
                  fromStage: prev.internalStage,
                  toStage: targetStage,
                  reason: `Moved to ${targetStage}`,
                  timestamp: new Date().toISOString(),
                },
                ...(prev.stageHistory || []),
              ],
            };
          }
          return {
            ...prev,
            internalStage: targetStage,
            shipments: updatedShipments,
            stageHistory: [
              {
                id: "temp-" + Date.now(),
                fromStage: prev.internalStage,
                toStage: targetStage,
                reason: `Moved to ${targetStage}`,
                timestamp: new Date().toISOString(),
              },
              ...(prev.stageHistory || []),
            ],
          };
        });

        invalidateCache("/api/dashboard/stats");
        invalidateCache("/api/delivery");
        invalidateCache("/api/orders");
      } else {
        setTransitionMsg(data.error || "Transition failed");
      }
    } catch {
      setTransitionMsg("Request failed");
    } finally {
      setIsTransitioning(false);
      setTransitioningStage(null);
      setTimeout(() => setTransitionMsg(null), 4000);
    }
  };

  const handleHandoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    const finalCourier = handoverCourier === "OTHER" ? customHandoverCourier.trim() : handoverCourier;
    if (!handoverAwb.trim() || !finalCourier) {
      setTransitionMsg("Courier and AWB number are required to record handover.");
      return;
    }

    setHandoverSubmitting(true);
    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          courierName: finalCourier,
          awbWaybill: handoverAwb.trim(),
          provider: "SHIPROCKET",
          remark: handoverRemark.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTransitionMsg(`Handover recorded with ${finalCourier} (AWB: ${handoverAwb.trim()})`);
        setShowHandoverModal(false);
        setHandoverAwb("");
        setCustomHandoverCourier("");
        setHandoverRemark("");

        // Optimistically advance order to DELIVERY
        updateOrderData((prev) => {
          const newShipment = data.shipment || {
            courierName: finalCourier,
            awbWaybill: handoverAwb.trim(),
            normalizedStatus: "PICKED_UP",
            currentScanActivity: "Handed over to carrier at warehouse dispatch dock",
          };
          const newHistory = {
            id: "temp-" + Date.now(),
            fromStage: prev.internalStage,
            toStage: "DELIVERY",
            reason: `Dispatched via ${finalCourier} (AWB: ${handoverAwb.trim()})`,
            timestamp: new Date().toISOString(),
          };
          return {
            ...prev,
            internalStage: "DELIVERY",
            nextAction: `In transit with ${finalCourier} (AWB: ${handoverAwb.trim()})`,
            shipments: [newShipment, ...(prev.shipments || [])],
            stageHistory: [newHistory, ...(prev.stageHistory || [])],
          };
        });

        invalidateCache("/api/dashboard/stats");
        invalidateCache("/api/delivery");
        invalidateCache("/api/orders");
      } else {
        setTransitionMsg(data.error || "Failed to record handover");
      }
    } catch {
      setTransitionMsg("Handover request failed");
    } finally {
      setHandoverSubmitting(false);
      setTimeout(() => setTransitionMsg(null), 5000);
    }
  };

  const handleReallocate = async () => {
    if (!order) return;
    setIsReallocating(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/allocate`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setTransitionMsg("Stock reallocation completed");
        if (data.order) {
          updateOrderData((prev) => ({
            ...prev,
            ...data.order,
          }));
        }
        invalidateCache("/api/orders");
      } else {
        setTransitionMsg(data.error || "Allocation failed");
      }
    } catch {
      setTransitionMsg("Failed to allocate order");
    } finally {
      setIsReallocating(false);
      setTimeout(() => setTransitionMsg(null), 4000);
    }
  };

  const handleAddRemark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !newRemarkText.trim()) return;
    const textToSubmit = newRemarkText.trim();
    setAddingRemark(true);

    try {
      const res = await fetch(`/api/orders/${order.id}/remark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remark: textToSubmit }),
      });
      const data = await res.json();
      if (data.success) {
        setNewRemarkText("");
        // Optimistically update remarks and history without re-fetching entire order
        updateOrderData((prev) => {
          const newRemark = data.remark || {
            id: "temp-" + Date.now(),
            text: textToSubmit,
            stage: prev.internalStage,
            authorName: "Staff",
            createdAt: new Date().toISOString(),
          };
          const newHistory = data.historyEntry || {
            id: "temp-hist-" + Date.now(),
            toStage: prev.internalStage,
            reason: `[Remark]: ${textToSubmit}`,
            timestamp: new Date().toISOString(),
          };
          return {
            ...prev,
            staffRemark: textToSubmit,
            remarks: [newRemark, ...(prev.remarks || [])],
            stageHistory: [newHistory, ...(prev.stageHistory || [])],
          };
        });
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
        updateOrderData((prev) => ({
          ...prev,
          rawMaterialDecision: decision,
          ...(data.result?.order ? data.result.order : {}),
        }));
        invalidateCache("/api/raw-material/queue");
        invalidateCache("/api/orders");
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
      case "DELIVERY":
        return [
          { stage: "DELIVERED", label: "Mark Delivered", color: "bg-emerald-700 hover:bg-emerald-800 text-white" },
          { stage: "DELIVERY_EXCEPTION", label: "Flag Delivery Exception", color: "bg-pink-600 hover:bg-pink-700 text-white" },
          { stage: "RTO", label: "Trigger Return to Origin (RTO)", color: "bg-red-600 hover:bg-red-700 text-white" },
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
      <div className="w-full sm:max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 border-l border-stone-200">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
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

              {/* Courier & AWB Tracking Card */}
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 font-bold text-stone-900">
                    <Truck className="w-4 h-4 text-[#a27b5c]" />
                    <span>Courier &amp; AWB Information</span>
                  </div>
                  {!isEditingAwb ? (
                    <button
                      onClick={() => setIsEditingAwb(true)}
                      className="px-2 py-1 text-[11px] font-medium text-[#a27b5c] bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded flex items-center space-x-1 transition"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{activeShipment ? "Edit AWB / Courier" : "Assign AWB"}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsEditingAwb(false)}
                      className="text-xs text-stone-500 hover:text-stone-700 font-medium"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {!isEditingAwb ? (
                  activeShipment ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                      <div className="bg-white p-2 rounded border border-stone-200">
                        <span className="text-[10px] text-stone-400 uppercase block font-semibold">AWB / Waybill</span>
                        <span className="font-mono font-bold text-stone-900">{activeShipment.awbWaybill}</span>
                      </div>
                      <div className="bg-white p-2 rounded border border-stone-200">
                        <span className="text-[10px] text-stone-400 uppercase block font-semibold">Courier Partner</span>
                        <span className="font-medium text-stone-800">{activeShipment.courierName || "N/A"}</span>
                      </div>
                      <div className="bg-white p-2 rounded border border-stone-200">
                        <span className="text-[10px] text-stone-400 uppercase block font-semibold">Shipment Status</span>
                        <span className="font-bold text-blue-700">{activeShipment.normalizedStatus?.replace(/_/g, " ") || "N/A"}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-stone-500 text-[11px] italic pt-1">
                      No courier or AWB assigned yet. Click &quot;Assign AWB&quot; to attach tracking details.
                    </p>
                  )
                ) : (
                  <form onSubmit={handleUpdateAwb} className="space-y-3 pt-2 border-t border-stone-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-stone-700 block mb-1">
                          Courier Partner
                        </label>
                        <select
                          value={courierInput}
                          onChange={(e) => setCourierInput(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded bg-white focus:ring-1 focus:ring-[#a27b5c]"
                        >
                          <option value="Blue Dart">Blue Dart</option>
                          <option value="Delhivery">Delhivery</option>
                          <option value="Shiprocket Cargo">Shiprocket Cargo</option>
                          <option value="DTDC">DTDC</option>
                          <option value="Ekart Logistics">Ekart Logistics</option>
                          <option value="Amazon Shipping">Amazon Shipping</option>
                          <option value="Shadowfax">Shadowfax</option>
                          <option value="Xpressbees">Xpressbees</option>
                          <option value="DHL Express (Export)">DHL Express (Export)</option>
                          <option value="FedEx">FedEx</option>
                          <option value="OTHER">+ Other Courier...</option>
                        </select>
                      </div>

                      {courierInput === "OTHER" && (
                        <div>
                          <label className="text-[11px] font-semibold text-stone-700 block mb-1">
                            Custom Courier Name
                          </label>
                          <input
                            type="text"
                            required
                            value={customCourierInput}
                            onChange={(e) => setCustomCourierInput(e.target.value)}
                            placeholder="e.g. V-Trans, TCI..."
                            className="w-full px-2.5 py-1.5 text-xs border border-amber-300 bg-amber-50/20 rounded focus:ring-1 focus:ring-[#a27b5c]"
                          />
                        </div>
                      )}

                      <div>
                        <label className="text-[11px] font-semibold text-stone-700 block mb-1">
                          AWB / Waybill Number <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={awbInput}
                          onChange={(e) => setAwbInput(e.target.value)}
                          placeholder="e.g. BD987123498"
                          className="w-full px-2.5 py-1.5 text-xs font-mono border border-stone-300 rounded bg-white focus:ring-1 focus:ring-[#a27b5c]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-stone-700 block mb-1">
                        Update Note / Remark (Optional)
                      </label>
                      <input
                        type="text"
                        value={awbRemarkInput}
                        onChange={(e) => setAwbRemarkInput(e.target.value)}
                        placeholder="e.g. Re-manifested with Blue Dart..."
                        className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded bg-white focus:ring-1 focus:ring-[#a27b5c]"
                      />
                    </div>

                    <div className="flex justify-end space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEditingAwb(false)}
                        className="px-3 py-1 border border-stone-300 rounded text-stone-700 bg-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingAwb}
                        className="px-3 py-1 bg-[#a27b5c] hover:bg-[#8a6549] text-white rounded font-semibold disabled:opacity-50"
                      >
                        {savingAwb ? "Saving..." : "Save AWB"}
                      </button>
                    </div>
                  </form>
                )}
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
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-stone-200 text-center">
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
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-medium shadow-xs disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {rmSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Raw Material Available (Start Production)</span>
                    </button>
                    <button
                      onClick={() => setRmDecisionMode("UNAVAILABLE")}
                      disabled={rmSubmitting}
                      className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded font-medium shadow-xs disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    >
                      Raw Material Unavailable (Queue as Blocked)
                    </button>
                    <button
                      onClick={() => handleRawMaterialDecision("PENDING_ASSESSMENT")}
                      disabled={rmSubmitting}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium shadow-xs disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {rmSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Mark Pending Assessment</span>
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
                      disabled={isReallocating || isTransitioning}
                      onClick={handleReallocate}
                      className="px-3 py-1.5 bg-[#a27b5c] text-white text-xs font-medium rounded hover:bg-[#8a6549] transition disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {isReallocating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{isReallocating ? "Re-running..." : "Re-run Stock Allocation"}</span>
                    </button>
                  )}

                  {getValidForwardStages(order.internalStage).map((st) => {
                    const isCurrentMoving = isTransitioning && transitioningStage === st.stage;
                    return (
                      <button
                        key={st.stage}
                        disabled={isTransitioning || isReallocating}
                        onClick={() => handleStageTransition(st.stage)}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition flex items-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 shadow-xs ${st.color}`}
                      >
                        {isCurrentMoving ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Updating to {st.stage}...</span>
                          </>
                        ) : (
                          <span>{st.label}</span>
                        )}
                      </button>
                    );
                  })}
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

      {/* Handover & AWB Modal from Inspector */}
      {showHandoverModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-xs no-print">
          <form
            onSubmit={handleHandoverSubmit}
            className="w-full max-w-md bg-white p-6 rounded-lg shadow-2xl border border-stone-200 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <h3 className="text-sm font-bold text-stone-900">
                Record Courier Handover: {order?.uniwareOrderCode}
              </h3>
              <button
                type="button"
                onClick={() => setShowHandoverModal(false)}
                className="text-stone-400 hover:text-stone-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-stone-500">
              To move this parcel to Delivery, please assign the shipping company and tracking AWB.
            </p>

            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">Shipping Partner</label>
              <select
                value={handoverCourier}
                onChange={(e) => setHandoverCourier(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-[#a27b5c]"
              >
                <option value="Blue Dart">Blue Dart</option>
                <option value="Delhivery">Delhivery</option>
                <option value="Shiprocket Cargo">Shiprocket Cargo</option>
                <option value="DTDC">DTDC</option>
                <option value="Ekart Logistics">Ekart Logistics</option>
                <option value="Amazon Shipping">Amazon Shipping</option>
                <option value="Shadowfax">Shadowfax</option>
                <option value="Xpressbees">Xpressbees</option>
                <option value="DHL Express (Export)">DHL Express (Export)</option>
                <option value="FedEx">FedEx</option>
                <option value="OTHER">+ Other / Custom Shipping Partner...</option>
              </select>
            </div>

            {handoverCourier === "OTHER" && (
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Custom Shipping Company Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customHandoverCourier}
                  onChange={(e) => setCustomHandoverCourier(e.target.value)}
                  placeholder="Enter shipping company (e.g. TCI Freight, V-Trans, GATI...)"
                  className="w-full px-3 py-1.5 text-xs border border-amber-300 bg-amber-50/30 rounded focus:ring-1 focus:ring-[#a27b5c]"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">
                AWB / Waybill Number <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={handoverAwb}
                onChange={(e) => setHandoverAwb(e.target.value)}
                placeholder="e.g. BD987123498"
                className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-[#a27b5c] font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">Handover Remark (Optional)</label>
              <textarea
                rows={2}
                value={handoverRemark}
                onChange={(e) => setHandoverRemark(e.target.value)}
                placeholder="E.g. Handed over to driver Mr. Ramesh at warehouse dock..."
                className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded focus:ring-1 focus:ring-[#a27b5c]"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowHandoverModal(false)}
                className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={handoverSubmitting}
                className="px-4 py-1.5 text-xs font-semibold bg-[#a27b5c] text-white hover:bg-[#8a6549] rounded transition"
              >
                {handoverSubmitting ? "Recording..." : "Confirm Handover & Move to Delivery"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
