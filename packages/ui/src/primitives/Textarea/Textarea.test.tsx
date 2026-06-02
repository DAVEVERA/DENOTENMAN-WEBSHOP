import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { Textarea } from "./Textarea";

describe("Textarea", () => {
  it("renders a textarea element", () => {
    render(<Textarea label="Omschrijving" />);
    expect(screen.getByRole("textbox", { name: "Omschrijving" })).toBeInTheDocument();
  });

  it("associates label with textarea via htmlFor", () => {
    render(<Textarea label="Notities" id="notes" />);
    expect(screen.getByLabelText("Notities")).toHaveAttribute("id", "notes");
  });

  it("is keyboard focusable", async () => {
    render(<Textarea label="Omschrijving" />);
    await userEvent.tab();
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("accepts typed input", async () => {
    render(<Textarea label="Omschrijving" />);
    const ta = screen.getByRole("textbox");
    await userEvent.type(ta, "Testinhoud");
    expect(ta).toHaveValue("Testinhoud");
  });

  it("sets aria-invalid when error prop is provided", () => {
    render(<Textarea label="Omschrijving" error="Verplicht" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("points aria-describedby at the error element", () => {
    render(<Textarea label="Omschrijving" id="desc" error="Te lang" />);
    const ta = screen.getByRole("textbox");
    expect(ta.getAttribute("aria-describedby")).toContain(`${ta.id}-error`);
  });

  it("is disabled when the disabled prop is set", () => {
    render(<Textarea label="Omschrijving" disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("renders error message with role alert", () => {
    render(<Textarea label="Omschrijving" error="Ongeldige invoer" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Ongeldige invoer");
  });

  it("applies error border class when error is set", () => {
    render(<Textarea label="Omschrijving" error="Fout" />);
    expect(screen.getByRole("textbox")).toHaveClass("border-danger");
  });
});
