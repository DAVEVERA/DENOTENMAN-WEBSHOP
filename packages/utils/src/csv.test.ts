import { describe, it, expect } from "vitest";
import { parseCsv, stringifyCsv } from "./csv.js";

describe("parseCsv", () => {
  it("parses a simple single-row csv", () => {
    expect(parseCsv("a,b,c")).toEqual([["a", "b", "c"]]);
  });

  it("parses multiple rows with LF", () => {
    expect(parseCsv("a,b\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("parses multiple rows with CRLF", () => {
    expect(parseCsv("a,b\r\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("handles quoted fields", () => {
    expect(parseCsv('"hello world",b')).toEqual([["hello world", "b"]]);
  });

  it("handles escaped quotes inside quoted fields", () => {
    expect(parseCsv('"say ""hi""",b')).toEqual([['say "hi"', "b"]]);
  });

  it("handles quoted field containing delimiter", () => {
    expect(parseCsv('"a,b",c')).toEqual([["a,b", "c"]]);
  });

  it("handles quoted field containing newline", () => {
    expect(parseCsv('"line1\nline2",b')).toEqual([["line1\nline2", "b"]]);
  });

  it("handles empty fields", () => {
    expect(parseCsv("a,,c")).toEqual([["a", "", "c"]]);
  });

  it("respects custom delimiter", () => {
    expect(parseCsv("a;b;c", { delimiter: ";" })).toEqual([["a", "b", "c"]]);
  });

  it("returns empty array for empty string", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("handles trailing newline gracefully", () => {
    const result = parseCsv("a,b\nc,d\n");
    expect(result).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("stringifyCsv", () => {
  it("joins rows with newlines", () => {
    expect(
      stringifyCsv([
        ["a", "b"],
        ["c", "d"],
      ]),
    ).toBe("a,b\nc,d");
  });

  it("quotes fields containing the delimiter", () => {
    expect(stringifyCsv([["a,b", "c"]])).toBe('"a,b",c');
  });

  it("quotes fields containing double quotes and escapes them", () => {
    expect(stringifyCsv([['say "hi"']])).toBe('"say ""hi"""');
  });

  it("quotes fields containing newlines", () => {
    expect(stringifyCsv([["line1\nline2"]])).toBe('"line1\nline2"');
  });

  it("does not quote plain fields", () => {
    expect(stringifyCsv([["hello", "world"]])).toBe("hello,world");
  });

  it("handles empty fields", () => {
    expect(stringifyCsv([["a", "", "c"]])).toBe("a,,c");
  });

  it("round-trips through parseCsv", () => {
    const original = [
      ["name", "price"],
      ["Hazelnoot, 50g", "1,75"],
      ['say "hi"', "0,99"],
    ];
    const csv = stringifyCsv(original);
    expect(parseCsv(csv)).toEqual(original);
  });
});
