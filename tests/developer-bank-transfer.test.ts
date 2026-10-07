import assert from "node:assert/strict";
import test from "node:test";

import { epcQrPayload, groupIban, isValidIban, normalizeIban, paymentReference, plainAmount } from "../lib/developer-portal/bank-transfer";

test("an IBAN is checked the way a bank does", () => {
  assert.equal(isValidIban("NL91 ABNA 0417 1643 00"), true);
  assert.equal(isValidIban("nl91abna0417164300"), true);
  assert.equal(isValidIban("NL91 ABNA 0417 1643 01"), false, "one wrong digit");
  assert.equal(isValidIban("NL00BANK0123456789"), false, "wrong check digits");
  assert.equal(isValidIban("NL91ABNA04171643"), false, "too short for a Dutch IBAN");
  assert.equal(isValidIban("BE68 5390 0754 7034"), true, "Belgian IBANs work too");
  assert.equal(isValidIban(""), false);
  assert.equal(isValidIban("1234"), false);
  assert.equal(normalizeIban(" nl91 abna 0417 1643 00 "), "NL91ABNA0417164300");
  assert.equal(groupIban("NL91ABNA0417164300"), "NL91 ABNA 0417 1643 00");
});

test("the reference is the invoice numbers and never longer than a transfer allows", () => {
  assert.equal(paymentReference(["MNRV-2026-001", " MNRV-2026-002 "]), "MNRV-2026-001, MNRV-2026-002");
  assert.equal(paymentReference([]), "");
  const long = paymentReference(Array.from({ length: 30 }, (_, index) => `MNRV-2026-${String(index).padStart(3, "0")}`));
  assert.equal(long.length, 140);
  assert.ok(long.endsWith("..."));
});

test("the QR code holds the EPC fields in the order a bank app reads them", () => {
  const payload = epcQrPayload({ name: "MNRV", iban: "NL91 ABNA 0417 1643 00", amountCents: 121_050, reference: "MNRV-2026-001, MNRV-2026-002" });
  assert.deepEqual(payload?.split("\n"), ["BCD", "002", "1", "SCT", "", "MNRV", "NL91ABNA0417164300", "EUR1210.50", "", "", "MNRV-2026-001, MNRV-2026-002", ""]);
});

test("no QR code is made for a payment a bank would refuse", () => {
  const ok = { name: "MNRV", iban: "NL91ABNA0417164300", amountCents: 1_000, reference: "F-1" };
  assert.notEqual(epcQrPayload(ok), null);
  assert.equal(epcQrPayload({ ...ok, iban: "NL00BANK0123456789" }), null);
  assert.equal(epcQrPayload({ ...ok, amountCents: 0 }), null);
  assert.equal(epcQrPayload({ ...ok, amountCents: -5 }), null);
  assert.equal(epcQrPayload({ ...ok, amountCents: 10.5 }), null);
  assert.equal(epcQrPayload({ ...ok, amountCents: 100_000_000_000 }), null);
  const cleaned = epcQrPayload({ ...ok, name: `${"A".repeat(90)}\nB`, reference: "regel 1\nregel 2" })?.split("\n") ?? [];
  assert.equal(cleaned.length, 12, "line breaks in free text cannot shift the fields");
  assert.equal(cleaned[5].length, 70);
  assert.equal(cleaned[10], "regel 1 regel 2");
});

test("the amount is shown the way a bank app wants it typed", () => {
  assert.equal(plainAmount(121_050), "1210,50");
  assert.equal(plainAmount(5), "0,05");
});
