import type { Loop } from "../api/types";
import LoopCard from "./LoopCard";

interface LoopListProps {
  loops: Loop[];
  onRefresh: () => Promise<void>;
}

export default function LoopList({ loops, onRefresh }: LoopListProps) {
  if (loops.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-lg">No loops yet</p>
        <p className="text-sm mt-1">
          Add a ralph-enabled git repo to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {loops.map((loop) => (
        <LoopCard key={loop.id} loop={loop} onRefresh={onRefresh} />
      ))}
    </div>
  );
}
