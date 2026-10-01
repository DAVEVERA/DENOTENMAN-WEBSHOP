// Invoice export: periods (month, quarter, half-year, year) in Dutch time, and CSV rows
// for business invoices and private orders. Pure functions, shared by page and route.

export type ExportPeriodKind = "maand" | "kwartaal" | "halfjaar" | "jaar";

export type ExportPeriod = {
  kind: ExportPeriodKind;
  /** URL value: 2026-09, 2026-Q3, 2026-H2 or 2026. */
  value: string;
  label: string;
  /** Inclusive start and exclusive end, as UTC instants of Amsterdam midnights. */
  from: Date;
  to: Date;
};

const TIME_ZONE = "Europe/Amsterdam";
const monthName = new Intl.DateTimeFormat("nl-NL", { month: "long", timeZone: "UTC" });

function offsetMinutes(instant: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(instant))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return Math.round((asUtc - instant) / 60_000);
}

/** The instant at which a given day starts in Amsterdam (handles summer and winter time). */
export function amsterdamMidnight(year: number, monthIndex: number, day = 1): Date {
  const guess = Date.UTC(year, monthIndex, day);
  let instant = guess - offsetMinutes(guess) * 60_000;
  instant = guess - offsetMinutes(instant) * 60_000;
  return new Date(instant);
}

function amsterdamParts(date: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, year: "numeric", month: "numeric" }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value) - 1,
  };
}

function build(kind: ExportPeriodKind, year: number, index: number): ExportPeriod {
  switch (kind) {
    case "maand": {
      const date = new Date(Date.UTC(year, index, 1));
      return { kind, value: `${year}-${String(index + 1).padStart(2, "0")}`, label: `${monthName.format(date)} ${year}`, from: amsterdamMidnight(year, index), to: amsterdamMidnight(year, index + 1) };
    }
    case "kwartaal":
      return { kind, value: `${year}-Q${index + 1}`, label: `Q${index + 1} ${year}`, from: amsterdamMidnight(year, index * 3), to: amsterdamMidnight(year, index * 3 + 3) };
    case "halfjaar":
      return { kind, value: `${year}-H${index + 1}`, label: `${index === 0 ? "1e" : "2e"} halfjaar ${year}`, from: amsterdamMidnight(year, index * 6), to: amsterdamMidnight(year, index * 6 + 6) };
    case "jaar":
      return { kind, value: String(year), label: String(year), from: amsterdamMidnight(year, 0), to: amsterdamMidnight(year + 1, 0) };
  }
}

/** Parses 2026-09, 2026-Q3, 2026-H2 or 2026; null for anything else. */
export function parseExportPeriod(value: string | null | undefined): ExportPeriod | null {
  if (!value) return null;
  const month = value.match(/^(\d{4})-(\d{2})$/u);
  if (month && Number(month[2]) >= 1 && Number(month[2]) <= 12) return build("maand", Number(month[1]), Number(month[2]) - 1);
  const quarter = value.match(/^(\d{4})-Q([1-4])$/u);
  if (quarter) return build("kwartaal", Number(quarter[1]), Number(quarter[2]) - 1);
  const half = value.match(/^(\d{4})-H([12])$/u);
  if (half) return build("halfjaar", Number(half[1]), Number(half[2]) - 1);
  const year = value.match(/^(\d{4})$/u);
  if (year) return build("jaar", Number(year[1]), 0);
  return null;
}

export const EXPORT_PERIOD_KINDS: Array<{ kind: ExportPeriodKind; label: string; count: number }> = [
  { kind: "maand", label: "Per maand", count: 13 },
  { kind: "kwartaal", label: "Per kwartaal", count: 8 },
  { kind: "halfjaar", label: "Per halfjaar", count: 4 },
  { kind: "jaar", label: "Per jaar", count: 4 },
];

/** The current period first, then earlier ones. */
export function recentPeriods(kind: ExportPeriodKind, now: Date, count: number): ExportPeriod[] {
  const { year, month } = amsterdamParts(now);
  const periods: ExportPeriod[] = [];
  for (let step = 0; step < count; step += 1) {
    if (kind === "maand") {
      const total = year * 12 + month - step;
      periods.push(build(kind, Math.floor(total / 12), total % 12));
    } else if (kind === "kwartaal") {
      const total = year * 4 + Math.floor(month / 3) - step;
      periods.push(build(kind, Math.floor(total / 4), total % 4));
    } else if (kind === "halfjaar") {
      const total = year * 2 + Math.floor(month / 6) - step;
      periods.push(build(kind, Math.floor(total / 2), total % 2));
    } else {
      periods.push(build(kind, year - step, 0));
    }
  }
  return periods;
}

// ---------- VAT for private orders ----------

/** VAT rate on private orders: 6% to Belgium, 9% in the Netherlands (food, low rate). */
export function privateVatRatePercent(country: string): number {
  return country.trim().toUpperCase() === "BE" ? 6 : 9;
}

export type VatBreakdown = { ratePercent: number; subtotalCents: number; vatCents: number; totalCents: number };

/**
 * Consumers pay prices including VAT: the paid total is split into the amount
 * excluding VAT and the VAT itself (shipping follows the rate of the goods).
 */
export function privateOrderVat(country: string, totalCents: number): VatBreakdown {
  const ratePercent = privateVatRatePercent(country);
  const subtotalCents = Math.round((totalCents * 100) / (100 + ratePercent));
  return { ratePercent, subtotalCents, vatCents: totalCents - subtotalCents, totalCents };
}

// ---------- CSV ----------

export type ExportType = "alle" | "zakelijk" | "particulier";

export function csvCell(value: string): string {
  // Quote when needed; a leading =, +, - or @ is defused so spreadsheets never run it as a formula.
  const safe = /^[=+\-@\t\r]/u.test(value) && !/^-?\d+(?:\.\d+)?$/u.test(value) ? `'${value}` : value;
  return /[",;\n\r]/u.test(safe) ? `"${safe.replace(/"/gu, '""')}"` : safe;
}

export function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

function amsterdamDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE }).format(date);
}

export type BusinessInvoiceRow = {
  invoiceNumber: string;
  country: string;
  customerNumber: string | null;
  companyName: string;
  createdAt: Date;
  subtotalCents: number;
  vatRatePercent: number;
  vatAmountCents: number;
  totalCents: number;
  vatRegime: string;
  peppolStatus: string;
};

export type PrivateOrderRow = {
  orderNumber: string;
  country: string;
  contactName: string;
  contactEmail: string;
  createdAt: Date;
  paidAt: Date | null;
  status: string;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  refundedCents: number;
};

const BUSINESS_HEADER = ["Factuurnummer", "Land", "Klantnummer", "Bedrijf", "Factuurdatum", "Subtotaal excl. BTW", "BTW-percentage", "BTW-bedrag", "Totaal incl. BTW", "BTW-regeling", "Peppol-status"];
const PRIVATE_HEADER = ["Bestelnummer", "Land", "Klant", "E-mail", "Besteldatum", "Betaaldatum", "Status", "Korting", "Verzendkosten", "Subtotaal excl. BTW", "BTW-percentage", "BTW-bedrag", "Totaal incl. BTW", "Terugbetaald", "Netto incl. BTW"];
const COMBINED_HEADER = ["Type", "Nummer", "Land", "Klant", "Datum", "Subtotaal excl. BTW", "BTW-percentage", "BTW-bedrag", "Totaal incl. BTW", "Terugbetaald"];

function line(cells: Array<string | number>): string {
  return cells.map((cell) => csvCell(String(cell))).join(",");
}

export function buildInvoiceCsv(type: ExportType, business: BusinessInvoiceRow[], orders: PrivateOrderRow[]): string {
  let rows: string[];
  if (type === "zakelijk") {
    rows = [line(BUSINESS_HEADER), ...business.map((invoice) => line([
      invoice.invoiceNumber, invoice.country, invoice.customerNumber ?? "", invoice.companyName, amsterdamDate(invoice.createdAt),
      centsToAmount(invoice.subtotalCents), String(invoice.vatRatePercent), centsToAmount(invoice.vatAmountCents), centsToAmount(invoice.totalCents),
      invoice.vatRegime === "REVERSE_CHARGE" ? "BTW verlegd" : "Standaard", invoice.peppolStatus,
    ]))];
  } else if (type === "particulier") {
    rows = [line(PRIVATE_HEADER), ...orders.map((order) => {
      const vat = privateOrderVat(order.country, order.totalCents);
      return line([
        order.orderNumber, order.country, order.contactName, order.contactEmail, amsterdamDate(order.createdAt), amsterdamDate(order.paidAt),
        order.status === "FULFILLED" ? "Verzonden" : "Betaald", centsToAmount(order.discountCents), centsToAmount(order.shippingCents),
        centsToAmount(vat.subtotalCents), String(vat.ratePercent), centsToAmount(vat.vatCents), centsToAmount(vat.totalCents),
        centsToAmount(order.refundedCents), centsToAmount(order.totalCents - order.refundedCents),
      ]);
    })];
  } else {
    const combined = [
      ...business.map((invoice) => ({ at: invoice.createdAt, cells: ["Zakelijk", invoice.invoiceNumber, invoice.country, invoice.companyName, amsterdamDate(invoice.createdAt), centsToAmount(invoice.subtotalCents), String(invoice.vatRatePercent), centsToAmount(invoice.vatAmountCents), centsToAmount(invoice.totalCents), centsToAmount(0)] })),
      ...orders.map((order) => {
        const vat = privateOrderVat(order.country, order.totalCents);
        return { at: order.createdAt, cells: ["Particulier", order.orderNumber, order.country, order.contactName, amsterdamDate(order.createdAt), centsToAmount(vat.subtotalCents), String(vat.ratePercent), centsToAmount(vat.vatCents), centsToAmount(vat.totalCents), centsToAmount(order.refundedCents)] };
      }),
    ].sort((left, right) => left.at.getTime() - right.at.getTime());
    rows = [line(COMBINED_HEADER), ...combined.map((row) => line(row.cells))];
  }
  return `﻿${rows.join("\n")}`;
}

export function exportFilename(type: ExportType, country: "NL" | "BE" | null, period: ExportPeriod | null): string {
  return ["facturen", type, country?.toLowerCase() ?? "alle-landen", period?.value.toLowerCase() ?? "alles"].join("-") + ".csv";
}
