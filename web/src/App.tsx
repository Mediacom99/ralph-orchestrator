import { useEffect, useState } from "react";
import { useLoops } from "./hooks/useLoops";
import LoopList from "./components/LoopList";
import NewLoopForm from "./components/NewLoopForm";
import AuthPrompt from "./components/AuthPrompt";

export default function App() {
  const { loops, loading, error, refresh, wsConnected } = useLoops();
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    const handler = () => setNeedsAuth(true);
    window.addEventListener("ralph:auth-required", handler);
    return () => window.removeEventListener("ralph:auth-required", handler);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {needsAuth && (
        <AuthPrompt
          onAuthenticated={() => {
            setNeedsAuth(false);
            refresh();
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Ralph Orchestrator</h1>
          <span
            className={`inline-block w-2 h-2 rounded-full ${wsConnected ? "bg-emerald-500" : "bg-gray-500"}`}
            title={wsConnected ? "WebSocket connected" : "WebSocket disconnected"}
          />
        </div>
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
