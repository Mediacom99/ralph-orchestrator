export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-32 bg-gray-800 rounded" />
        <div className="h-6 w-20 bg-gray-800 rounded-full" />
      </div>
      <div className="h-4 w-48 bg-gray-800 rounded mb-3" />
      <div className="h-1.5 w-full bg-gray-800 rounded mb-4" />
      <div className="flex gap-2">
        <div className="h-8 w-20 bg-gray-800 rounded-lg" />
        <div className="h-8 w-20 bg-gray-800 rounded-lg" />
      </div>
    </div>
  );
}
