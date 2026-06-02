export type RefundInput = {
  paidAmountCents: number;
  requestedAmountCents: number;
  alreadyRefundedCents?: number;
};

export function calculateRefundCents(input: RefundInput) {
  const remaining = input.paidAmountCents - (input.alreadyRefundedCents ?? 0);
  if (input.requestedAmountCents <= 0) throw new Error("Refundbedrag is ongeldig.");
  if (input.requestedAmountCents > remaining) throw new Error("Refundbedrag is hoger dan resterend betaald bedrag.");
  return input.requestedAmountCents;
}
