import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LoopCard from "./LoopCard";
import type { Loop } from "../api/types";

function makeLoop(overrides: Partial<Loop> = {}): Loop {
  return {
    id: "abc123",
    git_url: "https://github.com/user/repo.git",
    repo_name: "repo",
    local_path: "/data/repos/repo-abc123",
    status: "stopped",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("LoopCard", () => {
  const noop = async () => {};

  it("renders name, status, and URL", () => {
    render(<LoopCard loop={makeLoop()} onRefresh={noop} />);
    expect(screen.getByText("repo")).toBeInTheDocument();
    expect(screen.getByText("Stopped")).toBeInTheDocument();
    expect(screen.getByText("https://github.com/user/repo.git")).toBeInTheDocument();
  });

  it("shows Start button when stopped", () => {
    render(<LoopCard loop={makeLoop({ status: "stopped" })} onRefresh={noop} />);
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.queryByText("Stop")).not.toBeInTheDocument();
  });

  it("shows Stop button when running", () => {
    render(<LoopCard loop={makeLoop({ status: "running" })} onRefresh={noop} />);
    expect(screen.getByText("Stop")).toBeInTheDocument();
    expect(screen.queryByText("Start")).not.toBeInTheDocument();
  });

  it("shows progress bar when data exists", () => {
    const loop = makeLoop({
      progress: {
        tasks_total: 10,
        tasks_done: 5,
        percentage: 50,
        elapsed_seconds: 120,
      },
    });
    render(<LoopCard loop={loop} onRefresh={noop} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("5/10 tasks")).toBeInTheDocument();
  });
});
