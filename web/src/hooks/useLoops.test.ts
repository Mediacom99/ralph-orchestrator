import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock useWebSocket to avoid actual WebSocket connections.
vi.mock("./useWebSocket", () => ({
  useWebSocket: () => ({ connected: false }),
}));

// Mock the API client.
const mockListLoops = vi.fn();
vi.mock("../api/client", () => ({
  api: {
    listLoops: (...args: unknown[]) => mockListLoops(...args),
  },
  getToken: () => "",
}));

const { useLoops } = await import("./useLoops");

describe("useLoops", () => {
  it("returns loops from API", async () => {
    const loops = [{ id: "a", repo_name: "repo", status: "stopped" }];
    mockListLoops.mockResolvedValue(loops);

    const { result } = renderHook(() => useLoops());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loops).toEqual(loops);
    expect(result.current.error).toBeNull();
  });

  it("handles API error", async () => {
    mockListLoops.mockRejectedValue(new Error("network fail"));

    const { result } = renderHook(() => useLoops());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("network fail");
  });

  it("ignores stale requests", async () => {
    let resolveFirst!: (v: unknown) => void;
    const firstCall = new Promise((r) => { resolveFirst = r; });

    mockListLoops
      .mockReturnValueOnce(firstCall)
      .mockReturnValueOnce(Promise.resolve([{ id: "b" }]));

    const { result } = renderHook(() => useLoops());

    // Trigger a second refresh while first is pending.
    await act(async () => {
      await result.current.refresh();
    });

    // Now resolve the first (stale) request.
    await act(async () => {
      resolveFirst([{ id: "a" }]);
      // Wait for microtask to flush.
      await new Promise((r) => setTimeout(r, 10));
    });

    // Should have the second result, not the first.
    expect(result.current.loops).toEqual([{ id: "b" }]);
  });
});
