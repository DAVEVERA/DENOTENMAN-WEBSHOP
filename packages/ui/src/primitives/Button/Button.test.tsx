import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders as a button element with the correct role", () => {
    render(<Button>Opslaan</Button>);
    expect(screen.getByRole("button", { name: "Opslaan" })).toBeInTheDocument();
  });

  it("is keyboard focusable", async () => {
    render(<Button>Focus mij</Button>);
    const btn = screen.getByRole("button");
    await userEvent.tab();
    expect(btn).toHaveFocus();
  });

  it("calls onClick on Enter key", async () => {
    const handler = vi.fn();
    render(<Button onClick={handler}>Bevestigen</Button>);
    const btn = screen.getByRole("button");
    btn.focus();
    await userEvent.keyboard("{Enter}");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("calls onClick on Space key", async () => {
    const handler = vi.fn();
    render(<Button onClick={handler}>Bevestigen</Button>);
    const btn = screen.getByRole("button");
    btn.focus();
    await userEvent.keyboard(" ");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("is disabled when the disabled prop is set", () => {
    render(<Button disabled>Uitgeschakeld</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("does not fire onClick when disabled", async () => {
    const handler = vi.fn();
    render(
      <Button disabled onClick={handler}>
        Niet klikbaar
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("shows loading state with aria-busy", () => {
    render(<Button loading>Laden</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toBeDisabled();
  });

  it("applies primary variant class", () => {
    render(<Button variant="primary">Primair</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-brand-green");
  });

  it("applies destructive variant class", () => {
    render(<Button variant="destructive">Verwijderen</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-danger");
  });

  it("applies sm size class", () => {
    render(<Button size="sm">Klein</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-8");
  });

  it("applies lg size class", () => {
    render(<Button size="lg">Groot</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-12");
  });

  it("renders as child element with asChild prop", () => {
    render(
      <Button asChild>
        <a href="/test">Link knop</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Link knop" })).toBeInTheDocument();
  });
});
