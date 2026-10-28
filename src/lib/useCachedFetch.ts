"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// In-memory global cache across component mounts
const memoryCache = new Map<string, { data: any; timestamp: number }>();

interface UseCachedFetchOptions {
  /** Time in ms before cached data is considered stale. Default: 15 seconds */
  staleTime?: number;
  /** Whether to revalidate on mount. Default: true */
  revalidateOnMount?: boolean;
}

export function useCachedFetch<T = any>(
  url: string | null,
  options: UseCachedFetchOptions = {}
) {
  const { staleTime = 15000, revalidateOnMount = true } = options;

  const cached = url ? memoryCache.get(url) : null;
  const [data, setData] = useState<T | null>(cached ? (cached.data as T) : null);
  const [loading, setLoading] = useState<boolean>(!cached);
  const [isBackgroundFetching, setIsBackgroundFetching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(
    async (showLoading: boolean | any = false) => {
      if (!url) return;

      const isExplicitLoading = typeof showLoading === "boolean" ? showLoading : false;
      const hasCached = memoryCache.has(url);
      if (isExplicitLoading || !hasCached) {
        setLoading(true);
      } else {
        setIsBackgroundFetching(true);
      }

      try {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }
        const json = await res.json();
        memoryCache.set(url, { data: json, timestamp: Date.now() });

        if (isMountedRef.current) {
          setData(json);
          setError(null);
        }
      } catch (err: any) {
        if (isMountedRef.current) {
          setError(err?.message || "Failed to fetch");
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setIsBackgroundFetching(false);
        }
      }
    },
    [url]
  );

  useEffect(() => {
    if (!url) return;

    const entry = memoryCache.get(url);
    if (entry) {
      setData(entry.data as T);
      setLoading(false);

      // Revalidate in background if stale or requested
      const isStale = Date.now() - entry.timestamp > staleTime;
      if (revalidateOnMount || isStale) {
        refetch(false);
      }
    } else {
      refetch(true);
    }
  }, [url, refetch, staleTime, revalidateOnMount]);

  const mutate = useCallback(
    (updater: T | ((prev: T | null) => T | null), revalidate = false) => {
      if (!url) return;
      setData((prev) => {
        const next = typeof updater === "function" ? (updater as any)(prev) : updater;
        memoryCache.set(url, { data: next, timestamp: Date.now() });
        return next;
      });
      if (revalidate) {
        refetch(false);
      }
    },
    [url, refetch]
  );

  return { data, loading, isBackgroundFetching, error, refetch, mutate };
}

/** Clear all or specific cached URLs */
export function invalidateCache(urlPattern?: string) {
  if (!urlPattern) {
    memoryCache.clear();
  } else {
    Array.from(memoryCache.keys()).forEach((key) => {
      if (key.includes(urlPattern)) {
        memoryCache.delete(key);
      }
    });
  }
}
