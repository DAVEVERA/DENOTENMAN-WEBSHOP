import { describe, it, expect } from "vitest";
import { slugify } from "./slug.js";

describe("slugify", () => {
  it("lowercases input", () => {
    expect(slugify("Hazelnoot")).toBe("hazelnoot");
  });

  it("replaces spaces with hyphens", () => {
    expect(slugify("gemengde noten")).toBe("gemengde-noten");
  });

  it("collapses multiple spaces into a single hyphen", () => {
    expect(slugify("noten  mix")).toBe("noten-mix");
  });

  it("strips diacritics", () => {
    expect(slugify("Pépé")).toBe("pepe");
  });

  it("strips diacritics — Dutch chars", () => {
    expect(slugify("brûlée")).toBe("brulee");
  });

  it("removes special characters", () => {
    expect(slugify("noten & zaden!")).toBe("noten-zaden");
  });

  it("collapses consecutive hyphens", () => {
    expect(slugify("noten--mix")).toBe("noten-mix");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  -noten- ")).toBe("noten");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("handles string with only special chars", () => {
    expect(slugify("!@#$%")).toBe("");
  });

  it("keeps numbers", () => {
    expect(slugify("noten 500g")).toBe("noten-500g");
  });

  it("handles already-valid slug unchanged", () => {
    expect(slugify("hazelnoot-50g")).toBe("hazelnoot-50g");
  });
});
