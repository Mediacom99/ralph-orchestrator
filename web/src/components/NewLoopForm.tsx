import { useState } from "react";
import { api } from "../api/client";

interface NewLoopFormProps {
  onCreated: () => void;
}

export default function NewLoopForm({ onCreated }: NewLoopFormProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [autoStart, setAutoStart] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.createLoop({ git_url: url.trim(), auto_start: autoStart });
      setUrl("");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create loop");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg cursor-pointer"
      >
        + New Loop
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3"
    >
      <div>
        <label className="block text-xs text-gray-400 mb-1">
          Git repository URL
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/user/repo.git"
          required
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input
          type="checkbox"
          checked={autoStart}
          onChange={(e) => setAutoStart(e.target.checked)}
          className="rounded"
        />
        Auto-start after cloning
      </label>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded cursor-pointer disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create"}
        </button>
        <button
          type="button"
          onClick={() => { setUrl(""); setAutoStart(true); setError(""); setOpen(false); }}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
