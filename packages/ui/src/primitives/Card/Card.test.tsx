import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./Card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Inhoud</Card>);
    expect(screen.getByText("Inhoud")).toBeInTheDocument();
  });

  it("applies border and background classes", () => {
    const { container } = render(<Card>Test</Card>);
    expect(container.firstChild).toHaveClass("border-neutral-200", "bg-white");
  });

  it("renders CardTitle as an h3", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Producttitel</CardTitle>
        </CardHeader>
      </Card>,
    );
    const heading = screen.getByRole("heading", { name: "Producttitel" });
    expect(heading.tagName.toLowerCase()).toBe("h3");
  });

  it("renders CardDescription as a paragraph", () => {
    render(
      <Card>
        <CardHeader>
          <CardDescription>Omschrijving</CardDescription>
        </CardHeader>
      </Card>,
    );
    expect(screen.getByText("Omschrijving")).toBeInTheDocument();
  });

  it("renders CardContent with correct padding class", () => {
    const { container } = render(
      <Card>
        <CardContent>Inhoud</CardContent>
      </Card>,
    );
    const content = container.querySelector(".p-6");
    expect(content).toBeInTheDocument();
  });

  it("renders CardFooter", () => {
    render(
      <Card>
        <CardFooter>Voettekst</CardFooter>
      </Card>,
    );
    expect(screen.getByText("Voettekst")).toBeInTheDocument();
  });

  it("composes all sub-components correctly", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Walnoten</CardTitle>
          <CardDescription>Premium kwaliteit</CardDescription>
        </CardHeader>
        <CardContent>Prijs: €8,95</CardContent>
        <CardFooter>
          <button>Toevoegen</button>
        </CardFooter>
      </Card>,
    );
    expect(screen.getByRole("heading", { name: "Walnoten" })).toBeInTheDocument();
    expect(screen.getByText("Premium kwaliteit")).toBeInTheDocument();
    expect(screen.getByText("Prijs: €8,95")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toevoegen" })).toBeInTheDocument();
  });
});
