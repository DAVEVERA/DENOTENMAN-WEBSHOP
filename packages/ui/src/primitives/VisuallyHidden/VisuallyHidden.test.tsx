import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { VisuallyHidden } from "./VisuallyHidden";

describe("VisuallyHidden", () => {
  it("renders children in the DOM", () => {
    render(<VisuallyHidden>Verborgen tekst</VisuallyHidden>);
    expect(screen.getByText("Verborgen tekst")).toBeInTheDocument();
  });

  it("applies sr-only class for visual hiding", () => {
    render(<VisuallyHidden>Verborgen</VisuallyHidden>);
    const el = screen.getByText("Verborgen");
    expect(el).toHaveClass("sr-only");
  });
});
