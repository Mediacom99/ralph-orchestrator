import { useState, useEffect } from "react";
import { api } from "../api/client";
import { addToast } from "../hooks/useToast";
import type { SettingsResponse } from "../api/types";

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then(setSettings)
      .catch(() => addToast("error", "Failed to load settings"));
  }, []);

  async function saveField(
    field: "anthropic_api_key" | "github_token",
    value: string,
  ) {
    setSaving(true);
    try {
      const updated = await api.updateSettings({ [field]: value });
      setSettings(updated);
      if (field === "anthropic_api_key") setAnthropicKey("");
      if (field === "github_token") setGithubToken("");
      addToast("success", value ? "Saved" : "Cleared");
    } catch {
      addToast("error", "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!settings)
    return <div className="text-gray-400 text-sm">Loading settings...</div>;

  return (
    <div className="space-y-6">
      {/* Auth Mode */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-1">
          Authentication Mode
        </h3>
        <p className="text-sm text-gray-500">
          {settings.auth_mode === "none"
            ? "No authentication"
            : settings.auth_mode === "subscription"
              ? "Claude subscription active"
              : "API key configured"}
        </p>
      </div>

      {/* Anthropic API Key */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-2">
          Anthropic API Key
        </h3>
        <p className="text-xs text-gray-500 mb-2">
          {settings.has_anthropic_api_key ? (
            <>
              Key is set{" "}
              <span className="font-mono">{settings.anthropic_api_key}</span>
            </>
          ) : (
            "Not configured"
          )}
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            placeholder="sk-ant-..."
            className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={() => saveField("anthropic_api_key", anthropicKey)}
            disabled={!anthropicKey || saving}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
        {settings.has_anthropic_api_key && (
          <button
            onClick={() => saveField("anthropic_api_key", "")}
            disabled={saving}
            className="mt-2 text-xs text-red-400 hover:text-red-300"
          >
            Clear key
          </button>
        )}
      </div>

      {/* GitHub Token */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-2">
          GitHub Token
        </h3>
        <p className="text-xs text-gray-500 mb-2">
          {settings.has_github_token ? (
            <>
              Token is set{" "}
              <span className="font-mono">{settings.github_token}</span>
            </>
          ) : (
            "Not configured"
          )}
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            placeholder="ghp_..."
            className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={() => saveField("github_token", githubToken)}
            disabled={!githubToken || saving}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
        {settings.has_github_token && (
          <button
            onClick={() => saveField("github_token", "")}
            disabled={saving}
            className="mt-2 text-xs text-red-400 hover:text-red-300"
          >
            Clear token
          </button>
        )}
      </div>

      <div className="pt-4 border-t border-gray-800">
        <button
          onClick={onClose}
          className="w-full px-4 py-2 rounded-lg text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700"
        >
          Close
        </button>
      </div>
    </div>
  );
}
