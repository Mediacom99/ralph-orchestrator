import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { SettingsResponse } from "../api/types";

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [newGhToken, setNewGhToken] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => {
      setError("Failed to load settings");
    });
  }, []);

  async function handleSaveGhToken(e: React.FormEvent) {
    e.preventDefault();
    await save({ github_token: newGhToken.trim() });
    setNewGhToken("");
  }

  async function handleClearGhToken() {
    await save({ github_token: "" });
  }

  async function handleSaveApiKey(e: React.FormEvent) {
    e.preventDefault();
    await save({ anthropic_api_key: newApiKey.trim() });
    setNewApiKey("");
  }

  async function handleClearApiKey() {
    await save({ anthropic_api_key: "" });
  }

  async function save(data: { github_token?: string; anthropic_api_key?: string }) {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const res = await api.updateSettings(data);
      setSettings(res);
      setSuccess("Settings saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const authMode = settings?.auth_mode ?? "none";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Auth Status */}
        <div className="space-y-1">
          <label className="block text-xs text-gray-400 font-medium uppercase tracking-wide">
            Claude Authentication
          </label>
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                authMode === "none" ? "bg-yellow-500" : "bg-emerald-500"
              }`}
            />
            {authMode === "subscription" && (
              <span className="text-emerald-400">Claude subscription active</span>
            )}
            {authMode === "api_key" && (
              <span className="text-emerald-400">
                API key configured
                {settings?.has_anthropic_api_key && (
                  <span className="text-gray-500 font-mono ml-1">
                    ({settings.anthropic_api_key})
                  </span>
                )}
              </span>
            )}
            {authMode === "none" && (
              <span className="text-yellow-400">
                No auth configured &mdash; set an API key or run{" "}
                <code className="text-xs bg-gray-800 px-1 rounded">claude login</code>
              </span>
            )}
          </div>
        </div>

        {/* Anthropic API Key */}
        <form onSubmit={handleSaveApiKey} className="space-y-2">
          <label className="block text-xs text-gray-400">
            Anthropic API Key
          </label>
          {settings?.has_anthropic_api_key && (
            <p className="text-xs text-gray-500">
              Current: <span className="font-mono">{settings.anthropic_api_key}</span>
            </p>
          )}
          <input
            type="password"
            value={newApiKey}
            onChange={(e) => setNewApiKey(e.target.value)}
            placeholder={
              settings?.has_anthropic_api_key
                ? "Enter new key to replace"
                : "sk-ant-..."
            }
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
          <p className="text-xs text-gray-500">
            Optional if using <code className="bg-gray-800 px-1 rounded">claude login</code> subscription auth.
          </p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !newApiKey.trim()}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded cursor-pointer disabled:opacity-50"
            >
              Save
            </button>
            {settings?.has_anthropic_api_key && (
              <button
                type="button"
                onClick={handleClearApiKey}
                disabled={saving}
                className="px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white text-sm rounded cursor-pointer disabled:opacity-50"
              >
                Clear
              </button>
            )}
          </div>
        </form>

        <hr className="border-gray-700" />

        {/* GitHub PAT */}
        <form onSubmit={handleSaveGhToken} className="space-y-2">
          <label className="block text-xs text-gray-400">
            GitHub Personal Access Token
          </label>
          {settings?.has_github_token && (
            <p className="text-xs text-gray-500">
              Current: <span className="font-mono">{settings.github_token}</span>
            </p>
          )}
          <input
            type="password"
            value={newGhToken}
            onChange={(e) => setNewGhToken(e.target.value)}
            placeholder={
              settings?.has_github_token
                ? "Enter new token to replace"
                : "ghp_..."
            }
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
          <p className="text-xs text-gray-500">
            Used for cloning private HTTPS repositories.
          </p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !newGhToken.trim()}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded cursor-pointer disabled:opacity-50"
            >
              Save
            </button>
            {settings?.has_github_token && (
              <button
                type="button"
                onClick={handleClearGhToken}
                disabled={saving}
                className="px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white text-sm rounded cursor-pointer disabled:opacity-50"
              >
                Clear
              </button>
            )}
          </div>
        </form>

        {error && <p className="text-xs text-red-400">{error}</p>}
        {success && <p className="text-xs text-emerald-400">{success}</p>}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
