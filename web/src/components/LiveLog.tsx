import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../api/client";
import { ArrowDownIcon } from "./icons";

interface LiveLogProps {
  loopId: string;
}

export function LiveLog({ loopId }: LiveLogProps) {
  const [lines, setLines] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    async function fetchLogs() {
      try {
        const data = await api.getLogs(loopId, 200, controller.signal);
        if (mounted) {
          setLines(data.content || "");
          if (atBottom) requestAnimationFrame(scrollToBottom);
        }
      } catch {
        /* ignore abort / network errors */
      }
    }

    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => {
      mounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [loopId, atBottom, scrollToBottom]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setAtBottom(nearBottom);
  }

  return (
    <div className="relative flex flex-col h-64 sm:h-80">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-gray-950 rounded-lg p-3 font-mono text-xs text-gray-300 whitespace-pre-wrap break-all custom-scrollbar"
      >
        {lines || (
          <span className="text-gray-600">Waiting for logs...</span>
        )}
      </div>
      {!atBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-2 right-2 p-1.5 rounded-full bg-gray-800 text-gray-400 hover:text-white shadow-lg"
          title="Jump to bottom"
        >
          <ArrowDownIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
