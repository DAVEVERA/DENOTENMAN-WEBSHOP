import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Spinner } from "./Spinner";

describe("Spinner", () => {
  it("renders with role status", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders default Dutch label in sr-only text", () => {
    render(<Spinner />);
    expect(screen.getByText("Laden…")).toBeInTheDocument();
  });

  it("renders custom Dutch label", () => {
    render(<Spinner label="Verwerken…" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Verwerken…");
    expect(screen.getByText("Verwerken…")).toBeInTheDocument();
  });

  it("applies size class for sm", () => {
    render(<Spinner size="sm" />);
    const svg = screen.getByRole("status").querySelector("svg");
    expect(svg).toHaveClass("h-4");
  });

  it("applies size class for lg", () => {
    render(<Spinner size="lg" />);
    const svg = screen.getByRole("status").querySelector("svg");
    expect(svg).toHaveClass("h-8");
  });
});
