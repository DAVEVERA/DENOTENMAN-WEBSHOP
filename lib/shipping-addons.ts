export type AddonCandidate = { id: string; priceCents: number; stock: number };
export type AddonProposal = { id: string; quantity: number; estimatedOverageCents: number };

export function proposeShippingAddons(
  subtotalCents: number,
  thresholdCents: number,
  candidates: AddonCandidate[],
  excludedIds: ReadonlySet<string>,
  limit = 40,
): AddonProposal[] {
  const remaining = thresholdCents - subtotalCents;
  if (remaining <= 0) return [];
  const maximumOverage = Math.min(1000, Math.round(thresholdCents * 0.2));
  return candidates.flatMap((candidate) => {
    if (excludedIds.has(candidate.id) || candidate.priceCents <= 0) return [];
    const quantity = Math.max(1, Math.ceil(remaining / candidate.priceCents));
    if (quantity > 3 || quantity > candidate.stock) return [];
    const overage = candidate.priceCents * quantity - remaining;
    return overage <= maximumOverage ? [{ id: candidate.id, quantity, estimatedOverageCents: overage }] : [];
  }).sort((left, right) => left.estimatedOverageCents - right.estimatedOverageCents || left.quantity - right.quantity || left.id.localeCompare(right.id)).slice(0, limit);
}
