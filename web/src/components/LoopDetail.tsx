import { useState } from "react";
import type { Loop } from "../api/types";
import { StatusBadge } from "./StatusBadge";
import { ProgressBar } from "./ProgressBar";
import { LiveLog } from "./LiveLog";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  PlayIcon,
  StopIcon,
  TrashIcon,
  ExternalLinkIcon,
  ClockIcon,
} from "./icons";

interface LoopDetailProps {
  loop: Loop;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
  acting: string | null;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

const canStart = new Set(["stopped", "failed", "complete", "error"]);
const canStop = new Set(["running", "cloning"]);

export function LoopDetail({
  loop,
  onStart,
  onStop,
  onDelete,
  acting,
}: LoopDetailProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isActing = acting === loop.id;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <StatusBadge status={loop.status} />
          {loop.pid && (
            <span className="text-xs text-gray-500">PID {loop.pid}</span>
          )}
        </div>
        <h3 className="text-xl font-bold text-white mb-1">{loop.repo_name}</h3>
        <a
          href={loop.git_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
        >
          {loop.git_url}
          <ExternalLinkIcon className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Timestamps */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500 block text-xs">Created</span>
          <span className="text-gray-300">{formatDate(loop.created_at)}</span>
        </div>
        {loop.started_at && (
          <div>
            <span className="text-gray-500 block text-xs">Started</span>
            <span className="text-gray-300">
              {formatDate(loop.started_at)}
            </span>
          </div>
        )}
        {loop.stopped_at && (
          <div>
            <span className="text-gray-500 block text-xs">Stopped</span>
            <span className="text-gray-300">
              {formatDate(loop.stopped_at)}
            </span>
          </div>
        )}
      </div>

      {/* Ralph Status */}
      {loop.ralph_status && (
        <div className="rounded-lg bg-gray-800/50 p-4">
          <h4 className="text-sm font-medium text-gray-300 mb-3">
            Ralph Status
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500 block text-xs">Loop Count</span>
              <span className="text-white font-medium">
                {loop.ralph_status.loop_count}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">Calls Made</span>
              <span className="text-white font-medium">
                {loop.ralph_status.calls_made}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">
                Max Calls/Hour
              </span>
              <span className="text-white font-medium">
                {loop.ralph_status.max_calls_per_hour}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">Status</span>
              <span className="text-white font-medium">
                {loop.ralph_status.status}
              </span>
            </div>
            {loop.ralph_status.exit_reason && (
              <div className="col-span-2">
                <span className="text-gray-500 block text-xs">
                  Exit Reason
                </span>
                <span className="text-yellow-400 font-medium">
                  {loop.ralph_status.exit_reason}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress */}
      {loop.progress && loop.progress.tasks_total > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-300">Progress</h4>
            {loop.progress.elapsed_seconds > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <ClockIcon className="w-3 h-3" />
                {formatElapsed(loop.progress.elapsed_seconds)}
              </span>
            )}
          </div>
          <ProgressBar
            percentage={loop.progress.percentage}
            done={loop.progress.tasks_done}
            total={loop.progress.tasks_total}
          />
          {loop.progress.last_output && (
            <p className="mt-2 text-xs text-gray-500 truncate">
              {loop.progress.last_output}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {canStart.has(loop.status) && (
          <button
            onClick={() => onStart(loop.id)}
            disabled={isActing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
          >
            <PlayIcon className="w-4 h-4" />
            Start
          </button>
        )}
        {canStop.has(loop.status) && (
          <button
            onClick={() => onStop(loop.id)}
            disabled={isActing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
          >
            <StopIcon className="w-4 h-4" />
            Stop
          </button>
        )}
        <button
          onClick={() => setConfirmDelete(true)}
          disabled={isActing}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 hover:bg-gray-700 text-red-400 disabled:opacity-50 ml-auto"
        >
          <TrashIcon className="w-4 h-4" />
          Delete
        </button>
      </div>

      {/* Logs */}
      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-2">Logs</h4>
        <LiveLog loopId={loop.id} />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => onDelete(loop.id)}
        title="Delete Loop"
        message={`Are you sure you want to delete "${loop.repo_name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
