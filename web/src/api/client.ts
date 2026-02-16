import type { Loop } from "./types";

const BASE = "/api";
const REQUEST_TIMEOUT_MS = 30_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    // B7: Only set Content-Type when the request has a body.
    const res = await fetch(BASE + path, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: {
        ...(init?.body != null ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers as Record<string, string>),
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  listLoops: () => request<Loop[]>("/loops"),

  getLoop: (id: string) => request<Loop>(`/loops/${id}`),

  createLoop: (data: { git_url: string; auto_start?: boolean }) =>
    request<Loop>("/loops", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  startLoop: (id: string) =>
    request<{ status: string }>(`/loops/${id}/start`, { method: "POST" }),

  stopLoop: (id: string) =>
    request<{ status: string }>(`/loops/${id}/stop`, { method: "POST" }),

  deleteLoop: (id: string) =>
    request<void>(`/loops/${id}`, { method: "DELETE" }),

  getLogs: (id: string, lines = 100) =>
    request<{ content: string }>(`/loops/${id}/logs?lines=${lines}`),
};
