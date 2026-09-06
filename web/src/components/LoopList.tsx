import type { Loop } from "../api/types";
import { LoopCard } from "./LoopCard";
import { SkeletonCard } from "./SkeletonCard";
import { EmptyState } from "./EmptyState";

interface LoopListProps {
  loops: Loop[];
  loading: boolean;
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onNewLoop: () => void;
  acting: string | null;
}

export function LoopList({
  loops,
  loading,
  onSelect,
  onStart,
  onStop,
  onNewLoop,
  acting,
}: LoopListProps) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (loops.length === 0) {
    return <EmptyState onNewLoop={onNewLoop} />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {loops.map((loop) => (
        <LoopCard
          key={loop.id}
          loop={loop}
          onSelect={onSelect}
          onStart={onStart}
          onStop={onStop}
          acting={acting}
        />
      ))}
    </div>
  );
}
