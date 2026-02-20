import type { Loop, SettingsResponse } from "./types";

const BASE = "/api";
const REQUEST_TIMEOUT_MS = 30_000;
const TOKEN_KEY = "ralph_api_token";

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const token = getToken();
    const res = await fetch(BASE + path, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: {
        ...(init?.body != null ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...Object.fromEntries(new Headers(init?.headers)),
      },
    });
    if (res.status === 401) {
      clearToken();
      window.dispatchEvent(new CustomEvent("ralph:auth-required"));
      throw new Error("Unauthorized");
    }
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

  getLogs: (id: string, lines = 100, signal?: AbortSignal) =>
    request<{ content: string }>(`/loops/${id}/logs?lines=${lines}`, { signal }),

  getSettings: () => request<SettingsResponse>("/settings"),

  updateSettings: (data: { github_token?: string; anthropic_api_key?: string }) =>
    request<SettingsResponse>("/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
