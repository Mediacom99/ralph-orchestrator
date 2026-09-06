import type { Loop } from "../api/types";
import { StatusBadge } from "./StatusBadge";
import { ProgressBar } from "./ProgressBar";
import { PlayIcon, StopIcon, ChevronRightIcon, ClockIcon } from "./icons";

interface LoopCardProps {
  loop: Loop;
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  acting: string | null;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

const canStartStatuses = new Set(["stopped", "failed", "complete", "error"]);
const canStopStatuses = new Set(["running", "cloning"]);

export function LoopCard({
  loop,
  onSelect,
  onStart,
  onStop,
  acting,
}: LoopCardProps) {
  const isActing = acting === loop.id;

  return (
    <div
      onClick={() => onSelect(loop.id)}
      className="group rounded-xl border border-gray-800 bg-gray-900 hover:border-gray-700 hover:bg-gray-900/80 p-5 cursor-pointer transition-colors"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white truncate">
            {loop.repo_name}
          </h3>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {loop.git_url}
          </p>
        </div>
        <StatusBadge status={loop.status} />
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 mb-3">
        {loop.ralph_status && (
          <>
            <span>Loop {loop.ralph_status.loop_count}</span>
            <span>{loop.ralph_status.calls_made} calls</span>
          </>
        )}
        {loop.progress && loop.progress.elapsed_seconds > 0 && (
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="w-3 h-3" />
            {formatElapsed(loop.progress.elapsed_seconds)}
          </span>
        )}
      </div>

      {/* Progress */}
      {loop.progress && loop.progress.tasks_total > 0 && (
        <div className="mb-3">
          <ProgressBar
            percentage={loop.progress.percentage}
            done={loop.progress.tasks_done}
            total={loop.progress.tasks_total}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-800/50">
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {canStartStatuses.has(loop.status) && (
            <button
              onClick={() => onStart(loop.id)}
              disabled={isActing}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 disabled:opacity-50"
            >
              <PlayIcon className="w-3.5 h-3.5" />
              Start
            </button>
          )}
          {canStopStatuses.has(loop.status) && (
            <button
              onClick={() => onStop(loop.id)}
              disabled={isActing}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-600/20 text-red-400 hover:bg-red-600/30 disabled:opacity-50"
            >
              <StopIcon className="w-3.5 h-3.5" />
              Stop
            </button>
          )}
        </div>
        <ChevronRightIcon className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
      </div>
    </div>
  );
}
