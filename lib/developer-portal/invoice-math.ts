import { z } from "zod";

export const DEVELOPER_VAT_RATES = [0, 9, 21] as const;
export type DeveloperVatRate = (typeof DEVELOPER_VAT_RATES)[number];

/** Days after sending before the first friendly reminder. */
export const FIRST_REMINDER_AFTER_DAYS = 7;
/** Days after the first reminder before the second one. */
export const SECOND_REMINDER_AFTER_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export const developerInvoiceLineSchema = z.object({
  description: z.string().trim().min(1, "Omschrijving is verplicht.").max(300),
  // Hours or pieces, up to two decimals (1,5 uur).
  quantity: z.number().positive("Aantal moet groter zijn dan 0.").max(100_000)
    .refine((value) => Math.round(value * 100) === value * 100, "Gebruik maximaal twee decimalen."),
  unitPriceCents: z.number().int().min(0).max(100_000_000),
  vatRate: z.union([z.literal(0), z.literal(9), z.literal(21)]),
}).strict();

export type DeveloperInvoiceLine = z.infer<typeof developerInvoiceLineSchema>;

export const developerInvoiceInputSchema = z.object({
  title: z.string().trim().min(1, "Geef de factuur een titel.").max(160),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "Kies een factuurdatum."),
  paymentTermDays: z.number().int().min(0).max(120),
  lines: z.array(developerInvoiceLineSchema).min(1, "Voeg ten minste één regel toe.").max(50),
  notes: z.string().trim().max(2_000).nullable(),
}).strict();

export type DeveloperInvoiceInput = z.infer<typeof developerInvoiceInputSchema>;

export type DeveloperInvoiceTotals = {
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  vatByRate: Array<{ rate: DeveloperVatRate; baseCents: number; vatCents: number }>;
};

export function lineAmountCents(line: DeveloperInvoiceLine): number {
  return Math.round(line.quantity * line.unitPriceCents);
}

/** VAT is calculated once per rate over the summed lines, as on a Dutch invoice. */
export function computeDeveloperInvoiceTotals(lines: readonly DeveloperInvoiceLine[]): DeveloperInvoiceTotals {
  const bases = new Map<DeveloperVatRate, number>();
  for (const line of lines) bases.set(line.vatRate, (bases.get(line.vatRate) ?? 0) + lineAmountCents(line));
  const vatByRate = DEVELOPER_VAT_RATES
    .filter((rate) => bases.has(rate))
    .map((rate) => {
      const baseCents = bases.get(rate)!;
      return { rate, baseCents, vatCents: Math.round((baseCents * rate) / 100) };
    });
  const subtotalCents = vatByRate.reduce((sum, row) => sum + row.baseCents, 0);
  const vatCents = vatByRate.reduce((sum, row) => sum + row.vatCents, 0);
  return { subtotalCents, vatCents, totalCents: subtotalCents + vatCents, vatByRate };
}

/** Parses a YYYY-MM-DD date as noon UTC, so it shows as the same day in Amsterdam. */
export function invoiceDateFromInput(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

export function dueDateFor(issueDate: Date, paymentTermDays: number): Date {
  return new Date(issueDate.getTime() + paymentTermDays * DAY_MS);
}

export function formatDeveloperInvoiceNumber(year: number, sequence: number): string {
  return `MNRV-${year}-${String(sequence).padStart(3, "0")}`;
}

export type ReminderState = {
  status: string;
  sentAt: Date | null;
  firstReminderAt: Date | null;
  secondReminderAt: Date | null;
};

/** Which reminder is due now, if any: 7 days after sending, then 14 days after that. */
export function dueReminder(invoice: ReminderState, now: Date): "FIRST" | "SECOND" | null {
  if (invoice.status !== "SENT" || !invoice.sentAt) return null;
  if (!invoice.firstReminderAt) {
    return now.getTime() - invoice.sentAt.getTime() >= FIRST_REMINDER_AFTER_DAYS * DAY_MS ? "FIRST" : null;
  }
  if (!invoice.secondReminderAt) {
    return now.getTime() - invoice.firstReminderAt.getTime() >= SECOND_REMINDER_AFTER_DAYS * DAY_MS ? "SECOND" : null;
  }
  return null;
}

/** NL00BANK0123456789 → NL00 BANK 0123 4567 89, for reading and typing over. */
export function formatIban(iban: string): string {
  return iban.replace(/\s+/gu, "").replace(/(.{4})(?=.)/gu, "$1 ");
}
