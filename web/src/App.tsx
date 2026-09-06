import { useState, useCallback, useEffect } from "react";
import { useLoops } from "./hooks/useLoops";
import { api } from "./api/client";
import { addToast } from "./hooks/useToast";
import { Header } from "./components/Header";
import { LoopList } from "./components/LoopList";
import { LoopDetail } from "./components/LoopDetail";
import { NewLoopForm } from "./components/NewLoopForm";
import { SettingsPanel } from "./components/SettingsPanel";
import { AuthPrompt } from "./components/AuthPrompt";
import { Modal } from "./components/Modal";
import { SlideOver } from "./components/SlideOver";
import { ToastContainer } from "./components/Toast";
import type { Loop } from "./api/types";

export default function App() {
  const { loops, loading, error, wsConnected, refresh } = useLoops();
  const [showNewLoop, setShowNewLoop] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const selectedLoop: Loop | undefined = selectedId
    ? loops.find((l) => l.id === selectedId)
    : undefined;

  // Close detail if loop disappears (e.g. deleted)
  useEffect(() => {
    if (selectedId && !loops.find((l) => l.id === selectedId)) {
      setSelectedId(null);
    }
  }, [loops, selectedId]);

  // Listen for auth-required events from API client
  useEffect(() => {
    function handleAuth() {
      setAuthRequired(true);
    }
    window.addEventListener("ralph:auth-required", handleAuth);
    return () => window.removeEventListener("ralph:auth-required", handleAuth);
  }, []);

  // Show errors as toasts
  useEffect(() => {
    if (error) addToast("error", error);
  }, [error]);

  const handleStart = useCallback(
    async (id: string) => {
      setActing(id);
      try {
        await api.startLoop(id);
        addToast("success", "Loop started");
        await refresh();
      } catch (err) {
        addToast(
          "error",
          err instanceof Error ? err.message : "Failed to start",
        );
      } finally {
        setActing(null);
      }
    },
    [refresh],
  );

  const handleStop = useCallback(
    async (id: string) => {
      setActing(id);
      try {
        await api.stopLoop(id);
        addToast("success", "Loop stopped");
        await refresh();
      } catch (err) {
        addToast(
          "error",
          err instanceof Error ? err.message : "Failed to stop",
        );
      } finally {
        setActing(null);
      }
    },
    [refresh],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setActing(id);
      try {
        await api.deleteLoop(id);
        addToast("success", "Loop deleted");
        setSelectedId(null);
        await refresh();
      } catch (err) {
        addToast(
          "error",
          err instanceof Error ? err.message : "Failed to delete",
        );
      } finally {
        setActing(null);
      }
    },
    [refresh],
  );

  if (authRequired) {
    return (
      <AuthPrompt
        onAuthenticated={() => {
          setAuthRequired(false);
          refresh();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Header
        wsConnected={wsConnected}
        onNewLoop={() => setShowNewLoop(true)}
        onSettings={() => setShowSettings(true)}
      />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <LoopList
          loops={loops}
          loading={loading}
          onSelect={setSelectedId}
          onStart={handleStart}
          onStop={handleStop}
          onNewLoop={() => setShowNewLoop(true)}
          acting={acting}
        />
      </main>

      <Modal
        open={showNewLoop}
        onClose={() => setShowNewLoop(false)}
        title="New Loop"
      >
        <NewLoopForm
          onCreated={refresh}
          onClose={() => setShowNewLoop(false)}
        />
      </Modal>

      <SlideOver
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title="Settings"
      >
        <SettingsPanel onClose={() => setShowSettings(false)} />
      </SlideOver>

      <SlideOver
        open={!!selectedLoop}
        onClose={() => setSelectedId(null)}
        title={selectedLoop?.repo_name ?? ""}
        wide
      >
        {selectedLoop && (
          <LoopDetail
            loop={selectedLoop}
            onStart={handleStart}
            onStop={handleStop}
            onDelete={handleDelete}
            acting={acting}
          />
        )}
      </SlideOver>

      <ToastContainer />
    </div>
  );
}
