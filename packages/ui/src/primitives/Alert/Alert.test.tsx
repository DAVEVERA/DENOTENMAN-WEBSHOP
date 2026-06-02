import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Alert, AlertTitle, AlertDescription } from "./Alert";

describe("Alert", () => {
  it("renders with role alert", () => {
    render(<Alert>Melding</Alert>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("applies info variant class by default", () => {
    render(<Alert>Info</Alert>);
    expect(screen.getByRole("alert")).toHaveClass("bg-info-light");
  });

  it("applies success variant class", () => {
    render(<Alert variant="success">Gelukt</Alert>);
    expect(screen.getByRole("alert")).toHaveClass("bg-success-light");
  });

  it("applies warning variant class", () => {
    render(<Alert variant="warning">Let op</Alert>);
    expect(screen.getByRole("alert")).toHaveClass("bg-warning-light");
  });

  it("applies danger variant class", () => {
    render(<Alert variant="danger">Fout</Alert>);
    expect(screen.getByRole("alert")).toHaveClass("bg-danger-light");
  });

  it("renders AlertTitle as h5", () => {
    render(
      <Alert>
        <AlertTitle>Titel</AlertTitle>
      </Alert>,
    );
    expect(screen.getByRole("heading", { name: "Titel" })).toBeInTheDocument();
  });

  it("renders AlertDescription", () => {
    render(
      <Alert>
        <AlertDescription>Beschrijving van de melding</AlertDescription>
      </Alert>,
    );
    expect(screen.getByText("Beschrijving van de melding")).toBeInTheDocument();
  });

  it("composes title and description correctly", () => {
    render(
      <Alert variant="danger">
        <AlertTitle>Betaling mislukt</AlertTitle>
        <AlertDescription>Controleer uw betaalgegevens en probeer opnieuw.</AlertDescription>
      </Alert>,
    );
    expect(screen.getByRole("heading", { name: "Betaling mislukt" })).toBeInTheDocument();
    expect(
      screen.getByText("Controleer uw betaalgegevens en probeer opnieuw."),
    ).toBeInTheDocument();
  });
});
