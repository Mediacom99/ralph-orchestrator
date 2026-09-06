import type { LoopStatus } from "../api/types";

const config: Record<LoopStatus, { label: string; color: string; pulse: boolean }> = {
  cloning: { label: "Cloning", color: "bg-blue-400", pulse: true },
  running: { label: "Running", color: "bg-emerald-400", pulse: true },
  stopped: { label: "Stopped", color: "bg-gray-400", pulse: false },
  complete: { label: "Complete", color: "bg-green-400", pulse: false },
  failed: { label: "Failed", color: "bg-red-400", pulse: false },
  error: { label: "Error", color: "bg-red-400", pulse: false },
};

export function StatusBadge({ status }: { status: LoopStatus }) {
  const { label, color, pulse } = config[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-200 shrink-0">
      <span className={`relative w-2 h-2 rounded-full ${color}`}>
        {pulse && (
          <span
            className={`absolute inset-0 rounded-full ${color} animate-ping opacity-75`}
          />
        )}
      </span>
      {label}
    </span>
  );
}
