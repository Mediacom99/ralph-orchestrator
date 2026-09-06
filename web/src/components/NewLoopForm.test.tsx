import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { NewLoopForm } from "./NewLoopForm";

describe("NewLoopForm", () => {
  it("renders form fields", () => {
    render(<NewLoopForm onCreated={vi.fn()} onClose={vi.fn()} />);
    expect(
      screen.getByPlaceholderText(/github\.com/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Start automatically after cloning"),
    ).toBeInTheDocument();
  });

  it("disables submit when URL is empty", () => {
    render(<NewLoopForm onCreated={vi.fn()} onClose={vi.fn()} />);
    const submit = screen.getByText("Create Loop");
    expect(submit).toBeDisabled();
  });

  it("calls onClose when cancel is clicked", () => {
    const onClose = vi.fn();
    render(<NewLoopForm onCreated={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });
});
