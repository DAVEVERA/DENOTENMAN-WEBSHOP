import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>Actief</Badge>);
    expect(screen.getByText("Actief")).toBeInTheDocument();
  });

  it("applies default variant class", () => {
    render(<Badge>Label</Badge>);
    expect(screen.getByText("Label")).toHaveClass("bg-neutral-100");
  });

  it("applies success variant class", () => {
    render(<Badge variant="success">Geslaagd</Badge>);
    expect(screen.getByText("Geslaagd")).toHaveClass("bg-success-light");
  });

  it("applies danger variant class", () => {
    render(<Badge variant="danger">Fout</Badge>);
    expect(screen.getByText("Fout")).toHaveClass("bg-danger-light");
  });

  it("applies warning variant class", () => {
    render(<Badge variant="warning">Waarschuwing</Badge>);
    expect(screen.getByText("Waarschuwing")).toHaveClass("bg-warning-light");
  });

  it("applies muted variant class", () => {
    render(<Badge variant="muted">Gedimpt</Badge>);
    expect(screen.getByText("Gedimpt")).toHaveClass("text-neutral-500");
  });

  it("accepts additional className", () => {
    render(<Badge className="uppercase">Label</Badge>);
    expect(screen.getByText("Label")).toHaveClass("uppercase");
  });
});
