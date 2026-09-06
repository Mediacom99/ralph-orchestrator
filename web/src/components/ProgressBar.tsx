interface ProgressBarProps {
  percentage: number;
  done: number;
  total: number;
}

export function ProgressBar({ percentage, done, total }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percentage));
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{Math.round(clamped)}%</span>
        <span>
          {done}/{total} tasks
        </span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
