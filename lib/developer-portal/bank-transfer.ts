// Paying an invoice straight to the developer's bank account: no payment provider, so the
// money is there as soon as the bank books the transfer. These pure helpers check the IBAN,
// build the reference and the QR code that a bank app reads (EPC "SEPA credit transfer" QR,
// also called Girocode): scanning it fills in account, name, amount and reference.

/** IBAN without spaces, upper case. */
export function normalizeIban(value: string): string {
  return value.replace(/\s+/gu, "").toUpperCase();
}

/** Four characters at a time, as printed on a bank card. */
export function groupIban(value: string): string {
  return normalizeIban(value).replace(/(.{4})(?=.)/gu, "$1 ");
}

/** The ISO 7064 mod-97 check that every bank applies; catches a mistyped digit. */
export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/u.test(iban)) return false;
  // Dutch IBANs are exactly 18 characters.
  if (iban.startsWith("NL") && iban.length !== 18) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const character of rearranged) {
    const digits = /\d/u.test(character) ? character : String(character.charCodeAt(0) - 55);
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** What the payer types as description: the invoice numbers, within the 140 characters a transfer allows. */
export function paymentReference(numbers: readonly string[]): string {
  const joined = numbers.map((number) => number.trim()).filter(Boolean).join(", ");
  return joined.length <= 140 ? joined : `${joined.slice(0, 137)}...`;
}

export type EpcInput = { name: string; iban: string; amountCents: number; reference: string };

/**
 * The text inside the QR code (EPC069-12, version 002, UTF-8). Returns null when it cannot
 * be a valid payment: bad IBAN, no amount or an amount above the 999.999.999,99 the format allows.
 */
export function epcQrPayload(input: EpcInput): string | null {
  const iban = normalizeIban(input.iban);
  if (!isValidIban(iban)) return null;
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0 || input.amountCents > 99_999_999_999) return null;
  const clean = (value: string, max: number) => value.replace(/[\r\n]+/gu, " ").trim().slice(0, max);
  const name = clean(input.name, 70) || "Ontwikkelaar";
  const amount = `EUR${(input.amountCents / 100).toFixed(2)}`;
  return [
    "BCD",
    "002",
    "1",
    "SCT",
    "", // BIC is optional within the euro area
    name,
    iban,
    amount,
    "", // purpose code
    "", // structured reference
    clean(input.reference, 140),
    "", // note to the payer
  ].join("\n");
}

/** The amount the way a bank app wants it typed: 1234,50 without a euro sign or thousands separator. */
export function plainAmount(amountCents: number): string {
  return (amountCents / 100).toFixed(2).replace(".", ",");
}
