import React, { useState, useEffect, useMemo, useRef } from "react";
import { Filter, Search, Check, X } from "lucide-react";

export interface ColumnFilterProps {
  columnId: string;
  columnTitle: string;
  options: { value: string; label: string; count?: number }[];
  selectedValues: string[];
  onApply: (selected: string[]) => void;
  onClear: () => void;
}

export const ColumnFilter: React.FC<ColumnFilterProps> = ({
  columnId,
  columnTitle,
  options,
  selectedValues,
  onApply,
  onClear,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [tempSelected, setTempSelected] = useState<string[]>(selectedValues);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  // Sync temp selection when external selectedValues change or when opening
  useEffect(() => {
    if (isOpen) {
      setTempSelected(selectedValues);
      setSearchTerm("");
    }
  }, [isOpen, selectedValues]);

  // Handle position calculation when opening to prevent clipping
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Position below the button
      const top = rect.bottom + window.scrollY + 4;
      // Ensure it stays inside viewport
      let left = rect.left + window.scrollX;
      const width = 240; // width of dropdown
      if (left + width > window.innerWidth - 16) {
        left = window.innerWidth - width - 16;
      }
      if (left < 16) left = 16;
      setDropdownPos({ top, left });
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(term) || opt.value.toLowerCase().includes(term)
    );
  }, [options, searchTerm]);

  const isAllFilteredSelected = useMemo(() => {
    if (filteredOptions.length === 0) return false;
    return filteredOptions.every((opt) => tempSelected.includes(opt.value));
  }, [filteredOptions, tempSelected]);

  const handleToggleOption = (value: string) => {
    setTempSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleSelectAll = () => {
    const allFilteredValues = filteredOptions.map((o) => o.value);
    const combined = Array.from(new Set([...tempSelected, ...allFilteredValues]));
    setTempSelected(combined);
  };

  const handleDeselectAll = () => {
    const filteredSet = new Set(filteredOptions.map((o) => o.value));
    setTempSelected((prev) => prev.filter((v) => !filteredSet.has(v)));
  };

  const handleApply = () => {
    onApply(tempSelected);
    setIsOpen(false);
  };

  const handleClear = () => {
    setTempSelected([]);
    onClear();
    setIsOpen(false);
  };

  const hasActiveFilter = selectedValues.length > 0;

  return (
    <div className="inline-flex items-center ml-1 relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title={`Filter ${columnTitle}`}
        className={`p-1 rounded transition-colors ${
          hasActiveFilter
            ? "bg-[#a27b5c] text-white shadow-xs"
            : "text-stone-400 hover:text-stone-700 hover:bg-stone-200/60"
        }`}
      >
        <Filter className="w-3 h-3" />
      </button>

      {isOpen && dropdownPos && (
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: `${dropdownPos.top}px`,
            left: `${dropdownPos.left}px`,
          }}
          className="z-[9999] w-64 bg-white rounded-lg shadow-xl border border-stone-200 text-stone-800 text-xs flex flex-col font-normal normal-case animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-stone-100 flex items-center justify-between bg-stone-50/70 rounded-t-lg">
            <span className="font-semibold text-stone-800 truncate">
              Filter: {columnTitle}
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-0.5 text-stone-400 hover:text-stone-700 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search box inside dropdown */}
          <div className="p-2 border-b border-stone-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-stone-400" />
              <input
                type="text"
                placeholder="Search values..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 bg-stone-50 border border-stone-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#a27b5c] focus:bg-white"
                autoFocus
              />
            </div>
          </div>

          {/* Select all & Clear shortcuts */}
          <div className="px-3 py-1.5 flex items-center justify-between border-b border-stone-100 text-[11px] text-stone-500 bg-stone-50/30">
            <button
              type="button"
              onClick={isAllFilteredSelected ? handleDeselectAll : handleSelectAll}
              className="text-[#a27b5c] hover:underline font-medium"
            >
              {isAllFilteredSelected ? "Deselect All" : "Select All"}
            </button>
            <button
              type="button"
              onClick={() => setTempSelected([])}
              className="hover:text-stone-800"
            >
              Clear in list
            </button>
          </div>

          {/* List of distinct options */}
          <div className="max-h-52 overflow-y-auto p-1.5 space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-stone-400 text-[11px]">
                No matching values
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const checked = tempSelected.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-stone-50 cursor-pointer select-none group"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleOption(opt.value)}
                      className="rounded border-stone-300 text-[#a27b5c] focus:ring-[#a27b5c] w-3.5 h-3.5 accent-[#a27b5c]"
                    />
                    <span className="flex-1 truncate text-stone-700 text-xs group-hover:text-stone-900">
                      {opt.label}
                    </span>
                    {typeof opt.count === "number" && (
                      <span className="text-[10px] text-stone-400 font-mono">
                        ({opt.count})
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>

          {/* Footer buttons: Apply & Clear */}
          <div className="p-2 border-t border-stone-100 flex items-center justify-between bg-stone-50/60 rounded-b-lg">
            <button
              type="button"
              onClick={handleClear}
              className="px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:text-stone-900 border border-stone-200 rounded hover:bg-stone-100 transition"
            >
              Clear Filter
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-3 py-1 text-[11px] font-semibold text-white bg-[#a27b5c] hover:bg-[#8a6549] rounded transition shadow-xs"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
