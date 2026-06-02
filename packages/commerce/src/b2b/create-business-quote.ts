import { calculateTotals, type TotalsLine } from "../pricing/calculate-totals";

export type BusinessQuote = {
  quoteNumber: string;
  accountId: string;
  lines: TotalsLine[];
  totalCents: number;
  expiresAt: string;
};

export function createBusinessQuote(accountId: string, lines: TotalsLine[], sequence = 1): BusinessQuote {
  const expires = new Date();
  expires.setDate(expires.getDate() + 14);
  return {
    quoteNumber: `OFF-${new Date().getFullYear()}-${String(sequence).padStart(4, "0")}`,
    accountId,
    lines,
    totalCents: calculateTotals({ lines }).totalCents,
    expiresAt: expires.toISOString(),
  };
}
