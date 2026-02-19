import { useEffect, useState } from "react";
import { api } from "../api/client";

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [currentToken, setCurrentToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api.getSettings().then((s) => {
      setCurrentToken(s.github_token);
      setHasToken(s.has_github_token);
    }).catch(() => {
      setError("Failed to load settings");
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const res = await api.updateSettings({ github_token: newToken.trim() });
      setCurrentToken(res.github_token);
      setHasToken(res.has_github_token);
      setNewToken("");
      setSuccess("Token saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const res = await api.updateSettings({ github_token: "" });
      setCurrentToken(res.github_token);
      setHasToken(res.has_github_token);
      setNewToken("");
      setSuccess("Token cleared");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white cursor-pointer"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              GitHub Personal Access Token
            </label>
            {hasToken && (
              <p className="text-xs text-gray-500 mb-1">
                Current: <span className="font-mono">{currentToken}</span>
              </p>
            )}
            <input
              type="password"
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
              placeholder={hasToken ? "Enter new token to replace" : "ghp_..."}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Used for cloning private HTTPS repositories.
            </p>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
          {success && <p className="text-xs text-emerald-400">{success}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !newToken.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            {hasToken && (
              <button
                type="button"
                onClick={handleClear}
                disabled={saving}
                className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white text-sm rounded cursor-pointer disabled:opacity-50"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded cursor-pointer"
            >
              Close
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
