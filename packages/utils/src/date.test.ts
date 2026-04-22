import { describe, it, expect } from "vitest";
import { formatDateNL, formatDateTimeNL } from "./date.js";

describe("formatDateNL", () => {
  it("formats a Date object", () => {
    const d = new Date("2026-04-22T00:00:00Z");
    const result = formatDateNL(d);
    expect(result).toMatch(/22/);
    expect(result).toMatch(/2026/);
  });

  it("formats an ISO string", () => {
    const result = formatDateNL("2026-04-22T00:00:00Z");
    expect(result).toMatch(/22/);
    expect(result).toMatch(/2026/);
  });

  it("does not include time component", () => {
    const result = formatDateNL("2026-04-22T14:30:00Z");
    expect(result).not.toMatch(/14:30/);
  });

  it("uses Dutch month abbreviation (apr for April)", () => {
    const result = formatDateNL("2026-04-22T12:00:00Z");
    expect(result.toLowerCase()).toMatch(/apr/);
  });
});

describe("formatDateTimeNL", () => {
  it("formats a Date object including time", () => {
    const d = new Date("2026-04-22T14:30:00.000Z");
    const result = formatDateTimeNL(d);
    expect(result).toMatch(/2026/);
  });

  it("formats an ISO string including time", () => {
    const result = formatDateTimeNL("2026-04-22T12:30:00Z");
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it("does include time digits", () => {
    const result = formatDateTimeNL("2026-04-22T14:30:00Z");
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
});
