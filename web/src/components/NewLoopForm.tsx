import { useState } from "react";
import { api } from "../api/client";
import { addToast } from "../hooks/useToast";

interface NewLoopFormProps {
  onCreated: () => void;
  onClose: () => void;
}

export function NewLoopForm({ onCreated, onClose }: NewLoopFormProps) {
  const [url, setUrl] = useState("");
  const [autoStart, setAutoStart] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || submitting) return;
    setSubmitting(true);
    try {
      await api.createLoop({ git_url: url.trim(), auto_start: autoStart });
      addToast("success", "Loop created successfully");
      onCreated();
      onClose();
    } catch (err) {
      addToast(
        "error",
        err instanceof Error ? err.message : "Failed to create loop",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Git URL
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo.git"
          className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          autoFocus
        />
      </div>
      <label className="flex items-center gap-2 mb-6 cursor-pointer">
        <input
          type="checkbox"
          checked={autoStart}
          onChange={(e) => setAutoStart(e.target.checked)}
          className="rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-300">
          Start automatically after cloning
        </span>
      </label>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!url.trim() || submitting}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating..." : "Create Loop"}
        </button>
      </div>
    </form>
  );
}
