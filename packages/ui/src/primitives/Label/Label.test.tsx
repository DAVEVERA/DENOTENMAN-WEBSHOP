import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Label } from "./Label";

describe("Label", () => {
  it("renders as a label element", () => {
    render(<Label>Naam</Label>);
    expect(screen.getByText("Naam").tagName.toLowerCase()).toBe("label");
  });

  it("associates with an input via htmlFor", () => {
    render(
      <>
        <Label htmlFor="test-input">Naam</Label>
        <input id="test-input" />
      </>,
    );
    expect(screen.getByLabelText("Naam")).toBeInTheDocument();
  });

  it("renders required indicator when required prop is set", () => {
    render(<Label required>Veld</Label>);
    expect(screen.getByText("*", { exact: false })).toBeInTheDocument();
  });

  it("hides required indicator from screen readers", () => {
    render(<Label required>Veld</Label>);
    const asterisk = screen.getByText("*", { exact: false }).closest("span");
    expect(asterisk).toHaveAttribute("aria-hidden", "true");
  });

  it("applies font-medium class", () => {
    render(<Label>Label tekst</Label>);
    expect(screen.getByText("Label tekst")).toHaveClass("font-medium");
  });
});
