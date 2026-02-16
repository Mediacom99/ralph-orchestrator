interface ProgressBarProps {
  percentage: number;
  done: number;
  total: number;
}

export default function ProgressBar({ percentage, done, total }: ProgressBarProps) {
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{Math.round(Math.max(0, Math.min(percentage, 100)))}%</span>
        <span>
          {done}/{total} tasks
        </span>
      </div>
      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${Math.max(0, Math.min(percentage, 100))}%` }}
        />
      </div>
    </div>
  );
}
