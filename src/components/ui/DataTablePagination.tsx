import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export const DataTablePagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalRecords,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
}) => {
  const safeCurrentPage = Math.max(1, Math.min(currentPage, Math.max(1, totalPages)));
  const startRecord = totalRecords === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endRecord = Math.min(safeCurrentPage * pageSize, totalRecords);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      let start = Math.max(2, safeCurrentPage - 1);
      let end = Math.min(totalPages - 1, safeCurrentPage + 1);

      if (safeCurrentPage <= 3) {
        start = 2;
        end = 4;
      } else if (safeCurrentPage >= totalPages - 2) {
        start = totalPages - 3;
        end = totalPages - 1;
      }

      if (start > 2) {
        pages.push("...");
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 1) {
        pages.push("...");
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white border-t border-stone-200 text-xs text-stone-600 no-print rounded-b-lg">
      {/* Left: Records summary */}
      <div className="flex items-center space-x-2">
        <span className="font-medium text-stone-700">
          Showing <span className="font-semibold text-stone-900">{startRecord}</span>–
          <span className="font-semibold text-stone-900">{endRecord}</span> of{" "}
          <span className="font-semibold text-stone-900">{totalRecords}</span> records
        </span>
      </div>

      {/* Center / Right: Page size selector and page navigation */}
      <div className="flex flex-wrap items-center space-x-4">
        {/* Rows per page selector */}
        <div className="flex items-center space-x-1.5">
          <span className="text-stone-500">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-stone-50 border border-stone-200 rounded px-2 py-1 text-xs text-stone-800 focus:outline-none focus:ring-1 focus:ring-[#a27b5c]"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} rows
              </option>
            ))}
          </select>
        </div>

        {/* Page buttons */}
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={safeCurrentPage <= 1}
            title="First Page"
            className="p-1.5 rounded border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(safeCurrentPage - 1)}
            disabled={safeCurrentPage <= 1}
            title="Previous Page"
            className="flex items-center space-x-1 px-2.5 py-1 rounded border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          {/* Numbers */}
          <div className="hidden sm:flex items-center space-x-1">
            {pages.map((p, idx) => {
              if (p === "...") {
                return (
                  <span key={`ellipsis-${idx}`} className="px-2 py-1 text-stone-400">
                    ...
                  </span>
                );
              }
              const isCurrent = p === safeCurrentPage;
              return (
                <button
                  key={`page-${p}`}
                  type="button"
                  onClick={() => onPageChange(Number(p))}
                  className={`min-w-[28px] h-7 px-1.5 rounded text-xs font-medium transition ${
                    isCurrent
                      ? "bg-[#a27b5c] text-white shadow-xs font-semibold"
                      : "bg-white border border-stone-200 text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => onPageChange(safeCurrentPage + 1)}
            disabled={safeCurrentPage >= totalPages || totalPages === 0}
            title="Next Page"
            className="flex items-center space-x-1 px-2.5 py-1 rounded border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={safeCurrentPage >= totalPages || totalPages === 0}
            title="Last Page"
            className="p-1.5 rounded border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
