import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { Input } from "./Input";

describe("Input", () => {
  it("renders a text input", () => {
    render(<Input label="Naam" />);
    expect(screen.getByRole("textbox", { name: "Naam" })).toBeInTheDocument();
  });

  it("associates label with input via htmlFor/id", () => {
    render(<Input label="E-mailadres" id="email" />);
    expect(screen.getByLabelText("E-mailadres")).toHaveAttribute("id", "email");
  });

  it("is keyboard focusable", async () => {
    render(<Input label="Naam" />);
    await userEvent.tab();
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("accepts typed input", async () => {
    render(<Input label="Naam" />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "Jan");
    expect(input).toHaveValue("Jan");
  });

  it("shows aria-invalid when error is provided", () => {
    render(<Input label="Naam" error="Dit veld is verplicht" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("points aria-describedby at the error element", () => {
    render(<Input label="Naam" id="name-field" error="Foutmelding" />);
    const input = screen.getByRole("textbox");
    const errorId = `${input.id}-error`;
    expect(input.getAttribute("aria-describedby")).toContain(errorId);
    expect(document.getElementById(errorId)).toHaveTextContent("Foutmelding");
  });

  it("points aria-describedby at the hint element", () => {
    render(<Input label="Naam" id="name-hint" hint="Voer uw volledige naam in" />);
    const input = screen.getByRole("textbox");
    const hintId = `${input.id}-hint`;
    expect(input.getAttribute("aria-describedby")).toContain(hintId);
  });

  it("is disabled when the disabled prop is set", () => {
    render(<Input label="Naam" disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("does not accept input when disabled", async () => {
    render(<Input label="Naam" disabled />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "Jan");
    expect(input).toHaveValue("");
  });

  it("renders error message with role alert", () => {
    render(<Input label="Naam" error="Verplicht veld" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Verplicht veld");
  });

  it("applies error border class when error is set", () => {
    render(<Input label="Naam" error="Fout" />);
    expect(screen.getByRole("textbox")).toHaveClass("border-danger");
  });
});
