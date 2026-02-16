import { useEffect, useRef, useState } from "react";
import type { Loop, LoopStatus } from "../api/types";
import { api } from "../api/client";
import ProgressBar from "./ProgressBar";
import LiveLog from "./LiveLog";

const statusConfig: Record<LoopStatus, { label: string; color: string }> = {
  cloning: { label: "Cloning", color: "bg-blue-500" },
  running: { label: "Running", color: "bg-emerald-500" },
  stopped: { label: "Stopped", color: "bg-gray-500" },
  complete: { label: "Complete", color: "bg-green-500" },
  failed: { label: "Failed", color: "bg-red-500" },
  error: { label: "Error", color: "bg-red-500" },
};

interface LoopCardProps {
  loop: Loop;
  onRefresh: () => Promise<void>;
}

export default function LoopCard({ loop, onRefresh }: LoopCardProps) {
  const [showLogs, setShowLogs] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const status = statusConfig[loop.status] ?? statusConfig.error;

  // B6: await onRefresh() so buttons stay disabled until fresh data arrives.
  async function handleStart() {
    setActing(true);
    setError(null);
    try {
      await api.startLoop(loop.id);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : "Action failed");
    }
    await onRefresh();
    if (mountedRef.current) setActing(false);
  }

  async function handleStop() {
    setActing(true);
    setError(null);
    try {
      await api.stopLoop(loop.id);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : "Action failed");
    }
    await onRefresh();
    if (mountedRef.current) setActing(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete loop ${loop.repo_name}? This removes the cloned repo.`))
      return;
    setActing(true);
    setError(null);
    try {
      await api.deleteLoop(loop.id);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : "Action failed");
    }
    await onRefresh();
    if (mountedRef.current) setActing(false);
  }

  const isRunning = loop.status === "running";
  const canStart = loop.status === "stopped" || loop.status === "failed" || loop.status === "complete";

  function formatElapsed(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }

  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white truncate">
                {loop.repo_name}
              </h3>
              <span className="text-xs text-gray-500 shrink-0">{loop.id}</span>
            </div>
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {loop.git_url}
            </p>
          </div>
          <span
            className={`${status.color} text-white text-xs px-2 py-0.5 rounded-full shrink-0`}
          >
            {status.label}
          </span>
        </div>

        {/* Stats */}
        {loop.ralph_status && (
          <div className="flex gap-4 text-xs text-gray-400">
            <span>Loop #{loop.ralph_status.loop_count}</span>
            <span>Calls: {loop.ralph_status.calls_made}</span>
            {loop.progress && loop.progress.elapsed_seconds > 0 && (
              <span>{formatElapsed(loop.progress.elapsed_seconds)}</span>
            )}
          </div>
        )}

        {/* Progress */}
        {loop.progress && loop.progress.tasks_total > 0 && (
          <ProgressBar
            percentage={loop.progress.percentage}
            done={loop.progress.tasks_done}
            total={loop.progress.tasks_total}
          />
        )}

        {/* Error */}
        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {canStart && (
            <button
              onClick={handleStart}
              disabled={acting}
              className="text-xs px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer disabled:opacity-50"
            >
              Start
            </button>
          )}
          {isRunning && (
            <button
              onClick={handleStop}
              disabled={acting}
              className="text-xs px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded cursor-pointer disabled:opacity-50"
            >
              Stop
            </button>
          )}
          <button
            onClick={() => setShowLogs(true)}
            className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded cursor-pointer"
          >
            Logs
          </button>
          <div className="flex-1" />
          <button
            onClick={handleDelete}
            disabled={acting}
            className="text-xs px-2 py-1 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded cursor-pointer disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {showLogs && (
        <LiveLog loopId={loop.id} onClose={() => setShowLogs(false)} />
      )}
    </>
  );
}
