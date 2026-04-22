import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { Select } from "./Select";

describe("Select", () => {
  it("renders a combobox element", () => {
    render(
      <Select label="Categorie">
        <option value="a">Optie A</option>
      </Select>,
    );
    expect(screen.getByRole("combobox", { name: "Categorie" })).toBeInTheDocument();
  });

  it("associates label via htmlFor", () => {
    render(
      <Select label="Categorie" id="cat">
        <option value="a">Noten</option>
      </Select>,
    );
    expect(screen.getByLabelText("Categorie")).toHaveAttribute("id", "cat");
  });

  it("is keyboard focusable", async () => {
    render(
      <Select label="Categorie">
        <option value="a">Optie</option>
      </Select>,
    );
    await userEvent.tab();
    expect(screen.getByRole("combobox")).toHaveFocus();
  });

  it("changes selected value on user interaction", async () => {
    render(
      <Select label="Maat">
        <option value="sm">Klein</option>
        <option value="lg">Groot</option>
      </Select>,
    );
    await userEvent.selectOptions(screen.getByRole("combobox"), "lg");
    expect(screen.getByRole("combobox")).toHaveValue("lg");
  });

  it("sets aria-invalid on error", () => {
    render(
      <Select label="Categorie" error="Kies een categorie">
        <option value="">Kies…</option>
      </Select>,
    );
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-invalid", "true");
  });

  it("points aria-describedby at error element", () => {
    render(
      <Select label="Categorie" id="cat-sel" error="Verplicht">
        <option value="">Kies…</option>
      </Select>,
    );
    const sel = screen.getByRole("combobox");
    expect(sel.getAttribute("aria-describedby")).toContain(`${sel.id}-error`);
  });

  it("is disabled when disabled prop is set", () => {
    render(
      <Select label="Categorie" disabled>
        <option value="a">Optie</option>
      </Select>,
    );
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("renders error message with role alert", () => {
    render(
      <Select label="Categorie" error="Selecteer een waarde">
        <option value="">Kies…</option>
      </Select>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Selecteer een waarde");
  });

  it("applies error border class", () => {
    render(
      <Select label="Categorie" error="Fout">
        <option value="">Kies…</option>
      </Select>,
    );
    expect(screen.getByRole("combobox")).toHaveClass("border-danger");
  });
});
