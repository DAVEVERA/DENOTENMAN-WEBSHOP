const formatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// U+00A0 NON-BREAKING SPACE that Intl.NumberFormat may emit between the
// currency symbol and the amount. Using String.fromCharCode avoids a
// literal non-printable character in source.
const NBSP = String.fromCharCode(0x00a0);

export function formatEuroCents(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new TypeError(`cents must be an integer, got ${cents}`);
  }
  if (cents < 0) {
    throw new RangeError(`cents must be non-negative, got ${cents}`);
  }

  const formatted = formatter.format(cents / 100);
  return formatted.split(NBSP).join(" ");
}
