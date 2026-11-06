import React from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export type SortDirection = "asc" | "desc" | null;

export interface DateSortHeaderProps {
  title: string;
  columnId: string;
  currentSortColumn?: string | null;
  currentSortDirection?: SortDirection;
  onSortChange: (columnId: string) => void;
  className?: string;
  children?: React.ReactNode; // Optional right-side actions like ColumnFilter
}

export const DateSortHeader: React.FC<DateSortHeaderProps> = ({
  title,
  columnId,
  currentSortColumn,
  currentSortDirection,
  onSortChange,
  className = "",
  children,
}) => {
  const isActive = currentSortColumn === columnId && currentSortDirection !== null;

  return (
    <div className={`flex items-center justify-between gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={() => onSortChange(columnId)}
        className="flex items-center gap-1 font-semibold text-stone-700 hover:text-stone-900 group select-none text-left cursor-pointer transition focus:outline-none"
        title={
          isActive
            ? currentSortDirection === "asc"
              ? "Sorted Oldest First. Click to sort Newest First."
              : "Sorted Newest First. Click to clear sorting."
            : `Click to sort by ${title} (Newest First)`
        }
      >
        <span className={isActive ? "text-[#a27b5c] font-bold" : ""}>{title}</span>
        <span
          className={`inline-flex items-center justify-center p-0.5 rounded transition ${
            isActive
              ? "bg-[#a27b5c]/10 text-[#a27b5c]"
              : "text-stone-400 opacity-60 group-hover:opacity-100 group-hover:text-stone-600"
          }`}
        >
          {isActive ? (
            currentSortDirection === "asc" ? (
              <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3" />
          )}
        </span>
      </button>

      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
};
