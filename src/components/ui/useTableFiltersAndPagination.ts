import { useState, useMemo, useEffect } from "react";

export type FilterValueExtractor<T> = (item: T) => string | string[] | null | undefined;
export type SortDirection = "asc" | "desc" | null;
export type DateValueExtractor<T> = (item: T) => Date | string | number | null | undefined;

export interface ColumnDefinition<T> {
  id: string;
  title: string;
  getValue?: FilterValueExtractor<T>;
}

export function useTableFiltersAndPagination<T>(
  data: T[],
  options?: {
    initialPageSize?: number;
    initialPage?: number;
    searchFilter?: string;
    searchFields?: ((item: T) => string | null | undefined)[];
    customFilterFn?: (item: T, columnFilters: Record<string, string[]>) => boolean;
    initialSortColumn?: string | null;
    initialSortDirection?: SortDirection;
    dateSortExtractors?: Record<string, DateValueExtractor<T>>;
  }
) {
  const [currentPage, setCurrentPage] = useState(options?.initialPage || 1);
  const [pageSize, setPageSize] = useState(options?.initialPageSize || 25);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [sortColumn, setSortColumn] = useState<string | null>(options?.initialSortColumn || null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(options?.initialSortDirection || null);

  // Reset to page 1 whenever searchFilter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [options?.searchFilter]);

  // Extract distinct values dynamically for any column
  const getDistinctValues = (columnId: string, extractor: FilterValueExtractor<T>) => {
    const counts = new Map<string, number>();
    for (const item of data) {
      const raw = extractor(item);
      if (Array.isArray(raw)) {
        for (const v of raw) {
          const str = String(v ?? "").trim();
          if (str) {
            counts.set(str, (counts.get(str) || 0) + 1);
          }
        }
      } else {
        const str = String(raw ?? "").trim();
        if (str) {
          counts.set(str, (counts.get(str) || 0) + 1);
        }
      }
    }
    const distinct: { value: string; label: string; count: number }[] = [];
    counts.forEach((count, value) => {
      distinct.push({ value, label: value, count });
    });
    // Sort alphabetically
    distinct.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" }));
    return distinct;
  };

  const setColumnFilter = (columnId: string, values: string[]) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (!values || values.length === 0) {
        delete next[columnId];
      } else {
        next[columnId] = values;
      }
      return next;
    });
    setCurrentPage(1);
  };

  const clearColumnFilter = (columnId: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      delete next[columnId];
      return next;
    });
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setColumnFilters({});
    setCurrentPage(1);
  };

  const hasActiveFilters = Object.keys(columnFilters).length > 0;

  // Toggle sorting for a date column
  // Toggle sequence: desc (Newest First) -> asc (Oldest First) -> null (default)
  const toggleDateSort = (columnId: string) => {
    if (sortColumn !== columnId) {
      setSortColumn(columnId);
      setSortDirection("desc"); // Newest First default
    } else {
      if (sortDirection === "desc") {
        setSortDirection("asc"); // Oldest First
      } else if (sortDirection === "asc") {
        setSortDirection(null);
        setSortColumn(null);
      } else {
        setSortDirection("desc");
      }
    }
    setCurrentPage(1);
  };

  const setDateSort = (columnId: string, direction: SortDirection) => {
    setSortColumn(direction ? columnId : null);
    setSortDirection(direction);
    setCurrentPage(1);
  };

  // Helper to parse date value into timestamp
  const parseDateValue = (raw: any): number | null => {
    if (raw === null || raw === undefined || raw === "") return null;
    if (raw instanceof Date) {
      const t = raw.getTime();
      return isNaN(t) ? null : t;
    }
    if (typeof raw === "number") {
      return isNaN(raw) ? null : raw;
    }
    const parsed = Date.parse(String(raw));
    return isNaN(parsed) ? null : parsed;
  };

  // Filter and Sort the data
  const filteredData = useMemo(() => {
    const q = options?.searchFilter?.toLowerCase().trim();
    const activeEntries = Object.entries(columnFilters);

    const filtered = data.filter((item) => {
      // 1. Global search filter
      if (q && options?.searchFields && options.searchFields.length > 0) {
        const matchesSearch = options.searchFields.some((fn) => {
          const val = fn(item);
          return val ? val.toLowerCase().includes(q) : false;
        });
        if (!matchesSearch) return false;
      }

      // 2. Custom filter fn if supplied
      if (options?.customFilterFn) {
        if (!options.customFilterFn(item, columnFilters)) return false;
      }

      // 3. AND across active columns
      for (const [colId, selectedValues] of activeEntries) {
        if (!selectedValues || selectedValues.length === 0) continue;

        // Try to read item[colId] directly
        const rawVal = (item as any)[colId];
        if (Array.isArray(rawVal)) {
          // OR within column
          const matches = rawVal.some((v) => selectedValues.includes(String(v)));
          if (!matches) return false;
        } else {
          const strVal = String(rawVal ?? "").trim();
          if (!selectedValues.includes(strVal)) {
            return false;
          }
        }
      }

      return true;
    });

    // 4. Date-based Sorting
    if (sortColumn && sortDirection) {
      const extractor = options?.dateSortExtractors?.[sortColumn];
      return [...filtered].sort((a, b) => {
        const rawA = extractor ? extractor(a) : (a as any)[sortColumn];
        const rawB = extractor ? extractor(b) : (b as any)[sortColumn];

        const timeA = parseDateValue(rawA);
        const timeB = parseDateValue(rawB);

        // Put nulls/empty at the bottom in both directions
        if (timeA === null && timeB === null) return 0;
        if (timeA === null) return 1;
        if (timeB === null) return -1;

        if (sortDirection === "asc") {
          return timeA - timeB; // Oldest first
        } else {
          return timeB - timeA; // Newest first
        }
      });
    }

    return filtered;
  }, [
    data,
    columnFilters,
    options?.searchFilter,
    options?.searchFields,
    options?.customFilterFn,
    options?.dateSortExtractors,
    sortColumn,
    sortDirection,
  ]);

  // Pagination calculation
  const totalRecords = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  // Slice for current page
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  return {
    currentPage,
    pageSize,
    totalPages,
    totalRecords,
    columnFilters,
    filteredData,
    paginatedData,
    hasActiveFilters,
    sortColumn,
    sortDirection,
    toggleDateSort,
    setDateSort,
    setCurrentPage,
    setPageSize: (size: number) => {
      setPageSize(size);
      setCurrentPage(1);
    },
    setColumnFilter,
    clearColumnFilter,
    clearAllFilters,
    getDistinctValues,
  };
}
