import { useState } from "react";
import { Modal } from "./Modal";
import { api, setToken, clearToken } from "../api/client";

interface AuthPromptProps {
  onAuthenticated: () => void;
}

export function AuthPrompt({ onAuthenticated }: AuthPromptProps) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setChecking(true);
    setError("");
    setToken(key.trim());
    try {
      await api.listLoops();
      onAuthenticated();
    } catch {
      clearToken();
      setError("Invalid API key");
    } finally {
      setChecking(false);
    }
  }

  return (
    <Modal open title="Authentication Required" onClose={() => {}}>
      <form onSubmit={handleSubmit}>
        <p className="text-sm text-gray-400 mb-4">
          Enter your API key to continue.
        </p>
        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="API key"
          className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
          autoFocus
        />
        <button
          type="submit"
          disabled={!key.trim() || checking}
          className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
        >
          {checking ? "Checking..." : "Sign In"}
        </button>
      </form>
    </Modal>
  );
}
