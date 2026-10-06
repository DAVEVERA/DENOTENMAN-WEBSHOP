import type { Prisma } from "@prisma/client";

// Internal order hand-off in the admin: "verwerkt" for every paid order and, for market
// pickups, "staat klaar". Pure rules so they can be tested; the route and the list use them.
// Deliberately separate from OrderStatus: FULFILLED mails the customer and needs a tracking
// code, ticking a box in the list must not.

export type HandlingOrder = {
  status: string;
  isTest: boolean;
  deliveryMethod: "SHIPPING" | "PICKUP";
  processedAt: Date | null;
  readyForPickupAt: Date | null;
};

export type HandlingInput = { processed?: boolean; readyForPickup?: boolean };

export type HandlingUpdate = {
  processedAt?: Date | null;
  processedByName?: string | null;
  readyForPickupAt?: Date | null;
  readyForPickupByName?: string | null;
};

export type HandlingResult =
  | { ok: true; data: HandlingUpdate }
  | { ok: false; error: "NOT_HANDLEABLE" | "NOT_A_PICKUP" | "NO_FIELDS" };

/** Only paid orders (and shipped ones) that are not test orders are handled by hand. */
export function isHandleable(order: Pick<HandlingOrder, "status" | "isTest">): boolean {
  return !order.isTest && (order.status === "PAID" || order.status === "FULFILLED");
}

export function applyHandling(order: HandlingOrder, input: HandlingInput, adminName: string, now: Date): HandlingResult {
  if (input.processed === undefined && input.readyForPickup === undefined) return { ok: false, error: "NO_FIELDS" };
  if (!isHandleable(order)) return { ok: false, error: "NOT_HANDLEABLE" };
  if (input.readyForPickup !== undefined && order.deliveryMethod !== "PICKUP") return { ok: false, error: "NOT_A_PICKUP" };

  const data: HandlingUpdate = {};
  // Ticking something that is already ticked keeps the original person and time.
  if (input.processed === true && !order.processedAt) Object.assign(data, { processedAt: now, processedByName: adminName });
  if (input.processed === false) Object.assign(data, { processedAt: null, processedByName: null });
  if (input.readyForPickup === true && !order.readyForPickupAt) Object.assign(data, { readyForPickupAt: now, readyForPickupByName: adminName });
  if (input.readyForPickup === false) Object.assign(data, { readyForPickupAt: null, readyForPickupByName: null });
  return { ok: true, data };
}

export const HANDLING_FILTERS = ["te-verwerken", "verwerkt", "klaar-te-zetten", "staat-klaar"] as const;
export type HandlingFilter = (typeof HANDLING_FILTERS)[number];

export function parseHandlingFilter(value: string | undefined): HandlingFilter | null {
  return HANDLING_FILTERS.find((filter) => filter === value) ?? null;
}

export const HANDLING_FILTER_LABELS: Record<HandlingFilter, string> = {
  "te-verwerken": "Te verwerken",
  verwerkt: "Verwerkt",
  "klaar-te-zetten": "Afhaling: klaar te zetten",
  "staat-klaar": "Afhaling: staat klaar",
};

const PAID = { in: ["PAID", "FULFILLED"] as ("PAID" | "FULFILLED")[] };

/** Prisma `where` for a list filter; every filter only looks at paid, non-test orders. */
export function handlingWhere(filter: HandlingFilter): Prisma.OrderWhereInput {
  const base = { isTest: false, status: PAID };
  switch (filter) {
    case "te-verwerken":
      return { ...base, processedAt: null };
    case "verwerkt":
      return { ...base, processedAt: { not: null } };
    case "klaar-te-zetten":
      return { ...base, deliveryMethod: "PICKUP" as const, processedAt: null, readyForPickupAt: null };
    case "staat-klaar":
      return { ...base, deliveryMethod: "PICKUP" as const, readyForPickupAt: { not: null } };
  }
}

export function describeHandled(at: Date | null, byName: string | null, format: (date: Date) => string): string | null {
  if (!at) return null;
  return byName ? `${byName}, ${format(at)}` : `automatisch, ${format(at)}`;
}
