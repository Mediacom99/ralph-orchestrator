import { useCallback, useEffect, useRef, useState } from "react";
import type { Loop } from "../api/types";
import { api } from "../api/client";
import { useWebSocket } from "./useWebSocket";

const POLL_FAST = 5_000;
const POLL_SLOW = 30_000;

export function useLoops() {
  const [loops, setLoops] = useState<Loop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestIdRef.current;
    try {
      const data = await api.listLoops();
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

  // WebSocket — any event triggers a refresh.
  const { connected: wsConnected } = useWebSocket({
    onEvent: () => refresh(),
  });

  // Adaptive polling: slow when WS connected, fast as fallback.
  useEffect(() => {
    refresh();
    const interval = wsConnected ? POLL_SLOW : POLL_FAST;
    const timer = setInterval(refresh, interval);
    return () => clearInterval(timer);
  }, [refresh, wsConnected]);

  return { loops, loading, error, refresh, wsConnected };
}
