import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import NewLoopForm from "./NewLoopForm";

describe("NewLoopForm", () => {
  it("opens and closes form", () => {
    render(<NewLoopForm onCreated={vi.fn()} />);
    expect(screen.queryByPlaceholderText(/github/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("+ New Loop"));
    expect(screen.getByPlaceholderText(/github/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByPlaceholderText(/github/i)).not.toBeInTheDocument();
  });

  it("resets state on cancel", () => {
    render(<NewLoopForm onCreated={vi.fn()} />);
    fireEvent.click(screen.getByText("+ New Loop"));

    const input = screen.getByPlaceholderText(/github/i);
    fireEvent.change(input, { target: { value: "https://test.com/repo.git" } });
    expect(input).toHaveValue("https://test.com/repo.git");

    fireEvent.click(screen.getByText("Cancel"));
    fireEvent.click(screen.getByText("+ New Loop"));
    expect(screen.getByPlaceholderText(/github/i)).toHaveValue("");
  });
});
