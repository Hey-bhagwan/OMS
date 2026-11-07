import React, { useState } from "react";
import { AlertCircle, AlertTriangle, Clock, Info } from "lucide-react";

export interface PriorityBadgeProps {
  orderCode: string;
  displayOrderCode?: string | null;
  priorityLabel?: "LOW" | "NORMAL" | "HIGH" | "URGENT" | "OVERDUE" | string;
  priorityReason?: string | null;
  priorityScore?: number | null;
  fulfillmentDeadline?: string | Date | null;
  blockerReason?: string | null;
  internalStage?: string;
  onClick?: () => void;
  className?: string;
}

/**
 * Returns Tailwind color classes representing the order priority level.
 */
export function getPriorityColorClasses(label?: string) {
  switch (label) {
    case "OVERDUE":
      return {
        badge: "bg-rose-100 text-rose-900 border border-rose-300 shadow-xs",
        dot: "bg-rose-600 animate-pulse",
        text: "text-rose-900",
        border: "border-l-4 border-l-rose-500",
        bgLight: "bg-rose-50/40",
        header: "text-rose-700 bg-rose-50",
      };
    case "URGENT":
      return {
        badge: "bg-orange-100 text-orange-900 border border-orange-300 shadow-xs",
        dot: "bg-orange-500",
        text: "text-orange-900",
        border: "border-l-4 border-l-orange-500",
        bgLight: "bg-orange-50/40",
        header: "text-orange-700 bg-orange-50",
      };
    case "HIGH":
      return {
        badge: "bg-amber-100 text-amber-900 border border-amber-300",
        dot: "bg-amber-500",
        text: "text-amber-900",
        border: "border-l-4 border-l-amber-500",
        bgLight: "bg-amber-50/30",
        header: "text-amber-700 bg-amber-50",
      };
    case "LOW":
      return {
        badge: "bg-slate-100 text-slate-700 border border-slate-200",
        dot: "bg-slate-400",
        text: "text-slate-700",
        border: "border-l-4 border-l-slate-300",
        bgLight: "bg-slate-50/20",
        header: "text-slate-600 bg-slate-50",
      };
    default: // NORMAL
      return {
        badge: "bg-stone-100 text-stone-800 border border-stone-200",
        dot: "bg-stone-400",
        text: "text-stone-900",
        border: "border-l-4 border-l-stone-300",
        bgLight: "",
        header: "text-stone-700 bg-stone-50",
      };
  }
}

/**
 * Computes an explanatory text of why the order has this priority if not provided by backend.
 */
export function getPriorityExplanation(props: {
  priorityLabel?: string;
  priorityReason?: string | null;
  priorityScore?: number | null;
  fulfillmentDeadline?: string | Date | null;
  blockerReason?: string | null;
  internalStage?: string;
}): string {
  if (props.priorityReason) return props.priorityReason;

  if (props.internalStage === "DELIVERY") {
    return "Order has already been dispatched to courier; in delivery phase.";
  }

  const reasons: string[] = [];
  if (props.fulfillmentDeadline) {
    const dl = new Date(props.fulfillmentDeadline).getTime();
    const diff = dl - Date.now();
    if (diff < 0) {
      const days = Math.ceil(Math.abs(diff) / (24 * 3600 * 1000));
      reasons.push(`Fulfillment deadline passed ${days} day(s) ago`);
    } else if (diff < 24 * 3600 * 1000) {
      reasons.push("Fulfillment deadline due within 24 hours");
    } else if (diff < 48 * 3600 * 1000) {
      reasons.push("Fulfillment deadline due within 48 hours");
    }
  }

  if (props.blockerReason && props.blockerReason !== "None") {
    reasons.push(`Active blocker: ${props.blockerReason}`);
  }

  if (props.internalStage === "DELIVERY_EXCEPTION") {
    reasons.unshift("Courier reported delivery exception / RTO");
  }

  if (reasons.length > 0) return reasons.join(" • ");

  switch (props.priorityLabel) {
    case "OVERDUE":
      return "Fulfillment deadline has passed and order requires immediate attention.";
    case "URGENT":
      return "Critical SLA deadline approaching or active operational blocker present.";
    case "HIGH":
      return "Approaching fulfillment deadline within 48h.";
    case "LOW":
      return "Low operational urgency / Order already in delivery.";
    default:
      return "Standard operational priority.";
  }
}

/**
 * PriorityOrderCode renders the order code with its priority color styling and an interactive
 * hover tooltip explaining exactly why it holds this priority status.
 */
export const PriorityOrderCode: React.FC<PriorityBadgeProps> = ({
  orderCode,
  displayOrderCode,
  priorityLabel = "NORMAL",
  priorityReason,
  priorityScore,
  fulfillmentDeadline,
  blockerReason,
  internalStage,
  onClick,
  className = "",
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const colors = getPriorityColorClasses(priorityLabel);
  const explanation = getPriorityExplanation({
    priorityLabel,
    priorityReason,
    priorityScore,
    fulfillmentDeadline,
    blockerReason,
    internalStage,
  });

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          onClick={onClick}
          className={`font-mono font-bold px-1.5 py-0.5 rounded text-xs transition cursor-pointer ${
            colors.badge
          } hover:opacity-90 ${onClick ? "hover:underline" : ""}`}
        >
          <span className="inline-flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
            {orderCode}
          </span>
        </span>
      </div>

      {displayOrderCode && (
        <span className="text-[10px] text-stone-500 block truncate mt-0.5 font-sans">
          {displayOrderCode}
        </span>
      )}

      {/* Hover Tooltip explaining priority reason */}
      {showTooltip && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-72 p-2.5 bg-stone-900 text-stone-100 text-xs rounded-lg shadow-xl border border-stone-700 animate-in fade-in duration-150 pointer-events-none">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-stone-800">
            <div className="flex items-center gap-1.5 font-semibold">
              <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
              <span className="uppercase text-[10px] tracking-wide text-stone-300">
                Priority: {priorityLabel}
              </span>
            </div>
            {priorityScore !== null && priorityScore !== undefined && (
              <span className="text-[10px] font-mono text-stone-400">Score: {priorityScore}</span>
            )}
          </div>

          <div className="space-y-1 text-[11px] leading-relaxed text-stone-200">
            <div className="flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#a27b5c] shrink-0 mt-0.5" />
              <span>{explanation}</span>
            </div>
          </div>

          <div className="mt-2 pt-1 border-t border-stone-800/80 text-[10px] text-stone-400 flex items-center justify-between">
            <span>Stage: {internalStage || "IN_PROGRESS"}</span>
            <span className="italic">Click order to inspect</span>
          </div>
        </div>
      )}
    </div>
  );
};
