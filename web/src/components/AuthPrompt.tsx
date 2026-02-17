import { useState } from "react";
import { setToken } from "../api/client";
import { api } from "../api/client";

interface AuthPromptProps {
  onAuthenticated: () => void;
}

export default function AuthPrompt({ onAuthenticated }: AuthPromptProps) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setChecking(true);
    try {
      setToken(key.trim());
      await api.listLoops();
      onAuthenticated();
    } catch {
      setError("Invalid API key");
      setToken("");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-sm space-y-4"
      >
        <h2 className="text-lg font-semibold text-white">Authentication Required</h2>
        <div>
          <label className="block text-xs text-gray-400 mb-1">API Key</label>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Enter your API key"
            required
            autoFocus
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={checking}
          className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded cursor-pointer disabled:opacity-50"
        >
          {checking ? "Checking..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
