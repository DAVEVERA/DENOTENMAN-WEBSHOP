import { describe, it, expect } from "vitest";
import { formatEuroCents } from "./currency.js";

const NBSP = String.fromCharCode(0x00a0);

describe("formatEuroCents", () => {
  it("formats 175 cents as € 1,75", () => {
    expect(formatEuroCents(175)).toBe("€ 1,75");
  });

  it("formats 0 cents as € 0,00", () => {
    expect(formatEuroCents(0)).toBe("€ 0,00");
  });

  it("formats 100 cents as € 1,00", () => {
    expect(formatEuroCents(100)).toBe("€ 1,00");
  });

  it("formats 1999 cents as € 19,99", () => {
    expect(formatEuroCents(1999)).toBe("€ 19,99");
  });

  it("formats 100000 cents as € 1.000,00", () => {
    expect(formatEuroCents(100000)).toBe("€ 1.000,00");
  });

  it("throws RangeError on negative input", () => {
    expect(() => formatEuroCents(-1)).toThrowError(RangeError);
  });

  it("throws TypeError on float input", () => {
    expect(() => formatEuroCents(1.5)).toThrowError(TypeError);
  });

  it("throws TypeError on NaN", () => {
    expect(() => formatEuroCents(NaN)).toThrowError(TypeError);
  });

  it("does not contain a non-breaking space (U+00A0)", () => {
    const result = formatEuroCents(175);
    expect(result.includes(NBSP)).toBe(false);
  });

  it("uses a regular ASCII space between symbol and amount", () => {
    const result = formatEuroCents(175);
    const spaceIndex = result.indexOf(" ");
    expect(spaceIndex).toBeGreaterThan(-1);
    expect(result.charCodeAt(spaceIndex)).toBe(0x0020);
  });
});
