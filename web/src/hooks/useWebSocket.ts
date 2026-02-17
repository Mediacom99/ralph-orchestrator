import { useEffect, useRef, useState } from "react";
import { getToken } from "../api/client";

interface WSEvent {
  type: string;
  loop_id: string;
  data?: unknown;
}

interface UseWebSocketOptions {
  loopId?: string;
  onEvent?: (event: WSEvent) => void;
}

export function useWebSocket(opts: UseWebSocketOptions = {}) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | undefined>(undefined);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    let disposed = false;

    function connect() {
      if (disposed) return;

      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      const params = new URLSearchParams();
      const token = getToken();
      if (token) params.set("token", token);
      if (optsRef.current.loopId) params.set("loop_id", optsRef.current.loopId);
      const qs = params.toString();
      const url = `${proto}//${location.host}/ws${qs ? `?${qs}` : ""}`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!disposed) setConnected(true);
      };

      ws.onmessage = (e) => {
        try {
          const event: WSEvent = JSON.parse(e.data);
          optsRef.current.onEvent?.(event);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!disposed) {
          setConnected(false);
          reconnectTimer.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [opts.loopId]);

  return { connected };
}
