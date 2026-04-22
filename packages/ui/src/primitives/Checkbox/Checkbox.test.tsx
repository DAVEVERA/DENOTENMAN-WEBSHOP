import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("renders a checkbox element", () => {
    render(<Checkbox label="Akkoord" />);
    expect(screen.getByRole("checkbox", { name: "Akkoord" })).toBeInTheDocument();
  });

  it("is keyboard focusable", async () => {
    render(<Checkbox label="Akkoord" />);
    await userEvent.tab();
    expect(screen.getByRole("checkbox")).toHaveFocus();
  });

  it("toggles checked state on Space key", async () => {
    render(<Checkbox label="Akkoord" />);
    const checkbox = screen.getByRole("checkbox");
    checkbox.focus();
    await userEvent.keyboard(" ");
    expect(checkbox).toBeChecked();
  });

  it("is disabled when disabled prop is set", () => {
    render(<Checkbox label="Akkoord" disabled />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("does not toggle when disabled", async () => {
    render(<Checkbox label="Akkoord" disabled />);
    const checkbox = screen.getByRole("checkbox");
    await userEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("sets aria-invalid on error", () => {
    render(<Checkbox label="Akkoord" error="Verplicht" />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("renders error message with role alert", () => {
    render(<Checkbox label="Akkoord" error="U dient akkoord te gaan" />);
    expect(screen.getByRole("alert")).toHaveTextContent("U dient akkoord te gaan");
  });

  it("points aria-describedby at error element", () => {
    render(<Checkbox label="Akkoord" id="agree" error="Verplicht" />);
    const cb = screen.getByRole("checkbox");
    expect(cb.getAttribute("aria-describedby")).toContain("agree-error");
  });

  it("associates label with checkbox", () => {
    render(<Checkbox label="Nieuwsbrief ontvangen" id="newsletter" />);
    expect(screen.getByLabelText("Nieuwsbrief ontvangen")).toBeInTheDocument();
  });
});
