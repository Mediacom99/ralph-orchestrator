import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getToken, setToken, clearToken } from "./client";

describe("token management", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores and retrieves token", () => {
    setToken("abc123");
    expect(getToken()).toBe("abc123");
  });

  it("clears token", () => {
    setToken("abc123");
    clearToken();
    expect(getToken()).toBe("");
  });
});

describe("request function", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    localStorage.clear();
  });

  it("adds auth header when token exists", async () => {
    setToken("mytoken");
    let capturedHeaders: Headers | undefined;
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify([]), { status: 200 });
    });

    const { api } = await import("./client");
    await api.listLoops();

    expect(capturedHeaders?.get("Authorization")).toBe("Bearer mytoken");
  });

  it("dispatches auth-required on 401", async () => {
    const eventHandler = vi.fn();
    window.addEventListener("ralph:auth-required", eventHandler);

    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
      });
    });

    const { api } = await import("./client");
    await expect(api.listLoops()).rejects.toThrow("Unauthorized");
    expect(eventHandler).toHaveBeenCalled();

    window.removeEventListener("ralph:auth-required", eventHandler);
  });

  it("handles fetch abort as timeout", async () => {
    // Directly test the error handling path rather than relying on real timers.
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      // Simulate AbortController being triggered.
      const error = new DOMException("The operation was aborted", "AbortError");
      init?.signal?.addEventListener("abort", () => {});
      throw error;
    });

    const { api } = await import("./client");
    await expect(api.listLoops()).rejects.toThrow("Request timed out");
  });
});
