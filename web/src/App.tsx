import { useLoops } from "./hooks/useLoops";
import LoopList from "./components/LoopList";
import NewLoopForm from "./components/NewLoopForm";

export default function App() {
  const { loops, loading, error, refresh } = useLoops();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Ralph Orchestrator</h1>
        <NewLoopForm onCreated={refresh} />
      </div>

      {/* Status bar */}
      {error && (
        <div className="mb-4 px-4 py-2 bg-red-900/40 border border-red-800 rounded text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Main content */}
      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading...</div>
      ) : (
        <LoopList loops={loops} onRefresh={refresh} />
      )}
    </div>
  );
}
