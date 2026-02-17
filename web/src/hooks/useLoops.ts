import { useCallback, useEffect, useRef, useState } from "react";
import type { Loop } from "../api/types";
import { api } from "../api/client";

export function useLoops(intervalMs = 5000) {
  const [loops, setLoops] = useState<Loop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestIdRef.current;
    try {
      const data = await api.listLoops();
      // Only apply state if this is still the latest request.
      if (id !== requestIdRef.current) return;
      setLoops(data ?? []);
      setError(null);
    } catch (err) {
      if (id !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, intervalMs);
    return () => clearInterval(timer);
  }, [refresh, intervalMs]);

  return { loops, loading, error, refresh };
}
