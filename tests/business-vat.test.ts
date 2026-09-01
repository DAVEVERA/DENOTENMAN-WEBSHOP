import assert from "node:assert/strict";
import test from "node:test";
import { calculateVat, isSupportedBusinessCountry, resolveVat } from "../lib/business-vat";

test("NL resolves to standard 9% VAT", () => {
  const resolution = resolveVat("NL");
  assert.equal(resolution.regime, "STANDARD");
  assert.equal(resolution.ratePercent, 9);
  assert.equal(resolution.invoiceNote, "");
});

test("BE resolves to reverse-charge 0% VAT with an invoice note", () => {
  const resolution = resolveVat("BE");
  assert.equal(resolution.regime, "REVERSE_CHARGE");
  assert.equal(resolution.ratePercent, 0);
  assert.match(resolution.invoiceNote, /verlegd/i);
});

test("country lookup is case-insensitive and trims whitespace", () => {
  assert.equal(resolveVat(" be ").regime, "REVERSE_CHARGE");
  assert.equal(resolveVat("nl").regime, "STANDARD");
});

test("unsupported countries are rejected explicitly", () => {
  assert.throws(() => resolveVat("DE"), /Onbekend land/);
  assert.equal(isSupportedBusinessCountry("DE"), false);
});

test("calculateVat computes the VAT amount and total from an excl.-VAT subtotal", () => {
  const result = calculateVat(10_000, 9);
  assert.equal(result.subtotalCents, 10_000);
  assert.equal(result.vatAmountCents, 900);
  assert.equal(result.totalCents, 10_900);
});

test("calculateVat returns zero VAT for a 0% reverse-charge rate", () => {
  const result = calculateVat(10_000, 0);
  assert.equal(result.vatAmountCents, 0);
  assert.equal(result.totalCents, 10_000);
});

test("calculateVat rounds to the nearest cent", () => {
  const result = calculateVat(333, 9);
  assert.equal(result.vatAmountCents, 30);
  assert.equal(result.totalCents, 363);
});
