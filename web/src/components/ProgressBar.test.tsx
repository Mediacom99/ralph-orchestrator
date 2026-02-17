import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ProgressBar from "./ProgressBar";

describe("ProgressBar", () => {
  it("renders percentage and task count", () => {
    render(<ProgressBar percentage={75} done={3} total={4} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("3/4 tasks")).toBeInTheDocument();
  });

  it("clamps percentage between 0 and 100", () => {
    const { rerender } = render(
      <ProgressBar percentage={150} done={5} total={4} />
    );
    expect(screen.getByText("100%")).toBeInTheDocument();

    rerender(<ProgressBar percentage={-10} done={0} total={4} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
