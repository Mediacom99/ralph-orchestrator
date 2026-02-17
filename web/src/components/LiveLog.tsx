import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";

interface LiveLogProps {
  loopId: string;
  onClose: () => void;
}

export default function LiveLog({ loopId, onClose }: LiveLogProps) {
  const [content, setContent] = useState("Loading...");
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLPreElement>(null);
  // M3: Only auto-scroll when user is at the bottom.
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    const ac = new AbortController();
    const doFetch = () => {
      api.getLogs(loopId, 200, ac.signal)
        .then((data) => { if (active) setContent(data.content || "(empty)"); })
        .catch(() => { if (active) setContent("(no logs available)"); });
    };
    doFetch();
    const t = setInterval(doFetch, 3000);
    return () => { active = false; ac.abort(); clearInterval(t); };
  }, [loopId]);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [content, autoScroll]);

  function handleScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setAutoScroll(atBottom);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <span className="text-sm font-medium text-gray-300">
            Logs — {loopId}
          </span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-sm cursor-pointer"
          >
            Close
          </button>
        </div>
        <pre
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="p-4 overflow-auto flex-1 text-xs text-gray-300 font-mono leading-relaxed whitespace-pre-wrap"
        >
          {content}
          <div ref={bottomRef} />
        </pre>
      </div>
    </div>
  );
}
